/**
 * PullRequestScreen — orchestre la revue d'une PR.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import MetricsDashboard from '../components/MetricsDashboard';
import CodeCityView from '../components/CodeCityView';
import FindingsList from '../components/FindingsList';
import AiSummary from '../components/AiSummary';
import DependencyGraph from '../components/DependencyGraph';
import MobileDiffView from '../components/MobileDiffView';
import MiniMap from '../components/MiniMap';
import ReviewStatusIndicator from '../components/ReviewStatusIndicator';
import { useTheme } from '../services/theme';
import {
  hasGithubToken,
  buildPrDetailFromGithub,
  parsePrUrl,
} from '../services/githubApi';
import {
  enrichPrDetailWithBackend,
  pingBackend,
} from '../services/backendApi';
import { startScan, isScanning, subscribeScans } from '../services/scanTracker';
import { useTranslation } from 'react-i18next';

const TABS = [
  { key: 'overview', label: 'Aperçu', icon: 'dashboard' },
  { key: 'map', label: 'Carte', icon: 'grid-view' },
  { key: 'minimap', label: 'Minimap', icon: 'map' },
  { key: 'diff', label: 'Diff', icon: 'compare-arrows' },
  { key: 'graph', label: 'Graphe', icon: 'hub' },
  { key: 'findings', label: 'Findings', icon: 'warning' },
];

const EMPTY_PR = {
  id: '',
  title: '',
  author: '',
  repository: '',
  url: '',
  status: 'pending',
  branch: '',
  baseBranch: '',
  description: '',
  aiSummary: '',
  summary: {
    qualityGate: 'NONE',
    bugs: 0,
    vulnerabilities: 0,
    codeSmells: 0,
    securityHotspots: 0,
    coverage: null,
    impactedFilesCount: 0,
    criticalFindings: 0,
    linesAdded: 0,
    linesRemoved: 0,
  },
  impactedFiles: [],
  findings: [],
  callGraph: { nodes: [], edges: [] },
  diffHunks: [],
};

const PullRequestScreen = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { prId, url, repository } = route?.params || {};
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [pr, setPr] = useState(EMPTY_PR);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [tabIndex, setTabIndex] = useState(0);
  const [diffFocus, setDiffFocus] = useState(null); // { filePath, line } | null
  const [minimapFocus, setMinimapFocus] = useState(null); // filePath | null
  const [findingsFilter, setFindingsFilter] = useState('ALL');
  const [scanning, setScanning] = useState(false);
  const [pagerHeight, setPagerHeight] = useState(0);
  const scrollRef = useRef(null);
  const wasScanning = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErrorMsg(null);
      try {
        if (!(await hasGithubToken())) {
          setErrorMsg('Connecte-toi à GitHub pour voir cette pull request.');
          return;
        }
        // Try to derive owner/repo/number from url or repository+prId
        let ref = parsePrUrl(url);
        if (!ref && repository && prId) {
          const [owner, repo] = repository.split('/');
          ref = { owner, repo, number: parseInt(prId, 10) };
        }
        if (!ref) {
          setErrorMsg('Pull request introuvable.');
          return;
        }
        // 1. GitHub → métadonnées + diff
        const detail = await buildPrDetailFromGithub(ref.owner, ref.repo, ref.number);
        if (cancelled) return;

        // 2. Backend → métriques scan (Sonar + CodeQL/SARIF + call graph)
        //    Best-effort : si le backend est down ou la PR pas encore scannée,
        //    on garde les données GitHub seules (findings/summary vides).
        const projectUrl = `https://github.com/${ref.owner}/${ref.repo}`;
        const enriched = await enrichPrDetailWithBackend(
          detail,
          projectUrl,
          String(ref.number)
        );
        if (cancelled) return;

        setPr(enriched);
      } catch (e) {
        console.log('[PR] fetch failed:', e);
        if (!cancelled) {
          setErrorMsg('Erreur de connexion — impossible de charger la pull request.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prId, url, repository]);

  const findingsByLine = useMemo(() => {
    const map = {};
    (pr.findings || []).forEach((f) => {
      const path = f.location?.filePath;
      const line = f.location?.startLine;
      if (!path || !line) return;
      if (!map[path]) map[path] = {};
      if (!map[path][line]) map[path][line] = [];
      map[path][line].push(f);
    });
    return map;
  }, [pr.findings]);

  // Drive the horizontal scroll from the tabIndex state. Using a dedicated
  // effect ensures the ScrollView is measured with the right width before
  // we scroll, which fixes the "clicks don't land on the right tab" bug.
  useEffect(() => {
    if (width > 0) {
      scrollRef.current?.scrollTo({ x: tabIndex * width, animated: true });
    }
  }, [tabIndex, width]);

  const setTab = (idx) => setTabIndex(idx);

  const onScrollEnd = (e) => {
    if (width <= 0) return;
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    if (idx !== tabIndex) setTabIndex(idx);
  };

  const prCoords = () => {
    const [owner, repo] = String(pr.repository || '').split('/');
    const number = parseInt(pr.id, 10);
    if (!owner || !repo || !number) return null;
    return { owner, repo, number, projectUrl: `https://github.com/${owner}/${repo}` };
  };

  const refreshDetail = async (owner, repo, number) => {
    const projectUrl = `https://github.com/${owner}/${repo}`;
    const detail = await buildPrDetailFromGithub(owner, repo, number);
    const enriched = await enrichPrDetailWithBackend(detail, projectUrl, String(number));
    setPr(enriched);
  };

  const handleTriggerScan = async () => {
    const c = prCoords();
    if (!c) return;
    setScanning(true);
    wasScanning.current = true;
    try {
      await startScan(c.projectUrl, String(c.number));
    } catch (e) {
      setScanning(false);
      wasScanning.current = false;
      Alert.alert('Échec', e?.message || 'Impossible de lancer le scan.');
    }
  };

  useEffect(() => {
    const c = prCoords();
    if (!c) return undefined;
    const sync = () => {
      const now = isScanning(c.projectUrl, String(c.number));
      if (wasScanning.current && !now) {
        refreshDetail(c.owner, c.repo, c.number).catch(() => {});
      }
      wasScanning.current = now;
      setScanning(now);
    };
    sync();
    return subscribeScans(sync);
  }, [pr.id, pr.repository]);

  const showEvalNotice = () => Alert.alert(t('evalTitle'), t('evalMessage'));

  const handleApprove = () => showEvalNotice();

  const handleRequestChanges = () => showEvalNotice();

  const handleComment = () => showEvalNotice();

  const handleCommentFinding = () => showEvalNotice();

  // Tap sur un fichier (carte) → minimap sur ce fichier
  const handleFilePress = (file) => {
    if (file?.path) setMinimapFocus(file.path);
    setTab(2);
  };

  // Double-tap sur minimap OU bouton "Voir le diff" → diff sur le fichier+ligne
  const handleOpenDiffFromMap = (file, line) => {
    setDiffFocus(file?.path ? { filePath: file.path, line } : null);
    setTab(3);
  };

  const clearDiffFocus = () => setDiffFocus(null);

  const handleViewFindingDiff = (f) => {
    const fp = f?.location?.filePath;
    if (fp) {
      const base = fp.split('/').pop();
      const match = (pr.impactedFiles || []).find(
        (imp) =>
          imp.path === fp ||
          imp.path.endsWith('/' + fp) ||
          fp.endsWith('/' + imp.path) ||
          imp.path.split('/').pop() === base
      );
      setDiffFocus({
        filePath: match ? match.path : fp,
        line: f.location.startLine || null,
      });
    }
    setTab(3);
  };

  const metricToFilter = {
    bugs: 'BUG',
    vulnerabilities: 'SECURITY',
    securityHotspots: 'SECURITY',
    codeSmells: 'SMELL',
    qualityGate: 'ALL',
  };

  const handleMetricPress = (metricKey) => {
    switch (metricKey) {
      case 'impactedFiles':
        setTab(1);
        break;
      case 'coverage':
        break;
      default:
        setFindingsFilter(metricToFilter[metricKey] || 'ALL');
        setTab(5);
    }
  };

  const handleCommentLine = () => showEvalNotice();

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={styles.loaderText}>Récupération des fichiers et du diff…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (errorMsg) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <View style={styles.loaderWrap}>
          <Icon name="cloud-off" size={40} color={colors.textFaint} />
          <Text style={[styles.loaderText, { marginTop: 10 }]}>{errorMsg}</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginTop: 16 }}>
            <Text style={{ color: colors.accent, fontWeight: '700' }}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header — zone passive */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Retour"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.prNumber}>
            #{pr.id} · {pr.repository.split('/').pop()}
          </Text>
          <Text style={styles.prTitle} numberOfLines={1}>{pr.title}</Text>
          <View style={styles.metaRow}>
            <Icon name="person" size={12} color={colors.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>{pr.author}</Text>
          </View>
          <View style={styles.metaRow}>
            <Icon name="call-split" size={12} color={colors.textMuted} />
            <Text style={[styles.metaText, { flex: 1 }]} numberOfLines={1}>
              {pr.branch} → {pr.baseBranch}
            </Text>
          </View>
        </View>
        <ReviewStatusIndicator status={pr.status} compact />
      </View>

      <AiSummary summary={pr.aiSummary} />

      {pr.id ? (
        <View style={styles.scanBar}>
          {scanning ? (
            <>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.scanText}>Scan en cours…</Text>
            </>
          ) : pr.scanned === false ? (
            <>
              <Icon name="radar" size={16} color={colors.textMuted} />
              <Text style={styles.scanText}>Pas encore scanné</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={handleTriggerScan} style={styles.scanBtn}>
                <Icon name="play-arrow" size={16} color="#fff" />
                <Text style={styles.scanBtnText}>Scanner</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Icon name="check-circle" size={16} color="#66BB6A" />
              <Text style={styles.scanText}>Analysé</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={handleTriggerScan} style={styles.scanBtnGhost}>
                <Icon name="refresh" size={16} color={colors.accent} />
                <Text style={styles.scanBtnGhostText}>Relancer l'analyse</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      ) : null}

      {/* Onglets */}
      <View style={styles.tabsBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsBarContent}
        >
          {TABS.map((tab, idx) => {
            const active = idx === tabIndex;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setTab(idx)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityLabel={`Onglet ${tab.label}`}
                accessibilityRole="tab"
              >
                <Icon name={tab.icon} size={18} color={active ? colors.accent : colors.textFaint} />
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Contenu avec swipe */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.pager}
        onLayout={(e) => setPagerHeight(e.nativeEvent.layout.height)}
        contentOffset={{ x: tabIndex * width, y: 0 }}
      >
        <View style={{ width, height: pagerHeight || undefined }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 96 }}>
            <View style={styles.descriptionCard}>
              <Text style={styles.descriptionLabel}>DESCRIPTION</Text>
              <Text style={styles.descriptionText}>{pr.description}</Text>
            </View>
            <MetricsDashboard summary={pr.summary} onMetricPress={handleMetricPress} />
          </ScrollView>
        </View>
        <View style={{ width, height: pagerHeight || undefined }}>
          <CodeCityView files={pr.impactedFiles} onFilePress={handleFilePress} />
        </View>
        <View style={{ width, height: pagerHeight || undefined }}>
          <MiniMap
            files={pr.impactedFiles}
            findings={pr.findings}
            focusFilePath={minimapFocus}
            onOpenDiff={handleOpenDiffFromMap}
          />
        </View>
        <View style={{ width, height: pagerHeight || undefined }}>
          <MobileDiffView
            hunks={pr.diffHunks}
            onCommentLine={handleCommentLine}
            findingsByLine={findingsByLine}
            focusFile={diffFocus?.filePath}
            focusLine={diffFocus?.line}
            onClearFocus={clearDiffFocus}
          />
        </View>
        <View style={{ width, height: pagerHeight || undefined }}>
          <DependencyGraph graph={pr.callGraph} />
        </View>
        <View style={{ width, height: pagerHeight || undefined }}>
          <FindingsList
            findings={pr.findings}
            initialFilter={findingsFilter}
            onComment={handleCommentFinding}
            onViewDiff={handleViewFindingDiff}
            onMarkSeen={(f) => Alert.alert('Marqué vu', f.title)}
          />
        </View>
      </ScrollView>

      {/* Barre d'actions */}
      <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.requestBtn]}
          onPress={handleRequestChanges}
          accessibilityLabel="Demander des modifications"
        >
          <Icon name="feedback" size={20} color="#FFF" />
          <Text style={styles.actionBtnText}>Modifs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.commentBtn]}
          onPress={handleComment}
          accessibilityLabel="Commenter la pull request"
        >
          <Icon name="comment" size={20} color="#FFF" />
          <Text style={styles.actionBtnText}>Commenter</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.approveBtn]}
          onPress={handleApprove}
          accessibilityLabel="Approuver la pull request"
        >
          <Icon name="check-circle" size={20} color="#FFF" />
          <Text style={styles.actionBtnText}>Approuver</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const makeStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scanBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 12,
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    scanText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
    scanBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.accent,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
    },
    scanBtnText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '700',
    },
    scanBtnGhost: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.accent,
    },
    scanBtnGhostText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '700',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: 44,
      height: 44,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 4,
    },
    headerInfo: {
      flex: 1,
    },
    prNumber: {
      color: colors.textMuted,
      fontSize: 11,
    },
    prTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: 'bold',
      marginTop: 2,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    metaText: {
      color: colors.textMuted,
      fontSize: 11,
      marginLeft: 4,
    },
    aiBanner: {
      backgroundColor: isDark ? 'rgba(255, 213, 79, 0.08)' : 'rgba(255, 213, 79, 0.22)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 213, 79, 0.35)',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    aiHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    aiLabel: {
      color: isDark ? '#FFD54F' : '#B8860B',
      fontSize: 10,
      fontWeight: 'bold',
      letterSpacing: 0.8,
      marginLeft: 4,
    },
    aiText: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 17,
    },
    tabsBar: {
      backgroundColor: colors.bg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tabsBarContent: {
      paddingHorizontal: 4,
      alignItems: 'center',
    },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      minHeight: 48,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: {
      borderBottomColor: colors.accent,
    },
    tabLabel: {
      color: colors.textFaint,
      fontSize: 13,
      marginLeft: 6,
      fontWeight: '600',
    },
    tabLabelActive: {
      color: colors.accent,
    },
    pager: {
      flex: 1,
    },
    descriptionCard: {
      margin: 16,
      padding: 14,
      backgroundColor: colors.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    descriptionLabel: {
      color: colors.textMuted,
      fontSize: 10,
      letterSpacing: 0.8,
      marginBottom: 6,
      fontWeight: 'bold',
    },
    descriptionText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 19,
    },
    actionBar: {
      flexDirection: 'row',
      paddingHorizontal: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.bg,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 56,
      borderRadius: 10,
      marginHorizontal: 4,
    },
    actionBtnText: {
      color: '#FFF',
      fontWeight: '700',
      fontSize: 13,
      marginLeft: 6,
    },
    requestBtn: {
      backgroundColor: '#FB8C00',
    },
    commentBtn: {
      backgroundColor: '#546E7A',
    },
    approveBtn: {
      backgroundColor: '#66BB6A',
    },
    loaderWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    loaderText: {
      color: colors.textMuted,
      marginTop: 12,
      fontSize: 13,
      textAlign: 'center',
    },
  });

export default PullRequestScreen;

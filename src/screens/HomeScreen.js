import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  qualityGateColors,
  severityColors,
  statusColors,
} from '../data/reviewColors';
import { useTheme } from '../services/theme';
import { useAuth } from '../services/context';
import { hasGithubToken, listMyOpenPullRequests } from '../services/githubApi';
import { enrichPrCardWithMetrics } from '../services/backendApi';

const statusLabel = {
  pending: 'En attente',
  in_progress: 'En cours',
  approved: 'Approuvée',
  changes_requested: 'Modifs demandées',
  rejected: 'Rejetée',
};

const HomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('toReview');
  const [prs, setPrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  const loadPrs = useCallback(async () => {
    setErrorMsg(null);
    try {
      if (!(await hasGithubToken())) {
        setPrs([]);
        setErrorMsg('Connecte-toi à GitHub pour voir tes pull requests.');
        return;
      }
      const base = await listMyOpenPullRequests();
      const enriched = await Promise.all(base.map(enrichPrCardWithMetrics));
      setPrs(enriched);
    } catch (e) {
      console.log('[Home] failed to load PRs:', e);
      setPrs([]);
      setErrorMsg('Erreur de connexion — impossible de charger les pull requests.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadPrs().finally(() => setLoading(false));
  }, [loadPrs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPrs();
    setRefreshing(false);
  };

  const myLogin = user?.login;
  const toReview = prs.filter(
    (p) => p.status === 'pending' || p.status === 'changes_requested'
  );
  const mine = prs.filter((p) =>
    myLogin ? p.author === myLogin : p.isMine || p.author === 'amozzon'
  );

  const displayed = (filter === 'toReview' ? toReview : mine)
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id));

  const renderPr = ({ item }) => {
    const gateColor = qualityGateColors[item.summary.qualityGate] || '#757575';
    const statusColor = statusColors[item.status] || '#888';

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.prCard}
        onPress={() =>
          navigation.navigate('PullRequest', {
            prId: item.id,
            url: item.url,
            repository: item.repository,
          })
        }
      >
        <View style={styles.prCardHeader}>
          <View style={[styles.gateStripe, { backgroundColor: gateColor }]} />
          <Text style={styles.prNumber}>#{item.id}</Text>
          <View style={[styles.statusPill, { backgroundColor: statusColor + '33', borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {statusLabel[item.status] || item.status}
            </Text>
          </View>
        </View>

        <Text style={styles.prTitle} numberOfLines={2}>{item.title}</Text>

        <View style={styles.prMeta}>
          <Icon name="person" size={12} color={colors.textMuted} />
          <Text style={styles.prMetaText}>{item.author}</Text>
          <Icon name="source" size={12} color={colors.textMuted} style={{ marginLeft: 10 }} />
          <Text style={styles.prMetaText} numberOfLines={1}>
            {item.repository.split('/').pop()}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Icon name="bug-report" size={14} color={item.summary.bugs > 0 ? severityColors.HIGH : colors.textFaint} />
            <Text style={[styles.statText, item.summary.bugs > 0 && styles.statTextAlert]}>
              {item.summary.bugs}
            </Text>
          </View>
          <View style={styles.stat}>
            <Icon name="security" size={14} color={item.summary.vulnerabilities > 0 ? severityColors.CRITICAL : colors.textFaint} />
            <Text style={[styles.statText, item.summary.vulnerabilities > 0 && styles.statTextAlert]}>
              {item.summary.vulnerabilities}
            </Text>
          </View>
          <View style={styles.stat}>
            <Icon name="whatshot" size={14} color={item.summary.securityHotspots > 0 ? severityColors.HIGH : colors.textFaint} />
            <Text style={styles.statText}>{item.summary.securityHotspots}</Text>
          </View>
          <View style={styles.stat}>
            <Icon name="auto-fix-high" size={14} color={item.summary.codeSmells > 5 ? severityColors.MED : colors.textFaint} />
            <Text style={styles.statText}>{item.summary.codeSmells}</Text>
          </View>
          <View style={[styles.stat, { marginLeft: 'auto' }]}>
            <Text style={styles.filesText}>
              {item.summary.impactedFilesCount} fichiers · +{item.summary.linesAdded} / -{item.summary.linesRemoved}
            </Text>
          </View>
        </View>

        {item.summary.criticalFindings > 0 && (
          <View style={styles.criticalBanner}>
            <Icon name="error" size={14} color={severityColors.CRITICAL} />
            <Text style={styles.criticalBannerText}>
              {item.summary.criticalFindings} problème{item.summary.criticalFindings > 1 ? 's' : ''} critique{item.summary.criticalFindings > 1 ? 's' : ''}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Bonjour</Text>
          <Text style={styles.headerTitle}>Revues de code</Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <Icon name="person" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          onPress={() => setFilter('toReview')}
          style={[styles.filterChip, filter === 'toReview' && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, filter === 'toReview' && styles.filterChipTextActive]}>
            À reviewer ({toReview.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilter('mine')}
          style={[styles.filterChip, filter === 'mine' && styles.filterChipActive]}
        >
          <Text style={[styles.filterChipText, filter === 'mine' && styles.filterChipTextActive]}>
            Mes PRs ({mine.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[styles.emptyText, { marginTop: 10 }]}>
            Récupération de tes pull requests…
          </Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          renderItem={renderPr}
          keyExtractor={(item) => `${item.repository}-${item.id}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              {errorMsg ? (
                <>
                  <Icon name="cloud-off" size={40} color={colors.textFaint} />
                  <Text style={styles.emptyText}>{errorMsg}</Text>
                  <Text style={[styles.emptyText, { fontSize: 12, marginTop: 6 }]}>
                    Tire vers le bas pour réessayer.
                  </Text>
                </>
              ) : (
                <>
                  <Icon name="inbox" size={40} color={colors.textFaint} />
                  <Text style={styles.emptyText}>Aucune pull request</Text>
                </>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 10,
    },
    greeting: {
      color: colors.textMuted,
      fontSize: 13,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: 'bold',
    },
    profileButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterRow: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    filterChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.card,
      borderRadius: 18,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    filterChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    filterChipText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    filterChipTextActive: {
      color: '#FFF',
    },
    listContent: {
      padding: 16,
      paddingTop: 4,
    },
    prCard: {
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 14,
      marginBottom: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    prCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    gateStripe: {
      position: 'absolute',
      left: -14,
      top: -14,
      bottom: -14,
      width: 4,
    },
    prNumber: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    statusPill: {
      marginLeft: 'auto',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 10,
      borderWidth: 1,
    },
    statusText: {
      fontSize: 10,
      fontWeight: 'bold',
      letterSpacing: 0.3,
    },
    prTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 8,
      lineHeight: 20,
    },
    prMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    prMetaText: {
      color: colors.textMuted,
      fontSize: 11,
      marginLeft: 4,
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stat: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 10,
    },
    statText: {
      color: colors.textMuted,
      fontSize: 12,
      marginLeft: 3,
      fontWeight: '600',
    },
    statTextAlert: {
      color: colors.text,
    },
    filesText: {
      color: colors.textMuted,
      fontSize: 10,
    },
    criticalBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    criticalBannerText: {
      color: severityColors.CRITICAL,
      fontSize: 11,
      marginLeft: 6,
      fontWeight: '600',
    },
    empty: {
      alignItems: 'center',
      padding: 40,
    },
    emptyText: {
      color: colors.textFaint,
      marginTop: 8,
    },
  });

export default HomeScreen;

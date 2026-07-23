import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { severityColors } from '../data/reviewColors';
import { useTheme } from '../services/theme';

const AT_RISK = '#FFA726';

const shortLabel = (label) => {
  const s = String(label || '');
  const parts = s.split('.');
  return parts.length > 2 ? parts.slice(-2).join('.') : s;
};

function reachableFrom(startIds, outEdges) {
  const seen = new Set();
  const queue = [...startIds];
  while (queue.length) {
    const cur = queue.shift();
    (outEdges[cur] || []).forEach((next) => {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    });
  }
  return seen;
}

const DependencyGraph = ({ graph }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { nodes = [], edges = [] } = graph || {};
  const [focusId, setFocusId] = useState(null);
  const [history, setHistory] = useState([]);

  const outEdges = useMemo(() => {
    const m = {};
    edges.forEach((e) => {
      if (!m[e.from]) m[e.from] = [];
      m[e.from].push(e.to);
    });
    return m;
  }, [edges]);

  const inEdges = useMemo(() => {
    const m = {};
    edges.forEach((e) => {
      if (!m[e.to]) m[e.to] = [];
      m[e.to].push(e.from);
    });
    return m;
  }, [edges]);

  const nodeById = useMemo(() => {
    const m = {};
    nodes.forEach((n) => {
      m[n.id] = n;
    });
    return m;
  }, [nodes]);

  const labelOf = useCallback((id) => nodeById[id]?.label || id, [nodeById]);

  const impactedIds = useMemo(
    () => nodes.filter((n) => n.isImpacted).map((n) => n.id),
    [nodes],
  );

  const atRiskIds = useMemo(() => {
    const reached = reachableFrom(impactedIds, inEdges);
    impactedIds.forEach((id) => reached.delete(id));
    return reached;
  }, [impactedIds, inEdges]);

  const analysisFailed = useMemo(
    () =>
      nodes.some((n) =>
        /^error$|failed or skipped|deep-analysis/i.test(String(n.label || '')),
      ),
    [nodes],
  );

  const accentFor = useCallback(
    (n) => {
      if (!n) return colors.textFaint;
      if (n.isImpacted) {
        const s = n.severity && n.severity !== 'CLEAN' ? n.severity : null;
        return s ? severityColors[s] : colors.accent;
      }
      if (atRiskIds.has(n.id)) return AT_RISK;
      return colors.textFaint;
    },
    [atRiskIds, colors],
  );

  const focus = focusId || impactedIds[0] || nodes[0]?.id || null;
  const focusNode = focus ? nodeById[focus] : null;
  const callers = focus ? inEdges[focus] || [] : [];
  const callees = focus ? outEdges[focus] || [] : [];

  const navigateTo = (id) => {
    if (!id || id === focus) return;
    setHistory((h) => [...h, focus]);
    setFocusId(id);
  };

  const goBack = () => {
    setHistory((h) => {
      if (!h.length) return h;
      setFocusId(h[h.length - 1]);
      return h.slice(0, -1);
    });
  };

  if (!nodes.length) {
    return (
      <View style={styles.emptyWrap}>
        <Icon name="hub" size={40} color={colors.textFaint} />
        <Text style={styles.emptyText}>{t('graphEmpty')}</Text>
      </View>
    );
  }

  if (analysisFailed) {
    return (
      <View style={styles.emptyWrap}>
        <Icon name="account-tree" size={40} color={colors.textFaint} />
        <Text style={styles.emptyText}>{t('graphUnavailable')}</Text>
        <Text style={styles.emptySubText}>{t('graphAnalysisFailed')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('graphTitle')}</Text>
            <Text style={styles.subtitle}>
              {t('graphSubtitle', {
                modified: impactedIds.length,
                atRisk: atRiskIds.size,
                total: nodes.length,
              })}
            </Text>
          </View>
          {history.length > 0 ? (
            <Pressable
              onPress={goBack}
              hitSlop={10}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel={t('graphBackLabel')}
            >
              <Icon name="arrow-back" size={16} color={colors.accent} />
              <Text style={styles.backText}>{t('graphBack')}</Text>
            </Pressable>
          ) : null}
        </View>

        {impactedIds.length > 0 ? (
          <View style={styles.jumpWrap}>
            <Text style={styles.sectionLabel}>{t('graphJumpToModified')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.jumpRow}
            >
              {impactedIds.map((id) => (
                <NeighborChip
                  key={id}
                  node={nodeById[id]}
                  accent={accentFor(nodeById[id])}
                  active={id === focus}
                  onPress={() => navigateTo(id)}
                  styles={styles}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('graphCalledBy', { count: callers.length })}</Text>
          {callers.length ? (
            <View style={styles.chipsWrap}>
              {callers.map((id) => (
                <NeighborChip
                  key={id}
                  node={nodeById[id]}
                  accent={accentFor(nodeById[id])}
                  onPress={() => navigateTo(id)}
                  styles={styles}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.leafHint}>{t('graphNoCallers')}</Text>
          )}
        </View>

        <View style={styles.connector}>
          <Icon name="arrow-downward" size={18} color={colors.textFaint} />
        </View>

        <FocusCard
          node={focusNode}
          accent={accentFor(focusNode)}
          atRisk={
            focusNode && !focusNode.isImpacted && atRiskIds.has(focusNode.id)
          }
          styles={styles}
          colors={colors}
        />

        <View style={styles.connector}>
          <Icon name="arrow-downward" size={18} color={colors.textFaint} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('graphCalls', { count: callees.length })}</Text>
          {callees.length ? (
            <View style={styles.chipsWrap}>
              {callees.map((id) => (
                <NeighborChip
                  key={id}
                  node={nodeById[id]}
                  accent={accentFor(nodeById[id])}
                  onPress={() => navigateTo(id)}
                  styles={styles}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.leafHint}>{t('graphNoCallees')}</Text>
          )}
        </View>

        <View style={styles.legend}>
          <LegendItem styles={styles} color={colors.accent} label={t('graphLegendModified')} />
          <LegendItem styles={styles} color={AT_RISK} label={t('graphLegendAtRisk')} />
          <LegendItem styles={styles} color={colors.textFaint} label={t('graphLegendUnrelated')} />
        </View>

        <View style={styles.hint}>
          <Icon name="touch-app" size={14} color={colors.textFaint} />
          <Text style={styles.hintText}>{t('graphHint')}</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const NeighborChip = ({ node, accent, active, onPress, styles }) => {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={t('graphNavigateTo', { label: node ? node.label : '' })}
    >
      <View style={[styles.chipDot, { backgroundColor: accent }]} />
      <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
        {node ? shortLabel(node.label) : ''}
      </Text>
    </Pressable>
  );
};

const FocusCard = ({ node, accent, atRisk, styles, colors }) => {
  const { t } = useTranslation();
  if (!node) return null;
  return (
    <View style={[styles.focusCard, { borderColor: accent, backgroundColor: accent + '14' }]}>
      <View style={styles.focusTop}>
        <Icon
          name={node.type === 'class' ? 'class' : 'functions'}
          size={22}
          color={accent}
        />
        <View style={styles.focusTextCol}>
          <Text style={styles.focusLabel} numberOfLines={2}>
            {shortLabel(node.label)}
          </Text>
          {node.label !== shortLabel(node.label) ? (
            <Text style={styles.focusPath} numberOfLines={2} selectable>
              {node.label}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.focusMeta}>
        {node.isImpacted ? (
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <Text style={styles.badgeText}>{t('graphBadgeModified')}</Text>
          </View>
        ) : atRisk ? (
          <View style={[styles.badge, { backgroundColor: AT_RISK }]}>
            <Text style={styles.badgeText}>{t('graphBadgeAtRisk')}</Text>
          </View>
        ) : (
          <View style={[styles.badge, { backgroundColor: colors.textFaint }]}>
            <Text style={styles.badgeText}>{t('graphBadgeHealthy')}</Text>
          </View>
        )}
        {node.severity && node.severity !== 'CLEAN' ? (
          <Text style={[styles.focusSeverity, { color: accent }]}>{node.severity}</Text>
        ) : null}
        <Text style={styles.focusType}>
          {node.type === 'class' ? t('graphTypeClass') : t('graphTypeFunction')}
        </Text>
      </View>
    </View>
  );
};

const LegendItem = ({ color, label, styles }) => (
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: color }]} />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const makeStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 60 },

    emptyWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
      backgroundColor: colors.bg,
    },
    emptyText: {
      color: colors.text,
      marginTop: 10,
      textAlign: 'center',
      fontSize: 15,
      fontWeight: '600',
    },
    emptySubText: {
      color: colors.textFaint,
      marginTop: 8,
      textAlign: 'center',
      fontSize: 12,
      lineHeight: 18,
      paddingHorizontal: 24,
    },

    header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14 },
    title: { color: colors.text, fontSize: 16, fontWeight: 'bold' },
    subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    backText: { color: colors.accent, fontSize: 12, fontWeight: '700', marginLeft: 4 },

    jumpWrap: { marginBottom: 16 },
    jumpRow: { paddingRight: 8, alignItems: 'center' },

    sectionLabel: {
      color: colors.textMuted,
      fontSize: 10,
      letterSpacing: 0.8,
      fontWeight: '700',
      marginBottom: 8,
    },
    section: { marginBottom: 4 },

    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap' },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 40,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginRight: 8,
      marginBottom: 8,
      maxWidth: '100%',
    },
    chipActive: { borderColor: colors.accent, backgroundColor: colors.accent + '22' },
    chipDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600', flexShrink: 1 },
    chipTextActive: { color: colors.text },

    leafHint: { color: colors.textFaint, fontSize: 12, fontStyle: 'italic', marginBottom: 8 },

    connector: { alignItems: 'center', paddingVertical: 2 },

    focusCard: {
      borderRadius: 12,
      borderWidth: 2,
      padding: 16,
    },
    focusTop: { flexDirection: 'row', alignItems: 'flex-start' },
    focusTextCol: { flex: 1, marginLeft: 10 },
    focusLabel: {
      color: colors.text,
      fontSize: 16,
      fontWeight: 'bold',
    },
    focusPath: {
      color: colors.textFaint,
      fontSize: 11,
      marginTop: 3,
      fontFamily: 'monospace',
    },
    focusMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      marginTop: 10,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
      marginRight: 8,
    },
    badgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold', letterSpacing: 0.5 },
    focusSeverity: { fontSize: 12, fontWeight: '700', marginRight: 8 },
    focusType: { color: colors.textFaint, fontSize: 12 },

    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 20,
      padding: 10,
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 14,
      marginBottom: 4,
    },
    legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
    legendText: { color: colors.textMuted, fontSize: 11 },

    hint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
      paddingHorizontal: 8,
    },
    hintText: {
      color: colors.textFaint,
      fontSize: 11,
      marginLeft: 6,
      textAlign: 'center',
      flexShrink: 1,
    },
  });

export default DependencyGraph;

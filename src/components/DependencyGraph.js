/**
 * DependencyGraph — layered impact graph for a PR (2D, no SVG).
 */

import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { severityColors } from '../data/reviewColors';
import { useTheme } from '../services/theme';

const AT_RISK = '#FFA726';

const FILTERS = [
  { key: 'ALL', label: 'Tout' },
  { key: 'IMPACTED', label: 'Impactés seulement' },
  { key: 'CRITICAL', label: 'Chemin critique' },
];

const DOUBLE_TAP_MS = 280;
const LONG_PRESS_MS = 450;

function computeLayers(nodes, inEdges) {
  const rank = {};
  const visiting = {};

  const dfs = (id) => {
    if (rank[id] !== undefined) return rank[id];
    if (visiting[id]) return 0;
    visiting[id] = true;
    const parents = inEdges[id] || [];
    const r = parents.length === 0 ? 0 : 1 + Math.max(...parents.map(dfs));
    visiting[id] = false;
    rank[id] = r;
    return r;
  };

  nodes.forEach((n) => dfs(n.id));

  const layers = {};
  nodes.forEach((n) => {
    const r = rank[n.id] ?? 0;
    if (!layers[r]) layers[r] = [];
    layers[r].push(n);
  });

  return Object.keys(layers)
    .map(Number)
    .sort((a, b) => a - b)
    .map((r) => ({ rank: r, nodes: layers[r] }));
}

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

function impactPath(startId, outEdges, labelOf) {
  const lines = [];
  const seen = new Set([startId]);
  const walk = (id, depth) => {
    (outEdges[id] || []).forEach((next) => {
      lines.push(`${'  '.repeat(depth)}${labelOf(id)} → ${labelOf(next)}`);
      if (!seen.has(next)) {
        seen.add(next);
        walk(next, depth + 1);
      }
    });
  };
  walk(startId, 0);
  return lines;
}

const DependencyGraph = ({ graph }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { nodes = [], edges = [] } = graph || {};
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [tooltip, setTooltip] = useState(null);
  const lastTapRef = useRef({ id: null, ts: 0 });

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

  const labelOf = useCallback(
    (id) => nodes.find((n) => n.id === id)?.label || id,
    [nodes],
  );

  const impactedIds = useMemo(
    () => nodes.filter((n) => n.isImpacted).map((n) => n.id),
    [nodes],
  );

  const atRiskIds = useMemo(() => {
    const reached = reachableFrom(impactedIds, outEdges);
    impactedIds.forEach((id) => reached.delete(id));
    return reached;
  }, [impactedIds, outEdges]);

  const criticalIds = useMemo(() => {
    const set = new Set(impactedIds);
    atRiskIds.forEach((id) => set.add(id));
    return set;
  }, [impactedIds, atRiskIds]);

  const visibleNodes = useMemo(() => {
    if (filter === 'IMPACTED') return nodes.filter((n) => n.isImpacted);
    if (filter === 'CRITICAL') return nodes.filter((n) => criticalIds.has(n.id));
    return nodes;
  }, [nodes, filter, criticalIds]);

  const layers = useMemo(
    () => computeLayers(visibleNodes, inEdges),
    [visibleNodes, inEdges],
  );

  const handleTap = (id) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last.id === id && now - last.ts < DOUBLE_TAP_MS) {
      setSelectedId(null);
      lastTapRef.current = { id: null, ts: 0 };
      return;
    }
    lastTapRef.current = { id, ts: now };
    setSelectedId((prev) => (prev === id ? null : id));
  };

  const handleLongPress = (id) => {
    setTooltip({
      nodeId: id,
      lines: impactPath(id, outEdges, labelOf),
    });
  };

  const accentFor = (n) => {
    if (n.isImpacted) {
      const s = n.severity && n.severity !== 'CLEAN' ? n.severity : null;
      return s ? severityColors[s] : colors.accent;
    }
    if (atRiskIds.has(n.id)) return AT_RISK;
    return colors.textFaint;
  };

  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) : null;

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        accessibilityLabel="Graphe de dépendances"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Graphe de dépendances</Text>
          <Text style={styles.subtitle}>
            {impactedIds.length} impactés · {atRiskIds.size} au risque ·{' '}
            {nodes.length} total
          </Text>
        </View>

        <View style={styles.chipRow} accessibilityRole="radiogroup">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.chip,
                  active && styles.chipActive,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.legend} accessibilityLabel="Légende">
          <LegendItem styles={styles} color={severityColors.CRITICAL} label="Impacté critique" />
          <LegendItem styles={styles} color={colors.accent} label="Impacté" />
          <LegendItem styles={styles} color={AT_RISK} label="Au risque (cascade)" dashed />
          <LegendItem styles={styles} color={colors.textFaint} label="Sain" />
        </View>

        {layers.map((layer, idx) => (
          <View key={layer.rank} style={styles.layer}>
            <View style={styles.layerHeader}>
              <Text style={styles.layerTitle}>Niveau {idx}</Text>
              <View style={styles.layerLine} />
            </View>

            {layer.nodes.map((n) => {
              const isSelected = selectedId === n.id;
              const atRisk = atRiskIds.has(n.id);
              const accent = accentFor(n);
              const callers = inEdges[n.id] || [];
              const callees = outEdges[n.id] || [];

              return (
                <Pressable
                  key={n.id}
                  onPress={() => handleTap(n.id)}
                  onLongPress={() => handleLongPress(n.id)}
                  delayLongPress={LONG_PRESS_MS}
                  hitSlop={4}
                  style={({ pressed }) => [
                    styles.node,
                    atRisk && styles.nodeAtRisk,
                    isSelected && styles.nodeSelected,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                >
                  <View style={styles.nodeHeader}>
                    <Icon
                      name={n.type === 'class' ? 'class' : 'functions'}
                      size={18}
                      color={accent}
                    />
                    <Text style={styles.nodeLabel} numberOfLines={1}>
                      {n.label}
                    </Text>
                    {n.isImpacted && (
                      <View style={[styles.badge, { backgroundColor: accent }]}>
                        <Text style={styles.badgeText}>IMPACTÉ</Text>
                      </View>
                    )}
                    {!n.isImpacted && atRisk && (
                      <View style={[styles.badge, styles.badgeAtRisk]}>
                        <Text style={styles.badgeText}>AU RISQUE</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.edgeRow}>
                    <Text style={styles.edgeArrow}>←</Text>
                    <Text style={styles.edgeLabel} numberOfLines={2}>
                      {callers.length
                        ? callers.map(labelOf).join(', ')
                        : 'racine (aucun appelant)'}
                    </Text>
                  </View>

                  <View style={styles.edgeRow}>
                    <Text style={styles.edgeArrow}>→</Text>
                    <Text style={styles.edgeLabel} numberOfLines={2}>
                      {callees.length
                        ? callees.map(labelOf).join(', ')
                        : 'feuille (aucun appel sortant)'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}

        {visibleNodes.length === 0 && (
          <View style={styles.empty}>
            <Icon name="hub" size={40} color={colors.textFaint} />
            <Text style={styles.emptyText}>
              Aucun nœud à afficher pour ce filtre.
            </Text>
          </View>
        )}

        <View style={styles.hint}>
          <Icon name="touch-app" size={14} color={colors.textFaint} />
          <Text style={styles.hintText}>
            Tap : sélectionner · Long-press : chemin d'impact · Double-tap : vue globale
          </Text>
        </View>
      </ScrollView>

      {selectedNode && (
        <View style={styles.panel} accessibilityLabel="Voisins du nœud sélectionné">
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle} numberOfLines={1}>
              {selectedNode.label}
            </Text>
            <Pressable
              onPress={() => setSelectedId(null)}
              hitSlop={12}
              style={styles.panelClose}
              accessibilityRole="button"
              accessibilityLabel="Fermer le panneau"
            >
              <Icon name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
          <Text style={styles.panelSection}>
            Entrants ({(inEdges[selectedNode.id] || []).length})
          </Text>
          <Text style={styles.panelList}>
            {(inEdges[selectedNode.id] || []).map(labelOf).join('\n') || '—'}
          </Text>
          <Text style={styles.panelSection}>
            Sortants ({(outEdges[selectedNode.id] || []).length})
          </Text>
          <Text style={styles.panelList}>
            {(outEdges[selectedNode.id] || []).map(labelOf).join('\n') || '—'}
          </Text>
        </View>
      )}

      <Modal
        visible={!!tooltip}
        transparent
        animationType="fade"
        onRequestClose={() => setTooltip(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setTooltip(null)}>
          <Pressable style={styles.tooltip} onPress={() => {}}>
            <View style={styles.tooltipHeader}>
              <Icon name="account-tree" size={18} color={colors.accent} />
              <Text style={styles.tooltipTitle} numberOfLines={1}>
                Chemin d'impact — {tooltip ? labelOf(tooltip.nodeId) : ''}
              </Text>
            </View>
            <ScrollView style={styles.tooltipBody}>
              {tooltip && tooltip.lines.length > 0 ? (
                tooltip.lines.map((l, i) => (
                  <Text key={i} style={styles.tooltipLine}>
                    {l}
                  </Text>
                ))
              ) : (
                <Text style={styles.tooltipLine}>Aucun appel sortant.</Text>
              )}
            </ScrollView>
            <Pressable
              onPress={() => setTooltip(null)}
              style={styles.tooltipClose}
              accessibilityRole="button"
            >
              <Text style={styles.tooltipCloseText}>Fermer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const LegendItem = ({ color, label, dashed, styles }) => (
  <View style={styles.legendItem}>
    <View
      style={[
        styles.legendDot,
        { backgroundColor: dashed ? 'transparent' : color, borderColor: color },
        dashed && styles.legendDotDashed,
      ]}
    />
    <Text style={styles.legendText}>{label}</Text>
  </View>
);

const makeStyles = (colors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    content: { padding: 16, paddingBottom: 200 },

    header: { marginBottom: 12 },
    title: { color: colors.text, fontSize: 16, fontWeight: 'bold' },
    subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

    chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
    chip: {
      minHeight: 48,
      minWidth: 48,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 24,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginRight: 8,
      marginBottom: 8,
      justifyContent: 'center',
    },
    chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
    chipText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
    chipTextActive: { color: '#FFF' },

    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 12,
      padding: 8,
      backgroundColor: colors.card,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 12,
      marginBottom: 4,
    },
    legendDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 6,
      borderWidth: 2,
    },
    legendDotDashed: { borderStyle: 'dashed' },
    legendText: { color: colors.textMuted, fontSize: 11 },

    layer: { marginBottom: 16 },
    layerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    layerTitle: {
      color: colors.textFaint,
      fontSize: 10,
      fontWeight: 'bold',
      letterSpacing: 1,
      marginRight: 8,
    },
    layerLine: { flex: 1, height: 1, backgroundColor: colors.border },

    node: {
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 12,
      marginBottom: 8,
      minHeight: 48,
      borderWidth: 1,
      borderColor: colors.border,
    },
    nodeAtRisk: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: AT_RISK,
    },
    nodeSelected: { backgroundColor: colors.cardAlt },
    nodeHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    nodeLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      marginLeft: 8,
      flex: 1,
    },
    badge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      marginLeft: 6,
    },
    badgeAtRisk: { backgroundColor: AT_RISK },
    badgeText: {
      color: '#FFF',
      fontSize: 9,
      fontWeight: 'bold',
      letterSpacing: 0.5,
    },

    edgeRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 },
    edgeArrow: {
      color: colors.textFaint,
      fontSize: 14,
      width: 18,
      textAlign: 'center',
    },
    edgeLabel: { color: colors.textMuted, fontSize: 11, marginLeft: 4, flex: 1 },

    empty: { alignItems: 'center', padding: 40 },
    emptyText: { color: colors.textFaint, marginTop: 8 },

    hint: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      paddingHorizontal: 8,
    },
    hintText: {
      color: colors.textFaint,
      fontSize: 10,
      marginLeft: 6,
      textAlign: 'center',
    },

    panel: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      padding: 12,
      maxHeight: 220,
    },
    panelHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    panelTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: 'bold',
    },
    panelClose: {
      minWidth: 48,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    panelSection: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: 'bold',
      marginTop: 6,
      marginBottom: 2,
      letterSpacing: 0.5,
    },
    panelList: { color: colors.textMuted, fontSize: 12, lineHeight: 18 },

    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    tooltip: {
      width: '100%',
      maxHeight: '70%',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    tooltipHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    tooltipTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    tooltipBody: { maxHeight: 320 },
    tooltipLine: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: 'monospace',
      marginBottom: 2,
    },
    tooltipClose: {
      marginTop: 12,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      borderRadius: 8,
    },
    tooltipCloseText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  });

export default DependencyGraph;

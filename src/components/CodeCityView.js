/**
 * CodeCityView — 2D treemap / CodeCity visualisation of impacted files.
 */

import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {
  PinchGestureHandler,
  GestureHandlerRootView,
  State,
} from 'react-native-gesture-handler';
import { severityColors } from '../data/reviewColors';
import { useTheme } from '../services/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const CONTAINER_PAD = 16;
const CONTAINER_WIDTH = SCREEN_W - CONTAINER_PAD * 2;
const CONTAINER_HEIGHT = 420;
const GUTTER = 8;
const MIN_TILE = 48;

const SEVERITY_RANK = { CLEAN: 0, LOW: 1, MED: 2, HIGH: 3, CRITICAL: 4 };
const SEVERITIES = ['CRITICAL', 'HIGH', 'MED', 'LOW', 'CLEAN'];

const LEVEL = { MODULES: 'modules', FILES: 'files', FOCUS: 'focus' };

const fileName = (p) => p.split('/').pop();
const folderOf = (p) => {
  const parts = p.split('/');
  parts.pop();
  return parts.join('/') || '/';
};
const loc = (f) => Math.max(1, (f.linesAdded || 0) + (f.linesRemoved || 0));
const maxSeverity = (files) =>
  files.reduce(
    (acc, f) =>
      (SEVERITY_RANK[f.severity] ?? 0) > (SEVERITY_RANK[acc] ?? 0)
        ? f.severity
        : acc,
    'CLEAN'
  );

const aggregateByModule = (files) => {
  const buckets = new Map();
  files.forEach((f) => {
    const key = folderOf(f.path);
    if (!buckets.has(key))
      buckets.set(key, {
        path: key,
        isModule: true,
        files: [],
        linesAdded: 0,
        linesRemoved: 0,
        findingsCount: 0,
        aiHighlight: false,
      });
    const m = buckets.get(key);
    m.files.push(f);
    m.linesAdded += f.linesAdded || 0;
    m.linesRemoved += f.linesRemoved || 0;
    m.findingsCount += f.findingsCount || 0;
    if (f.aiHighlight) m.aiHighlight = true;
  });
  return Array.from(buckets.values()).map((m) => ({
    ...m,
    severity: maxSeverity(m.files),
    complexity: m.files.reduce((s, f) => s + (f.complexity || 0), 0),
  }));
};

const treemap = (items, x, y, w, h, out = []) => {
  if (!items.length || w < MIN_TILE || h < MIN_TILE) return out;
  if (items.length === 1) {
    out.push({ item: items[0], x, y, w, h });
    return out;
  }

  const sorted = [...items].sort((a, b) => loc(b) - loc(a));
  const total = sorted.reduce((s, it) => s + loc(it), 0);

  let acc = 0;
  let splitIdx = 1;
  for (let i = 0; i < sorted.length; i++) {
    acc += loc(sorted[i]);
    if (acc >= total / 2) {
      splitIdx = i + 1;
      break;
    }
  }
  splitIdx = Math.min(Math.max(splitIdx, 1), sorted.length - 1);

  const left = sorted.slice(0, splitIdx);
  const right = sorted.slice(splitIdx);
  const leftW = left.reduce((s, it) => s + loc(it), 0);
  const ratio = leftW / total;

  if (w >= h) {
    const splitW = Math.max(MIN_TILE, Math.round(w * ratio));
    treemap(left, x, y, splitW - GUTTER / 2, h, out);
    treemap(right, x + splitW + GUTTER / 2, y, w - splitW - GUTTER / 2, h, out);
  } else {
    const splitH = Math.max(MIN_TILE, Math.round(h * ratio));
    treemap(left, x, y, w, splitH - GUTTER / 2, out);
    treemap(right, x, y + splitH + GUTTER / 2, w, h - splitH - GUTTER / 2, out);
  }
  return out;
};

const Tile = ({ block, onPress, onLongPress, compact, styles, isDark }) => {
  const { item, x, y, w, h } = block;
  const color = severityColors[item.severity] || severityColors.CLEAN;
  const label = item.isModule ? item.path : fileName(item.path);
  const sub = item.isModule
    ? `${item.files.length} fichier${item.files.length > 1 ? 's' : ''}`
    : folderOf(item.path);
  const showFooter = h >= 70;
  const showSub = h >= 54;

  return (
    <Pressable
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={
        item.isModule
          ? `Module ${item.path}, ${item.files.length} fichiers, sévérité ${item.severity}, ${item.findingsCount} findings`
          : `Fichier ${fileName(item.path)}, sévérité ${item.severity}, ${item.linesAdded} ajouts ${item.linesRemoved} retraits, ${item.findingsCount} findings`
      }
      android_ripple={{ color: color + '55' }}
      style={({ pressed }) => [
        styles.tile,
        {
          left: x,
          top: y,
          width: Math.max(MIN_TILE, w),
          height: Math.max(MIN_TILE, h),
          backgroundColor: color + (isDark ? '33' : '22'),
          borderColor: color,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <View style={styles.tileTop}>
        <Text
          numberOfLines={compact ? 2 : 1}
          style={[styles.tileName, compact && styles.tileNameLg]}
        >
          {label}
        </Text>
        {showSub && (
          <Text numberOfLines={1} style={styles.tileFolder}>
            {sub}
          </Text>
        )}
      </View>

      {showFooter && (
        <View style={styles.tileFooter}>
          <Text style={styles.tileLoc}>
            +{item.linesAdded} / -{item.linesRemoved}
          </Text>
          {item.findingsCount > 0 && (
            <View style={[styles.badge, { backgroundColor: color }]}>
              <Text style={styles.badgeText}>{item.findingsCount}</Text>
            </View>
          )}
        </View>
      )}

      {item.aiHighlight && (
        <View style={styles.aiFlash} accessibilityLabel="Suggestion IA">
          <Icon name="auto-awesome" size={12} color="#1E1E1E" />
        </View>
      )}
    </Pressable>
  );
};

const Tooltip = ({ item, onClose, styles, colors }) => {
  if (!item) return null;
  const color = severityColors[item.severity] || severityColors.CLEAN;
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.tooltipBackdrop} onPress={onClose}>
        <View style={styles.tooltipCard}>
          <View style={[styles.tooltipStripe, { backgroundColor: color }]} />
          <Text style={styles.tooltipTitle} numberOfLines={2}>
            {item.isModule ? item.path : item.path}
          </Text>
          <Text style={styles.tooltipRow}>
            <Text style={styles.tooltipKey}>Sévérité : </Text>
            <Text style={{ color }}>{item.severity}</Text>
          </Text>
          <Text style={styles.tooltipRow}>
            <Text style={styles.tooltipKey}>Findings : </Text>
            {item.findingsCount}
          </Text>
          <Text style={styles.tooltipRow}>
            <Text style={styles.tooltipKey}>Complexité : </Text>
            {item.complexity ?? '—'}
          </Text>
          <Text style={styles.tooltipRow}>
            <Text style={styles.tooltipKey}>Lignes : </Text>
            +{item.linesAdded} / -{item.linesRemoved}
          </Text>
          {item.aiHighlight && (
            <View style={styles.tooltipAi}>
              <Icon name="auto-awesome" size={14} color="#FDD835" />
              <Text style={styles.tooltipAiText}>
                Suggestion IA disponible
              </Text>
            </View>
          )}
          <Text style={styles.tooltipHint}>Touchez hors du cadre pour fermer</Text>
        </View>
      </Pressable>
    </Modal>
  );
};

const CodeCityView = ({ files = [], onFilePress }) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [level, setLevel] = useState(LEVEL.MODULES);
  const [focusPath, setFocusPath] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [mutedSeverities, setMutedSeverities] = useState(() => new Set());
  const lastTapRef = useRef(0);

  const onPinchEnd = useCallback((e) => {
    if (e.nativeEvent.state !== State.END) return;
    const s = e.nativeEvent.scale;
    if (s > 1.6) {
      setLevel((prev) =>
        prev === LEVEL.MODULES ? LEVEL.FILES : LEVEL.FOCUS
      );
    } else if (s < 0.7) {
      setLevel((prev) =>
        prev === LEVEL.FOCUS ? LEVEL.FILES : LEVEL.MODULES
      );
      if (level === LEVEL.FOCUS) setFocusPath(null);
    }
  }, [level]);

  const visibleFiles = useMemo(
    () => files.filter((f) => !mutedSeverities.has(f.severity)),
    [files, mutedSeverities]
  );

  const items = useMemo(() => {
    if (level === LEVEL.MODULES) return aggregateByModule(visibleFiles);
    if (level === LEVEL.FOCUS && focusPath) {
      const f = visibleFiles.find((x) => x.path === focusPath);
      return f ? [f] : visibleFiles;
    }
    return visibleFiles;
  }, [level, visibleFiles, focusPath]);

  const blocks = useMemo(
    () => treemap(items, 0, 0, CONTAINER_WIDTH, CONTAINER_HEIGHT),
    [items]
  );

  const handleTilePress = useCallback(
    (item) => {
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        setLevel(LEVEL.MODULES);
        setFocusPath(null);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;

      if (item.isModule) {
        setLevel(LEVEL.FILES);
        return;
      }
      if (level === LEVEL.FILES) {
        onFilePress && onFilePress(item);
        return;
      }
      if (level === LEVEL.FOCUS) {
        onFilePress && onFilePress(item);
      }
    },
    [level, onFilePress]
  );

  const handleLongPress = useCallback((item) => {
    setTooltip(item);
  }, []);

  const toggleSeverity = useCallback((sev) => {
    setMutedSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  }, []);

  if (!files.length) {
    return (
      <View style={styles.empty}>
        <Icon name="layers-clear" size={40} color={colors.textFaint} />
        <Text style={styles.emptyText}>Aucun fichier impacté</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.wrapper}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <View style={styles.headerBlock}>
          <Text style={styles.title}>Carte des fichiers modifiés</Text>
          <Text style={styles.subtitle}>
            Taille = lignes touchées · Couleur = sévérité
          </Text>
          <View style={styles.levelRow}>
            <Pressable
              onPress={() => {
                setLevel(LEVEL.MODULES);
                setFocusPath(null);
              }}
              style={[styles.levelBtn, level === LEVEL.MODULES && styles.levelBtnActive]}
              accessibilityRole="button"
            >
              <Icon
                name="folder"
                size={14}
                color={level === LEVEL.MODULES ? '#fff' : colors.textMuted}
              />
              <Text style={[styles.levelBtnText, level === LEVEL.MODULES && styles.levelBtnTextActive]}>
                Modules
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setLevel(LEVEL.FILES)}
              style={[styles.levelBtn, level === LEVEL.FILES && styles.levelBtnActive]}
              accessibilityRole="button"
            >
              <Icon
                name="description"
                size={14}
                color={level === LEVEL.FILES ? '#fff' : colors.textMuted}
              />
              <Text style={[styles.levelBtnText, level === LEVEL.FILES && styles.levelBtnTextActive]}>
                Fichiers
              </Text>
            </Pressable>
            <Text style={styles.levelHint}>· pinch pour zoomer</Text>
          </View>
        </View>

        <PinchGestureHandler onHandlerStateChange={onPinchEnd}>
          <View
            style={[
              styles.treemap,
              { width: CONTAINER_WIDTH, height: CONTAINER_HEIGHT },
            ]}
          >
            {blocks.map((b) => (
              <Tile
                key={b.item.path}
                block={b}
                onPress={handleTilePress}
                onLongPress={handleLongPress}
                compact={level === LEVEL.FOCUS}
                styles={styles}
                isDark={isDark}
              />
            ))}
          </View>
        </PinchGestureHandler>

        <View style={styles.legend}>
          {SEVERITIES.map((sev) => {
            const muted = mutedSeverities.has(sev);
            const color = severityColors[sev];
            return (
              <Pressable
                key={sev}
                onPress={() => toggleSeverity(sev)}
                accessibilityRole="button"
                accessibilityLabel={`Filtrer ${sev}, ${muted ? 'masqué' : 'visible'}`}
                style={({ pressed }) => [
                  styles.legendItem,
                  muted && styles.legendItemMuted,
                  pressed && { opacity: 0.6 },
                ]}
                hitSlop={8}
              >
                <View style={[styles.legendDot, { backgroundColor: color }]} />
                <Text style={[styles.legendText, muted && styles.legendTextMuted]}>
                  {sev}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <Tooltip item={tooltip} onClose={() => setTooltip(null)} styles={styles} colors={colors} />
    </GestureHandlerRootView>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    wrapper: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scrollContent: {
      padding: CONTAINER_PAD,
    },
    headerBlock: {
      marginBottom: 12,
    },
    title: {
      color: colors.text,
      fontSize: 16,
      fontWeight: 'bold',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 4,
    },
    levelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
    },
    levelText: {
      color: colors.accent,
      fontSize: 12,
      marginLeft: 4,
      fontWeight: '600',
    },
    levelHint: {
      color: colors.textMuted,
      fontSize: 11,
      marginLeft: 6,
    },
    levelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginRight: 6,
    },
    levelBtnActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    levelBtnText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    levelBtnTextActive: {
      color: '#fff',
    },
    treemap: {
      position: 'relative',
      marginVertical: 12,
      backgroundColor: colors.card,
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    tile: {
      position: 'absolute',
      borderWidth: 2,
      borderRadius: 6,
      padding: 8,
      justifyContent: 'space-between',
      minWidth: MIN_TILE,
      minHeight: MIN_TILE,
    },
    tileTop: { flexShrink: 1 },
    tileName: {
      color: colors.text,
      fontSize: 12,
      fontWeight: 'bold',
    },
    tileNameLg: {
      fontSize: 15,
    },
    tileFolder: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
    },
    tileFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    tileLoc: {
      color: colors.text,
      fontSize: 11,
    },
    badge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 6,
    },
    badgeText: {
      color: '#FFF',
      fontSize: 11,
      fontWeight: 'bold',
    },
    aiFlash: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: '#FDD835',
      justifyContent: 'center',
      alignItems: 'center',
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      marginTop: 4,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 4,
      marginVertical: 4,
      paddingHorizontal: 10,
      paddingVertical: 10,
      backgroundColor: colors.card,
      borderRadius: 16,
      minHeight: 36,
      borderWidth: 1,
      borderColor: colors.border,
    },
    legendItemMuted: {
      opacity: 0.4,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 6,
    },
    legendText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
    },
    legendTextMuted: {
      textDecorationLine: 'line-through',
    },
    empty: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
      backgroundColor: colors.bg,
    },
    emptyText: {
      color: colors.textFaint,
      marginTop: 8,
    },
    tooltipBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    tooltipCard: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tooltipStripe: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      borderTopLeftRadius: 10,
      borderTopRightRadius: 10,
    },
    tooltipTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: 'bold',
      marginBottom: 10,
      marginTop: 4,
    },
    tooltipRow: {
      color: colors.text,
      fontSize: 12,
      marginVertical: 2,
    },
    tooltipKey: {
      color: colors.textMuted,
    },
    tooltipAi: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      padding: 8,
      backgroundColor: '#FDD83522',
      borderRadius: 6,
    },
    tooltipAiText: {
      color: '#B8860B',
      fontSize: 12,
      marginLeft: 6,
      fontWeight: '600',
    },
    tooltipHint: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 12,
      textAlign: 'center',
      fontStyle: 'italic',
    },
  });

export default CodeCityView;

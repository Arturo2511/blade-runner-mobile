import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Dimensions,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { severityColors } from '../data/reviewColors';
import { useTheme } from '../services/theme';

const LINE_HEIGHT = 2;      // hauteur visuelle d'une ligne dans la minimap
const LINE_GAP = 0;         // espacement entre lignes (0 = continu)
const MAP_WIDTH = 120;      // largeur de la silhouette
const GUTTER_WIDTH = 14;    // largeur de la gouttière pour les findings
const DOUBLE_TAP_DELAY = 280;

const fileName = (p) => (p ? p.split('/').pop() : '');
const folderOf = (p) => {
  if (!p) return '';
  const parts = p.split('/');
  parts.pop();
  return parts.join('/');
};

/** Return findings for a given file from the PR-level findings list. */
const findingsForFile = (findings, filePath) =>
  (findings || []).filter((f) => f.location?.filePath === filePath);

const MiniMap = ({ files = [], findings = [], focusFilePath, onOpenDiff }) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [highlightLine, setHighlightLine] = useState(null); // ligne tapée
  const lastTapRef = useRef({ line: null, ts: 0 });

  // Keep only files that have the minimap-ready data
  const mapFiles = useMemo(
    () => files.filter((f) => Array.isArray(f.diffLines) && f.totalLines),
    [files]
  );

  // If parent asks to focus a specific file, jump to it.
  useEffect(() => {
    if (!focusFilePath || mapFiles.length === 0) return;
    const idx = mapFiles.findIndex((f) => f.path === focusFilePath);
    if (idx >= 0 && idx !== selectedIdx) {
      setSelectedIdx(idx);
      setHighlightLine(null);
    }
  }, [focusFilePath, mapFiles]);

  if (!mapFiles.length) {
    return (
      <View style={styles.emptyWrap}>
        <Icon name="map" size={40} color={colors.textFaint} />
        <Text style={styles.emptyText}>
          {t('minimapEmpty')}
        </Text>
        <Text style={styles.emptySub}>
          {t('minimapEmptySub')}
        </Text>
      </View>
    );
  }

  const active = mapFiles[selectedIdx] || mapFiles[0];
  const activeFindings = useMemo(
    () => findingsForFile(findings, active.path),
    [findings, active]
  );

  const mapHeight = Math.max(
    160,
    active.totalLines * (LINE_HEIGHT + LINE_GAP)
  );

  // Pre-compute per-line color
  const lineStatusByNumber = useMemo(() => {
    const map = {};
    active.diffLines.forEach((d) => {
      map[d.line] = d.type;
    });
    return map;
  }, [active.diffLines]);

  const handleMapPress = (line) => {
    const now = Date.now();
    const last = lastTapRef.current;
    if (last.line === line && now - last.ts < DOUBLE_TAP_DELAY) {
      // Double tap → open diff at this position
      lastTapRef.current = { line: null, ts: 0 };
      onOpenDiff?.(active, line);
      return;
    }
    lastTapRef.current = { line, ts: now };
    setHighlightLine(line);
  };

  const selectedStructure = useMemo(() => {
    if (!highlightLine) return null;
    return (active.structure || []).find(
      (s) => highlightLine >= s.startLine && highlightLine <= s.endLine
    );
  }, [active, highlightLine]);

  const findingOnLine = useMemo(
    () => activeFindings.find((f) => f.location?.startLine === highlightLine),
    [activeFindings, highlightLine]
  );

  return (
    <View style={styles.container}>
      {/* Sélecteur de fichier — chips horizontales */}
      <View style={styles.filePickerWrap}>
        <Text style={styles.sectionLabel}>{t('minimapSectionFile')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.fileChipsRow}
        >
          {mapFiles.map((f, i) => {
            const isActive = i === selectedIdx;
            const sevColor = severityColors[f.severity] || severityColors.CLEAN;
            return (
              <TouchableOpacity
                key={f.path}
                onPress={() => {
                  setSelectedIdx(i);
                  setHighlightLine(null);
                }}
                accessibilityLabel={t('minimapFileA11y', { name: fileName(f.path) })}
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.fileChip,
                  isActive && { borderColor: sevColor, backgroundColor: sevColor + '22' },
                ]}
              >
                <View style={[styles.fileChipDot, { backgroundColor: sevColor }]} />
                <Text
                  numberOfLines={1}
                  style={[styles.fileChipText, isActive && styles.fileChipTextActive]}
                >
                  {fileName(f.path)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Header du fichier actif */}
      <View style={styles.fileHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fileName} numberOfLines={1}>{fileName(active.path)}</Text>
          <Text style={styles.filePath} numberOfLines={1}>{folderOf(active.path)}</Text>
        </View>
        <View style={styles.fileStats}>
          <Text style={[styles.stat, styles.statAdd]}>+{active.linesAdded}</Text>
          <Text style={[styles.stat, styles.statRemove]}> −{active.linesRemoved}</Text>
        </View>
      </View>

      {/* Carte principale : minimap à gauche, panel d'info à droite */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator
      >
        <View style={styles.mapRow}>
          {/* MINIMAP */}
          <View
            style={[styles.mapCanvas, { width: MAP_WIDTH + GUTTER_WIDTH, height: mapHeight }]}
            accessibilityLabel={t('minimapCanvasA11y')}
          >
            {/* 1. Couche structure (bordure latérale par bloc) */}
            {(active.structure || []).map((s, idx) => {
              const top = (s.startLine - 1) * (LINE_HEIGHT + LINE_GAP);
              const h =
                (s.endLine - s.startLine + 1) * (LINE_HEIGHT + LINE_GAP);
              return (
                <View
                  key={`s-${idx}`}
                  style={[
                    styles.structureBand,
                    {
                      top,
                      height: h,
                      backgroundColor:
                        s.type === 'method'
                          ? colors.accent + '18'
                          : s.type === 'class'
                            ? colors.textMuted + '18'
                            : 'transparent',
                    },
                  ]}
                />
              );
            })}

            {/* 2. Couche diff (lignes colorées) */}
            {active.diffLines.map((d) => {
              const color =
                d.type === 'add'
                  ? '#66BB6A'
                  : d.type === 'remove'
                    ? '#E53935'
                    : colors.textFaint + '77';
              return (
                <View
                  key={`l-${d.line}`}
                  style={{
                    position: 'absolute',
                    left: GUTTER_WIDTH,
                    top: (d.line - 1) * (LINE_HEIGHT + LINE_GAP),
                    width: MAP_WIDTH,
                    height: LINE_HEIGHT,
                    backgroundColor: color,
                  }}
                />
              );
            })}

            {/* 3. Couche findings (marqueurs dans la gouttière gauche) */}
            {activeFindings.map((f) => {
              const line = f.location?.startLine;
              if (!line) return null;
              const sev = severityColors[f.severity] || '#888';
              return (
                <View
                  key={`f-${f.id}`}
                  style={{
                    position: 'absolute',
                    left: 2,
                    top: (line - 1) * (LINE_HEIGHT + LINE_GAP) - 2,
                    width: GUTTER_WIDTH - 4,
                    height: 6,
                    borderRadius: 2,
                    backgroundColor: sev,
                  }}
                />
              );
            })}

            {/* 4. Couche navigation (ligne surlignée par tap) */}
            {highlightLine ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: 0,
                  top: (highlightLine - 1) * (LINE_HEIGHT + LINE_GAP) - 1,
                  width: MAP_WIDTH + GUTTER_WIDTH,
                  height: 4,
                  backgroundColor: colors.accent,
                }}
              />
            ) : null}

            {/* Zone de tap transparente couvrant toute la minimap */}
            <Pressable
              style={styles.tapLayer}
              onPress={(e) => {
                const y = e.nativeEvent.locationY;
                const line = Math.max(
                  1,
                  Math.min(active.totalLines, Math.floor(y / (LINE_HEIGHT + LINE_GAP)) + 1)
                );
                handleMapPress(line);
              }}
              accessibilityLabel={t('minimapTapLayerA11y')}
              accessibilityHint={t('minimapTapLayerHint')}
            />

            {/* Règle latérale : numéros de ligne repères (chaque 20) */}
            {Array.from({ length: Math.floor(active.totalLines / 20) }).map((_, i) => {
              const ln = (i + 1) * 20;
              return (
                <Text
                  key={`r-${ln}`}
                  style={{
                    position: 'absolute',
                    right: 2,
                    top: (ln - 1) * (LINE_HEIGHT + LINE_GAP) - 6,
                    color: colors.textFaint,
                    fontSize: 9,
                  }}
                >
                  {ln}
                </Text>
              );
            })}
          </View>

          {/* PANEL D'INFO */}
          <View style={styles.infoPanel}>
            <Text style={styles.sectionLabel}>{t('minimapSectionLegend')}</Text>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#66BB6A' }]} />
              <Text style={styles.legendText}>{t('minimapLegendAdded')}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: '#E53935' }]} />
              <Text style={styles.legendText}>{t('minimapLegendRemoved')}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: colors.textFaint }]} />
              <Text style={styles.legendText}>{t('minimapLegendContext')}</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: severityColors.CRITICAL }]} />
              <Text style={styles.legendText}>{t('minimapLegendFinding')}</Text>
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>{t('minimapSectionPosition')}</Text>
            {highlightLine ? (
              <>
                <Text style={styles.posLine}>{t('minimapLine', { n: highlightLine, total: active.totalLines })}</Text>
                {selectedStructure ? (
                  <View style={styles.structureRow}>
                    <Icon
                      name={selectedStructure.type === 'method' ? 'functions' : 'class'}
                      size={14}
                      color={colors.accent}
                    />
                    <Text style={styles.structureLabel} numberOfLines={2}>
                      {selectedStructure.name}
                    </Text>
                  </View>
                ) : null}
                {findingOnLine ? (
                  <View style={[styles.findingCard, {
                    borderLeftColor: severityColors[findingOnLine.severity] || '#888',
                  }]}>
                    <Text style={styles.findingSeverity}>
                      {findingOnLine.severity}
                    </Text>
                    <Text style={styles.findingTitle} numberOfLines={3}>
                      {findingOnLine.title}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.hintText}>
                {t('minimapHint')}
              </Text>
            )}

            <View style={styles.divider} />

            <Text style={styles.sectionLabel}>
              {t('minimapSectionFindings', { count: activeFindings.length })}
            </Text>
            {activeFindings.length === 0 ? (
              <Text style={styles.hintText}>{t('minimapNoFindings')}</Text>
            ) : (
              activeFindings.slice(0, 3).map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={styles.miniFinding}
                  onPress={() => setHighlightLine(f.location?.startLine)}
                >
                  <View
                    style={[
                      styles.miniFindingDot,
                      { backgroundColor: severityColors[f.severity] || '#888' },
                    ]}
                  />
                  <Text style={styles.miniFindingText} numberOfLines={2}>
                    {t('minimapFindingLine', { line: f.location?.startLine, title: f.title })}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      {highlightLine ? (
        <View style={styles.pinnedBar}>
          <Text style={styles.pinnedLine} numberOfLines={1}>
            {t('minimapLine', { n: highlightLine, total: active.totalLines })}
          </Text>
          <TouchableOpacity
            style={styles.pinnedBtn}
            onPress={() => onOpenDiff?.(active, highlightLine)}
            accessibilityLabel={t('minimapOpenDiffA11y')}
          >
            <Icon name="compare-arrows" size={16} color="#FFF" />
            <Text style={styles.openDiffBtnText}>{t('minimapViewDiff')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
};

const makeStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    emptyWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 40,
    },
    emptyText: {
      color: colors.textMuted,
      marginTop: 10,
      fontSize: 14,
      textAlign: 'center',
    },
    emptySub: {
      color: colors.textFaint,
      marginTop: 6,
      fontSize: 11,
      textAlign: 'center',
    },
    filePickerWrap: {
      paddingTop: 10,
      paddingBottom: 4,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 10,
      letterSpacing: 0.8,
      fontWeight: '700',
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 6,
    },
    fileChipsRow: {
      paddingHorizontal: 12,
      paddingBottom: 8,
      alignItems: 'center',
    },
    fileChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      minHeight: 36,
      marginHorizontal: 4,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    fileChipDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 6,
    },
    fileChipText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
      maxWidth: 180,
    },
    fileChipTextActive: {
      color: colors.text,
    },
    fileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    fileName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: 'bold',
    },
    filePath: {
      color: colors.textFaint,
      fontSize: 10,
      marginTop: 2,
    },
    fileStats: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stat: {
      fontSize: 12,
      fontWeight: '700',
      fontFamily: 'monospace',
    },
    statAdd: { color: '#66BB6A' },
    statRemove: { color: '#E53935' },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      padding: 16,
      paddingBottom: 80,
    },
    mapRow: {
      flexDirection: 'row',
    },
    mapCanvas: {
      position: 'relative',
      backgroundColor: isDark ? '#18181A' : '#F8F8F8',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    structureBand: {
      position: 'absolute',
      left: 0,
      width: 14, // gouttière structure
    },
    tapLayer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    infoPanel: {
      flex: 1,
      marginLeft: 12,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 4,
    },
    legendDot: {
      width: 10,
      height: 6,
      borderRadius: 2,
      marginRight: 6,
    },
    legendText: {
      color: colors.textMuted,
      fontSize: 11,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
      marginHorizontal: 16,
    },
    posLine: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginHorizontal: 16,
    },
    structureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginTop: 4,
    },
    structureLabel: {
      color: colors.textMuted,
      fontSize: 12,
      marginLeft: 6,
      flex: 1,
    },
    findingCard: {
      marginHorizontal: 16,
      marginTop: 8,
      padding: 8,
      borderLeftWidth: 3,
      backgroundColor: colors.card,
      borderRadius: 4,
    },
    findingSeverity: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    findingTitle: {
      color: colors.text,
      fontSize: 12,
    },
    pinnedBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.card,
    },
    pinnedLine: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      flexShrink: 1,
      marginRight: 12,
    },
    pinnedBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.accent,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
      minHeight: 44,
    },
    openDiffBtnText: {
      color: '#FFF',
      fontSize: 13,
      fontWeight: '700',
      marginLeft: 6,
    },
    hintText: {
      color: colors.textFaint,
      fontSize: 11,
      fontStyle: 'italic',
      marginHorizontal: 16,
      lineHeight: 16,
    },
    miniFinding: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: 16,
      marginBottom: 6,
      minHeight: 32,
    },
    miniFindingDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 8,
    },
    miniFindingText: {
      flex: 1,
      color: colors.textMuted,
      fontSize: 11,
    },
  });

export default MiniMap;

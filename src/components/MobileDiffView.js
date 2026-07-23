/**
 * MobileDiffView — unified diff for code review on mobile (Blade Runner).
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { useTheme } from '../services/theme';
import { useTranslation } from 'react-i18next';

const AUTO_COLLAPSE_THRESHOLD = 8;
const MAX_VISIBLE_LINES = 20;
const INDENT_WIDTH = 2;
const DOUBLE_TAP_DELAY = 280;

const FINDING_RED = '#E53935';
const ADD_GREEN = '#66BB6A';
const REMOVE_RED = '#E53935';

const getLineColors = (colors, isDark) => ({
  add: { bg: colors.diffAddBg, marker: ADD_GREEN, mark: '+' },
  remove: { bg: colors.diffRemoveBg, marker: REMOVE_RED, mark: '−' },
  context: { bg: 'transparent', marker: isDark ? '#555' : '#AAA', mark: ' ' },
});

const fileNameOf = (path) => (path ? path.split('/').pop() : '');

const normaliseIndent = (raw) => {
  if (typeof raw !== 'string') return '';
  const match = raw.match(/^[\t ]*/);
  const leading = match ? match[0] : '';
  const rest = raw.slice(leading.length);
  let levels = 0;
  let i = 0;
  while (i < leading.length) {
    if (leading[i] === '\t') {
      levels += 1;
      i += 1;
    } else {
      let spaces = 0;
      while (i < leading.length && leading[i] === ' ' && spaces < 4) {
        spaces += 1;
        i += 1;
      }
      if (spaces > 0) levels += 1;
    }
  }
  return ' '.repeat(levels * INDENT_WIDTH) + rest;
};

const FindingBadge = ({ count, onPress, severity, styles }) => {
  const { t } = useTranslation();
  if (!count) return null;
  const bg = severity === 'critical' ? '#B71C1C' : FINDING_RED;
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('diffFindingBadgeLabel', { count })}
      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
      style={[styles.findingBadge, { backgroundColor: bg }]}
    >
      <Text style={styles.findingBadgeText}>{count > 9 ? '9+' : count}</Text>
    </TouchableOpacity>
  );
};

const DiffLine = React.memo(function DiffLine({
  hunk,
  line,
  idx,
  onCommentLine,
  findings,
  onPressFinding,
  styles,
  lineColors,
  isFocusLine,
  focusLineRef,
}) {
  const { t } = useTranslation();
  const c = lineColors[line.type] || lineColors.context;
  const findingCount = findings ? findings.length : 0;
  const topSeverity =
    findings && findings.find((f) => f.severity === 'critical')
      ? 'critical'
      : 'warn';

  const a11yType =
    line.type === 'add'
      ? t('diffLineTypeAdd')
      : line.type === 'remove'
      ? t('diffLineTypeRemove')
      : t('diffLineTypeContext');

  return (
    <Pressable
      ref={isFocusLine ? focusLineRef : undefined}
      onLongPress={() => onCommentLine && onCommentLine(hunk, line, idx)}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={
        line.lineNumber
          ? t('diffLineLabelWithNumber', {
              type: a11yType,
              number: line.lineNumber,
            })
          : t('diffLineLabel', { type: a11yType })
      }
      style={({ pressed }) => [
        styles.line,
        { backgroundColor: c.bg },
        isFocusLine && styles.focusLine,
        pressed && { opacity: 0.75 },
      ]}
    >
      <View style={styles.lineGutter}>
        {findingCount > 0 ? (
          <FindingBadge
            count={findingCount}
            severity={topSeverity}
            onPress={() => onPressFinding && onPressFinding(findings)}
            styles={styles}
          />
        ) : (
          <Text style={styles.lineNumber}>
            {line.lineNumber != null ? line.lineNumber : ''}
          </Text>
        )}
      </View>
      <Text style={[styles.lineMarker, { color: c.marker }]}>{c.mark}</Text>
      <Text style={styles.lineContent} selectable>
        {normaliseIndent(line.content || '')}
      </Text>
    </Pressable>
  );
});

const HunkBlock = ({
  hunk,
  filePath,
  onCommentLine,
  findingsByLine,
  onPressFinding,
  fileCollapsed,
  styles,
  colors,
  lineColors,
  focusLine,
  focusLineRef,
}) => {
  const { t } = useTranslation();
  const autoCollapse = hunk.lines.length > AUTO_COLLAPSE_THRESHOLD;
  const containsFocus =
    focusLine != null && hunk.lines.some((l) => l.lineNumber === focusLine);
  const [collapsed, setCollapsed] = useState(autoCollapse);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (containsFocus) {
      setCollapsed(false);
      setShowAll(true);
    }
  }, [containsFocus]);

  const added = useMemo(
    () => hunk.lines.filter((l) => l.type === 'add').length,
    [hunk.lines]
  );
  const removed = useMemo(
    () => hunk.lines.filter((l) => l.type === 'remove').length,
    [hunk.lines]
  );

  const effectiveCollapsed = fileCollapsed || collapsed;
  const visibleLines = showAll
    ? hunk.lines
    : hunk.lines.slice(0, MAX_VISIBLE_LINES);
  const hiddenCount = hunk.lines.length - visibleLines.length;

  return (
    <View style={styles.hunk}>
      <TouchableOpacity
        onPress={() => setCollapsed((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={t('diffHunkLabel', {
          line: hunk.oldStart,
          action: effectiveCollapsed ? t('diffExpand') : t('diffCollapse'),
        })}
        accessibilityState={{ expanded: !effectiveCollapsed }}
        style={styles.hunkHeader}
      >
        <Icon
          name={effectiveCollapsed ? 'chevron-right' : 'expand-more'}
          size={22}
          color={colors.textMuted}
        />
        <Text style={styles.hunkRange} numberOfLines={1}>
          @@ -{hunk.oldStart} +{hunk.newStart} @@
        </Text>
        <Text style={styles.hunkStat}>
          <Text style={{ color: ADD_GREEN }}>+{added}</Text>
          {'  '}
          <Text style={{ color: REMOVE_RED }}>−{removed}</Text>
        </Text>
      </TouchableOpacity>

      {!effectiveCollapsed && (
        <View>
          {visibleLines.map((line, idx) => {
            const ln = line.lineNumber;
            const fileFindings =
              (findingsByLine && findingsByLine[filePath]) || null;
            const findings = fileFindings && ln != null ? fileFindings[ln] : null;
            return (
              <DiffLine
                key={`${hunk.oldStart}-${idx}`}
                hunk={hunk}
                line={line}
                idx={idx}
                onCommentLine={onCommentLine}
                findings={findings}
                onPressFinding={onPressFinding}
                styles={styles}
                lineColors={lineColors}
                isFocusLine={focusLine != null && ln === focusLine}
                focusLineRef={focusLineRef}
              />
            );
          })}

          {hiddenCount > 0 && (
            <TouchableOpacity
              onPress={() => setShowAll(true)}
              accessibilityRole="button"
              accessibilityLabel={t('diffShowMoreLabel', { count: hiddenCount })}
              style={styles.showMore}
            >
              <Icon name="unfold-more" size={18} color={colors.accent} />
              <Text style={styles.showMoreText}>
                {t('diffShowMoreText', { count: hiddenCount })}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

const FileBlock = ({
  path,
  hunksOfFile,
  onCommentLine,
  findingsByLine,
  onPressFinding,
  onNavigateFile,
  focusLine,
  focusLineRef,
  styles,
  colors,
  lineColors,
}) => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const lastTap = useRef(0);

  // If we're focused on a specific line, make sure the file is expanded.
  useEffect(() => {
    if (focusLine != null) setCollapsed(false);
  }, [focusLine]);

  const added = useMemo(
    () =>
      hunksOfFile.reduce(
        (n, h) => n + h.lines.filter((l) => l.type === 'add').length,
        0
      ),
    [hunksOfFile]
  );
  const removed = useMemo(
    () =>
      hunksOfFile.reduce(
        (n, h) => n + h.lines.filter((l) => l.type === 'remove').length,
        0
      ),
    [hunksOfFile]
  );

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      setCollapsed((v) => !v);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }, []);

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .failOffsetY([-15, 15])
        .onEnd((e) => {
          'worklet';
          if (!onNavigateFile) return;
          if (e.translationX < -60) {
            onNavigateFile('next');
          } else if (e.translationX > 60) {
            onNavigateFile('prev');
          }
        }),
    [onNavigateFile]
  );

  const HeaderInner = (
    <Pressable
      onPress={handleDoubleTap}
      accessibilityRole="button"
      accessibilityLabel={
        collapsed
          ? t('diffFileLabelExpand', { name: fileNameOf(path) })
          : t('diffFileLabelCollapse', { name: fileNameOf(path) })
      }
      style={styles.fileHeader}
    >
      <Icon name="description" size={20} color={colors.accent} />
      <View style={styles.fileHeaderText}>
        <Text style={styles.fileName} numberOfLines={1}>
          {fileNameOf(path)}
        </Text>
        <Text style={styles.filePath} numberOfLines={1}>
          {path}
        </Text>
      </View>
      <View style={styles.fileStats}>
        <Text style={styles.fileStatAdd}>+{added}</Text>
        <Text style={styles.fileStatRem}>−{removed}</Text>
      </View>
      <TouchableOpacity
        onPress={() => setCollapsed((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={
          collapsed ? t('diffFileExpandAll') : t('diffFileCollapseAll')
        }
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={styles.fileCollapseBtn}
      >
        <Icon
          name={collapsed ? 'unfold-more' : 'unfold-less'}
          size={22}
          color={colors.textMuted}
        />
      </TouchableOpacity>
    </Pressable>
  );

  return (
    <View style={styles.fileBlock}>
      {onNavigateFile ? (
        <GestureDetector gesture={swipe}>{HeaderInner}</GestureDetector>
      ) : (
        HeaderInner
      )}

      {!collapsed &&
        hunksOfFile.map((hunk, idx) => (
          <HunkBlock
            key={`${path}-${idx}`}
            hunk={hunk}
            filePath={path}
            onCommentLine={onCommentLine}
            findingsByLine={findingsByLine}
            onPressFinding={onPressFinding}
            fileCollapsed={collapsed}
            styles={styles}
            colors={colors}
            lineColors={lineColors}
            focusLine={focusLine}
            focusLineRef={focusLineRef}
          />
        ))}

      {collapsed && (
        <View style={styles.fileCollapsedNote}>
          <Icon name="visibility-off" size={14} color={colors.textFaint} />
          <Text style={styles.fileCollapsedText}>
            {t('diffFileCollapsedNote')}
          </Text>
        </View>
      )}
    </View>
  );
};

const MobileDiffView = ({
  hunks = [],
  onCommentLine,
  findingsByLine,
  onNavigateFile,
  onPressFinding,
  focusFile,
  focusLine,
  onClearFocus,
}) => {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const lineColors = useMemo(() => getLineColors(colors, isDark), [colors, isDark]);

  const byFile = useMemo(() => {
    const acc = {};
    for (const h of hunks) {
      if (!acc[h.filePath]) acc[h.filePath] = [];
      acc[h.filePath].push(h);
    }
    return acc;
  }, [hunks]);

  // If focusFile is set, filter entries to that file only.
  // Fall back to the full list if the file has no hunks.
  const allEntries = Object.entries(byFile);
  const entries = useMemo(() => {
    if (!focusFile) return allEntries;
    const filtered = allEntries.filter(([path]) => path === focusFile);
    return filtered.length ? filtered : allEntries;
  }, [allEntries, focusFile]);

  const focusActive = !!focusFile && entries.length < allEntries.length;
  const focusFileName = focusFile ? focusFile.split('/').pop() : null;

  const scrollRef = useRef(null);
  const focusLineRef = useRef(null);
  const rootRef = useRef(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (focusLine == null || !focusFile) return undefined;
    let cancelled = false;
    let tries = 0;
    const attempt = () => {
      if (cancelled) return;
      const node = focusLineRef.current;
      const root = rootRef.current;
      const sv = scrollRef.current;
      if (node && root && sv && node.measureInWindow && root.measureInWindow) {
        root.measureInWindow((rx, ry) => {
          if (cancelled) return;
          node.measureInWindow((nx, ny) => {
            if (cancelled) return;
            const target = scrollYRef.current + (ny - ry) - 80;
            sv.scrollTo({ y: Math.max(0, target), animated: true });
          });
        });
      } else if (tries++ < 15) {
        setTimeout(attempt, 90);
      }
    };
    const t = setTimeout(attempt, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [focusFile, focusLine, entries]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View ref={rootRef} collapsable={false} style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator
        scrollEventThrottle={16}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
      >
        <View style={styles.stickyWrap}>
          {focusActive ? (
            <View style={styles.focusBanner}>
              <Icon name="my-location" size={14} color={colors.accent} />
              <Text style={styles.focusText} numberOfLines={1}>
                {t('diffFocus', { name: focusFileName })}
                {focusLine ? t('diffFocusLineSuffix', { line: focusLine }) : ''}
              </Text>
              <TouchableOpacity
                onPress={onClearFocus}
                style={styles.focusClearBtn}
                accessibilityLabel={t('diffViewAllFiles')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.focusClearText}>{t('diffShowAll')}</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.hint}>
            <Icon name="touch-app" size={14} color={colors.textFaint} />
            <Text style={styles.hintText}>
              {t('diffHintBase')}
              {onNavigateFile ? t('diffHintSwipe') : ''}
            </Text>
          </View>
        </View>

        {entries.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="compare-arrows" size={40} color={colors.textFaint} />
            <Text style={styles.emptyText}>{t('diffEmpty')}</Text>
          </View>
        ) : (
          entries.map(([path, hunksOfFile]) => (
            <FileBlock
              key={path}
              path={path}
              hunksOfFile={hunksOfFile}
              onCommentLine={onCommentLine}
              findingsByLine={findingsByLine}
              onPressFinding={onPressFinding}
              onNavigateFile={onNavigateFile}
              focusLine={focusFile === path ? focusLine : undefined}
              focusLineRef={focusFile === path ? focusLineRef : undefined}
              styles={styles}
              colors={colors}
              lineColors={lineColors}
            />
          ))
        )}
      </ScrollView>
      </View>
    </GestureHandlerRootView>
  );
};

const makeStyles = (colors, isDark) =>
  StyleSheet.create({
    focusLine: {
      backgroundColor: colors.accent + '33',
    },
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    content: {
      paddingBottom: 96,
    },

    stickyWrap: {
      backgroundColor: colors.bg,
      paddingHorizontal: 8,
      paddingTop: 8,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    focusBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginTop: 8,
      minHeight: 40,
    },
    focusText: {
      flex: 1,
      color: colors.text,
      fontSize: 12,
      marginLeft: 6,
      fontWeight: '600',
    },
    focusClearBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: colors.accent,
      minHeight: 32,
      justifyContent: 'center',
    },
    focusClearText: {
      color: '#FFF',
      fontSize: 11,
      fontWeight: '700',
    },

    banner: {
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    bannerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    bannerTitle: {
      flex: 1,
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      marginLeft: 8,
      fontWeight: '500',
    },
    hintsWrap: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    hintsLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    chipsRow: {
      paddingRight: 8,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.chipBg,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 6,
      marginRight: 8,
      maxWidth: 260,
      minHeight: 28,
    },
    chipText: {
      color: colors.chipText,
      fontSize: 12,
      flexShrink: 1,
    },

    hint: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      paddingHorizontal: 4,
    },
    hintText: {
      color: colors.textFaint,
      fontSize: 11,
      marginLeft: 6,
      fontStyle: 'italic',
      flex: 1,
    },

    fileBlock: {
      backgroundColor: colors.card,
      borderRadius: 10,
      marginHorizontal: 8,
      marginTop: 10,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    fileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 10,
      minHeight: 48,
      backgroundColor: colors.cardAlt,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    fileHeaderText: {
      flex: 1,
      marginLeft: 8,
      marginRight: 8,
    },
    fileName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    filePath: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 1,
    },
    fileStats: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 8,
    },
    fileStatAdd: {
      color: ADD_GREEN,
      fontSize: 12,
      fontFamily: 'monospace',
      fontWeight: '700',
      marginRight: 6,
    },
    fileStatRem: {
      color: REMOVE_RED,
      fontSize: 12,
      fontFamily: 'monospace',
      fontWeight: '700',
    },
    fileCollapseBtn: {
      minWidth: 48,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fileCollapsedNote: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      justifyContent: 'center',
    },
    fileCollapsedText: {
      color: colors.textFaint,
      fontSize: 12,
      marginLeft: 6,
      fontStyle: 'italic',
    },

    hunk: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    hunkHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 48,
      paddingHorizontal: 8,
      backgroundColor: colors.codeBg,
    },
    hunkRange: {
      color: colors.textMuted,
      fontSize: 12,
      fontFamily: 'monospace',
      flex: 1,
      marginLeft: 4,
    },
    hunkStat: {
      fontSize: 12,
      fontFamily: 'monospace',
      marginLeft: 8,
    },

    line: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 6,
      paddingHorizontal: 8,
      minHeight: 32,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.lineBorder,
    },
    lineGutter: {
      width: 34,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: 1,
    },
    lineNumber: {
      color: colors.textFaint,
      fontSize: 11,
      fontFamily: 'monospace',
    },
    lineMarker: {
      width: 16,
      fontFamily: 'monospace',
      fontSize: 13,
      fontWeight: '700',
      textAlign: 'center',
    },
    lineContent: {
      flex: 1,
      color: colors.text,
      fontFamily: 'monospace',
      fontSize: 13,
      lineHeight: 19,
      flexWrap: 'wrap',
    },

    findingBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    findingBadgeText: {
      color: '#FFF',
      fontSize: 11,
      fontWeight: '700',
      fontFamily: 'monospace',
    },

    showMore: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 12,
      backgroundColor: isDark
        ? 'rgba(100,181,246,0.08)'
        : 'rgba(25,118,210,0.08)',
    },
    showMoreText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '600',
      marginLeft: 6,
    },

    empty: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    emptyText: {
      color: colors.textMuted,
      marginTop: 8,
      fontSize: 13,
    },
  });

export default MobileDiffView;

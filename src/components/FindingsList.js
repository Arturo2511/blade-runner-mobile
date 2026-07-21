/**
 * FindingsList — liste des findings CodeQL / Sonar triés par sévérité.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { severityColors } from '../data/reviewColors';
import { sortBySeverity, severityRank } from '../utils/sarifParser';
import { useTheme } from '../services/theme';

const categoryIcons = {
  SECURITY: 'security',
  BUG: 'bug-report',
  SMELL: 'auto-fix-high',
  PERF: 'speed',
};

const categoryLabels = {
  SECURITY: 'Sécurité',
  BUG: 'Bug',
  SMELL: 'Smell',
  PERF: 'Perf',
};

const sourceLabels = {
  codeql: 'CodeQL',
  sonar: 'Sonar',
};

const severityFrLabels = {
  CRITICAL: 'Critique',
  HIGH: 'Élevé',
  MED: 'Moyen',
  LOW: 'Faible',
  CLEAN: 'OK',
};

const FindingCard = ({
  finding,
  expanded,
  onToggle,
  onLongPress,
  onComment,
  onViewDiff,
  onMarkSeen,
  styles,
  colors,
}) => {
  const color = severityColors[finding.severity] || '#888';
  const catIcon = categoryIcons[finding.category] || 'info';
  const fileShort = finding.location?.filePath
    ? finding.location.filePath.split('/').slice(-2).join('/')
    : '—';
  const startLine = finding.location?.startLine ?? 0;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onToggle}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={styles.card}
      accessibilityRole="button"
      accessibilityLabel={`Finding ${severityFrLabels[finding.severity] || finding.severity}, ${finding.title}, fichier ${fileShort} ligne ${startLine}`}
      accessibilityState={{ expanded }}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.severityPill, { backgroundColor: color }]}>
          <Text style={styles.severityText}>{finding.severity}</Text>
        </View>

        <View style={styles.categoryBadge}>
          <Icon name={catIcon} size={13} color={colors.text} />
          <Text style={styles.categoryBadgeText}>
            {categoryLabels[finding.category] || finding.category}
          </Text>
        </View>

        <View style={styles.sourceBadge}>
          <Text style={styles.sourceBadgeText}>
            {sourceLabels[finding.source] || finding.source}
          </Text>
        </View>

        <Icon
          name={expanded ? 'expand-less' : 'expand-more'}
          size={22}
          color={colors.textMuted}
          style={styles.expandChevron}
        />
      </View>

      <Text
        style={styles.title}
        numberOfLines={expanded ? undefined : 2}
      >
        {finding.title}
      </Text>

      <View style={styles.fileRefRow}>
        <Icon name="description" size={12} color={colors.textMuted} />
        <Text style={styles.fileRef} numberOfLines={1}>
          {'  '}{fileShort}:{startLine}
        </Text>
      </View>

      {expanded && (
        <View style={styles.details}>
          {!!finding.description && (
            <Text style={styles.description}>{finding.description}</Text>
          )}

          {!!finding.location?.snippet && (
            <View style={styles.snippetBox}>
              <Text style={styles.snippetText}>
                {finding.location.snippet}
              </Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onComment?.(finding)}
              accessibilityRole="button"
            >
              <Icon name="comment" size={18} color={colors.accent} />
              <Text style={styles.actionBtnText}>Commenter</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onViewDiff?.(finding)}
              accessibilityRole="button"
            >
              <Icon name="compare-arrows" size={18} color={colors.accent} />
              <Text style={styles.actionBtnText}>Voir le diff</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => onMarkSeen?.(finding)}
              accessibilityRole="button"
            >
              <Icon name="done" size={18} color={colors.accent} />
              <Text style={styles.actionBtnText}>Marquer vu</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const FilterChip = ({ label, active, count, onPress, styles }) => (
  <TouchableOpacity
    onPress={onPress}
    style={[styles.chip, active && styles.chipActive]}
    accessibilityRole="button"
    accessibilityState={{ selected: !!active }}
  >
    <Text style={[styles.chipText, active && styles.chipTextActive]}>
      {label}
      {count != null ? `  (${count})` : ''}
    </Text>
  </TouchableOpacity>
);

const QuickActionsMenu = ({ finding, visible, onClose, onComment, onViewDiff, onMarkSeen, styles, colors }) => {
  if (!finding) return null;
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.quickMenu}>
          <Text style={styles.quickMenuTitle} numberOfLines={2}>
            {finding.title}
          </Text>
          <TouchableOpacity
            style={styles.quickMenuItem}
            onPress={() => { onClose(); onComment?.(finding); }}
            accessibilityRole="button"
          >
            <Icon name="comment" size={20} color={colors.accent} />
            <Text style={styles.quickMenuItemText}>Commenter</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickMenuItem}
            onPress={() => { onClose(); onViewDiff?.(finding); }}
            accessibilityRole="button"
          >
            <Icon name="compare-arrows" size={20} color={colors.accent} />
            <Text style={styles.quickMenuItemText}>Voir le diff</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickMenuItem}
            onPress={() => { onClose(); onMarkSeen?.(finding); }}
            accessibilityRole="button"
          >
            <Icon name="visibility-off" size={20} color={colors.textMuted} />
            <Text style={[styles.quickMenuItemText, { color: colors.textMuted }]}>Ignorer</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const FindingsList = ({
  findings = [],
  initialFilter = 'ALL',
  onComment,
  onViewDiff,
  onMarkSeen,
}) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const [filter, setFilter] = useState(initialFilter);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [menuFinding, setMenuFinding] = useState(null);

  const severityFilters = ['CRITICAL', 'HIGH', 'MED', 'LOW'];
  const categoryFilters = ['SECURITY', 'BUG', 'SMELL'];

  const countByFn = useMemo(() => {
    return (predicate) => findings.filter(predicate).length;
  }, [findings]);

  const filtered = useMemo(() => {
    let out = findings;
    if (filter !== 'ALL') {
      if (severityFilters.includes(filter)) {
        out = out.filter((f) => f.severity === filter);
      } else if (categoryFilters.includes(filter)) {
        out = out.filter((f) => f.category === filter);
      }
    }
    if (query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      out = out.filter(
        (f) =>
          (f.title || '').toLowerCase().includes(q) ||
          (f.ruleId || '').toLowerCase().includes(q)
      );
    }
    return sortBySeverity(out);
  }, [findings, filter, query]);

  const categoryOrder = { SECURITY: 4, BUG: 3, SMELL: 2, PERF: 1 };
  const prioritized = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const sv = severityRank(b.severity) - severityRank(a.severity);
      if (sv !== 0) return sv;
      return (categoryOrder[b.category] || 0) - (categoryOrder[a.category] || 0);
    });
  }, [filtered]);

  const countBySeverity = (sev) => countByFn((f) => f.severity === sev);
  const countByCategory = (cat) => countByFn((f) => f.category === cat);

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Icon name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher (ruleId, titre)…"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
          accessibilityLabel="Rechercher un finding"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={() => setQuery('')}
            accessibilityLabel="Effacer la recherche"
            style={styles.searchClearBtn}
          >
            <Icon name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={styles.chipsScroll}
      >
        <FilterChip styles={styles} label="Tous" active={filter === 'ALL'} count={findings.length} onPress={() => setFilter('ALL')} />
        <FilterChip styles={styles} label="Critique" active={filter === 'CRITICAL'} count={countBySeverity('CRITICAL')} onPress={() => setFilter('CRITICAL')} />
        <FilterChip styles={styles} label="Élevé" active={filter === 'HIGH'} count={countBySeverity('HIGH')} onPress={() => setFilter('HIGH')} />
        <FilterChip styles={styles} label="Moyen" active={filter === 'MED'} count={countBySeverity('MED')} onPress={() => setFilter('MED')} />
        <FilterChip styles={styles} label="Faible" active={filter === 'LOW'} count={countBySeverity('LOW')} onPress={() => setFilter('LOW')} />
        <View style={styles.chipSeparator} />
        <FilterChip styles={styles} label="SECURITY" active={filter === 'SECURITY'} count={countByCategory('SECURITY')} onPress={() => setFilter('SECURITY')} />
        <FilterChip styles={styles} label="BUG" active={filter === 'BUG'} count={countByCategory('BUG')} onPress={() => setFilter('BUG')} />
        <FilterChip styles={styles} label="SMELL" active={filter === 'SMELL'} count={countByCategory('SMELL')} onPress={() => setFilter('SMELL')} />
      </ScrollView>

      {prioritized.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="verified" size={40} color="#66BB6A" />
          <Text style={styles.emptyText}>
            {findings.length === 0
              ? 'Aucun problème détecté'
              : 'Aucun résultat pour ces filtres'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={prioritized}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <FindingCard
              finding={item}
              expanded={expandedId === item.id}
              onToggle={() =>
                setExpandedId(expandedId === item.id ? null : item.id)
              }
              onLongPress={() => setMenuFinding(item)}
              onComment={onComment}
              onViewDiff={onViewDiff}
              onMarkSeen={onMarkSeen}
              styles={styles}
              colors={colors}
            />
          )}
        />
      )}

      <QuickActionsMenu
        visible={!!menuFinding}
        finding={menuFinding}
        onClose={() => setMenuFinding(null)}
        onComment={onComment}
        onViewDiff={onViewDiff}
        onMarkSeen={onMarkSeen}
        styles={styles}
        colors={colors}
      />
    </View>
  );
};

const makeStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      marginHorizontal: 12,
      marginTop: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      height: 44,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      color: colors.text,
      marginLeft: 8,
      fontSize: 14,
      paddingVertical: 0,
    },
    searchClearBtn: {
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    chipsScroll: {
      flexGrow: 0,
      maxHeight: 60,
    },
    chipsRow: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      alignItems: 'center',
    },
    chip: {
      minHeight: 36,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: colors.card,
      borderRadius: 18,
      marginRight: 8,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
    },
    chipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipText: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    chipTextActive: {
      color: '#FFF',
    },
    chipSeparator: {
      width: 1,
      height: 20,
      backgroundColor: colors.border,
      marginHorizontal: 4,
    },
    listContent: {
      paddingHorizontal: 12,
      paddingBottom: 96,
      paddingTop: 4,
    },
    card: {
      minHeight: 56,
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 12,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
      flexWrap: 'wrap',
    },
    severityPill: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    severityText: {
      color: '#FFF',
      fontSize: 10,
      fontWeight: 'bold',
      letterSpacing: 0.5,
    },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 8,
      borderRadius: 4,
      backgroundColor: colors.cardAlt,
    },
    categoryBadgeText: {
      color: colors.text,
      fontSize: 10,
      fontWeight: '600',
      marginLeft: 4,
    },
    sourceBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginLeft: 6,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sourceBadgeText: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
    },
    expandChevron: {
      marginLeft: 'auto',
    },
    title: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
    },
    fileRefRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    fileRef: {
      color: colors.textMuted,
      fontSize: 11,
    },
    details: {
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    description: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 10,
    },
    snippetBox: {
      backgroundColor: colors.codeBg,
      borderRadius: 6,
      padding: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    snippetText: {
      color: colors.text,
      fontFamily: 'monospace',
      fontSize: 11,
      flexWrap: 'wrap',
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
    },
    actionBtn: {
      minHeight: 44,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginLeft: 4,
      borderRadius: 6,
    },
    actionBtnText: {
      color: colors.accent,
      fontSize: 12,
      marginLeft: 6,
      fontWeight: '600',
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    },
    emptyText: {
      color: colors.textMuted,
      marginTop: 8,
    },
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    quickMenu: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickMenuTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 8,
    },
    quickMenuItem: {
      minHeight: 48,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    quickMenuItemText: {
      color: colors.text,
      fontSize: 14,
      marginLeft: 14,
    },
  });

export default FindingsList;

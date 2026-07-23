import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../services/theme';

function toPlain(md) {
  return String(md || '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\$\\rightarrow\$/g, '→')
    .replace(/\$([^$]*)\$/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/^\s*---\s*$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function renderInline(text, styles) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <Text key={i} style={styles.bold}>
          {p.slice(2, -2)}
        </Text>
      );
    }
    const clean = p
      .replace(/`([^`]*)`/g, '$1')
      .replace(/\$\\rightarrow\$/g, '→')
      .replace(/\$([^$]*)\$/g, '$1');
    return <Text key={i}>{clean}</Text>;
  });
}

function MarkdownBlocks({ md, styles }) {
  const blocks = [];
  String(md || '')
    .split('\n')
    .forEach((raw, idx) => {
      const line = raw.replace(/\s+$/, '');
      if (!line.trim()) return;

      if (/^#{1,6}\s+/.test(line)) {
        const level = line.match(/^#+/)[0].length;
        const txt = line.replace(/^#{1,6}\s+/, '');
        blocks.push(
          <Text key={idx} style={[styles.h, level <= 2 ? styles.h2 : styles.h3]}>
            {renderInline(txt, styles)}
          </Text>
        );
      } else if (/^\s*[-*]\s+/.test(line)) {
        const txt = line.replace(/^\s*[-*]\s+/, '');
        blocks.push(
          <View key={idx} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{renderInline(txt, styles)}</Text>
          </View>
        );
      } else if (/^\s*\d+\.\s+/.test(line)) {
        const m = line.match(/^\s*(\d+)\.\s+(.*)$/);
        blocks.push(
          <View key={idx} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>{m[1]}.</Text>
            <Text style={styles.bulletText}>{renderInline(m[2], styles)}</Text>
          </View>
        );
      } else if (/^\s*---\s*$/.test(line)) {
        blocks.push(<View key={idx} style={styles.hr} />);
      } else {
        blocks.push(
          <Text key={idx} style={styles.p}>
            {renderInline(line, styles)}
          </Text>
        );
      }
    });
  return <View>{blocks}</View>;
}

const AiSummary = ({ summary }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { height } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);

  const hasSummary = typeof summary === 'string' && summary.trim().length > 0;
  if (!hasSummary) return null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Icon name="auto-awesome" size={14} color="#FFD54F" />
        <Text style={styles.label}>{t('aiSummaryLabel')}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={() => setExpanded((e) => !e)}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.toggle}>{expanded ? t('aiSummaryShowLess') : t('aiSummaryShowMore')}</Text>
        </TouchableOpacity>
      </View>

      {expanded ? (
        <ScrollView
          style={{ maxHeight: Math.round(height * 0.4) }}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          <MarkdownBlocks md={summary} styles={styles} />
        </ScrollView>
      ) : (
        <Text
          style={styles.preview}
          numberOfLines={3}
          onPress={() => setExpanded(true)}
        >
          {toPlain(summary)}
        </Text>
      )}
    </View>
  );
};

const makeStyles = (c) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      padding: 12,
      marginHorizontal: 12,
      marginTop: 8,
    },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    label: {
      color: '#FFD54F',
      fontSize: 12,
      fontWeight: '700',
      marginLeft: 4,
      letterSpacing: 0.3,
    },
    toggle: { color: c.accent, fontSize: 12, fontWeight: '600' },
    preview: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    h: { color: c.text, fontWeight: '700', marginTop: 8, marginBottom: 2 },
    h2: { fontSize: 15 },
    h3: { fontSize: 13.5 },
    p: { color: c.text, fontSize: 13, lineHeight: 19, marginBottom: 4 },
    bold: { fontWeight: '700', color: c.text },
    bulletRow: { flexDirection: 'row', marginBottom: 3, paddingLeft: 4 },
    bulletDot: {
      color: c.accent,
      fontSize: 13,
      lineHeight: 19,
      width: 18,
      fontWeight: '700',
    },
    bulletText: { color: c.text, fontSize: 13, lineHeight: 19, flex: 1 },
    hr: { height: 1, backgroundColor: c.border, marginVertical: 8 },
  });

export default AiSummary;

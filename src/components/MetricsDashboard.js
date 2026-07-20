/**
 * MetricsDashboard — grille des KPI d'une PR.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { qualityGateColors, severityColors } from '../data/reviewColors';
import { useTheme } from '../services/theme';

const gateLabel = {
  OK: 'PASSED',
  WARN: 'WARNING',
  ERROR: 'FAILED',
  NONE: 'N/A',
};

const gateIcon = {
  OK: 'check-circle',
  WARN: 'warning',
  ERROR: 'error',
  NONE: 'help',
};

const colorForBugs = (n) => (n > 0 ? severityColors.CRITICAL : severityColors.CLEAN);
const colorForVulns = (n) => (n > 0 ? severityColors.CRITICAL : severityColors.CLEAN);
const colorForHotspots = (n) => (n > 0 ? severityColors.HIGH : severityColors.CLEAN);
const colorForSmells = (n) => (n > 5 ? severityColors.HIGH : severityColors.CLEAN);
const colorForCoverage = (c) => {
  if (c == null) return '#757575';
  if (c < 60) return severityColors.CRITICAL;
  if (c < 80) return severityColors.HIGH;
  return severityColors.CLEAN;
};
const colorForComplexity = (v, accent) => {
  if (v == null) return accent;
  if (v > 15) return severityColors.HIGH;
  if (v > 10) return severityColors.MED;
  return severityColors.CLEAN;
};

/** Carte KPI générique. */
const MetricCard = ({
  metricKey,
  icon,
  label,
  value,
  subtitle,
  color,
  onPress,
  accessibilityLabel,
  styles,
}) => {
  const Container = onPress ? TouchableOpacity : View;
  return (
    <Container
      activeOpacity={onPress ? 0.8 : 1}
      onPress={onPress ? () => onPress(metricKey) : undefined}
      style={styles.card}
      accessibilityRole={onPress ? 'button' : 'summary'}
      accessibilityLabel={accessibilityLabel || `${label} ${value}`}
      accessibilityHint={onPress ? 'Appuyer pour voir le détail' : undefined}
    >
      <Icon name={icon} size={26} color={color} />
      <View style={styles.cardText}>
        <Text style={styles.cardValue} numberOfLines={1}>{value}</Text>
        <Text style={styles.cardLabel} numberOfLines={1}>{label}</Text>
        {subtitle ? (
          <Text style={styles.cardSubtitle} numberOfLines={1}>{subtitle}</Text>
        ) : null}
      </View>
    </Container>
  );
};

const MetricsDashboard = ({ summary, onMetricPress }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  if (!summary) return null;

  const gate = summary.qualityGate || 'NONE';
  const gateColor = qualityGateColors[gate] || qualityGateColors.NONE;
  const gateTxt = gateLabel[gate] || 'N/A';

  const hasComplexity =
    typeof summary.complexity === 'number' && summary.complexity > 0;

  const handleGatePress = onMetricPress
    ? () => onMetricPress('qualityGate')
    : undefined;

  return (
    <View style={styles.container}>
      {/* Quality Gate */}
      <TouchableOpacity
        activeOpacity={onMetricPress ? 0.85 : 1}
        disabled={!onMetricPress}
        onPress={handleGatePress}
        style={[
          styles.gateCard,
          { backgroundColor: gateColor + '22', borderColor: gateColor },
        ]}
        accessibilityRole={onMetricPress ? 'button' : 'summary'}
        accessibilityLabel={`Quality Gate ${gateTxt}`}
      >
        <View style={styles.gateTextBlock}>
          <Text style={styles.gateTitle}>QUALITY GATE</Text>
          <Text style={[styles.gateValue, { color: gateColor }]}>{gateTxt}</Text>
          {typeof summary.criticalFindings === 'number' && (
            <Text style={styles.gateSubtitle}>
              {summary.criticalFindings} finding{summary.criticalFindings > 1 ? 's' : ''} critique{summary.criticalFindings > 1 ? 's' : ''}
            </Text>
          )}
        </View>
        <Icon name={gateIcon[gate] || 'help'} size={56} color={gateColor} />
      </TouchableOpacity>

      {/* Sécurité */}
      <View style={styles.row}>
        <MetricCard
          styles={styles}
          metricKey="securityHotspots"
          icon="whatshot"
          label="Hotspots"
          value={summary.securityHotspots ?? 0}
          color={colorForHotspots(summary.securityHotspots ?? 0)}
          onPress={onMetricPress}
          accessibilityLabel={`${summary.securityHotspots ?? 0} hotspots de sécurité`}
        />
        <MetricCard
          styles={styles}
          metricKey="vulnerabilities"
          icon="security"
          label="Vulnérabilités"
          value={summary.vulnerabilities ?? 0}
          color={colorForVulns(summary.vulnerabilities ?? 0)}
          onPress={onMetricPress}
          accessibilityLabel={`${summary.vulnerabilities ?? 0} vulnérabilités`}
        />
      </View>

      {/* Qualité */}
      <View style={styles.row}>
        <MetricCard
          styles={styles}
          metricKey="bugs"
          icon="bug-report"
          label="Bugs"
          value={summary.bugs ?? 0}
          color={colorForBugs(summary.bugs ?? 0)}
          onPress={onMetricPress}
          accessibilityLabel={`${summary.bugs ?? 0} bugs`}
        />
        <MetricCard
          styles={styles}
          metricKey="codeSmells"
          icon="auto-fix-high"
          label="Code smells"
          value={summary.codeSmells ?? 0}
          color={colorForSmells(summary.codeSmells ?? 0)}
          onPress={onMetricPress}
          accessibilityLabel={`${summary.codeSmells ?? 0} code smells`}
        />
      </View>

      {/* Couverture + fichiers */}
      <View style={styles.row}>
        <MetricCard
          styles={styles}
          metricKey="coverage"
          icon="analytics"
          label="Coverage"
          value={
            summary.coverage != null
              ? `${Number(summary.coverage).toFixed(1)}%`
              : '—'
          }
          color={colorForCoverage(summary.coverage)}
          onPress={onMetricPress}
        />
        <MetricCard
          styles={styles}
          metricKey="impactedFiles"
          icon="folder-open"
          label="Fichiers"
          value={summary.impactedFilesCount ?? 0}
          subtitle={`+${summary.linesAdded ?? 0} / -${summary.linesRemoved ?? 0}`}
          color={colors.accent}
          onPress={onMetricPress}
        />
      </View>

      {hasComplexity && (
        <View style={styles.row}>
          <MetricCard
            styles={styles}
            metricKey="complexity"
            icon="timeline"
            label="Complexité cyclomatique"
            value={summary.complexity}
            color={colorForComplexity(summary.complexity, colors.accent)}
            onPress={onMetricPress}
          />
          <View style={styles.cardPlaceholder} />
        </View>
      )}
    </View>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      padding: 12,
      backgroundColor: colors.bg,
    },
    gateCard: {
      minHeight: 110,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 18,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 12,
    },
    gateTextBlock: {
      flex: 1,
      paddingRight: 12,
    },
    gateTitle: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 1.5,
      fontWeight: '700',
    },
    gateValue: {
      fontSize: 28,
      fontWeight: '800',
      marginTop: 6,
      letterSpacing: 0.5,
    },
    gateSubtitle: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 4,
    },
    row: {
      flexDirection: 'row',
      marginBottom: 12,
      marginHorizontal: -6,
    },
    card: {
      minHeight: 88,
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 14,
      marginHorizontal: 6,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardPlaceholder: {
      flex: 1,
      marginHorizontal: 6,
    },
    cardText: {
      marginLeft: 12,
      flex: 1,
    },
    cardValue: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '800',
    },
    cardLabel: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    cardSubtitle: {
      color: colors.textFaint,
      fontSize: 11,
      marginTop: 2,
    },
  });

export default MetricsDashboard;

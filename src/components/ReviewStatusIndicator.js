import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../services/theme';

const ReviewStatusIndicator = ({ status, compact = false }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return {
          icon: 'hourglass-empty',
          color: '#FFB74D',
          label: t('pending'),
          description: t('waitingForReview'),
        };
      case 'in_progress':
        return {
          icon: 'sync',
          color: '#64B5F6',
          label: t('inProgress'),
          description: t('reviewInProgress'),
        };
      case 'changes_requested':
        return {
          icon: 'feedback',
          color: '#F44336',
          label: t('changesRequested'),
          description: t('reviewerRequestedChanges'),
        };
      case 'approved':
        return {
          icon: 'check-circle',
          color: '#4CAF50',
          label: t('approved'),
          description: t('reviewApproved'),
        };
      case 'rejected':
        return {
          icon: 'cancel',
          color: '#F44336',
          label: t('rejected'),
          description: t('reviewRejected'),
        };
      default:
        return {
          icon: 'help',
          color: '#BDBDBD',
          label: t('unknown'),
          description: t('unknownStatus'),
        };
    }
  };

  const statusConfig = getStatusConfig();

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: statusConfig.color }]}>
        <Icon name={statusConfig.icon} size={16} color="#FFF" />
        <Text style={styles.compactLabel}>{statusConfig.label}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.iconContainer, { backgroundColor: statusConfig.color }]}>
        <Icon name={statusConfig.icon} size={24} color="#FFF" />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.label}>{statusConfig.label}</Text>
        <Text style={styles.description}>{statusConfig.description}</Text>
      </View>
    </View>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
    },
    label: {
      color: colors.text,
      fontSize: 16,
      fontWeight: 'bold',
      marginBottom: 4,
    },
    description: {
      color: colors.textMuted,
      fontSize: 14,
    },
    compactContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 16,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    compactLabel: {
      color: '#FFF',
      fontSize: 12,
      fontWeight: 'bold',
      marginLeft: 4,
    },
  });

export default ReviewStatusIndicator;

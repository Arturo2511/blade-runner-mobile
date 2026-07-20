import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useAuth } from '../services/context';
import { useTheme } from '../services/theme';

/**
 * ProfileScreen — read-only GitHub profile + preferences.
 *
 * Since auth is OAuth GitHub, the account info (name, login, avatar, email)
 * comes from GitHub and is not editable in the app. This screen is therefore
 * limited to:
 *  - Display the GitHub identity (read-only, link "Open on GitHub")
 *  - Preferences: theme (Auto/Light/Dark), language, notifications
 *  - Session: logout
 */
const ProfileScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const { logout, user } = useAuth();
  const { mode: themeMode, setMode: setThemeMode, colors } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const styles = useMemo(() => makeStyles(colors), [colors]);

  const ghUser = user || {
    login: 'demo-reviewer',
    name: 'Demo Reviewer',
    avatar_url: null,
    email: null,
    provider: 'github',
  };

  const initial = (ghUser.name || ghUser.login || '?').trim().charAt(0).toUpperCase();

  const themeOptions = [
    { key: 'auto', label: t('themeAuto'), icon: 'brightness-auto' },
    { key: 'light', label: t('themeLight'), icon: 'light-mode' },
    { key: 'dark', label: t('themeDark'), icon: 'dark-mode' },
  ];

  const handleChangeLanguage = () => {
    const newLang = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
  };

  const handleOpenGithub = () => {
    if (ghUser.login) {
      Linking.openURL(`https://github.com/${ghUser.login}`).catch(() => {});
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      // logout clears local state anyway
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('profile')}</Text>
        </View>

        {/* Identité GitHub — read only */}
        <View style={styles.identityCard}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{ghUser.name || ghUser.login}</Text>
          {ghUser.login ? (
            <View style={styles.handleRow}>
              <Icon name="code" size={14} color={colors.textMuted} />
              <Text style={styles.handle}>@{ghUser.login}</Text>
            </View>
          ) : null}
          {ghUser.email ? <Text style={styles.email}>{ghUser.email}</Text> : null}

          <TouchableOpacity
            style={styles.githubLink}
            onPress={handleOpenGithub}
            accessibilityLabel="Ouvrir mon profil GitHub"
          >
            <Icon name="open-in-new" size={16} color={colors.accent} />
            <Text style={styles.githubLinkText}>Voir sur GitHub</Text>
          </TouchableOpacity>
        </View>

        {/* Préférences */}
        <Text style={styles.sectionLabel}>{t('settings')}</Text>

        <View style={styles.group}>
          <View style={[styles.row, styles.rowTop]}>
            <View style={styles.rowLeft}>
              <Icon name="notifications" size={22} color={colors.accent} />
              <Text style={styles.rowLabel}>{t('notifications')}</Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#767577', true: colors.accent }}
              thumbColor={notificationsEnabled ? '#FFF' : '#f4f3f4'}
            />
          </View>

          <View style={[styles.row, styles.themeRow]}>
            <View style={styles.rowLeft}>
              <Icon name="brightness-2" size={22} color={colors.accent} />
              <Text style={styles.rowLabel}>{t('themeMode')}</Text>
            </View>
            <View style={styles.themeChipsRow}>
              {themeOptions.map((opt) => {
                const active = themeMode === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={opt.label}
                    onPress={() => setThemeMode(opt.key)}
                    style={[styles.themeChip, active && styles.themeChipActive]}
                  >
                    <Icon
                      name={opt.icon}
                      size={14}
                      color={active ? '#FFF' : colors.textMuted}
                    />
                    <Text
                      style={[styles.themeChipText, active && styles.themeChipTextActive]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity style={[styles.row, styles.rowBottom]} onPress={handleChangeLanguage}>
            <View style={styles.rowLeft}>
              <Icon name="language" size={22} color={colors.accent} />
              <Text style={styles.rowLabel}>{t('language')}</Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{i18n.language.toUpperCase()}</Text>
              <Icon name="chevron-right" size={22} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          accessibilityLabel={t('logout')}
        >
          <Icon name="exit-to-app" size={20} color="#F44336" />
          <Text style={styles.logoutText}>{t('logout')}</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Blade Runner · UNamur · Master 60</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: 32,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    headerTitle: {
      color: colors.text,
      fontSize: 24,
      fontWeight: 'bold',
    },
    identityCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      marginHorizontal: 16,
      marginTop: 12,
      padding: 20,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarPlaceholder: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.accent,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatarText: {
      color: '#FFF',
      fontSize: 32,
      fontWeight: 'bold',
    },
    name: {
      color: colors.text,
      fontSize: 20,
      fontWeight: '700',
    },
    handleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    handle: {
      color: colors.textMuted,
      fontSize: 13,
      marginLeft: 4,
    },
    email: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 4,
    },
    githubLink: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 40,
    },
    githubLinkText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '600',
      marginLeft: 6,
    },
    sectionLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      marginHorizontal: 20,
      marginTop: 24,
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    group: {
      backgroundColor: colors.card,
      borderRadius: 12,
      marginHorizontal: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      minHeight: 56,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowTop: {},
    rowBottom: {
      borderBottomWidth: 0,
    },
    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    rowLabel: {
      color: colors.text,
      fontSize: 15,
      marginLeft: 12,
    },
    rowRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rowValue: {
      color: colors.textMuted,
      fontSize: 14,
      marginRight: 6,
    },
    themeRow: {
      paddingVertical: 12,
      flexWrap: 'wrap',
      rowGap: 8,
    },
    themeChipsRow: {
      flexDirection: 'row',
    },
    themeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginLeft: 6,
      minHeight: 32,
    },
    themeChipActive: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    themeChipText: {
      color: colors.textMuted,
      fontSize: 12,
      marginLeft: 4,
      fontWeight: '600',
    },
    themeChipTextActive: {
      color: '#FFF',
    },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 16,
      marginTop: 24,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#F44336',
      minHeight: 48,
    },
    logoutText: {
      color: '#F44336',
      fontSize: 15,
      fontWeight: '600',
      marginLeft: 8,
    },
    footer: {
      color: colors.textFaint,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 32,
    },
  });

export default ProfileScreen;

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useAuth } from '../services/context';
import { useTheme } from '../services/theme';

/**
 * AuthScreen — GitHub OAuth (Device Flow).
 *
 * If GitHub OAuth is configured (config/github.js), tapping the button
 * starts a real device flow: we display the user_code, open the GitHub
 * verification page in the system browser, and wait for the token.
 * If not configured, login fails with an error.
 */
const AuthScreen = () => {
  const { t, i18n } = useTranslation();
  const { loginWithGithub } = useAuth();
  const [loading, setLoading] = useState(false);
  const [device, setDevice] = useState(null); // { userCode, verificationUri, completion, cancel }
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'fr' ? 'en' : 'fr';
    i18n.changeLanguage(newLang);
  };

  const handleGithubLogin = async () => {
    if (loading) return;
    console.log('[Auth] tap login');
    setLoading(true);
    try {
      const result = await loginWithGithub();
      console.log('[Auth] login result:', result?.type);
      if (result?.type === 'device') {
        // Show the user_code modal and start polling.
        setDevice(result);
        setLoading(false);

        try {
          await result.completion;
          setDevice(null);
        } catch (err) {
          console.log('[Auth] device flow error:', err);
          setDevice(null);
          if (String(err?.message) !== 'cancelled') {
            Alert.alert('Échec de la connexion', describeError(err));
          }
        }
      } else {
        setLoading(false);
      }
    } catch (e) {
      console.log('[Auth] login threw:', e);
      setLoading(false);
      Alert.alert('Erreur', describeError(e));
    }
  };

  const handleCopyCode = async () => {
    if (!device?.userCode) return;
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(device.userCode);
      Alert.alert('Copié', 'Code copié dans le presse-papier');
    } catch {
      // expo-clipboard not installed — silently ignore
    }
  };

  const handleOpenBrowser = async () => {
    if (!device?.verificationUri) return;
    const oauth = await import('../services/githubOAuth');
    await oauth.openVerificationPage(device.verificationUri);
  };

  const handleCancelDevice = () => {
    if (device?.cancel) device.cancel();
    setDevice(null);
  };

  const openPrivacyInfo = () => {
    Alert.alert(t('privacyTitle'), t('privacyBody'), [{ text: 'OK' }]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.languageToggle}>
        <TouchableOpacity onPress={toggleLanguage} style={styles.languageButton}>
          <Text style={styles.languageButtonText}>
            {i18n.language === 'fr' ? 'EN' : 'FR'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logoContainer}>
        <View style={styles.logoBg}>
          <Icon name="code" size={44} color={colors.accent} />
        </View>
        <Text style={styles.appName}>Blade Runner</Text>
        <Text style={styles.appTagline}>{t('appTagline')}</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.githubButton}
          onPress={handleGithubLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Icon name="code" size={22} color="#FFF" style={styles.githubIcon} />
              <Text style={styles.githubButtonText}>{t('continueWithGithub')}</Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.infoRow}>
          <Icon name="info-outline" size={14} color={colors.textFaint} />
          <Text style={styles.infoText}>{t('githubOnlyInfo')}</Text>
        </View>

        <TouchableOpacity onPress={openPrivacyInfo} style={styles.privacyLink}>
          <Icon name="privacy-tip" size={14} color={colors.textFaint} />
          <Text style={styles.privacyLinkText}>{t('privacyLink')}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.footer}>
        UNamur · {new Date().getFullYear()} · Master 60
      </Text>

      {/* Device-flow modal */}
      <Modal
        visible={!!device}
        transparent
        animationType="fade"
        onRequestClose={handleCancelDevice}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleCancelDevice}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Icon name="key" size={32} color={colors.accent} />
            <Text style={styles.modalTitle}>Connecter votre compte GitHub</Text>
            <Text style={styles.modalSub}>
              1. Ouvre {device?.verificationUri || 'github.com/login/device'} dans ton navigateur
              {'\n'}2. Saisis le code ci-dessous
              {'\n'}3. Reviens ici, on prend la suite automatiquement.
            </Text>

            <View style={styles.codeBox}>
              <Text style={styles.codeText} selectable>
                {device?.userCode || '—'}
              </Text>
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity style={styles.modalAction} onPress={handleCopyCode}>
                <Icon name="content-copy" size={18} color={colors.accent} />
                <Text style={styles.modalActionText}>Copier</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalAction} onPress={handleOpenBrowser}>
                <Icon name="open-in-new" size={18} color={colors.accent} />
                <Text style={styles.modalActionText}>Ouvrir GitHub</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.waitingRow}>
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text style={styles.waitingText}>En attente de votre autorisation…</Text>
            </View>

            <TouchableOpacity onPress={handleCancelDevice} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

function describeError(err) {
  const msg = String(err?.message || err || '');
  if (msg === 'expired_token') return 'Le code a expiré. Réessaie.';
  if (msg === 'access_denied') return 'Connexion refusée.';
  if (msg.includes('Network')) return 'Pas de connexion internet.';
  return msg || 'Impossible de se connecter à GitHub.';
}

const makeStyles = (colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
      paddingHorizontal: 24,
      justifyContent: 'space-between',
    },
    languageToggle: {
      alignSelf: 'flex-end',
      marginTop: 8,
    },
    languageButton: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    languageButtonText: {
      color: colors.text,
      fontWeight: 'bold',
    },
    logoContainer: {
      alignItems: 'center',
      marginTop: 40,
    },
    logoBg: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: isDark
        ? 'rgba(100, 181, 246, 0.15)'
        : 'rgba(25, 118, 210, 0.12)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    appName: {
      color: colors.text,
      fontSize: 32,
      fontWeight: 'bold',
    },
    appTagline: {
      color: colors.textMuted,
      fontSize: 14,
      marginTop: 8,
      textAlign: 'center',
      paddingHorizontal: 20,
    },
    actions: {
      marginBottom: 40,
    },
    githubButton: {
      backgroundColor: '#24292F',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: 16,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: isDark ? '#444' : '#1A1E22',
    },
    githubIcon: {
      marginRight: 10,
    },
    githubButtonText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: '600',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'center',
      marginTop: 16,
      paddingHorizontal: 8,
    },
    infoText: {
      color: colors.textFaint,
      fontSize: 11,
      marginLeft: 6,
      lineHeight: 16,
      flexShrink: 1,
      textAlign: 'center',
    },
    privacyLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
    },
    privacyLinkText: {
      color: colors.textFaint,
      fontSize: 12,
      marginLeft: 4,
      textDecorationLine: 'underline',
    },
    footer: {
      color: colors.textFaint,
      fontSize: 11,
      textAlign: 'center',
      marginBottom: 12,
    },

    // Device flow modal
    modalBackdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalCard: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 24,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 17,
      fontWeight: 'bold',
      marginTop: 12,
      textAlign: 'center',
    },
    modalSub: {
      color: colors.textMuted,
      fontSize: 12,
      lineHeight: 18,
      textAlign: 'left',
      marginTop: 12,
      alignSelf: 'stretch',
    },
    codeBox: {
      backgroundColor: isDark ? '#0A0A0A' : '#F0F0F3',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingVertical: 16,
      paddingHorizontal: 24,
      marginTop: 16,
      marginBottom: 12,
    },
    codeText: {
      color: colors.accent,
      fontSize: 28,
      letterSpacing: 4,
      fontFamily: 'monospace',
      fontWeight: 'bold',
    },
    modalActionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignSelf: 'stretch',
      marginVertical: 8,
    },
    modalAction: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 8,
      minHeight: 44,
    },
    modalActionText: {
      color: colors.accent,
      fontSize: 13,
      fontWeight: '700',
      marginLeft: 6,
    },
    waitingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      marginBottom: 4,
    },
    waitingText: {
      color: colors.textMuted,
      fontSize: 12,
      marginLeft: 8,
    },
    cancelBtn: {
      marginTop: 12,
      paddingVertical: 10,
      paddingHorizontal: 20,
      minHeight: 44,
      justifyContent: 'center',
    },
    cancelBtnText: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '600',
    },
  });

export default AuthScreen;

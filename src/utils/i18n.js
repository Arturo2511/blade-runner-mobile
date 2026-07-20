import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Auth
      continueWithGithub: 'Continue with GitHub',
      appTagline: 'Nomadic ergonomic code review',
      githubOnlyInfo:
        'We use your GitHub account to access your pull requests. No password is stored.',
      privacyTitle: 'Privacy',
      privacyBody:
        'Blade Runner stores only aggregated PR metrics. The OAuth token is kept in the device secure storage. Source code is not persisted on our servers.',
      privacyLink: 'Privacy policy',

      // Navigation / Tabs
      home: 'Home',
      reviews: 'Reviews',
      profile: 'Profile',
      dashboard: 'Dashboard',

      // PR screen tabs
      overview: 'Overview',
      map: 'Map',
      diff: 'Diff',
      graph: 'Graph',
      findings: 'Findings',

      // Review actions
      approve: 'Approve',
      requestChanges: 'Request changes',
      comment: 'Comment',

      // Filters
      pendingReviews: 'Pending reviews',
      myReviews: 'My pull requests',
      recentActivity: 'Recent activity',
      seeAll: 'See all',
      allReviews: 'All reviews',
      newReview: 'New review',
      settings: 'Settings',

      // Code viewer legacy
      files: 'Files',
      comments: 'Comments',
      diffView: 'Diff view',
      selectFileToView: 'Select a file to view',
      browseFiles: 'Browse files',

      // Generic
      loading: 'Loading…',
      error: 'An error occurred',
      retry: 'Retry',

      // Auth screen
      email: 'Email',
      password: 'Password',
      forgotPassword: 'Forgot password?',
      login: 'Log in',
      loginWithGoogle: 'Log in with Google',
      dontHaveAccount: "Don't have an account?",
      signup: 'Sign up',
      fullName: 'Full name',
      confirmPassword: 'Confirm password',
      alreadyHaveAccount: 'Already have an account?',
      mobileCodeReview: 'Mobile code review',

      // Profile screen
      name: 'Name',
      enterName: 'Enter your name',
      enterEmail: 'Enter your email',
      role: 'Role',
      enterRole: 'Enter your role',
      team: 'Team',
      enterTeam: 'Enter your team',
      bio: 'Bio',
      enterBio: 'Enter a short bio',
      editProfile: 'Edit profile',
      nameEmailRequired: 'Name and email are required',
      ok: 'OK',
      cancel: 'Cancel',
      save: 'Save',
      notifications: 'Notifications',
      darkMode: 'Dark mode',
      themeMode: 'Theme',
      themeAuto: 'Auto',
      themeLight: 'Light',
      themeDark: 'Dark',
      language: 'Language',
      changePassword: 'Change password',
      logout: 'Log out',

      // Review list
      codeReviews: 'Code reviews',
      searchReviews: 'Search reviews',
      assignedTo: 'Assigned to',
      noMatchingReviews: 'No reviews match your search',
      noReviews: 'No reviews yet',
      all: 'All',
      pending: 'Pending',
      inProgress: 'In progress',
      changesRequested: 'Changes requested',
      approved: 'Approved',
      rejected: 'Rejected',

      // Review status indicator
      waitingForReview: 'Waiting for review',
      reviewInProgress: 'Review in progress',
      reviewerRequestedChanges: 'Reviewer requested changes',
      reviewApproved: 'Review approved',
      reviewRejected: 'Review rejected',
      unknown: 'Unknown',
      unknownStatus: 'Unknown status',

      // Diff viewer
      changedFiles: 'Changed files',
      diffViewer: 'Diff viewer',
      sideBySide: 'Side by side',
      unified: 'Unified',
      showChangesOnly: 'Show changes only',
      selectFileToCompare: 'Select a file to compare',
      previous: 'Previous',
      current: 'Current',

      // Code viewer controls
      showLineNumbers: 'Show line numbers',
      wrapLines: 'Wrap lines',

      // Comments
      resolveComment: 'Resolve',
      replyToComment: 'Reply',
      addComment: 'Add a comment',

      // File explorer
      search: 'Search',
    },
  },
  fr: {
    translation: {
      // Auth
      continueWithGithub: 'Continuer avec GitHub',
      appTagline: 'Revue de code nomade et ergonomique',
      githubOnlyInfo:
        'Nous utilisons votre compte GitHub pour accéder à vos pull requests. Aucun mot de passe n\'est stocké.',
      privacyTitle: 'Confidentialité',
      privacyBody:
        'Blade Runner ne stocke que les métriques agrégées des PR. Le token OAuth est conservé dans le stockage sécurisé de l\'appareil. Le code source n\'est pas persisté sur nos serveurs.',
      privacyLink: 'Politique de confidentialité',

      // Navigation / Tabs
      home: 'Accueil',
      reviews: 'Revues',
      profile: 'Profil',
      dashboard: 'Tableau de bord',

      // PR screen tabs
      overview: 'Aperçu',
      map: 'Carte',
      diff: 'Diff',
      graph: 'Graphe',
      findings: 'Findings',

      // Review actions
      approve: 'Approuver',
      requestChanges: 'Demander des modifications',
      comment: 'Commenter',

      // Filters
      pendingReviews: 'Revues en attente',
      myReviews: 'Mes pull requests',
      recentActivity: 'Activité récente',
      seeAll: 'Voir tout',
      allReviews: 'Toutes les revues',
      newReview: 'Nouvelle revue',
      settings: 'Paramètres',

      // Code viewer legacy
      files: 'Fichiers',
      comments: 'Commentaires',
      diffView: 'Vue diff',
      selectFileToView: 'Sélectionnez un fichier à consulter',
      browseFiles: 'Parcourir les fichiers',

      // Generic
      loading: 'Chargement…',
      error: 'Une erreur est survenue',
      retry: 'Réessayer',

      // Theme
      themeMode: 'Thème',
      themeAuto: 'Auto',
      themeLight: 'Clair',
      themeDark: 'Sombre',
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources,
    lng: 'fr',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;

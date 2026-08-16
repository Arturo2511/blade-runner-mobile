# Blade Runner — Mobile

## Application mobile de revue de code ergonomique

Application React Native / Expo développée dans le cadre d'un mémoire de Master 60 (UNamur) sur la conception d'un environnement de revue de code nomade ergonomique.

Elle se connecte à GitHub (OAuth Device Flow) pour lister les pull requests de l'utilisateur, et au backend **Blade Runner** (Spring) pour enrichir chaque PR avec les résultats d'analyse statique : métriques SonarQube, findings SARIF (CodeQL / Sonar) et graphe d'appels au format DOT.

![Logo de l'application](./assets/icon.png)

## Fonctionnalités

- **Connexion GitHub** via OAuth Device Flow (aucun `client_secret` embarqué)
- **Liste des pull requests ouvertes** de l'utilisateur, avec quality gate et compteurs de findings
- **Tableau de bord de PR** : quality gate, bugs, vulnérabilités, hotspots, code smells, couverture, lignes ajoutées/supprimées
- **Carte CodeCity** : treemap 2D des fichiers impactés, colorée par sévérité
- **Minimap** : silhouette du fichier avec marqueurs de findings, tap pour se positionner, double-tap pour ouvrir le diff à cet endroit
- **Diff unifié mobile** : repliage automatique des blocs de contexte, findings signalés sur la ligne concernée
- **Graphe de dépendances** : navigateur ego-centré appelants / appelés, nœuds impactés et à risque
- **Liste de findings** triée par sévérité, filtrable par catégorie (sécurité, bug, smell, perf)
- **Résumé IA** de la PR, en texte lisible sur mobile
- **Déclenchement de scan** depuis l'app, avec suivi de l'état d'analyse
- **Thème clair / sombre / automatique**, persisté sur l'appareil
- **Bilingue français / anglais** (i18next, détection de la langue système)
- **Libellés d'accessibilité** sur les zones interactives des visualisations

> ⚠️ **Prototype d'évaluation** — toutes les actions d'écriture GitHub (approuver, demander des modifications, commenter) sont neutralisées et affichent un avis d'évaluation. Rien n'est envoyé sur GitHub.

## Prérequis

- Node.js 20 ou supérieur
- npm
- Expo CLI (`npx expo`)
- Android Studio (développement Android) ou Xcode (développement iOS, macOS uniquement)

## Installation

```bash
git clone git@github.com:Arturo2511/blade-runner-mobile.git
cd blade-runner-mobile
npm install
```

## Configuration

### GitHub OAuth

`src/config/github.js` contient le `clientId` de l'OAuth App GitHub. Pour utiliser la vôtre :

1. Créez une OAuth App sur [github.com/settings/developers](https://github.com/settings/developers)
2. Activez **Device flow** dans ses paramètres
3. Renseignez le `clientId` (les scopes demandés sont `read:user`, `user:email`, `repo`)

Sans `clientId`, la connexion échoue : il n'y a pas de mode démo.

### Backend

`src/config/backend.js` pointe vers :

- `https://bladerunner.mozzon.net` en production
- `http://localhost:8080` (ou `http://10.0.2.2:8080` sur émulateur Android) en développement

Si le backend est injoignable ou si la PR n'a pas encore été scannée, l'app reste fonctionnelle avec les seules données GitHub (métriques et findings vides).

## Lancement

```bash
npm start        # Expo (choisir la plateforme dans le terminal)
npm run ios
npm run android
npm run web
```

## Build

Les profils EAS sont définis dans `eas.json` :

```bash
eas build --profile development --platform ios   # dev client
eas build --profile preview --platform android   # APK interne
eas build --profile production                   # store (autoIncrement)
```

## Architecture

```
mobile/
├── App.js                    # Navigation, providers (thème, auth), thèmes React Navigation
├── index.js                  # Point d'entrée Expo
├── src/
│   ├── components/           # Composants de visualisation
│   ├── screens/              # Écrans
│   ├── services/             # Auth, API GitHub, API backend, stockage, thème
│   ├── config/               # Configuration GitHub OAuth et backend
│   ├── data/                 # Palettes sémantiques (sévérité, quality gate, statut)
│   └── utils/                # Parseurs SARIF / DOT, i18n
├── assets/                   # Icônes et splash
└── docs/                     # Documentation d'architecture et de fonctionnalités
```

### Écrans

- **AuthScreen** : connexion GitHub par device flow (affichage du `user_code`, ouverture du navigateur, polling du token)
- **HomeScreen** : liste des PR ouvertes, enrichies par les métriques backend, avec pull-to-refresh
- **PullRequestScreen** : orchestre la revue d'une PR en six onglets — Aperçu, Carte, Minimap, Diff, Graphe, Findings
- **ProfileScreen** : identité GitHub en lecture seule, choix du thème et de la langue, déconnexion

### Composants

- **MetricsDashboard** : grille des KPI de la PR
- **CodeCityView** : treemap 2D des fichiers impactés
- **MiniMap** : silhouette du fichier et gouttière de findings
- **MobileDiffView** : diff unifié optimisé pour l'écran mobile
- **DependencyGraph** : navigation dans le graphe d'appels
- **FindingsList** : findings triés par sévérité, avec filtres
- **AiSummary** : rendu du résumé IA
- **ReviewStatusIndicator** : état de la revue

### Services

- **githubOAuth** : device flow complet (device code → navigateur → polling → profil)
- **githubApi** : PR, fichiers modifiés et diff via l'API REST GitHub
- **backendApi** : `GET /metrics`, `GET /listPr`, ping `/actuator/health`, avec timeout et dégradation gracieuse
- **scanTracker** : déclenchement d'un scan et suivi de son état
- **auth** / **context** : session stockée en AsyncStorage et état global
- **storage** : préférences utilisateur, cache avec expiration
- **theme** : mode `auto` / `light` / `dark` et palette de surfaces

### Utilitaires

- **sarifParser** : SARIF v2.1.0 → liste plate de findings (sévérité, catégorie, localisation)
- **dotParser** : DOT Graphviz → nœuds et arêtes du graphe d'appels, marquage des nœuds impactés
- **i18n** : ressources françaises et anglaises

## Considérations ergonomiques

- Visualisations pensées pour l'écran étroit : treemap, minimap et diff replié plutôt qu'un défilement linéaire
- Navigation par onglets balayables au sein d'une PR
- Zones de toucher généreuses, double-tap pour approfondir sans quitter le contexte
- Palettes sémantiques identiques en clair et en sombre, pour un repérage stable des sévérités
- Dégradation gracieuse quand le backend est absent, plutôt qu'un écran d'erreur bloquant

## Technologies

- **Expo SDK 57** / **React Native 0.86** / **React 19**
- **React Navigation 6** (stack + bottom tabs)
- **react-native-gesture-handler** et **react-native-reanimated**
- **i18next** / **react-i18next**
- **AsyncStorage** pour la persistance locale
- **expo-web-browser** pour le device flow OAuth

## Licence

Ce projet est développé dans le cadre d'un mémoire universitaire et n'est pas disponible pour une utilisation commerciale sans autorisation.

## Auteurs

Arturo MOZZON et Pawel JALBRZYKOWSKI — Master 60 en Sciences Informatiques, Université de Namur (UNamur)

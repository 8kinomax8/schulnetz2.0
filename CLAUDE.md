# CONTEXTE & GUIDE — schulnetz2.0

## Objectif du document
Ce fichier constitue la documentation technique de **schulnetz2.0** : architecture, conventions, configuration, flux de données, logique métier, sécurité, et **définitions précises de toutes les fonctions publiques** du code‑base. Il sert aux développeurs, aux agents CI/CD et aux intégrateurs.

---

## Table des matières
- [Résumé du projet](#résumé-du-projet)
- [Stack & dépendances](#stack--dépendances)
- [Arborescence du dépôt](#arborescence-du-dépôt)
- [Flux de données & responsabilités](#flux-de-données--responsabilités)
- [Variables d'environnement](#variables-denvironnement)
- [Installation & développement local](#installation--développement-local)
- [Scripts npm utiles](#scripts-npm-utiles)
- [Supabase – schéma, migrations & bonnes pratiques](#supabase--schéma-migrations--bonnes-pratiques)
- [API & endpoints clés](#api--endpoints-clés)
- [Logique métier (calculs de notes)](#logique-métier-calculs-de-notes)
  - [Fonctions de `calculationService.js`](#fonctions-de-calculationservicejs)
  - [Hooks de calcul (`useGradeCalculations.js`, `useApprenticeshipCalculations.js`)](#hooks-de-calcul)
- [Numérisation & IA](#numérisation--ia)
- [Tests, linting & qualité du code](#tests-linting--qualité-du-code)
- [Déploiement](#déploiement)
- [Sécurité](#sécurité)
- [Fichiers & emplacements importants](#fichiers--emplacements-importants)
- [Historique & notes de maintenance](#historique--notes-de-maintenance)
- [Références des méthodes et exportations](#références-des-méthodes-et-exportations)

---

## Résumé du projet
`schulnetz2.0` est une **SPA** permettant aux apprentis CFC de :
- saisir, visualiser et analyser les notes de la **Berufsmaturität (BM)** ;
- gérer les modules de la **Berufsschule (EFZ)** ;
- simuler des scénarios de notes ;
- numériser les bulletins et les captures SAL via IA.
Le front‑end utilise **React + Vite** et s’appuie sur **Supabase** (auth, base de données, storage). Un petit backend **Node.js** (ESM) expose uniquement des fonctions serverless (`api/scan.js`).

---

## Stack & dépendances
- **Frontend** : React 18, Vite, Tailwind CSS, lucide‑react, recharts
- **Infrastructure** : Supabase (PostgreSQL, Auth, Storage, Row‑Level‑Security)
- **Backend (optionnel)** : Node.js 20 (ESM) – API serverless (`api/`, `backend/`)
- **IA** : Anthropic Claude (OCR / extraction)
- **Gestion de paquets** : npm ≥ 7, `package.json` liste toutes les dépendances et leurs versions.

---

## Arborescence du dépôt
```text
schulnetz2.0/
├─ src/
│  ├─ components/          # UI réutilisable
│  ├─ hooks/               # hooks métier (grade, auth…)
│  ├─ services/            # logique métier & wrappers API
│  ├─ utils/               # fonctions utilitaires
│  ├─ constants/           # listes de matières, config statique
│  ├─ styles/              # Tailwind & CSS custom
│  ├─ App.jsx
│  └─ main.jsx
├─ api/                    # fonctions serverless (Vercel, Netlify…)
│  └─ scan.js
├─ backend/                # (facultatif) logique serveur supplémentaire
├─ supabase/               # migrations SQL
│  └─ migrations/
├─ public/                # assets statiques
├─ config.js               # configuration centrale
├─ .env.example           # squelette des variables d’environnement
├─ package.json
├─ tailwind.config.js
├─ vite.config.js
└─ README.md               # guide utilisateur
```

---

## Flux de données & responsabilités
| Côté | Responsabilité |
|------|----------------|
| **Frontend** | Collecte des contrôles, calculs (moyennes, simulations), affichage, interactions utilisateur. |
| **Supabase** | Persistance des utilisateurs, préférences, notes finales, exécution des migrations et policies RLS. |
| **API `api/scan.js`** | Reçoit images/PDF, lance le pipeline OCR + Claude, retourne les contrôles extraits. |
| **Backend (optionnel)** | Logique sécurisée, création de fonctions edge, proxy vers services IA si nécessaire. |

---

## Variables d'environnement
Fichier `.env` à la racine (ou `env.local` selon votre workflow) :
```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY   # jamais de service_role côté client
# Variables serveur (utilisées uniquement dans `api/` ou `backend/`)
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY   # never committed
CLAUDE_API_KEY=YOUR_ANTHROPIC_CLAUDE_KEY            # server‑only
```
> **Sécurité** : ne jamais committer les clés privées. Utilisez les secrets du service de déploiement.

---

## Installation & développement local
**Prérequis** : Node.js ≥ 20, npm ≥ 7, compte Supabase.
```bash
# Clone
git clone <repo‑url>
cd schulnetz2.0

# Dépendances
npm ci

# .env
cp .env.example .env
# → remplissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY

# Démarrage
npm run dev
```
L’application se trouve sur `http://localhost:5173`.

---

## Scripts npm utiles
| Script | Description |
|--------|-------------|
| `npm run dev` | Démarre Vite en mode développement (HMR) |
| `npm run build` | Build production (optimisé) |
| `npm run preview` | Servir le build prod localement |
| `npm run lint` | Lint avec ESLint |
| `npm run test` *(à implémenter)* | Tests unitaires (Jest + RTL) |

---

## Supabase – schéma, migrations & bonnes pratiques
- **Migrations** : scripts SQL dans `supabase/migrations/`. Appliquez‑les avec `supabase db push` ou `supabase migration up`.
- **RLS** : toutes les tables sont protégées par des policies. Revérifiez‑les après chaque changement de schéma.
- **Sauvegarde** : `supabase db dump` régulièrement.
- **Clés** : `anon` côté client, `service_role` côté serveur uniquement.

---

## API & endpoints clés
- `POST /api/scan` : accepte un `data-uri` d’image/PDF, renvoie les contrôles extraits via Claude.
- Future endpoints (`/api/grades`, `/api/users`) seront documentés ici.
- **Sécurité** : JWT Supabase requis, rate‑limiting intégré.

---

## Logique métier (calculs de notes)
Les fonctions sont centralisées dans **`src/services/calculationService.js`**. Elles sont importées par les hooks.
### Fonctions de `calculationService.js`
| Fonction | Signature | Description |
|----------|-----------|-------------|
| `calculateWeightedAverage(controls: Control[])` | `number` | Retourne la moyenne pondérée d’une liste de contrôles. Les poids sont normalisés via `parseWeight`. Arrondi au demi‑point (`roundToHalf`). |
| `calculateSemesterAverage(controls: Control[])` | `number` | Moyenne du semestre : applique `calculateWeightedAverage` puis arrondit au demi‑point. |
| `calculateErfahrungsnote(semesterAverages: number[])` | `number` | Moyenne arithmétique simple des moyennes semestrielles, arrondie au demi‑point. |
| `getExamAverage(examScore: number, erfahrungsnote: number)` | `number` | Retourne `(erfahrungsnote + examScore) / 2` (pas d’arrondi supplémentaire). |
| `calculatePromotionStatus(semesterAverages: number[], deficits: number[], insufficientCount: number)` | `{eligible: boolean, reasons?: string[]}` | Implémente les règles BM1 : moyenne générale ≥ 4.0, déficit total ≤ 2.0, max 2 notes insuffisantes. |
| `calculateModuleAverage(controls: Control[])` | `number` | Moyenne pondérée d’un module EFZ, arrondie au demi‑point. |
| `calculateModulesAverage(moduleAverages: number[])` | `number` | Moyenne arithmétique des modules, arrondie au demi‑point. |
| `calculateUekAverage(uekControls: Control[])` | `number` | Moyenne des contrôles ÜK, arrondie au demi‑point. |
| `calculateSchoolPart(modulesAvg: number, uekAvg: number)` | `number` | `0.8 * modulesAvg + 0.2 * uekAvg`, arrondi au dixième. |
| `calculateFinalGrade(schoolPart: number, ipaScore: number)` | `number` | `0.5 * schoolPart + 0.5 * ipaScore`, arrondi au dixième. |
| `parseWeight(weight: string | number)` | `number` | Convertit `"1/2"`, `"50%"` ou nombre brut en valeur décimale.
| `roundToHalf(value: number)` | `number` | Arrondit à la demi‑unité la plus proche.
| `roundToTenth(value: number)` | `number` | Arrondit à 0.1.

> **Remarque** : toutes les fonctions sont **pures** (pas d’effet de bord) et testables en isolation.

### Hooks de calcul (`src/hooks`)
- **`useGradeCalculations.js`** : expose `calculateWeightedAverage`, `calculateSemesterAverage`, `calculatePromotionStatus`, etc., pour la BM. Retourne des valeurs memo‑isées via `useMemo`.
- **`useApprenticeshipCalculations.js`** : expose les fonctions EFZ (`calculateModuleAverage`, `calculateSchoolPart`, `calculateFinalGrade`).
- Chaque hook attend en entrée les listes de contrôles provenant du store Supabase via `useDatabase`.

---

## Numérisation / IA
`api/scan.js` implémente le pipeline suivant :
1. Vérifie le JWT Supabase et le taux de requêtes.
2. Décodage du *data‑uri* (`base64` → Buffer).
3. Construction du payload Claude (`/v1/messages`).
4. Envoi via `fetch`, traitement de la réponse JSON.
5. Normalisation des contrôles extraits : `{subject, date, grade, type}`.
6. Retour au front sous forme de tableau JSON.
**Bonnes pratiques** :
- Valider manuellement les nouvelles formes de bulletins.
- Surveiller le quota Claude.
- Mock‑er les réponses dans les tests unitaires (`nock` ou `msw`).

---

## Tests, linting & qualité
- **ESLint** : `npm run lint` doit réussir avant chaque PR.
- **Jest + React Testing Library** : tests unitaires pour `calculationService.js` et les hooks.
- **CI** : GitHub Actions exécute lint + tests à chaque push.

---

## Déploiement
### Frontend
```bash
npm run build   # génère ./dist
# déployer ./dist sur Vercel, Netlify, ou tout hébergeur static
```
### API serverless
- Déployer `api/scan.js` sur Vercel Functions, Netlify Functions, Railway, etc.
- Configurer les variables d’environnement (`CLAUDE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
### Supabase
- `supabase db push` en prod.
- Auditer les policies RLS après chaque migration.

---

## Sécurité
- **Ne jamais** commettre `service_role` dans le repo.
- Rate‑limit sur `/api/scan` + vérification JWT.
- CORS whitelist via `vercel.json`.
- Audits périodiques des policies RLS (`supabase policy list`).

---

## Fichiers & emplacements importants
- `config.js` – configuration globale.
- `src/services/supabaseClient.js` – initialisation du client Supabase.
- `src/services/calculationService.js` – logique métier des notes (voir fonctions ci‑dessus).
- `src/hooks/useGradeCalculations.js` – hook BM.
- `src/hooks/useApprenticeshipCalculations.js` – hook EFZ.
- `api/scan.js` – endpoint IA.
- `supabase/migrations/` – scripts SQL.

---

## Historique & notes de maintenance
- **2026‑05‑10** : refactorisation du parsing des poids (`parseWeight`).
- **2026‑04‑18** : ajout du rate‑limiting DB pour le scan.
- **2026‑03‑22** : migration du schéma EFZ (modules, ÜK, IPA).
- **2026‑02‑15** : correction de l’arrondi `maturnote` globale.

---

## Références des méthodes et exportations
| Fichier | Export(s) | Description |
|---------|----------|-------------|
| `src/services/calculationService.js` | `calculateWeightedAverage`, `calculateSemesterAverage`, `calculateErfahrungsnote`, `getExamAverage`, `calculatePromotionStatus`, `calculateModuleAverage`, `calculateModulesAverage`, `calculateUekAverage`, `calculateSchoolPart`, `calculateFinalGrade`, `parseWeight`, `roundToHalf`, `roundToTenth` | Logique métier pure.
| `src/hooks/useGradeCalculations.js` | `useWeightedAverage`, `useSemesterAverage`, `usePromotionStatus` | Hook BM.
| `src/hooks/useApprenticeshipCalculations.js` | `useModuleAverage`, `useSchoolPart`, `useFinalGrade` | Hook EFZ.
| `api/scan.js` | `handler` (export default) | Endpoint IA.
| `src/services/supabaseClient.js` | `createClient` | Wrapper Supabase.

---

*Ce document doit être maintenu à jour à chaque modification majeure du code ou de l’architecture. Toute contribution doit ouvrir une PR qui met à jour ce fichier si nécessaire.*

## Objectif du document
Ce fichier fournit une **documentation exhaustive** du projet *schulnetz2.0* : architecture, conventions, configuration, flux de données, logique métier, sécurité et bonnes pratiques de développement. Il s’adresse aux contributeurs, aux agents automatisés (CI, scripts) et aux intégrateurs.

---

## Table des matières
- [Résumé du projet](#résumé-du-projet)
- [Stack & dépendances](#stack--dépendances)
- [Arborescence du dépôt](#arborescence-du-dépôt)
- [Flux de données & responsabilités](#flux-de-données--responsabilités)
- [Variables d'environnement](#variables-denvironnement)
- [Installation & développement local](#installation--développement-local)
- [Scripts npm utiles](#scripts-npm-utiles)
- [Supabase – schéma, migrations & bonnes pratiques](#supabase--schéma-migrations--bonnes-pratiques)
- [API & endpoints clés](#api--endpoints-clés)
- [Logique métier (calculs de notes)](#logique-métier-calculs-de-notes)
- [Numérisation & IA](#numérisation--ia)
- [Tests, linting & qualité du code](#tests-linting--qualité-du-code)
- [Déploiement](#déploiement)
- [Sécurité](#sécurité)
- [Fichiers & emplacements importants](#fichiers--emplacements-importants)
- [Historique & notes de maintenance](#historique--notes-de-maintenance)
- [Références des méthodes et exportations](#références-des-méthodes-et-exportations)

---

## Résumé du projet
`schulnetz2.0` est une **SPA** qui permet aux apprentis CFC de :
- saisir, visualiser et analyser les notes de la **Berufsmaturität (BM)** ;
- gérer les modules de la **Berufsschule (EFZ)** ;
- simuler des scénarios de notes ;
- numériser les bulletins et les captures SAL via IA.
Le front‑end utilise **React + Vite** et s’appuie sur **Supabase** (auth, base de données, storage). Un backend **Node.js** léger (ESM) n’est présent que pour les fonctions serveur spécifiques (ex. : `/api/scan`).

---

## Stack & dépendances
- **Frontend** : React 18, Vite, Tailwind CSS, lucide‑react, recharts
- **Infrastructure** : Supabase (PostgreSQL, Auth, Storage, Row‑Level‑Security)
- **Backend (optionnel)** : Node.js 20 (ESM) – API serverless (`api/`, `backend/`)
- **IA** : Anthropic Claude (OCR / extraction)
- **Gestion de paquets** : npm ≥ 7, `package.json` liste toutes les dépendances et leurs versions.

---

## Arborescence du dépôt
```text
schulnetz2.0/
├─ src/
│  ├─ components/          # UI réutilisable
│  ├─ hooks/               # hooks métier (grade, auth…)
│  ├─ services/            # logique métier & wrappers API
│  ├─ utils/               # fonctions utilitaires
│  ├─ constants/           # listes de matières, config statique
│  ├─ styles/              # Tailwind & CSS custom
│  ├─ App.jsx
│  └─ main.jsx
├─ api/                    # fonctions serverless (Vercel, Netlify…)
│  └─ scan.js
├─ backend/                # (facultatif) logique serveur supplémentaire
├─ supabase/               # migrations SQL
│  └─ migrations/
├─ public/                # assets statiques
├─ config.js               # configuration centrale
├─ .env.example           # squelette des variables d’environnement
├─ package.json
├─ tailwind.config.js
├─ vite.config.js
└─ README.md               # guide utilisateur (mis à jour ci‑dessus)
```

---

## Flux de données & responsabilités
| Côté | Responsabilité |
|------|----------------|
| **Frontend** | Collecte des contrôles, calculs (moyennes, simulations), affichage, interactions utilisateur. |
| **Supabase** | Persistance des utilisateurs, préférences, notes finales, exécution des migrations et policies RLS. |
| **API `api/scan.js`** | Reçoit images/PDF, lance le pipeline OCR + Claude, retourne les contrôles extraits. |
| **Backend (optionnel)** | Logique sécurisée, création de fonctions edge, proxy vers services IA si nécessaire. |

---

## Variables d'environnement
Fichier `.env` à la racine (ou `env.local` selon votre workflow) :
```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY   # jamais de service_role côté client
# Variables serveur (utilisées uniquement dans `api/` ou `backend/`)
SUPABASE_URL=YOUR_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY   # never committed
CLAUDE_API_KEY=YOUR_ANTHROPIC_CLAUDE_KEY            # server‑only
```
> **Sécurité** : ne jamais committer les clés privées. Utilisez les secrets du service de déploiement (Vercel, Netlify, Railway, etc.).

---

## Installation & développement local
**Prérequis** : Node.js ≥ 20, npm ≥ 7, compte Supabase.
```bash
# 1. Clone le dépôt
git clone <repo‑url>
cd schulnetz2.0

# 2. Installer les dépendances
npm ci   # utilisation d’un lockfile strict

# 3. Créez le fichier .env (copiez .env.example)
cp .env.example .env
# → remplissez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY

# 4. Lancer le serveur de développement
npm run dev
# L'application est accessible sur http://localhost:5173
```
---

## Scripts npm utiles
| Script | Description |
|--------|-------------|
| `npm run dev` | Démarre Vite en mode développement (HMR) |
| `npm run build` | Build production (optimisé) |
| `npm run preview` | Prévisualise le build production localement |
| `npm run lint` | Exécute ESLint avec la configuration du projet |
| `npm run test` *(à implémenter)* | Priorité : tests unitaires pour la logique métier |

---

## Supabase – schéma, migrations & bonnes pratiques
- **Migrations** : scripts SQL dans `supabase/migrations/`. Appliquez‑les avec `supabase db push` ou `supabase migration up`.
- **RLS** : toutes les tables utilisateurs sont protégées par des policies. Vérifiez‑les après chaque modification de schéma.
- **Sauvegardes** : exportez régulièrement la base (`supabase db dump`).
- **Clés** : utilisez exclusivement `anon` côté client, `service_role` côté serveur.

---

## API & endpoints clés
- `api/scan.js` : point d’entrée serverless pour la numérisation de documents.
- `api/...` (futurs) : ajouter toute nouvelle route RESTful ici et documenter‑la dans ce fichier.
- **Sécurité** : authentification via token Supabase, rate‑limiting intégré.

---

## Logique métier (calculs de notes)
Les fonctions principales résident dans `src/services/calculationService.js` et sont exposées via les hooks `useGradeCalculations.js` / `useApprenticeshipCalculations.js`.
### BM (Berufsmaturität)
- **Moyenne pondérée** : `calculateWeightedAverage` → arrondi au demi‑point (`roundToHalfOrWhole`).
- **Moyenne semestrielle** : `calculateSemesterAverage` → même arrondi.
- **Erfahrungsnote** : moyenne arithmétique simple des moyennes semestrielles.
- **Note finale** : `(Erfahrungsnote + examen)/2` (pas d’arrondi supplémentaire).
- **Promotion BM1** : conditions : moyenne générale ≥ 4.0, déficit total ≤ 2.0, ≤ 2 insuffisances (`calculatePromotionStatus`).
### EFZ (Berufsschule)
- **Modules** : moyenne pondérée par matière (`calculateModuleAverage`).
- **Moyenne modules** : `calculateModulesAverage` (arrondi au demi‑point).
- **ÜK** : `calculateUekAverage` (arrondi au demi‑point).
- **Partie école** : `calculateSchoolPart` → 80 % modules + 20 % ÜK, arrondi au dixième.
- **Note finale CFC** : `calculateFinalGrade` → 50 % partie école + 50 % IPA, arrondi au dixième.

---

## Numérisation / IA
Le pipeline `api/scan.js` effectue :
1. Validation d’authentification et du rate‑limit.
2. Décodage du *data‑uri* (image / PDF).
3. Construction d’un payload Claude (`/v1/messages`).
4. Retour des contrôles extraits (matière, date, note, type).
**Bonnes pratiques** :
- Validez manuellement les extractions lors de l’ajout de nouveaux formats de bulletins.
- Surveillez le quota Claude (limite d’appels, coûts).
- Ajoutez des tests d’intégration qui mockent la réponse Claude.

---

## Tests, linting & qualité
- **ESLint** : `npm run lint` doit passer avant chaque PR.
- **Tests unitaires** : à implémenter (Jest + React Testing Library). Prioriser :
  - `calculationService.js`
  - hooks critiques (`useGradeCalculations`, `useApprenticeshipCalculations`).
- **CI** : configurer un workflow GitHub Actions qui exécute lint + tests.

---

## Déploiement
- **Frontend** : Vercel ou Netlify (déploiement via `npm run build`).
- **Backend/API** : déployer `api/` comme functions serverless (Vercel, Netlify Functions, Railway, Render). Configurez les variables d’environnement serveur (`CLAUDE_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
- **Supabase** : appliquer les migrations via le CLI CI (`supabase db push`).

---

## Sécurité
- **Ne jamais exposer** `service_role` côté client.
- **Rate‑limit** sur `/api/scan` ; surveillez les logs.
- **CORS** : whitelist des origines autorisées.
- **Policies RLS** : réviser après chaque changement de schéma.

---

## Fichiers & emplacements importants
- `config.js` – configuration globale du projet.
- `src/services/supabaseClient.js` – initialisation du client Supabase.
- `src/services/calculationService.js` – logique métier des notes.
- `src/hooks/useGradeCalculations.js` – hook principal pour BM.
- `src/hooks/useApprenticeshipCalculations.js` – hook principal pour EFZ.
- `api/scan.js` – endpoint d’analyse de documents.
- `supabase/migrations/` – scripts SQL de migration.

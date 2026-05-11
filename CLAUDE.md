# CONTEXT — schulnetz2.0

Ce document fournit une vue d'ensemble complète du projet "schulnetz2.0". Il rassemble le contexte technique, l'architecture, les conventions, l'installation, les points d'attention et les décisions de conception pour faciliter la maintenance, le déploiement et l'onboarding.

---

## Table des matières

* Résumé du projet
* Stack & dépendances principales
* Arborescence importante
* Description détaillée des modules
* Variables d'environnement
* Installation & développement local
* Scripts npm
* Déploiement & hébergement
* Tests & qualité
* Décisions d'architecture
* Points d'attention / sécurité
* Roadmap / TODO
* Ressources et contributeurs

---

## Résumé du projet

`schulnetz2.0` est une application web (SPA) permettant de calculer, visualiser et analyser les notes des informaticiens CFC en maturité professionnelle.

L'application repose sur :

* un frontend React (Vite)
* un backend Node.js léger (optionnel selon usage)
* **Supabase comme backend principal (authentification + base de données)**

L’objectif est de centraliser la logique métier côté client tout en s’appuyant sur Supabase pour la persistance et la gestion des utilisateurs.

---

## Stack & dépendances principales

* Frontend : React + Vite
* UI : TailwindCSS, lucide-react, recharts
* Backend (léger) : Node.js (ESM)
* Base de données : **Supabase (PostgreSQL)**
* Authentification : **Supabase Auth**
* Client Supabase : `@supabase/supabase-js`
* Outils dev : ESLint, PostCSS

---

## Arborescence importante

* `backend/` — API optionnelle (logique serveur spécifique)
* `src/` — Frontend React

  * `components/`
  * `hooks/`
  * `services/`

    * `supabaseClient.js`
    * `gradeService.js`
* `config.js` — configuration centralisée

---

## Description des modules

### Backend (optionnel)

Le backend Node.js est utilisé uniquement si nécessaire (logique sécurisée, proxy API, etc.).

Sinon, **les interactions principales passent directement par Supabase depuis le frontend**.

---

### Base de données (Supabase)

* Fournie par Supabase (PostgreSQL)
* Gérée via dashboard Supabase ou migrations SQL
* Accès direct via `supabase-js` côté frontend

Fonctionnalités utilisées :

* tables relationnelles
* policies (RLS — Row Level Security)
* authentification intégrée

---

### Frontend

* Entrée : `src/main.jsx`
* App principale : `src/App.jsx`
* Composants : affichage, simulation, analyse
* Hooks : logique métier (calculs, auth, etc.)
* Services : communication avec Supabase

---

### Services & Utils

* `supabaseClient.js` :

  * initialise le client Supabase avec les variables d'environnement
* Services métier :

  * gestion des notes
  * calculs
  * persistance Supabase

---

## Variables d'environnement

### Frontend (.env)

* `VITE_SUPABASE_URL`
* `VITE_SUPABASE_ANON_KEY`

---

### Backend (si utilisé)

* `PORT`
* `NODE_ENV`

---

## Installation & développement local

### Prérequis

* Node.js >= 20

### Setup

```bash
npm install
npm run dev
```

App accessible sur :

```
http://localhost:5173
```

---

## Scripts npm

* `dev` : lance Vite
* `build` : build production
* `preview` : preview build
* `lint` : ESLint

---

## Déploiement & hébergement

### Frontend

* Vercel / Netlify recommandé

### Backend (optionnel)

* VPS / Railway / Render

### Supabase

* héberge :

  * base de données
  * authentification
  * API REST automatique

---

## Tests & qualité

* ESLint configuré
* Pas encore de tests automatisés

Recommandé :

* tests unitaires (hooks, calculs)
* tests d'intégration (services Supabase)

---

## Décisions d'architecture

* Supabase remplace :

  * base de données (ex-RDS)
  * authentification (ex-Cognito)
* Backend réduit au minimum
* Logique métier principalement côté frontend
* Utilisation de RLS pour sécuriser les données

---

## Points d'attention / sécurité

* Ne jamais exposer de clé `service_role`
* Utiliser uniquement la clé publique (`anon key`) côté frontend
* Activer RLS sur toutes les tables
* Vérifier les policies d'accès utilisateur

---

## Roadmap / TODO

* Ajouter tests automatisés
* Implémenter RLS robuste
* Ajouter validation des données
* Ajouter monitoring (logs, erreurs)

---

## Contributeurs

Voir historique Git

---

## Fichiers clés

* `config.js`
* `src/services/supabaseClient.js`
* `src/App.jsx`

## Logique de calcul des notes

### BM (Berufsmaturität)

* Pour une matière du semestre en cours, l’app calcule une moyenne pondérée des contrôles saisis, puis l’arrondit au demi-point le plus proche. C’est calculateWeightedAverage puis calculateSemesterAverage dans calculationService.js:10 et calculationService.js:40.
* La pondération est lue telle quelle et peut être donnée comme nombre, fraction du type 1/2, pourcentage du type 50%, ou texte numérique via parseWeight dans calculationService.js:94.
* La note requise pour atteindre un objectif se calcule avec la formule inverse de la moyenne pondérée: required = (targetAverage * totalWeight - currentSum) / nextWeight dans calculationService.js:65.
* Le simulateur de semestre ajoute les contrôles planifiés aux notes réelles, recalcule la moyenne pondérée, puis l’UI compare cette moyenne simulée à l’objectif. Le calcul vit dans calculationService.js:81 et l’interface dans SemesterSimulatorCard.jsx:23.
* Pour les bulletins précédents, l’Erfahrungsnote d’une matière est la moyenne arithmétique simple de toutes ses notes semestrielles, ensuite arrondie au demi-point. C’est calculateErfahrungsnote dans calculationService.js:50.
Pour les examens finaux, la note de matière affichée est (Erfahrungsnote + note d’examen) / 2, sans arrondi supplémentaire côté calcul. C’est getExamAverage dans useGradeCalculations.js:44.
* La “maturnote” globale affichée dans l’onglet examens est, en l’état, une moyenne arithmétique simple des notes d’examen de toutes les matières concernées. Le code ne la pondère pas, malgré le libellé UI “Weighted average”. C’est getOverallAverage dans useGradeCalculations.js:58 et son affichage dans App.jsx:814.
* Le statut de promotion BM1 prend les notes semestrielles par matière, garde uniquement la dernière note par matière, exclut exactement “Interdisziplinäres Arbeiten in den Fächern”, puis applique 3 conditions: moyenne générale ≥ 4.0, déficit total ≤ 2.0, et au plus 2 notes insuffisantes. La moyenne est arrondie au dixième, le déficit est la somme de 4 - note pour chaque note < 4. C’est calculatePromotionStatus dans calculationService.js:114 et l’affichage dans PromotionStatus.jsx:12.
* Le mode “simulation de promotion” ne réutilise pas les notes brutes, mais les moyennes semestrielles simulées, re-arrondies au demi-point avant d’appliquer les mêmes règles. C’est useGradeCalculations.js:91 et l’appel dans App.jsx:627.

### Berufsschule (EFZ)

Le module EFZ (Eidgenössischer Fachausweis) gère la scolarité professionnelle avec:

* **Modules de formation**: Suivi des notes par module avec pondération individuelle
* **üK (Übungskurse)**: Notes de cours pratiques, pondération fixe de 1
* **Calcul de la partie école**: 80% moyenne des modules + 20% moyenne üK, arrondie au dixième
* **Note IPA**: Examen final professionnel, compte pour 50% de la note finale
* **Note finale CFC**: 50% partie école + 50% note IPA, arrondie au dixième
* **Fonctionnalités**: 
  - Saisie manuelle des moyennes de module depuis anciens bulletins
  - Scan SAL (système d'évaluation continu) pour import automatique des contrôles
  - Scan de bulletins PDF/images pour extraction des moyennes
  - Simulation avec contrôles planifiés
  - Calcul de la note IPA requise pour atteindre un objectif final

Fichiers clés: `src/hooks/useApprenticeshipCalculations.js`, `src/services/calculationService.js`, `src/services/efzService.js`

### Numérisation et IA

* **API Anthropic Claude**: Analyse de documents (bulletins, captures d'écran SAL)
* **Endpoint `/api/scan`**: Traite les images via l'API Claude pour extraire les notes
* **Prompt SAL**: Extraction des contrôles continus avec dates et matières
* **Prompt Bulletin**: Extraction des semestres et notes des bulletins scolaires
* **Formats supportés**: JPG, PNG, WebP (images), PDF (bulletins)

Fichiers clés: `backend/server.js` (lignes 84-173), `src/services/apiService.js`, `backend/routes.js`

### Backend API (MySQL)

Base de données relationnelle optionnelle pour persistance serveur:

**Tables principales**:
* `users` - Profils utilisateurs (Cognito Sub, email, BM type)
* `grades` - Notes de contrôles individuels
* `semester_grades` - Moyennes semestrielles par matière
* `semester_plans` - Contrôles planifiés (simulation)
* `subject_goals` - Objectifs de notes par matière
* `exam_simulator` - Notes d'examen simulées
* Tables EFZ: `efz_modules`, `efz_module_grades`, `efz_uek_grades`, `efz_ipa`

**Endpoints REST** (prefix `/api`):
* `POST /users/sync` - Synchronisation utilisateur
* `POST /users/:userId/grades` - Ajout d'un contrôle
* `GET/POST /users/:userId/semester-grades` - Notes semestrielles
* `POST /users/:userId/semester-plans` - Contrôles planifiés
* `POST /users/:userId/exam-grades` - Notes d'examen
* `POST /api/scan` - Analyse de documents via IA

Fichiers: `backend/queries.js`, `backend/routes.js`, `backend/db.js`

### Modifications récentes (git log)

* Gestion des dates: conversion Suisse (DD.MM.YYYY) ↔ SQL (YYYY-MM-DD)
* Badge de synchronisation (statut DB)
* Objectif maturnote (`maturanote_goal`) persistant
* Améliorations scan SAL (filtrage, validation)
* Support PDF réactivé
* Correction affichage dates
* CORS et configuration multi-environnements

Fichiers modifiés récemment: `App.jsx`, `config.js`, `useDatabase.js`, `calculationService.js`

---

Fin du CONTEXT.md
# 🚖 Instructions de Développement : Taxi-Planner MVP

Ce document sert de guide de référence pour GitHub Copilot / Cursor afin de développer une micro-app de gestion de planning pour un chauffeur de taxi indépendant.

---

## 🎯 Vision du Produit
Une application ultra-légère (PWA) permettant à un chauffeur seul de :
1. **Journée :** Noter rapidement des courses au fil de l'eau.
2. **Soirée :** Organiser son planning et celui de ses collègues.
3. **Action :** Envoyer les détails de la course aux collègues par SMS en un clic.

---

## 🛠 Stack Technique (Choix "Vibecoding" & Simplicité)
- **Frontend :** HTML5, Tailwind CSS (via CDN), JavaScript ES6 (Vanilla).
- **Backend :** Firebase (Firestore pour la DB, Auth pour l'accès restreint).
- **Hébergement :** GitHub Pages.
- **UX :** Mobile-First, approche "Gros Boutons" (usage en voiture/tablette).

---

## 📂 Structure des Fichiers
- `index.html` : Interface unique avec navigation par sections (Tabs).
- `app.js` : Logique métier, CRUD Firestore et gestion des SMS.
- `firebase-config.js` : Initialisation de Firebase (Clés API).
- `manifest.json` : Pour transformer le site en application installable (PWA).

---

## 📋 Spécifications Fonctionnelles

### 1. Sécurité (Firebase Auth)
- Seul l'administrateur (le client) doit pouvoir se connecter.
- Les données ne sont accessibles qu'après authentification.

### 2. Gestion des Collègues (`collection: collegues`)
- Champs : `nom`, `telephone`.
- Interface simple pour ajouter ou supprimer un collègue.

### 3. Saisie de Course (`collection: courses`)
- **Mode Saisie Rapide :** - Champs : Nom Client, Lieu Départ, Lieu Arrivée, Date et Heure (via `datetime-local`).
    - Statut par défaut : `en_attente`.
- **Mode Organisation :**
    - Assigner un collègue via une liste déroulante (récupérée de la collection `collegues`).
    - Passer le statut à `assigne`.

### 4. Le bouton "Magic SMS"
- Pour chaque course assignée, afficher un bouton SMS.
- Action : Ouvre l'app SMS native avec un message pré-rempli :
  > "Salut [Nom Collègue], course pour toi le [Date] à [Heure]. Trajet : [Départ] vers [Arrivée]. Confirme-moi !"
- Utiliser le format : `sms:[telephone]?&body=[message_encodé]`.

---

## 🎨 Design & UI (Directives Tailwind)
- **Thème :** Dark Mode par défaut (fond sombre `#121212`) avec accents Jaune Taxi (`#f2d400`).
- **Accessibilité :** - Boutons de minimum 48px de hauteur.
    - Police `sans-serif` large (inter).
    - Inputs avec `text-lg` pour éviter le zoom auto sur iOS.

---

## 🚀 Étapes de Développement (Workflow Copilot)

### Étape 1 : Squelette & Firebase
1. Créer `index.html` avec le boilerplate Tailwind.
2. Créer `firebase-config.js`. Configurer l'auth et firestore.
3. Créer un écran de login simple.

### Étape 2 : Annuaire des Collègues
1. Créer une section (onglet) pour gérer les collègues.
2. Implémenter l'ajout dans Firestore et l'affichage en liste.

### Étape 3 : Saisie des Courses (UI Jour)
1. Créer le formulaire de prise de note rapide.
2. Ajouter la validation pour s'assurer que la date est saisie.

### Étape 4 : Le Planning (UI Soir)
1. Lister les courses par ordre chronologique.
2. Ajouter le sélecteur de collègues sur chaque "carte" de course.
3. Implémenter la fonction `updateDoc` de Firestore pour l'assignation.

### Étape 5 : Automatisation SMS & PWA
1. Coder la fonction `generateSMSURL(course, collegue)`.
2. Générer le fichier `manifest.json` et les balises meta pour l'icône d'accueil.

---

## ⚠️ Règles de Gestion Importantes
- **Format Date :** Toujours afficher la date au format français (JJ/MM HH:mm).
- **Format Tel :** S'assurer que les numéros de téléphone sont compatibles avec le lien `sms:`.
- **Firebase Rules :** `allow read, write: if request.auth != null;`
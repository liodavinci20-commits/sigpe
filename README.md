# SIGPE — Système d'Information pour la Gestion Pédagogique des Élèves

> Application web ERP scolaire développée pour l'**ENS Yaoundé** (Cameroun) · Année académique 2024–2025  
> Version actuelle : **v2.0** — Backend Supabase connecté, onboarding élève, données réelles

---

## 1. Présentation du Projet

### Objectif

SIGPE est une plateforme de pilotage pédagogique centralisée pour un établissement secondaire. Elle couvre :
l'authentification multi-rôles, les inscriptions, la saisie des notes avec coefficients, les bulletins scolaires,
l'emploi du temps, le suivi des présences, les rapports statistiques et la communication école-famille.

### Fonctionnalités principales

| Fonctionnalité | État | Description |
|---|---|---|
| Authentification multi-rôles | ✅ Réel | 7 rôles distincts, Supabase Auth JWT |
| Mode démo | ✅ Fonctionnel | Simulation sans compte réel (`isDemo: true`) |
| Onboarding élève | ✅ Réel | Formulaire 3 étapes obligatoire après inscription |
| Tableau de bord admin | ✅ Réel | Stats en direct depuis Supabase |
| Annuaire élèves | ✅ Réel | Liste, recherche, filtre, ajout depuis Supabase |
| Notes & Coefficients | ✅ Réel (UI) | Saisie par séquence, coefficient 1→6, moyenne pondérée |
| Profil élève | ✅ Réel | Données perso, notes, présences, notifications depuis BD |
| Portail parents | ✅ Réel | Suivi enfant, notes, graphique, messagerie |
| Bulletins scolaires | 🔶 Partiel | UI complète, génération PDF à brancher |
| Emploi du temps | 🔶 Mock | Grille statique, `schedule_slots` prêt en BD |
| Rapports statistiques | 🔶 Mock | KPIs statiques, tables `grades` prêtes |
| Mode sombre | ✅ Fonctionnel | Toggle CSS pur sur `document.body` |

---

## 2. Stack Technique

```
React 18          — UI (composants fonctionnels + hooks)
Vite 5            — Bundler / Dev server
React Router 6    — Routing SPA (BrowserRouter, ProtectedRoute, Outlet)
Supabase JS 2     — Auth JWT + PostgreSQL (15 tables)
Lucide React      — Bibliothèque d'icônes
CSS custom        — global.css (design system avec variables CSS)
```

---

## 3. Structure des Dossiers

```
sigpe-app/
├── .env                          # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
├── database_schema.sql           # Schéma SQL complet v2.0 (15 tables + trigger)
├── package.json
└── src/
    ├── main.jsx                  # Point d'entrée React
    ├── App.jsx                   # Router + routes publiques/privées/onboarding
    ├── supabaseClient.js         # Client Supabase singleton
    ├── assets/
    │   ├── global.css            # Design system (variables CSS, composants)
    │   └── images/
    ├── context/
    │   └── AuthContext.jsx       # État global auth — expose: user, login, logout, setUser
    ├── components/
    │   ├── layout/
    │   │   ├── Layout.jsx        # Coquille (Sidebar + Header + Outlet)
    │   │   ├── Sidebar.jsx       # Navigation filtrée par rôle
    │   │   ├── Header.jsx        # Dark mode toggle
    │   │   └── ProtectedRoute.jsx
    │   └── ui/
    │       └── AddStudentModal.jsx  # Modal inscription élève → vrai INSERT Supabase
    └── pages/
        ├── Login.jsx             # 3 modes : Démo / Connexion réelle / Inscription
        ├── Onboarding.jsx        # Formulaire profil obligatoire après inscription élève
        ├── Dashboard.jsx         # Tableau de bord (stats réelles admin, mock teacher)
        ├── Students.jsx          # Annuaire élèves réel (Supabase)
        ├── Profile.jsx           # Profil élève (réel ou mock démo)
        ├── Grades.jsx            # Saisie notes avec coefficient 1→6
        ├── Bulletin.jsx          # Génération bulletins (UI)
        ├── Schedule.jsx          # Emploi du temps (mock)
        ├── Reports.jsx           # Rapports & statistiques (mock)
        └── Parent.jsx            # Portail parent (réel ou mock démo)
```

---

## 4. Base de Données — Schéma v2.0 (15 Tables)

### Vue d'ensemble

```
auth.users (Supabase)
    │
    └──1:1──► profiles  ◄──── onboarding_completed, role, full_name, avatar_url
                  │
       ┌──────────┼──────────────────┬──────────────────────┐
       │          │                  │                      │
    student    teacher/staff       parent              (autres)
       │          │                  │
  students    class_subjects    student_parents ────────► students
       │          │
  ┌────┼────┐     └──── classes ◄──── academic_years
  │    │    │               │
grades att. bulletins  schedule_slots
  │
sequences ◄──── academic_years
```

### Tableau des tables

| # | Table | Rôle | Colonnes clés |
|---|---|---|---|
| 1 | `profiles` | Extension auth.users, tous les utilisateurs | `id`, `role`, `full_name`, `avatar_url`, `onboarding_completed` |
| 2 | `academic_years` | Années scolaires | `label`, `start_date`, `end_date`, `is_current` |
| 3 | `classes` | Classes de l'établissement | `name`, `level`, `academic_year_id`, `head_teacher_id` |
| 4 | `subjects` | Référentiel matières | `name`, `code`, `default_coefficient`, `category` |
| 5 | `class_subjects` | Matière × Classe × Enseignant | `class_id`, `subject_id`, `teacher_id`, `coefficient` |
| 6 | `students` | Données scolaires élèves | `matricule`, `class_id`, `date_of_birth`, `gender`, `parent_phone`, `guardian_type` |
| 7 | `student_parents` | Lien N:N élève ↔ parent | `student_id`, `parent_id`, `relationship`, `is_primary` |
| 8 | `sequences` | Périodes d'évaluation (Séq.1→6) | `label`, `number`, `trimester`, `is_active` |
| 9 | `grades` | Notes par élève/matière/séquence | `note`, `coefficient_override`, `student_id`, `class_subject_id`, `sequence_id` |
| 10 | `attendance` | Registre présences/absences | `student_id`, `date`, `period`, `status`, `justification` |
| 11 | `schedule_slots` | Emploi du temps | `class_subject_id`, `day_of_week`, `start_time`, `end_time`, `room` |
| 12 | `bulletins` | Bulletins scolaires générés | `general_average`, `rank`, `status`, `pdf_url` |
| 13 | `bulletin_lines` | Détail note/matière dans un bulletin | `bulletin_id`, `subject_id`, `note`, `coefficient` |
| 14 | `notifications` | Alertes broadcast établissement | `target_group`, `title`, `content`, `type`, `is_read` |
| 15 | `messages` | Messagerie privée bidirectionnelle | `sender_id`, `recipient_id`, `content`, `thread_id` |

### Trigger automatique

```sql
-- Déclenché à chaque inscription via supabase.auth.signUp()
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Ce que fait le trigger :
-- 1. INSERT INTO profiles (id, role, full_name) depuis raw_user_meta_data
-- 2. Si role = 'student' → INSERT INTO students (id, matricule auto-généré)
```

---

## 5. Authentification & Rôles

### Les 7 rôles

| Rôle technique | Libellé affiché | Redirection après login | Accès |
|---|---|---|---|
| `admin` | Administrateur | `/dashboard` | Toutes les pages |
| `sub_admin` | Sous-Administrateur | `/dashboard` | Toutes les pages |
| `teacher_course` | Enseignant Cours | `/dashboard` | Dashboard, Élèves, Notes, EDT |
| `teacher_head` | Prof. Titulaire | `/dashboard` | Dashboard, Élèves, Notes, Bulletins, EDT, Rapports |
| `counselor` | Conseiller Orientation | `/dashboard` | Dashboard, Élèves, Profil, EDT, Rapports |
| `parent` | Parent | `/parent` | Portail Parent, Profil, Bulletins, EDT |
| `student` | Élève | `/onboarding` → `/profile` | Profil, EDT |

### Flux d'authentification complet

```
INSCRIPTION (signUp)
  supabase.auth.signUp({ email, password, options: { data: { role, full_name } } })
    → Trigger SQL → INSERT profiles + INSERT students (si élève)
    → onAuthStateChange fired
    → AuthContext.loadRealProfile()
    → Si student + onboarding_completed = false → navigate('/onboarding')
    → Sinon → routeByRole(role)

CONNEXION (signIn)
  supabase.auth.signInWithPassword({ email, password })
    → onAuthStateChange fired
    → AuthContext.loadRealProfile()
      → SELECT * FROM profiles WHERE id = auth.uid()
      → setUser({ id, email, role, name, displayRole, avatar, onboardingCompleted })
      → routeByRole(role, onboardingCompleted)

DÉMO (sans compte)
  login(role) dans AuthContext
    → setUser({ isDemo: true, role, name simulé, onboardingCompleted: true })
    → routeByRole(role, true)  ← jamais d'onboarding en démo

DÉCONNEXION
  supabase.auth.signOut()  ← seulement si !user.isDemo
  setUser(null) → navigate('/login')
```

---

## 6. Onboarding Élève

Après toute première inscription, l'élève est redirigé vers `/onboarding` avant d'accéder à son profil.

### Les 3 étapes

```
Étape 1 — Identité
  Photo · Nom complet · Date de naissance · Sexe · Ville · Groupe sanguin

Étape 2 — Scolarité
  Affichage info (classe assignée par admin, matricule généré automatiquement)

Étape 3 — Famille
  Téléphone du parent/tuteur · Lien de parenté (père/mère/tuteur/autre)
```

### Ce qui est sauvegardé

```js
// profiles
{ full_name, avatar_url, onboarding_completed: true }

// students
{ date_of_birth, gender, blood_type, city, parent_phone, guardian_type }
```

Une fois l'onboarding terminé (`onboarding_completed = true`), l'élève ne voit plus jamais cette page.

---

## 7. Mode Démo vs Données Réelles

**Principe :** chaque page vérifie `user.isDemo` et choisit sa source de données.

```javascript
useEffect(() => {
  if (user.isDemo) {
    setData(MOCK_DATA);  // données fictives embarquées
  } else {
    fetchRealData();     // requêtes Supabase
  }
}, [user]);
```

### État par page

| Page | Mode Démo | Mode Réel |
|---|---|---|
| `Login.jsx` | Sélection de rôle → simulation immédiate | Supabase Auth signIn/signUp |
| `Dashboard.jsx` | Stats fictives | COUNT réels depuis `profiles`, `classes`, `messages` |
| `Students.jsx` | — | Liste depuis `students JOIN profiles JOIN classes` |
| `Profile.jsx` | Données mock (Ngo Balla Marie-Claire) | `students + grades + attendance + notifications` |
| `Parent.jsx` | Données mock (enfant fictif) | `student_parents → child → grades + attendance` |
| `Grades.jsx` | Mock classes + élèves | UI prête, `INSERT grades` à brancher |
| `Bulletin.jsx` | — | UI prête, génération PDF à brancher |
| `Schedule.jsx` | Grille statique | `schedule_slots` prêt en BD |
| `Reports.jsx` | KPIs statiques | À connecter aux tables `grades` + `students` |

---

## 8. Fonctionnement des Coefficients (Grades.jsx)

Le coefficient d'une unité d'enseignement (1 à 6) est sélectionnable par l'enseignant lors de la saisie.

```
Enseignant sélectionne coeff 4 pour Mathématiques 3ème B
  → Affiché dans l'en-tête + bandeau informatif
  → Colonne "Note pondérée" = note_élève × coefficient
  → Moyenne classe pondérée calculée en temps réel
  → En BD : stocké dans class_subjects.coefficient
  → En bulletin : SUM(note × coeff) / SUM(coeff) = moyenne générale
```

**Calcul de la moyenne pondérée :**
```javascript
const weightedAvg = (grades) => {
  let pts = 0, c = 0;
  grades.forEach(g => {
    const coeff = g.coefficient_override ?? g.class_subjects?.coefficient ?? 1;
    pts += g.note * coeff;
    c   += coeff;
  });
  return c > 0 ? pts / c : null;
};
```

---

## 9. Inscription d'un Élève par l'Admin (AddStudentModal)

L'administrateur peut inscrire un élève directement depuis l'annuaire sans se déconnecter.

```javascript
// Technique : client Supabase temporaire sans persistance de session
const tempClient = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

await tempClient.auth.signUp({ email, password, options: { data: { role: 'student', full_name } } });
// → Trigger crée profiles + students automatiquement
// → Admin met à jour class_id, date_of_birth, parent_phone, etc.
// → onboarding_completed: true (admin a déjà tout rempli)
```

L'élève peut alors se connecter avec l'email et le mot de passe communiqués par l'admin.

---

## 10. Requêtes Supabase Types

```javascript
// Compter les élèves inscrits
const { count } = await supabase
  .from('profiles')
  .select('*', { count: 'exact', head: true })
  .eq('role', 'student');

// Charger la liste élèves avec classe
const { data } = await supabase
  .from('students')
  .select('id, matricule, profiles(full_name, avatar_url), classes(name)')
  .order('created_at', { ascending: false });

// Notes d'un élève pour la séquence active
const { data } = await supabase
  .from('grades')
  .select(`
    note, coefficient_override,
    class_subjects(coefficient, subjects(name)),
    sequences(label, number, is_active)
  `)
  .eq('student_id', userId);

// Envoyer une notification à tous les parents
await supabase.from('notifications').insert({
  sender_id:    adminId,
  target_group: 'parents',
  title:        'Message de l\'Administration',
  content:      '...',
  type:         'info'
});

// Notifications pour un élève (personnelles ou broadcast)
const { data } = await supabase
  .from('notifications')
  .select('*')
  .or(`recipient_id.eq.${userId},target_group.eq.all,target_group.eq.students`)
  .order('created_at', { ascending: false });
```

---

## 11. Variables d'Environnement

```env
# sigpe-app/.env
VITE_SUPABASE_URL=https://kxsachahpbrftxqkqeco.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

Le fichier `supabaseClient.js` lit ces variables automatiquement via `import.meta.env`.

---

## 12. Configuration Supabase (à faire une seule fois)

### 1. Désactiver la confirmation email
```
Supabase Dashboard → Authentication → Providers → Email
→ Désactiver "Confirm email" → Save
```

### 2. Exécuter le schéma SQL
```
Supabase Dashboard → SQL Editor → New Query
→ Coller le contenu de database_schema.sql → Run
```

### 3. Si la BD existe déjà (migration v1 → v2)
```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;
ALTER TABLE students ADD COLUMN IF NOT EXISTS parent_phone TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_type TEXT
  CHECK (guardian_type IN ('père','mère','tuteur','autre'));
```

---

## 13. Démarrage Rapide

```bash
# 1. Installer les dépendances
cd sigpe-app
npm install

# 2. Configurer l'environnement
# Renseigner .env avec les clés Supabase (voir section 11)

# 3. Lancer le serveur de développement
npm run dev

# → http://localhost:5173
# → Mode Démo fonctionnel même sans clés Supabase
```

---

## 14. Ce qui Reste à Connecter (Priorités)

| Priorité | Page | Tâche |
|---|---|---|
| 🔴 | `Grades.jsx` | Brancher le bouton 💾 sur `supabase.from('grades').upsert(...)` |
| 🔴 | `Grades.jsx` | Charger les vraies classes/élèves de l'enseignant connecté |
| 🔴 | `student_parents` | Lier les parents à leurs enfants après inscription |
| 🟠 | `Schedule.jsx` | Charger `schedule_slots` depuis Supabase |
| 🟠 | `Bulletin.jsx` | Implémenter la génération réelle (`bulletins` + `bulletin_lines`) |
| 🟠 | `Reports.jsx` | Connecter les KPIs sur `grades`, `students`, `attendance` |
| 🟠 | `Profile.jsx` | Calculer et afficher le rang réel en classe |
| 🟡 | `messages` | Implémenter la messagerie avec destinataire réel |
| 🟡 | Supabase Storage | Bucket `avatars` pour les photos de profil |
| 🟡 | RLS | Ajouter Row Level Security sur toutes les tables |

---

## 15. Limites Connues

| Limite | Détail |
|---|---|
| Pas de RLS | Les données ne sont pas encore sécurisées par rôle côté serveur |
| Rang en classe | Affiché `—` pour les élèves réels (calcul de classement non implémenté) |
| Bulletin non généré | Le bouton "Lancer" ne crée pas encore de PDF réel |
| `teacher_head` / `counselor` | Vues Dashboard vides, à compléter |
| Lien parent-enfant | Doit être créé manuellement par l'admin dans `student_parents` |
| Schedule | Grille statique, non connectée à `schedule_slots` |

---

*SIGPE v2.0 © 2025 — ENS Yaoundé | Support : support@sigpe.cm*

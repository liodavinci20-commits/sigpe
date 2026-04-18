# SIGPE — Système d'Information pour la Gestion Pédagogique des Élèves

> Application web ERP scolaire développée pour l'**ENS Yaoundé** (Cameroun) · Année académique 2024–2025  
> Version actuelle : **v3.0** — Onboarding complet tous rôles, données réelles, filtrage par rôle

---

## 1. Présentation du Projet

### Objectif

SIGPE est une plateforme de pilotage pédagogique centralisée pour un établissement secondaire. Elle couvre :
l'authentification multi-rôles, les onboardings par rôle, la saisie des notes avec coefficients, les bulletins scolaires,
l'emploi du temps, le suivi des présences, les rapports statistiques et la communication école-famille.

### Fonctionnalités principales

| Fonctionnalité | État | Description |
|---|---|---|
| Authentification multi-rôles | ✅ Réel | 7 rôles distincts, Supabase Auth JWT |
| Mode démo | ✅ Fonctionnel | Simulation sans compte réel (`isDemo: true`) |
| Onboarding élève | ✅ Réel | 3 étapes : identité + classe + famille |
| Onboarding parent | ✅ Réel | Photo + identité + recherche enfant (Supabase) |
| Onboarding enseignant cours | ✅ Réel | Photo + matière (recherche) + multi-classes |
| Onboarding prof titulaire | ✅ Réel | Photo + identité + classe unique |
| Onboarding conseiller | ✅ Réel | Photo + identité + multi-classes |
| Tableau de bord admin | ✅ Réel | Stats en direct depuis Supabase |
| Tableau de bord enseignant | ✅ Réel | Notifications admin + ses classes |
| Annuaire élèves (admin) | ✅ Réel | Liste complète + assignation de classe inline |
| Annuaire élèves (enseignant) | ✅ Réel | Filtré sur ses classes uniquement |
| Notes & Évaluations | ✅ Réel | Saisie par séquence + type (devoir1/devoir2/compo) |
| Profil élève | ✅ Réel | Données perso, notes, présences, notifications |
| Profil enfant (parent) | ✅ Réel | Parent voit les données réelles de son enfant |
| Portail parents | ✅ Réel | Suivi enfant, donut présences, bannière enfant |
| Recherche globale Header | ✅ Réel | Debounce 300ms, filtrée par rôle |
| Cloche notifications | ✅ Réel | Supabase Realtime + animation + badge rouge |
| Badge élèves Sidebar | ✅ Réel | Comptage dynamique selon le rôle |
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
Supabase JS 2     — Auth JWT + PostgreSQL + Storage + Realtime
Lucide React      — Bibliothèque d'icônes
CSS custom        — global.css (design system avec variables CSS)
```

---

## 3. Structure des Dossiers

```
sigpe-app/
├── .env                          # VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
├── database_schema.sql           # Schéma SQL complet v3.0 (15 tables + trigger)
├── package.json
└── src/
    ├── main.jsx
    ├── App.jsx                   # Router + routes onboarding par rôle
    ├── supabaseClient.js
    ├── assets/global.css
    ├── context/
    │   └── AuthContext.jsx       # authLoading, user, login, logout, setUser, routeByRole
    ├── components/
    │   ├── layout/
    │   │   ├── Layout.jsx
    │   │   ├── Sidebar.jsx       # Badge élèves dynamique par rôle
    │   │   ├── Header.jsx        # Recherche Supabase + cloche Realtime
    │   │   └── ProtectedRoute.jsx  # Spinner pendant authLoading
    │   └── ui/
    │       └── AddStudentModal.jsx
    └── pages/
        ├── Login.jsx
        ├── Onboarding.jsx           # Élève : identité + classe + famille
        ├── OnboardingParent.jsx     # Parent : photo + recherche enfant Supabase
        ├── OnboardingTeacher.jsx    # Enseignant cours : photo + matière + classes
        ├── OnboardingTeacherHead.jsx  # Prof titulaire : photo + 1 classe
        ├── OnboardingCounselor.jsx  # Conseiller : photo + multi-classes
        ├── Dashboard.jsx
        ├── Students.jsx             # Filtré par rôle + assignation classe (admin)
        ├── Profile.jsx              # Données enfant si connecté en tant que parent
        ├── Grades.jsx               # Saisie réelle : séquence + type évaluation
        ├── Bulletin.jsx
        ├── Schedule.jsx
        ├── Reports.jsx
        └── Parent.jsx
```

---

## 4. Base de Données — Schéma v3.0 (15 Tables)

### Vue d'ensemble

```
auth.users (Supabase)
    │
    └──1:1──► profiles  ◄──── onboarding_completed, role, full_name, avatar_url
                  │
       ┌──────────┼──────────────────┬──────────────────────┐
       │          │                  │                      │
    student    teacher/staff       parent              counselor
       │          │                  │
  students    class_subjects    student_parents ──► students
       │          │
  ┌────┼────┐     └──── classes ◄──── academic_years
  │    │    │          (head_teacher_id)
grades att. bulletins
  │
sequences ◄──── academic_years
```

### Tableau des tables

| # | Table | Rôle | Colonnes clés |
|---|---|---|---|
| 1 | `profiles` | Extension auth.users | `id`, `role`, `full_name`, `avatar_url`, `onboarding_completed` |
| 2 | `academic_years` | Années scolaires | `label`, `start_date`, `end_date`, `is_current` |
| 3 | `classes` | Classes de l'établissement | `name`, `level`, `academic_year_id`, `head_teacher_id` |
| 4 | `subjects` | Référentiel matières | `name`, `code`, `default_coefficient`, `category` |
| 5 | `class_subjects` | Matière × Classe × Enseignant | `class_id`, `subject_id`, `teacher_id`, `coefficient`, `academic_year_id` |
| 6 | `students` | Données scolaires élèves | `matricule`, `class_id`, `date_of_birth`, `gender`, `parent_phone`, `guardian_type` |
| 7 | `student_parents` | Lien N:N élève ↔ parent | `student_id`, `parent_id`, `relationship`, `is_primary` |
| 8 | `sequences` | Périodes d'évaluation (Séq.1→6) | `label`, `number`, `trimester`, `is_active` |
| 9 | `grades` | Notes par élève/matière/séquence/type | `note`, `student_id`, `class_subject_id`, `sequence_id`, `evaluation_type` |
| 10 | `attendance` | Registre présences/absences | `student_id`, `date`, `period`, `status`, `justification` |
| 11 | `schedule_slots` | Emploi du temps | `class_subject_id`, `day_of_week`, `start_time`, `end_time`, `room` |
| 12 | `bulletins` | Bulletins scolaires générés | `general_average`, `rank`, `status`, `pdf_url` |
| 13 | `bulletin_lines` | Détail note/matière dans un bulletin | `bulletin_id`, `subject_id`, `note`, `coefficient` |
| 14 | `notifications` | Alertes broadcast établissement | `target_group`, `title`, `content`, `type`, `is_read` |
| 15 | `messages` | Messagerie privée bidirectionnelle | `sender_id`, `recipient_id`, `content`, `thread_id` |

### Colonnes importantes à ne pas oublier

```sql
-- grades : type d'évaluation obligatoire
ALTER TABLE grades ADD COLUMN IF NOT EXISTS evaluation_type TEXT
  CHECK (evaluation_type IN ('devoir1', 'devoir2', 'composition'));

-- Contrainte unique grades (remplace l'ancienne)
ALTER TABLE grades ADD CONSTRAINT grades_unique
  UNIQUE (student_id, class_subject_id, sequence_id, evaluation_type);

-- class_subjects : contrainte unique sur 3 colonnes
UNIQUE (class_id, subject_id, academic_year_id)

-- classes : prof titulaire
head_teacher_id UUID REFERENCES profiles(id)

-- student_parents : type de lien
relationship TEXT CHECK (relationship IN ('père','mère','tuteur','autre'))
```

### Trigger automatique

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
-- → INSERT INTO profiles (id, role, full_name) depuis raw_user_meta_data
-- → Si role = 'student' → INSERT INTO students (id, matricule auto-généré)
```

---

## 5. Authentification & Rôles

### Les 7 rôles

| Rôle technique | Libellé affiché | Onboarding | Redirection finale |
|---|---|---|---|
| `admin` | Administrateur | Aucun | `/dashboard` |
| `sub_admin` | Sous-Administrateur | Aucun | `/dashboard` |
| `teacher_course` | Enseignant Cours | `/onboarding-teacher` | `/grades` |
| `teacher_head` | Prof. Titulaire | `/onboarding-teacher-head` | `/dashboard` |
| `counselor` | Conseiller Orientation | `/onboarding-counselor` | `/dashboard` |
| `parent` | Parent | `/onboarding-parent` | `/parent` |
| `student` | Élève | `/onboarding` | `/profile` |

### Flux d'authentification

```
CONNEXION → onAuthStateChange → loadRealProfile()
  → SELECT * FROM profiles WHERE id = user.id
  → setUser({ role, name, displayRole, onboardingCompleted, ... })
  → routeByRole(role, onboardingCompleted)
    → Si onboarding non fait → route onboarding spécifique au rôle
    → Sinon → route principale du rôle

authLoading = true pendant la vérification de session
  → ProtectedRoute affiche un spinner (évite le flash vers /login)
  → authLoading = false après résolution
```

---

## 6. Onboardings par Rôle

### Élève (`/onboarding`)

```
Étape 1 — Identité : Photo · Nom · Date de naissance · Sexe · Ville · Groupe sanguin
Étape 2 — Scolarité : Choix de classe parmi celles disponibles en BD
Étape 3 — Famille : Téléphone parent · Lien de parenté
→ Sauvegarde : profiles + students + avatar Supabase Storage
→ Redirige vers /profile
```

### Parent (`/onboarding-parent`)

```
Étape 1 — Identité : Photo · Nom · Lien de parenté (père/mère/tuteur/autre)
Étape 2 — Enfant : Recherche par nom ou matricule (2 requêtes Supabase fusionnées)
→ Sauvegarde : profiles + student_parents (upsert onConflict: student_id,parent_id)
→ Redirige vers /parent — bannière "Parent de [prénom enfant]"
```

### Enseignant de cours (`/onboarding-teacher`)

```
Étape 1 — Identité : Photo · Nom · Téléphone
Étape 2 — Matière : Recherche ilike dans subjects
Étape 3 — Classes : Multi-sélection (checkboxes)
→ Sauvegarde : profiles + class_subjects (upsert onConflict: class_id,subject_id,academic_year_id)
→ academic_year_id : SELECT id FROM academic_years WHERE is_current = true
→ Redirige vers /grades
```

### Prof titulaire (`/onboarding-teacher-head`)

```
Étape 1 — Identité : Photo · Nom · Téléphone
Étape 2 — Classe : Sélection unique (classes déjà prises affichées en grisé avec nom du titulaire actuel)
→ Sauvegarde : profiles + UPDATE classes SET head_teacher_id = user.id
→ Redirige vers /dashboard
```

### Conseiller d'orientation (`/onboarding-counselor`)

```
Étape 1 — Identité : Photo · Nom · Téléphone
Étape 2 — Classes : Multi-sélection des classes suivies
→ Sauvegarde : profiles + notification staff "Conseiller inscrit, classes : ..."
→ Redirige vers /dashboard
```

---

## 7. Supabase Storage — Bucket `avatars`

Les photos de profil sont uploadées dans le bucket `avatars`.

### Politiques RLS à créer (SQL Editor Supabase)

```sql
-- Permettre upload
CREATE POLICY "Upload avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- Permettre lecture publique
CREATE POLICY "Read avatars" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'avatars');

-- Permettre remplacement (upsert)
CREATE POLICY "Update avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');
```

### Code d'upload

```javascript
const path = `avatars/${user.id}.${ext}`;
const { error } = await supabase.storage
  .from('avatars')
  .upload(path, file, { upsert: true });

const { data } = supabase.storage.from('avatars').getPublicUrl(path);
avatarUrl = data.publicUrl;
```

---

## 8. Cloche & Notifications Realtime (Header)

La cloche reçoit les nouvelles notifications en temps réel via Supabase Realtime.

```javascript
// Subscription Realtime
const channel = supabase
  .channel(`notifs-${user.id}`)
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'notifications' },
    (payload) => {
      const relevant = !groups || groups.includes(payload.new?.target_group);
      if (!relevant) return;
      setUnreadCount(prev => prev + 1);
      setRinging(true);
      setTimeout(() => setRinging(false), 1200);
    }
  ).subscribe();
```

### Groupes de notifications par rôle

| Rôle | Groupes visibles |
|---|---|
| `admin`, `sub_admin` | Tout (`null` = pas de filtre) |
| `teacher_*`, `counselor` | `all`, `staff` |
| `student` | `all`, `students` |
| `parent` | `all`, `parents` |

---

## 9. Recherche Globale (Header)

Recherche debounce 300ms avec deux requêtes parallèles fusionnées.

```javascript
// Élèves par nom
supabase.from('profiles').select('id, full_name, avatar_url, students(matricule, class_id, classes(name))')
  .eq('role', 'student').ilike('full_name', `%${q}%`).limit(5)

// Élèves par matricule
supabase.from('students').select('id, matricule, class_id, profiles(full_name, avatar_url), classes(name)')
  .ilike('matricule', `%${q}%`).limit(4)

// Classes
supabase.from('classes').select('id, name, level').ilike('name', `%${q}%`).limit(4)
```

Pour `teacher_course` et `teacher_head` : les 3 requêtes sont filtrées sur `classIds` issus de `class_subjects`/`classes`.

---

## 10. Filtrage Élèves par Rôle (Students.jsx)

```javascript
// Admin/sous-admin : tous les élèves
// teacher_course : élèves de ses classes (via class_subjects.teacher_id)
// teacher_head   : élèves de sa classe (via classes.head_teacher_id)
// counselor      : tous les élèves (pas de table dédiée)

if (user.role === 'teacher_course') {
  const { data: csRows } = await supabase
    .from('class_subjects').select('class_id').eq('teacher_id', user.id);
  allowedClassIds = [...new Set(csRows.map(r => r.class_id))];
  query = query.in('class_id', allowedClassIds);
}
```

- Le dropdown d'assignation de classe (modifier la classe d'un élève) est **réservé aux admins**
- Le bouton "Nouvel Élève" est **réservé aux admins**
- Les enseignants voient la classe affichée en lecture seule

---

## 11. Badge Élèves Sidebar

Comptage dynamique selon le rôle, chargé au montage du composant Sidebar.

```javascript
// Admin : COUNT(*) FROM students
// teacher_course : COUNT avec filtre IN(class_ids from class_subjects)
// teacher_head   : COUNT avec filtre IN(class_ids from classes where head_teacher_id)
// counselor      : COUNT(*) FROM students (pas de table dédiée)
// isDemo         : pas de badge (pas de requête Supabase)
```

---

## 12. Profil Élève vu par un Parent (Profile.jsx)

```javascript
if (user.role === 'parent') {
  const { data: link } = await supabase
    .from('student_parents')
    .select('student_id')
    .eq('parent_id', user.id)
    .limit(1).single();

  if (!link?.student_id) { setData({ noChild: true }); return; }
  studentId = link.student_id; // chargement des données de l'enfant
}
```

---

## 13. Notes & Évaluations (Grades.jsx)

### Structure de données

```
Séquence (Séq. 1 → 6)
  └── Type d'évaluation : devoir1 | devoir2 | composition
        └── Note par élève
```

### Upsert des notes

```javascript
await supabase.from('grades').upsert({
  student_id:      studentId,
  class_subject_id: csId,
  sequence_id:     seqId,
  evaluation_type: 'devoir1',  // ou 'devoir2' ou 'composition'
  note:            parseFloat(value),
}, { onConflict: 'student_id,class_subject_id,sequence_id,evaluation_type' });
```

---

## 14. Erreurs Courantes & Fixes

| Erreur | Cause | Fix |
|---|---|---|
| Flash vers `/login` au chargement | `ProtectedRoute` redirige avant que la session Supabase soit vérifiée | `authLoading` dans AuthContext + spinner dans ProtectedRoute |
| `no unique constraint matching ON CONFLICT` | `onConflict` ne correspond pas à une contrainte existante | Vérifier les colonnes exactes de la contrainte UNIQUE |
| `column is_active does not exist` | La colonne s'appelle `is_current` dans `academic_years` | `.eq('is_current', true)` |
| `violated security` (Storage) | Bucket `avatars` sans politique RLS | Créer les 3 politiques INSERT/SELECT/UPDATE |
| Photo non sauvegardée silencieusement | Erreur d'upload avalée, `avatarUrl = null` | Afficher notification d'erreur, conditionner `avatar_url` au succès |
| Recherche parent impossible sur JOIN | PostgREST ne filtre pas sur tables jointes dans `.or()` | Deux requêtes séparées + fusion/déduplication côté JS |
| `relationship` rejeté par CHECK | Code envoyait `'parent'` mais contrainte attend `'père'/'mère'/'tuteur'/'autre'` | Dropdown avec les valeurs exactes du CHECK |

---

## 15. SQL à Exécuter (Actions manuelles Supabase)

```sql
-- 1. Activer l'année courante
UPDATE academic_years SET is_current = true WHERE label = '2024-2025';

-- 2. Ajouter evaluation_type aux notes
ALTER TABLE grades ADD COLUMN IF NOT EXISTS evaluation_type TEXT
  CHECK (evaluation_type IN ('devoir1', 'devoir2', 'composition'));

-- 3. Recréer la contrainte unique grades
ALTER TABLE grades DROP CONSTRAINT IF EXISTS grades_student_id_class_subject_id_sequence_id_key;
ALTER TABLE grades ADD CONSTRAINT grades_unique
  UNIQUE (student_id, class_subject_id, sequence_id, evaluation_type);

-- 4. Policies Storage (bucket avatars)
-- Voir section 7
```

---

## 16. Variables d'Environnement

```env
VITE_SUPABASE_URL=https://kxsachahpbrftxqkqeco.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
```

---

## 17. Démarrage Rapide

```bash
cd sigpe-app
npm install
npm run dev
# → http://localhost:5173
# → Mode Démo disponible sans compte Supabase
```

---

## 18. Ce qui Reste à Connecter

| Priorité | Page/Fonctionnalité | Tâche |
|---|---|---|
| 🔴 | `counselor_classes` | Créer table dédiée pour lier conseiller ↔ classes (actuellement pas de filtre) |
| 🟠 | `Schedule.jsx` | Charger `schedule_slots` depuis Supabase |
| 🟠 | `Bulletin.jsx` | Implémenter la génération réelle (`bulletins` + `bulletin_lines`) |
| 🟠 | `Reports.jsx` | Connecter les KPIs sur `grades`, `students`, `attendance` |
| 🟠 | `Profile.jsx` | Calculer et afficher le rang réel en classe |
| 🟡 | `messages` | Implémenter la messagerie avec destinataire réel |
| 🟡 | RLS | Ajouter Row Level Security sur toutes les tables |
| 🟡 | Dashboard `teacher_head` | Section propre au prof titulaire (ses élèves, moyennes) |

---

*SIGPE v3.0 © 2025 — ENS Yaoundé*

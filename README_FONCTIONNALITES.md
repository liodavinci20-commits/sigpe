# SIGPE — Fonctionnalités à Implémenter

> Ce document recense toutes les fonctionnalités planifiées, leur logique métier, les flux utilisateur, les structures de données nécessaires et les détails d'implémentation. Rien ne doit être codé sans que ce document ne soit consulté en premier.

---

## Table des matières

1. [Correction urgente — Grades.jsx](#1-correction-urgente--gradesjsx)
2. [Rapports enrichis — Catégorisation des élèves](#2-rapports-enrichis--catégorisation-des-élèves)
3. [Système d'alerte Titulaire → Enseignant](#3-système-dalerte-titulaire--enseignant)
4. [Réponse de l'enseignant — Exercices ciblés](#4-réponse-de-lenseignant--exercices-ciblés)
5. [Vue élève — Mes exercices](#5-vue-élève--mes-exercices)
6. [Nouvelles tables Supabase](#6-nouvelles-tables-supabase)
7. [Récapitulatif des fichiers touchés](#7-récapitulatif-des-fichiers-touchés)

---

## 1. Correction urgente — Grades.jsx

### Problème actuel

Le code de `Grades.jsx` a été modifié lors d'une session précédente pour utiliser des colonnes `note_devoir1`, `note_devoir2`, `note_composition` **qui n'existent pas** dans la base de données.

### Vraie structure de la table `grades`

```sql
CREATE TABLE grades (
  id                   UUID PRIMARY KEY,
  student_id           UUID REFERENCES students(id),
  class_subject_id     UUID REFERENCES class_subjects(id),
  teacher_id           UUID REFERENCES profiles(id),
  sequence_id          UUID REFERENCES sequences(id),
  evaluation_type      TEXT CHECK (evaluation_type IN ('devoir1','devoir2','composition')),
  note                 NUMERIC(4,2) CHECK (note >= 0 AND note <= 20),
  coefficient_override INTEGER,
  comment              TEXT,
  created_at           TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ,
  UNIQUE (student_id, class_subject_id, sequence_id, evaluation_type)
);
```

### Ce que ça implique

- **1 ligne par type d'évaluation** par élève par matière par séquence
- Pour afficher les 3 colonnes (Devoir 1 / Devoir 2 / Composition) dans l'interface, il faut **pivoter** : récupérer les 3 lignes et les présenter sur une seule ligne visuelle
- Pour sauvegarder, il faut **upsert 3 lignes séparées** (une par type)

### Logique de lecture (SELECT)

```
Récupérer toutes les lignes grades
WHERE class_subject_id = X AND sequence_id = Y

Grouper par student_id :
  {
    student_id: "abc",
    devoir1: note de la ligne où evaluation_type = 'devoir1',
    devoir2: note de la ligne où evaluation_type = 'devoir2',
    composition: note de la ligne où evaluation_type = 'composition',
  }
```

### Logique de sauvegarde (UPSERT)

Pour chaque élève, upsert jusqu'à 3 lignes :

```js
const upserts = [];
students.forEach(s => {
  if (s.d1 !== null) upserts.push({
    student_id: s.id, class_subject_id: selectedCS.id,
    sequence_id: selectedSeqId, teacher_id: user.id,
    evaluation_type: 'devoir1', note: Number(s.d1)
  });
  if (s.d2 !== null) upserts.push({
    student_id: s.id, class_subject_id: selectedCS.id,
    sequence_id: selectedSeqId, teacher_id: user.id,
    evaluation_type: 'devoir2', note: Number(s.d2)
  });
  if (s.comp !== null) upserts.push({
    student_id: s.id, class_subject_id: selectedCS.id,
    sequence_id: selectedSeqId, teacher_id: user.id,
    evaluation_type: 'composition', note: Number(s.comp)
  });
});

await supabase.from('grades').upsert(upserts, {
  onConflict: 'student_id,class_subject_id,sequence_id,evaluation_type'
});
```

### Fichiers à corriger

- `src/pages/Grades.jsx` — fonction `loadStudentsAndGrades` + fonction `handleSave`
- `src/pages/Profile.jsx` — section affichage des notes dans le profil élève
- `src/pages/Reports.jsx` — calcul des moyennes

---

## 2. Rapports enrichis — Catégorisation des élèves

### Objectif

Transformer la page Rapports & Statistiques du titulaire et du conseiller en un **outil de pilotage réel**, connecté aux données de la BD, qui permet de voir en un coup d'œil le niveau de chaque élève par matière.

### Qui voit cette fonctionnalité

- `teacher_head` (professeur titulaire) — pour sa classe uniquement
- `counselor` (conseiller) — pour toutes les classes

### Système de catégorisation

| Catégorie | Fourchette de moyenne | Couleur | Signification |
|-----------|----------------------|---------|---------------|
| Excellent | ≥ 15/20 | Vert foncé (`#16a34a`) | Aucune intervention nécessaire |
| Bien | 12 – 14.9 | Vert clair (`var(--green)`) | Suit correctement |
| Fragile | 10 – 11.9 | Orange (`#f59e0b`) | Zone de bascule — à surveiller |
| En difficulté | < 10 | Rouge (`#ef4444`) | Intervention urgente |

> Le niveau **"Fragile"** est critique : ces élèves ne sont pas encore en échec mais sans action ils le deviennent. C'est la zone d'intervention préventive.

### Calcul de la moyenne par élève par matière

```
Pour chaque élève, pour chaque matière (class_subject) :
  Récupérer toutes les lignes grades de la séquence active
  
  moyenne = somme des notes / nombre de notes présentes
  
  Si evaluation_type = 'composition' existe → lui donner coefficient 2
  Si evaluation_type = 'devoir1' ou 'devoir2' → coefficient 1 chacun
  
  moyenne_pondérée = (d1×1 + d2×1 + compo×2) / (nb_coeffs_présents)
```

### Structure de la requête Supabase

Étape 1 — récupérer les class_subjects de la classe :
```js
const { data: csRows } = await supabase
  .from('class_subjects')
  .select('id, coefficient, subjects(name), profiles(full_name)')
  .eq('class_id', classId);
```

Étape 2 — récupérer toutes les notes de la classe pour la séquence active :
```js
const { data: gradeRows } = await supabase
  .from('grades')
  .select('student_id, class_subject_id, evaluation_type, note')
  .in('class_subject_id', csRows.map(cs => cs.id))
  .eq('sequence_id', activeSequenceId);
```

Étape 3 — pivoter et calculer en JS :
```js
// Construire un objet { [student_id]: { [class_subject_id]: { d1, d2, comp, avg, category } } }
```

### Affichage dans la page Rapports

Pour chaque matière, une carte qui affiche :

```
┌─────────────────────────────────────────────────────┐
│  MATHÉMATIQUES   ·   Prof : M. Kamga   ·   Coeff 4  │
├─────────────────────────────────────────────────────┤
│  🟢 Excellent (3)   AMOUGOU Paul · BITA Clara · ...  │
│  🟡 Bien      (8)   NKODO Jules · MVOGO Sarah · ...  │
│  🟠 Fragile   (4)   MBARGA Léa · ETOUNDI Karl · ...  │
│  🔴 Difficulté(2)   ATEBA Rose · FOUDA Brice         │
├─────────────────────────────────────────────────────┤
│           [ ⚠️ Alerter M. Kamga ]                    │
└─────────────────────────────────────────────────────┘
```

Le bouton **"Alerter"** n'apparaît que si des élèves sont en catégorie "Fragile" ou "En difficulté".

### Statistiques globales à conserver (et améliorer)

En plus de la catégorisation par matière, garder et enrichir :
- Moyenne générale de la classe par séquence (graphique existant)
- Taux de réussite (% élèves ≥ 10) — connecté aux vraies données
- Distribution des notes (histogramme) — calculé depuis les vraies notes
- Évolution entre séquences (courbe) — si plusieurs séquences ont des données

### Fichier concerné

- `src/pages/Reports.jsx` — refonte de la section données réelles, ajout de la vue par matière

---

## 3. Système d'alerte Titulaire → Enseignant

### Objectif

Permettre au titulaire ou au conseiller d'envoyer à un enseignant de matière une liste précise d'élèves nécessitant un suivi, avec leur niveau de difficulté.

### Déclencheur

Bouton **"Alerter [Nom de l'enseignant]"** présent sur la carte de chaque matière dans Rapports, visible uniquement si des élèves sont en catégorie "Fragile" ou "En difficulté".

### Ce qui se passe au clic

1. **Modale de confirmation** s'ouvre, affichant :
   - Le nom de l'enseignant destinataire
   - La matière concernée
   - La liste des élèves fragiles + en difficulté avec leur moyenne
   - Un champ optionnel pour ajouter un message personnalisé

2. À la validation, le système :
   - Crée un enregistrement dans `performance_groups` (voir section 6)
   - Envoie une notification dans `notifications` à l'enseignant
   - Affiche un toast de confirmation au titulaire/conseiller

### Contenu de la notification envoyée à l'enseignant

```
Titre : "⚠️ Élèves à suivre — [Matière]"
Contenu : "[Prénom Nom du titulaire] a signalé 6 élèves nécessitant
           un suivi particulier en [Matière] — Classe [Nom de classe]
           — Séquence [N]. Consultez l'onglet 'Élèves signalés'."
type : 'warning'
```

### Modale de confirmation (UI)

```
┌──────────────────────────────────────────────────────┐
│  ⚠️  Alerter M. Kamga — Mathématiques                │
├──────────────────────────────────────────────────────┤
│  Les élèves suivants seront signalés :               │
│                                                      │
│  🔴 ATEBA Rose          7.5 / 20                     │
│  🔴 FOUDA Brice         8.2 / 20                     │
│  🟠 MBARGA Léa         10.1 / 20                     │
│  🟠 NKODO Jules        10.8 / 20                     │
│  🟠 MVOGO Sarah        11.2 / 20                     │
│  🟠 ETOUNDI Karl       11.4 / 20                     │
│                                                      │
│  Message optionnel :                                 │
│  [ Ces élèves ont besoin de renforcement...     ]    │
│                                                      │
│        [ Annuler ]    [ ✅ Envoyer l'alerte ]        │
└──────────────────────────────────────────────────────┘
```

### Fichier concerné

- `src/pages/Reports.jsx` — ajout de la modale + logique d'envoi

---

## 4. Réponse de l'enseignant — Exercices ciblés

### Objectif

L'enseignant de matière reçoit la liste des élèves signalés et peut créer des exercices ou devoirs ciblés pour ce groupe.

### Où l'enseignant voit les signalements

Dans la page **Grades** (Notes & Évaluations), un onglet supplémentaire **"Élèves signalés"** apparaît si au moins un signalement existe pour ses matières.

Ou alternativement dans **TeacherProfile** — à décider.

> Recommandation : **dans Grades**, car c'est la page pédagogique. L'enseignant y est déjà pour noter, il voit là aussi qui a été signalé.

### Vue "Élèves signalés" chez l'enseignant

```
┌──────────────────────────────────────────────────────────┐
│  ⚠️  Signalement du 19/04/2025                           │
│  Signalé par : Prof. Titulaire Nkolo Jean                │
│  Classe : 3ème B — Mathématiques — Séquence 2            │
├──────────────────────────────────────────────────────────┤
│  🔴 ATEBA Rose          7.5 / 20   En difficulté         │
│  🔴 FOUDA Brice         8.2 / 20   En difficulté         │
│  🟠 MBARGA Léa         10.1 / 20   Fragile               │
│  🟠 NKODO Jules        10.8 / 20   Fragile               │
│  🟠 MVOGO Sarah        11.2 / 20   Fragile               │
│  🟠 ETOUNDI Karl       11.4 / 20   Fragile               │
├──────────────────────────────────────────────────────────┤
│  Message : "Ces élèves ont besoin de renforcement"       │
│                                                          │
│            [ + Créer un exercice pour ce groupe ]        │
└──────────────────────────────────────────────────────────┘
```

### Création d'un exercice

Modale simple :

```
┌──────────────────────────────────────┐
│  Nouvel exercice — Groupe signalé    │
├──────────────────────────────────────┤
│  Titre *                             │
│  [ Révisions fractions           ]   │
│                                      │
│  Description / Consignes             │
│  [ Revoir les chapitres 3 et 4   ]   │
│  [ Exercices p.47 n°1,2,3,5      ]   │
│                                      │
│  Date limite (optionnel)             │
│  [ 25/04/2025                    ]   │
│                                      │
│   [ Annuler ]  [ ✅ Publier ]        │
└──────────────────────────────────────┘
```

À la publication :
- Crée une ligne dans `group_exercises`
- Envoie une notification à chaque élève du groupe : "📚 Nouvel exercice de Mathématiques posté par M. Kamga"

### Fichiers concernés

- `src/pages/Grades.jsx` — ajout de l'onglet "Élèves signalés" + modale exercice

---

## 5. Vue élève — Mes exercices

### Objectif

L'élève voit les exercices qui lui ont été soumis suite à un signalement.

### Où ça apparaît

Dans `src/pages/Profile.jsx`, section **"Mes exercices"** ajoutée en bas du profil élève (visible par l'élève lui-même, ou par le titulaire/conseiller quand il consulte le profil d'un élève).

### Affichage

```
┌─────────────────────────────────────────────────────┐
│  📚  Mes Exercices                                   │
├─────────────────────────────────────────────────────┤
│  Mathématiques — M. Kamga                            │
│  "Révisions fractions et équations du 1er degré"     │
│  Posté le 19/04/2025 · À rendre avant le 25/04/2025 │
│                                                      │
│  [Aucune autre exercice en cours]                    │
└─────────────────────────────────────────────────────┘
```

### Logique de requête

```js
// 1. Trouver les performance_groups où student_id est dans student_ids
// 2. Pour chaque group, chercher les group_exercises
// 3. Afficher titre, description, date_limite, nom de l'enseignant
```

### Fichier concerné

- `src/pages/Profile.jsx` — section ajoutée en bas, visible selon le rôle

---

## 6. Nouvelles tables Supabase

### Table `performance_groups`

Créée quand un titulaire ou conseiller envoie une alerte à un enseignant.

```sql
CREATE TABLE performance_groups (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id             UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  class_subject_id     UUID REFERENCES class_subjects(id) ON DELETE CASCADE NOT NULL,
  sequence_id          UUID REFERENCES sequences(id) ON DELETE CASCADE NOT NULL,
  created_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  teacher_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  student_ids          UUID[] NOT NULL,
  note                 TEXT,
  created_at           TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

> `student_ids` est un tableau d'UUID Postgres (type natif). Chaque élément est l'id d'un élève signalé.
> `created_by` = le titulaire ou conseiller qui a envoyé l'alerte
> `teacher_id` = l'enseignant destinataire de l'alerte

### Table `group_exercises`

Créée quand l'enseignant répond à un signalement en publiant un exercice.

```sql
CREATE TABLE group_exercises (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  performance_group_id  UUID REFERENCES performance_groups(id) ON DELETE CASCADE NOT NULL,
  teacher_id            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  due_date              DATE,
  created_at            TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

### SQL à exécuter dans Supabase

```sql
-- Table 1
CREATE TABLE performance_groups (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id             UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
  class_subject_id     UUID REFERENCES class_subjects(id) ON DELETE CASCADE NOT NULL,
  sequence_id          UUID REFERENCES sequences(id) ON DELETE CASCADE NOT NULL,
  created_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  teacher_id           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  student_ids          UUID[] NOT NULL,
  note                 TEXT,
  created_at           TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Table 2
CREATE TABLE group_exercises (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  performance_group_id  UUID REFERENCES performance_groups(id) ON DELETE CASCADE NOT NULL,
  teacher_id            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  title                 TEXT NOT NULL,
  description           TEXT,
  due_date              DATE,
  created_at            TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Recharger le cache Supabase après création
NOTIFY pgrst, 'reload schema';
```

---

## 7. Récapitulatif des fichiers touchés

| Fichier | Ce qui change |
|---------|--------------|
| `src/pages/Grades.jsx` | Correction schema (evaluation_type + note), ajout onglet "Élèves signalés", modale exercice |
| `src/pages/Reports.jsx` | Catégorisation élèves par matière, stats connectées BD, bouton alerte + modale confirmation |
| `src/pages/Profile.jsx` | Correction requête notes, section "Mes exercices" en bas |
| `src/pages/TeacherProfile.jsx` | Aucun changement prévu |
| `src/pages/Schedule.jsx` | Déjà corrigé (schéma class_subject_id) — tester en production |
| `supabase` | Créer tables `performance_groups` et `group_exercises` |

---

## 8. Ordre d'implémentation recommandé

1. **D'abord** : Créer les 2 tables Supabase (SQL à exécuter)
2. **Ensuite** : Corriger `Grades.jsx` (bloquant — les notes ne se sauvegardent pas)
3. **Ensuite** : Corriger `Profile.jsx` (requête notes cassée)
4. **Ensuite** : Enrichir `Reports.jsx` (catégorisation + alerte)
5. **Ensuite** : Ajouter l'onglet signalements + exercices dans `Grades.jsx`
6. **Enfin** : Ajouter la section exercices dans `Profile.jsx`

---

## 9. Ce qui n'est PAS dans le scope actuel

- Correction de bulletin en ligne par l'enseignant
- Système de messagerie parent-enseignant
- Notification par email (seulement notifications internes)
- Correction/notation des exercices soumis
- Pièces jointes aux exercices (fichiers PDF/image)
- Row Level Security (RLS) Supabase

Ces points peuvent être ajoutés dans une version ultérieure.

---

*Dernière mise à jour : 19 avril 2025*

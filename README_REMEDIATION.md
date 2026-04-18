# 🎯 SIGPE — Module de Détection & Remédiation des Élèves en Difficulté

## 📌 Contexte du Problème

Les enseignants saisissent les notes via la page **Grades** (Devoirs, Compositions, par séquence et par matière).  
Actuellement, ces notes sont stockées mais **rien ne les analyse automatiquement** pour :
- Repérer les élèves en difficulté
- Alerter les enseignants / parents / administration
- Proposer un plan d'action (remédiation)

**But** : Transformer les notes brutes en un système intelligent de suivi pédagogique.

---

## 🧠 Comment le Système Repère les Élèves en Difficulté ?

### Étape 1 — Seuils de Détection Automatique

Dès qu'un enseignant enregistre des notes, le système calcule automatiquement et compare aux seuils suivants :

| Indicateur | Seuil d'Alerte | Seuil Critique | Données utilisées |
|---|---|---|---|
| **Moyenne par matière** | < 10/20 | < 08/20 | Notes de la séquence |
| **Moyenne générale** | < 10/20 | < 08/20 | Toutes les matières pondérées (coefficients) |
| **Tendance** | 2 baisses consécutives | 3+ baisses | Comparaison entre séquences |
| **Échec multiple** | 3+ matières < 10 | 5+ matières < 10 | Croisement multi-matières |

### Étape 2 — Classification des Niveaux de Risque

Chaque élève reçoit un **statut automatique** basé sur les seuils :

```
🟢 Normal      → Moyenne ≥ 12 et aucune alerte
🟡 À surveiller → Moyenne entre 10-12 OU baisse de 2+ points
🟠 En difficulté → Moyenne < 10 OU 3+ matières faibles
🔴 Critique     → Moyenne < 8 OU tendance de chute sur 3 séquences
```

### Étape 3 — Source des Données (Ce qui existe déjà)

La table `grades` contient tout ce qu'il faut :

```sql
-- Table existante dans database_schema.sql
grades (
  student_id   → Qui ?
  subject      → Quelle matière ?
  note         → Combien ?
  coefficient  → Quel poids ?
  sequence     → Quand ? (Séquence 1, 2, 3...)
  teacher_id   → Saisi par qui ?
)
```

**Aucune modification du schéma existant n'est nécessaire pour la détection.**

---

## 🛠️ Proposition Technique — Ce qu'il faut Développer

### Phase 1 : Détection Automatique (Backend / Calcul)

#### A. Nouvelle table Supabase : `student_alerts`

```sql
CREATE TABLE student_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('watch', 'struggling', 'critical')),
  trigger_type TEXT NOT NULL, -- 'low_average', 'declining_trend', 'multi_subject_fail'
  subject TEXT,               -- NULL si alerte globale, sinon la matière
  details JSONB,              -- { avg: 7.5, previous_avg: 10, decline: -2.5 }
  sequence TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### B. Fonction Supabase (Trigger automatique)

Après chaque INSERT dans `grades`, un trigger Supabase :
1. Recalcule la moyenne de l'élève (par matière + générale)
2. Compare avec les séquences précédentes (tendance)
3. Crée/met à jour une entrée dans `student_alerts` si un seuil est atteint
4. Envoie un message automatique dans la table `messages` aux parties concernées

```
[Enseignant saisit une note]
         ↓
    INSERT grades
         ↓
   ┌─── TRIGGER ───┐
   │ Calcul moyenne │
   │ Comparaison    │
   │ Détection      │
   └────────────────┘
         ↓
  Seuil atteint ?
    ├── NON → Rien
    └── OUI → INSERT student_alerts
              + INSERT messages (notif parent/prof titulaire)
```

---

### Phase 2 : Dashboard de Suivi (Frontend React)

#### A. Nouvelle page : `Remediation.jsx`

Une page dédiée accessible par les rôles : `admin`, `teacher_head`, `counselor`

**Contenu de la page :**

| Section | Description |
|---|---|
| **🔴 Vue d'ensemble** | Cards KPI : nombre d'élèves à risque par niveau (critique, difficulté, surveillance) |
| **📋 Liste des alertes** | Tableau filtrable par classe, matière, niveau de risque |
| **👤 Fiche élève détaillée** | Clic sur un élève → historique des notes, graphique d'évolution, matières faibles |
| **📝 Plan de remédiation** | Formulaire pour attribuer des actions correctives |

#### B. Indicateurs visuels dans les pages existantes

| Page existante | Ajout proposé |
|---|---|
| **Grades.jsx** | Badge 🔴🟠🟡 à côté de la moyenne si < 10 |
| **Students.jsx** | Colonne "Statut académique" avec pastille de couleur |
| **Dashboard.jsx** | Nouvelle card "Élèves en difficulté" avec compteur |
| **Bulletin.jsx** | Section "Observations de remédiation" si applicable |
| **Parent.jsx** | Notification automatique si enfant en difficulté |

---

### Phase 3 : Propositions de Remédiation

#### A. Remédiation automatique selon le type de difficulté

Le système propose des actions types basées sur le diagnostic :

```
SI moyenne_matière < 8 et tendance_baisse :
  → "Cours de soutien en [matière] recommandé"
  → "Entretien avec le professeur de [matière]"

SI moyenne_générale < 10 et multi_matières_faibles :
  → "Conseil de classe anticipé recommandé"
  → "Convocation du parent"
  → "Suivi par le conseiller pédagogique"

SI première_alerte (seuil à surveiller) :
  → "Observation renforcée — suivi sur 2 séquences"
  → "Notification au professeur titulaire"
```

#### B. Nouvelle table : `remediation_plans`

```sql
CREATE TABLE remediation_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID REFERENCES student_alerts(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),           -- Prof titulaire / Conseiller
  action_type TEXT NOT NULL,                           -- 'tutoring', 'parent_meeting', 'counsel_session', 'extra_work'
  description TEXT,                                    -- Détails libres
  target_subject TEXT,                                 -- Matière ciblée (ou NULL si global)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date DATE,
  outcome TEXT,                                        -- Résultat après action
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

---

## 📊 Flux Complet — De la Note saisie à la Remédiation

```
┌─────────────────────────────────────────────────────────────────┐
│                    FLUX SIGPE REMÉDIATION                       │
└─────────────────────────────────────────────────────────────────┘

  1. ENSEIGNANT saisit notes (Grades.jsx)
          ↓
  2. INSERT dans table `grades`
          ↓
  3. TRIGGER calcule :
     • Moyenne par matière
     • Moyenne générale pondérée
     • Tendance vs séquences précédentes
     • Nombre de matières < 10
          ↓
  4. SEUIL ATTEINT ?
     ├── NON → FIN (élève OK)
     └── OUI → Création alerte `student_alerts`
                    ↓
  5. NOTIFICATIONS AUTOMATIQUES :
     • 📩 Message au Prof Titulaire
     • 📩 Message au Parent (via portail parent)
     • 📩 Alerte dans Dashboard admin
                    ↓
  6. PROF TITULAIRE / CONSEILLER ouvre Remediation.jsx
     • Voit la liste des élèves alertés
     • Consulte le diagnostic détaillé
     • Crée un plan de remédiation
                    ↓
  7. SUIVI
     • La remédiation est trackée (status: pending → in_progress → completed)
     • À la séquence suivante, le système vérifie si la situation s'améliore
     • Si amélioration → alerte résolue ✅
     • Si pas d'amélioration → escalade au niveau supérieur 🔺
```

---

## 🗂️ Résumé des Fichiers à Créer / Modifier

| Action | Fichier | Description |
|---|---|---|
| 🆕 CRÉER | `src/pages/Remediation.jsx` | Page principale de suivi des remédiation |
| 🆕 CRÉER | `src/components/ui/AlertBadge.jsx` | Composant réutilisable pastille de risque |
| 🆕 CRÉER | `src/components/ui/RemediationModal.jsx` | Modal pour créer un plan de remédiation |
| ✏️ MODIFIER | `database_schema.sql` | Ajouter tables `student_alerts` + `remediation_plans` |
| ✏️ MODIFIER | `src/App.jsx` | Ajouter route vers Remediation |
| ✏️ MODIFIER | `src/components/layout/Sidebar.jsx` | Ajouter lien navigation "Remédiation" |
| ✏️ MODIFIER | `src/pages/Grades.jsx` | Ajouter badge visuel de risque à côté des moyennes |
| ✏️ MODIFIER | `src/pages/Dashboard.jsx` | Ajouter card "Élèves en difficulté" |

---

## ⚡ Ordre d'Implémentation Recommandé

```
Étape 1 → Ajouter les 2 tables SQL (student_alerts + remediation_plans)
Étape 2 → Créer Remediation.jsx avec données mock (prototype visuel)
Étape 3 → Ajouter la navigation dans Sidebar + App.jsx
Étape 4 → Ajouter les badges visuels dans Grades.jsx
Étape 5 → Connecter à Supabase (requêtes réelles)
Étape 6 → Implémenter le trigger automatique de détection
Étape 7 → Système de notifications parent/prof
```

---

## ❓ Questions à Clarifier Avant de Commencer

1. **Seuils** : Les seuils proposés (10/20 alerte, 8/20 critique) sont-ils adaptés au système de notation de l'établissement ?
2. **Qui gère les remédiations ?** : Prof titulaire seul ? Ou aussi le conseiller pédagogique ?
3. **Types de remédiation** : Cours de soutien, travaux supplémentaires, convocation parent — d'autres types à prévoir ?
4. **Historique** : Faut-il garder un historique complet des remédiations résolues ou archiver ?
5. **Accès parent** : Le parent doit-il voir le plan de remédiation complet ou juste une notification simplifiée ?

---

> **Ce document sert de base de réflexion. Une fois les décisions prises sur les points ci-dessus, l'implémentation peut commencer immédiatement.**

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Save, Loader, RefreshCw } from 'lucide-react';

// ── DONNÉES DÉMO ────────────────────────────────────────────────
const MOCK_CLASSES  = [
  { id: 'c1', name: '3ème A', studentCount: 38 },
  { id: 'c2', name: '3ème B', studentCount: 42 },
  { id: 'c3', name: '2nde A', studentCount: 45 },
  { id: 'c4', name: '2nde B', studentCount: 41 },
  { id: 'c5', name: 'Tle C',  studentCount: 36 },
];
const MOCK_STUDENTS = [
  { id: 1, name: 'Abanda Christelle', d1: 14,   d2: 15,   comp: null },
  { id: 2, name: 'Ateba Serge',       d1: 9,    d2: 10,   comp: null },
  { id: 3, name: 'Biya Rodrigue',     d1: 17,   d2: 16,   comp: null },
  { id: 4, name: 'Fouda Célestine',   d1: 11,   d2: null, comp: null },
  { id: 5, name: 'Kamga Boris',       d1: 7,    d2: 8,    comp: null },
];
const MOCK_SEQS = ['Séquence 1','Séquence 2','Séquence 3','Séquence 4','Séquence 5','Séquence 6'];

// ── HELPERS ─────────────────────────────────────────────────────
const calcAvg = (d1, d2, comp) => {
  const vals = [d1, d2, comp].filter(v => v !== null && v !== '' && !isNaN(v));
  return vals.length === 0 ? null : vals.reduce((a, b) => a + Number(b), 0) / vals.length;
};

// ── COMPOSANT ───────────────────────────────────────────────────
const Grades = () => {
  const { user } = useAuth();
  const isRealTeacher = !user?.isDemo && user?.role === 'teacher_course';

  // ── État commun ─────────────────────────────────────────────
  const [coefficient,   setCoefficient]   = useState(4);
  const [students,      setStudents]      = useState(isRealTeacher ? [] : MOCK_STUDENTS);
  const [saving,        setSaving]        = useState(false);
  const [toast,         setToast]         = useState(null);

  // ── État démo ───────────────────────────────────────────────
  const [selectedClass,   setSelectedClass]   = useState(isRealTeacher ? null : MOCK_CLASSES[1]);
  const [selectedSubject, setSelectedSubject] = useState('Mathématiques');
  const [selectedSeq,     setSelectedSeq]     = useState('Séquence 2');

  // ── État réel ───────────────────────────────────────────────
  const [myClassSubjects, setMyClassSubjects]   = useState([]); // {id, class, subject, coefficient}
  const [sequences,       setSequences]         = useState([]);
  const [selectedCS,      setSelectedCS]        = useState(null); // class_subject courant
  const [selectedSeqId,   setSelectedSeqId]     = useState(null);
  const [loadingData,     setLoadingData]       = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Chargement initial (prof réel) ──────────────────────────
  useEffect(() => {
    if (!isRealTeacher) return;
    loadTeacherData();
  }, []);

  const loadTeacherData = async () => {
    setLoadingData(true);
    const [{ data: csRows }, { data: seqRows }] = await Promise.all([
      supabase
        .from('class_subjects')
        .select(`
          id, coefficient,
          classes  ( id, name, level ),
          subjects ( id, name )
        `)
        .eq('teacher_id', user.id),
      supabase
        .from('sequences')
        .select('id, label, number, is_active')
        .order('number'),
    ]);

    setMyClassSubjects(csRows || []);
    setSequences(seqRows || []);

    // Sélectionner par défaut la première class_subject et la séquence active
    if (csRows?.length) {
      const firstCS = csRows[0];
      setSelectedCS(firstCS);
      setCoefficient(firstCS.coefficient || 1);
      const activeSeq = seqRows?.find(s => s.is_active) || seqRows?.[0];
      if (activeSeq) setSelectedSeqId(activeSeq.id);
    }
    setLoadingData(false);
  };

  // ── Chargement des élèves + notes quand la sélection change ──
  useEffect(() => {
    if (!isRealTeacher || !selectedCS || !selectedSeqId) return;
    loadStudentsAndGrades();
  }, [selectedCS, selectedSeqId]);

  const loadStudentsAndGrades = useCallback(async () => {
    if (!selectedCS?.classes?.id) return;
    setLoadingData(true);
    try {
      // Élèves de la classe
      const { data: studentRows } = await supabase
        .from('students')
        .select('id, matricule, profiles(full_name)')
        .eq('class_id', selectedCS.classes.id)
        .order('profiles(full_name)');

      // Notes existantes pour ce class_subject + séquence
      const studentIds = (studentRows || []).map(s => s.id);
      let gradesMap = {};
      if (studentIds.length > 0) {
        const { data: gradeRows } = await supabase
          .from('grades')
          .select('id, student_id, note_devoir1, note_devoir2, note_composition')
          .eq('class_subject_id', selectedCS.id)
          .eq('sequence_id', selectedSeqId)
          .in('student_id', studentIds);

        (gradeRows || []).forEach(g => {
          gradesMap[g.student_id] = { id: g.id, d1: g.note_devoir1, d2: g.note_devoir2, comp: g.note_composition };
        });
      }

      setStudents((studentRows || []).map(s => ({
        id:   s.id,
        name: s.profiles?.full_name || s.matricule || s.id,
        d1:   gradesMap[s.id]?.d1   ?? null,
        d2:   gradesMap[s.id]?.d2   ?? null,
        comp: gradesMap[s.id]?.comp ?? null,
      })));
    } catch (err) {
      showToast('Erreur chargement : ' + err.message, 'error');
    } finally {
      setLoadingData(false);
    }
  }, [selectedCS, selectedSeqId]);

  const updateNote = (id, field, value) => {
    setStudents(prev => prev.map(s =>
      s.id === id ? { ...s, [field]: value === '' ? null : Number(value) } : s
    ));
  };

  // ── Sauvegarde réelle dans Supabase ─────────────────────────
  const handleSave = async () => {
    if (!isRealTeacher) { showToast('Simulation — données non sauvegardées.', 'info'); return; }
    if (!selectedCS || !selectedSeqId) return;
    setSaving(true);
    try {
      // Un seul upsert par élève (1 ligne = les 3 notes d1/d2/composition)
      const upserts = students
        .filter(s => s.d1 !== null || s.d2 !== null || s.comp !== null)
        .map(s => ({
          student_id:       s.id,
          class_subject_id: selectedCS.id,
          sequence_id:      selectedSeqId,
          teacher_id:       user.id,
          note_devoir1:     s.d1   !== null ? Number(s.d1)   : null,
          note_devoir2:     s.d2   !== null ? Number(s.d2)   : null,
          note_composition: s.comp !== null ? Number(s.comp) : null,
        }));

      if (upserts.length > 0) {
        const { error } = await supabase
          .from('grades')
          .upsert(upserts, { onConflict: 'student_id,class_subject_id,sequence_id' });
        if (error) throw error;
      }

      // Mettre à jour le coefficient dans class_subjects
      await supabase.from('class_subjects').update({ coefficient }).eq('id', selectedCS.id);

      showToast(`Notes de ${upserts.length} élève(s) enregistrées avec succès !`);
      await loadStudentsAndGrades();
    } catch (err) {
      showToast('Erreur sauvegarde : ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Calculs stats ────────────────────────────────────────────
  const studentsWithAvg = students.map(s => ({ ...s, avg: calcAvg(s.d1, s.d2, s.comp) }));
  const ranked = [...studentsWithAvg].filter(s => s.avg !== null).sort((a, b) => b.avg - a.avg);
  const getRank  = (id) => { const i = ranked.findIndex(s => s.id === id); return i === -1 ? '—' : `${i + 1}/${ranked.length}`; };
  const classAvg = ranked.length > 0 ? (ranked.reduce((s, r) => s + r.avg, 0) / ranked.length).toFixed(2) : null;

  // Labels d'affichage
  const displayClass   = isRealTeacher ? (selectedCS?.classes?.name || '—')    : selectedClass?.name;
  const displaySubject = isRealTeacher ? (selectedCS?.subjects?.name || '—')   : selectedSubject;
  const displaySeq     = isRealTeacher
    ? (sequences.find(s => s.id === selectedSeqId)?.label || '—')
    : selectedSeq;

  // Grouper par classe pour le sélecteur réel
  const classesList = myClassSubjects.reduce((acc, cs) => {
    if (!acc.find(x => x.classId === cs.classes?.id)) {
      acc.push({ classId: cs.classes?.id, className: cs.classes?.name, level: cs.classes?.level, cs });
    }
    return acc;
  }, []);

  return (
    <section className="page-section active">

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : 'var(--green)',
          color: '#fff', padding: '13px 20px', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', fontWeight: 600, fontSize: '14px'
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Sélecteur de classe ── */}
      {isRealTeacher ? (
        myClassSubjects.length === 0 && !loadingData ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-light)', fontSize: '14px' }}>
            Aucune classe assignée. Complétez votre profil ou contactez l'administration.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '22px' }}>
            {classesList.map(item => (
              <div key={item.classId}
                className={`class-pill ${selectedCS?.classes?.id === item.classId ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCS(item.cs);
                  setCoefficient(item.cs.coefficient || 1);
                }}
              >
                <div className="cp-name">{item.className}</div>
                <div className="cp-count">{item.level}</div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '22px' }}>
          {MOCK_CLASSES.map((cls) => (
            <div key={cls.id}
              className={`class-pill ${selectedClass?.id === cls.id ? 'active' : ''}`}
              onClick={() => setSelectedClass(cls)}
            >
              <div className="cp-name">{cls.name}</div>
              <div className="cp-count">{cls.studentCount} élèves</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">

        {/* En-tête */}
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3>Saisie des Notes — <span>{displayClass}</span></h3>
            <p style={{ marginTop: '2px' }}>{displaySubject} · {displaySeq} · {user?.name || 'Enseignant'}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>

            {/* Séquence */}
            <select className="filter-select" style={{ padding: '8px 12px' }}
              value={isRealTeacher ? selectedSeqId || '' : selectedSeq}
              onChange={e => isRealTeacher ? setSelectedSeqId(e.target.value) : setSelectedSeq(e.target.value)}
            >
              {isRealTeacher
                ? sequences.map(s => <option key={s.id} value={s.id}>{s.label}</option>)
                : MOCK_SEQS.map(s => <option key={s} value={s}>{s}</option>)
              }
            </select>

            {/* Matière (démo seulement) */}
            {!isRealTeacher && (
              <select className="filter-select" style={{ padding: '8px 12px' }}
                value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                {['Mathématiques','Français','SVT','Histoire-Géo','Anglais','Physique-Chimie'].map(s => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}

            {/* Coefficient */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--bg)', border: '2px solid var(--green)', borderRadius: '10px', padding: '5px 12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.5px' }}>COEFF.</span>
              <select value={coefficient} onChange={e => setCoefficient(Number(e.target.value))}
                style={{ background: 'transparent', border: 'none', fontWeight: 900, fontSize: '18px', color: 'var(--green)', cursor: 'pointer', outline: 'none', width: '38px' }}>
                {[1,2,3,4,5,6].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button className="btn-sm btn-green" onClick={handleSave} disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {saving ? <Loader size={14} /> : <Save size={14} />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>

            {isRealTeacher && (
              <button onClick={loadStudentsAndGrades} title="Rafraîchir"
                style={{ padding: '8px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--text-light)', display: 'flex' }}>
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Bandeau coefficient */}
        <div style={{ margin: '4px 0 16px', padding: '10px 16px', background: 'rgba(34,197,94,0.07)', borderRadius: '8px', border: '1px solid var(--green)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-dark)' }}>
            📐 <strong>{displaySubject}</strong> — Coefficient&nbsp;
            <strong style={{ color: 'var(--green)', fontSize: '17px' }}>×{coefficient}</strong>
            &nbsp;— La note pondérée est prise en compte dans les bulletins.
          </span>
          {coefficient >= 5 && (
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--orange, #f97316)', background: 'rgba(249,115,22,0.1)', padding: '3px 10px', borderRadius: '20px' }}>
              ⚠️ Coefficient élevé — impact fort sur la moyenne générale
            </span>
          )}
        </div>

        {/* Chargement */}
        {loadingData && (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <Loader size={20} /> Chargement des données…
          </div>
        )}

        {/* Tableau */}
        {!loadingData && (
          <>
            {students.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)', fontSize: '14px' }}>
                Aucun élève inscrit dans cette classe.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="notes-entry-table">
                  <thead>
                    <tr>
                      <th style={{ width: '40px' }}>#</th>
                      <th>Élève</th>
                      <th>Devoir 1</th>
                      <th>Devoir 2</th>
                      <th>Composition</th>
                      <th>Moy. /20</th>
                      <th style={{ color: 'var(--green)' }}>Pondérée ×{coefficient}</th>
                      <th>Rang</th>
                      <th>Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentsWithAvg.map((student, idx) => {
                      const avg      = student.avg;
                      const avgStr   = avg !== null ? avg.toFixed(2) : null;
                      const weighted = avg !== null ? (avg * coefficient).toFixed(2) : null;
                      const avgClass = avgStr ? (avg >= 14 ? 'note-high' : avg >= 8 ? 'note-mid' : 'note-low') : '';
                      return (
                        <tr key={student.id}>
                          <td style={{ color: 'var(--text-light)', fontWeight: 600 }}>{idx + 1}</td>
                          <td><strong>{student.name}</strong></td>
                          {['d1','d2','comp'].map(field => (
                            <td key={field}>
                              <input className="note-input" type="number" min="0" max="20" step="0.25"
                                value={student[field] ?? ''}
                                placeholder="—"
                                onChange={e => updateNote(student.id, field, e.target.value)} />
                            </td>
                          ))}
                          <td>
                            {avgStr
                              ? <span className={`note-badge ${avgClass}`} style={{ display: 'inline-flex' }}>{avgStr}</span>
                              : <span style={{ color: 'var(--text-light)' }}>—</span>}
                          </td>
                          <td>
                            {weighted
                              ? <span style={{ fontWeight: 800, color: 'var(--green)', fontSize: '14px' }}>{weighted}</span>
                              : <span style={{ color: 'var(--text-light)' }}>—</span>}
                          </td>
                          <td style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 600 }}>{getRank(student.id)}</td>
                          <td>
                            <input style={{ border: '1.5px solid var(--border)', borderRadius: '8px', padding: '7px 10px', fontSize: '12px', width: '90px', background: 'var(--bg)', color: 'var(--text-dark)' }}
                              placeholder="Obs..." />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Stats pied de tableau */}
            {ranked.length > 0 && (
              <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--bg)', borderRadius: '8px', display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Notés : <strong>{ranked.length}/{students.length}</strong></span>
                <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Moy. classe : <strong style={{ color: 'var(--blue-accent)' }}>{classAvg}/20</strong></span>
                <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                  Pondérée : <strong style={{ color: 'var(--green)' }}>{(Number(classAvg) * coefficient).toFixed(2)}</strong>
                  <span style={{ fontSize: '11px' }}> (×{coefficient})</span>
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Max : <strong style={{ color: 'var(--green)' }}>{ranked[0].avg.toFixed(2)}</strong></span>
                <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Min : <strong style={{ color: 'var(--red)' }}>{ranked[ranked.length-1].avg.toFixed(2)}</strong></span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default Grades;

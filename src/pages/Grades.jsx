import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Save, Loader, RefreshCw, X } from 'lucide-react';

const MOCK_CLASSES  = [
  { id: 'c1', name: '3ème A', studentCount: 38 },
  { id: 'c2', name: '3ème B', studentCount: 42 },
  { id: 'c3', name: '2nde A', studentCount: 45 },
];
const MOCK_STUDENTS = [
  { id: 1, name: 'Abanda Christelle', note: 14.5 },
  { id: 2, name: 'Ateba Serge',       note: 9.5  },
  { id: 3, name: 'Biya Rodrigue',     note: 16.5 },
  { id: 4, name: 'Fouda Célestine',   note: 11.0 },
  { id: 5, name: 'Kamga Boris',       note: 7.5  },
];
const MOCK_SEQS = ['Séquence 1','Séquence 2','Séquence 3','Séquence 4','Séquence 5','Séquence 6'];

const categorize = (avg) => {
  if (avg >= 15) return { label: 'Excellent',      color: '#16a34a' };
  if (avg >= 12) return { label: 'Bien',           color: 'var(--green)' };
  if (avg >= 10) return { label: 'Fragile',        color: '#f59e0b' };
  return             { label: 'En difficulté',  color: '#ef4444' };
};

const Grades = () => {
  const { user } = useAuth();
  const isRealTeacher = !user?.isDemo && user?.role === 'teacher_course';

  const [activeTab,      setActiveTab]      = useState('notes');
  const [coefficient,    setCoefficient]    = useState(4);
  const [students,       setStudents]       = useState([]);
  const [saving,         setSaving]         = useState(false);
  const [toast,          setToast]          = useState(null);

  // état démo
  const [selectedClass,   setSelectedClass]   = useState(MOCK_CLASSES[1]);
  const [selectedSubject, setSelectedSubject] = useState('Mathématiques');
  const [selectedSeq,     setSelectedSeq]     = useState('Séquence 2');

  // état réel — saisie notes
  const [myClassSubjects,  setMyClassSubjects]  = useState([]);
  const [sequences,        setSequences]        = useState([]);
  const [selectedClassId,  setSelectedClassId]  = useState(null);
  const [selectedCS,       setSelectedCS]       = useState(null);
  const [selectedSeqId,    setSelectedSeqId]    = useState(null);
  const [loadingData,      setLoadingData]      = useState(false);

  // état alertes
  const [alerts,        setAlerts]        = useState([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);

  // état modale exercice
  const [exModal,   setExModal]   = useState(null);
  const [exForm,    setExForm]    = useState({ title: '', description: '', due_date: '' });
  const [savingEx,  setSavingEx]  = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (!user) return;
    if (!isRealTeacher) { setStudents(MOCK_STUDENTS); return; }
    loadTeacherData();
    loadAlerts();
  }, [user?.id]);

  const loadTeacherData = async () => {
    setLoadingData(true);
    try {
      const [{ data: csRows }, { data: seqRows }] = await Promise.all([
        supabase
          .from('class_subjects')
          .select('id, coefficient, academic_year_id, classes(id, name, level), subjects(id, name)')
          .eq('teacher_id', user.id),
        supabase
          .from('sequences')
          .select('id, label, number, is_active, academic_year_id')
          .order('number'),
      ]);

      setMyClassSubjects(csRows || []);

      if (csRows?.length) {
        const firstCS = csRows[0];
        const yearId  = firstCS.academic_year_id;
        const filteredSeqs = (seqRows || []).filter(s => s.academic_year_id === yearId);
        setSequences(filteredSeqs);
        setSelectedClassId(firstCS.classes?.id || null);
        setSelectedCS(firstCS);
        setCoefficient(firstCS.coefficient || 1);
        const activeSeq = filteredSeqs.find(s => s.is_active) || filteredSeqs[0];
        if (activeSeq) setSelectedSeqId(activeSeq.id);
      } else {
        setSequences(seqRows || []);
      }
    } catch (err) {
      showToast('Erreur chargement : ' + err.message, 'error');
    } finally {
      setLoadingData(false);
    }
  };

  const handleSelectClass = (classId) => {
    setSelectedClassId(classId);
    const firstCSofClass = myClassSubjects.find(cs => cs.classes?.id === classId);
    if (!firstCSofClass) return;
    const yearId = firstCSofClass.academic_year_id;
    supabase.from('sequences').select('id, label, number, is_active, academic_year_id')
      .eq('academic_year_id', yearId).order('number')
      .then(({ data }) => {
        setSequences(data || []);
        const active = (data || []).find(s => s.is_active) || (data || [])[0];
        if (active) setSelectedSeqId(active.id);
      });
    setSelectedCS(firstCSofClass);
    setCoefficient(firstCSofClass.coefficient || 1);
  };

  useEffect(() => {
    if (!isRealTeacher || !selectedCS || !selectedSeqId) return;
    loadStudentsAndGrades();
  }, [selectedCS?.id, selectedSeqId]);

  const loadStudentsAndGrades = useCallback(async () => {
    if (!selectedCS?.classes?.id) return;
    setLoadingData(true);
    try {
      const { data: studentRows, error: sErr } = await supabase
        .from('students')
        .select('id, matricule, profiles(full_name)')
        .eq('class_id', selectedCS.classes.id);
      if (sErr) throw sErr;

      const studentIds = (studentRows || []).map(s => s.id);
      let notesMap = {};

      if (studentIds.length > 0) {
        const { data: gradeRows, error: gErr } = await supabase
          .from('grades')
          .select('student_id, note')
          .eq('class_subject_id', selectedCS.id)
          .eq('sequence_id', selectedSeqId)
          .in('student_id', studentIds);

        if (gErr) {
          console.warn('Notes non chargées :', gErr.message);
          showToast('Notes indisponibles — vérifiez le schéma Supabase', 'info');
        } else {
          (gradeRows || []).forEach(g => { notesMap[g.student_id] = g.note; });
        }
      }

      const sorted = (studentRows || []).slice().sort((a, b) => {
        const na = a.profiles?.full_name || a.matricule || '';
        const nb = b.profiles?.full_name || b.matricule || '';
        return na.localeCompare(nb, 'fr');
      });

      setStudents(sorted.map(s => ({
        id:   s.id,
        name: s.profiles?.full_name || s.matricule || s.id,
        note: notesMap[s.id] ?? null,
      })));
    } catch (err) {
      showToast('Erreur chargement élèves : ' + err.message, 'error');
    } finally {
      setLoadingData(false);
    }
  }, [selectedCS?.id, selectedSeqId]);

  const loadAlerts = useCallback(async () => {
    setLoadingAlerts(true);
    try {
      const { data: groups, error } = await supabase
        .from('performance_groups')
        .select(`
          id, student_ids, note, created_at, class_subject_id, sequence_id, created_by,
          classes(name),
          class_subjects(subjects(name)),
          sequences(label)
        `)
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // noms des créateurs
      const creatorIds = [...new Set((groups || []).map(g => g.created_by).filter(Boolean))];
      let creatorMap = {};
      if (creatorIds.length > 0) {
        const { data: creators } = await supabase
          .from('profiles').select('id, full_name').in('id', creatorIds);
        (creators || []).forEach(c => { creatorMap[c.id] = c.full_name; });
      }

      // noms des élèves
      const allStudentIds = [...new Set((groups || []).flatMap(g => g.student_ids || []))];
      let studentNameMap = {};
      if (allStudentIds.length > 0) {
        const { data: profRows } = await supabase
          .from('profiles').select('id, full_name').in('id', allStudentIds);
        (profRows || []).forEach(p => { studentNameMap[p.id] = p.full_name; });
      }

      // notes par élève pour chaque alerte
      const enriched = await Promise.all((groups || []).map(async (g) => {
        let gradeMap = {};
        if (g.student_ids?.length > 0) {
          const { data: gradeRows } = await supabase
            .from('grades')
            .select('student_id, note')
            .eq('class_subject_id', g.class_subject_id)
            .eq('sequence_id', g.sequence_id)
            .in('student_id', g.student_ids);
          (gradeRows || []).forEach(gr => { gradeMap[gr.student_id] = gr.note; });
        }

        const enrichedStudents = (g.student_ids || []).map(sid => ({
          id:  sid,
          name: studentNameMap[sid] || '—',
          avg:  gradeMap[sid] ?? null,
          cat:  gradeMap[sid] != null ? categorize(Number(gradeMap[sid])) : null,
        })).sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99));

        return {
          id:          g.id,
          className:   g.classes?.name || '—',
          subjectName: g.class_subjects?.subjects?.name || '—',
          seqLabel:    g.sequences?.label || '—',
          createdBy:   creatorMap[g.created_by] || '—',
          message:     g.note,
          createdAt:   g.created_at,
          students:    enrichedStudents,
        };
      }));

      setAlerts(enriched);
    } catch (err) {
      showToast('Erreur alertes : ' + err.message, 'error');
    } finally {
      setLoadingAlerts(false);
    }
  }, [user?.id]);

  const publishExercise = async () => {
    if (!exForm.title.trim() || !exModal) return;
    setSavingEx(true);
    try {
      const { error } = await supabase.from('group_exercises').insert({
        performance_group_id: exModal.groupId,
        teacher_id:           user.id,
        title:                exForm.title.trim(),
        description:          exForm.description || null,
        due_date:             exForm.due_date || null,
      });
      if (error) throw error;

      const notifs = exModal.students.map(s => ({
        sender_id:    user.id,
        recipient_id: s.id,
        title:        `📚 Nouvel exercice — ${exModal.subjectName}`,
        content:      `${user.name || 'Votre enseignant'} a publié : "${exForm.title.trim()}"`,
        type:         'info',
      }));
      if (notifs.length > 0) await supabase.from('notifications').insert(notifs);

      showToast(`Exercice publié pour ${exModal.students.length} élève(s) !`);
      setExModal(null);
      setExForm({ title: '', description: '', due_date: '' });
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      setSavingEx(false);
    }
  };

  const updateNote = (id, value) => {
    setStudents(prev => prev.map(s =>
      s.id === id ? { ...s, note: value === '' ? null : value } : s
    ));
  };

  const handleSave = async () => {
    if (!isRealTeacher) { showToast('Simulation — données non sauvegardées.', 'info'); return; }
    if (!selectedCS || !selectedSeqId) return;
    setSaving(true);
    try {
      const upserts = students
        .filter(s => s.note !== null && s.note !== '' && !isNaN(s.note))
        .map(s => ({
          student_id:       s.id,
          class_subject_id: selectedCS.id,
          sequence_id:      selectedSeqId,
          teacher_id:       user.id,
          note:             Number(s.note),
        }));

      if (upserts.length > 0) {
        const { error } = await supabase
          .from('grades')
          .upsert(upserts, { onConflict: 'student_id,class_subject_id,sequence_id' });
        if (error) throw error;
      }

      await supabase.from('class_subjects').update({ coefficient }).eq('id', selectedCS.id);
      showToast(`Notes de ${upserts.length} élève(s) enregistrées !`);
      await loadStudentsAndGrades();
    } catch (err) {
      showToast('Erreur sauvegarde : ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const withNote    = students.filter(s => s.note !== null && s.note !== '' && !isNaN(Number(s.note))).map(s => ({ ...s, note: Number(s.note) }));
  const ranked      = [...withNote].sort((a, b) => b.note - a.note);
  const getRank     = (id) => { const i = ranked.findIndex(s => s.id === id); return i === -1 ? '—' : `${i+1}/${ranked.length}`; };
  const classAvg    = ranked.length > 0 ? (ranked.reduce((s, r) => s + r.note, 0) / ranked.length).toFixed(2) : null;

  const displayClass   = isRealTeacher ? (selectedCS?.classes?.name  || '—') : selectedClass?.name;
  const displaySubject = isRealTeacher ? (selectedCS?.subjects?.name || '—') : selectedSubject;
  const displaySeq     = isRealTeacher ? (sequences.find(s => s.id === selectedSeqId)?.label || '—') : selectedSeq;

  const classesList    = myClassSubjects.reduce((acc, cs) => {
    if (!acc.find(x => x.classId === cs.classes?.id))
      acc.push({ classId: cs.classes?.id, className: cs.classes?.name, level: cs.classes?.level });
    return acc;
  }, []);
  const subjectsOfClass = myClassSubjects.filter(cs => cs.classes?.id === selectedClassId);

  return (
    <section className="page-section active">

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : 'var(--green)',
          color: '#fff', padding: '13px 20px', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', fontWeight: 600, fontSize: '14px',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Onglets — uniquement pour teacher_course réel */}
      {isRealTeacher && (
        <div style={{ display: 'flex', gap: '0', marginBottom: '24px', borderBottom: '2px solid var(--border)' }}>
          <button
            onClick={() => setActiveTab('notes')}
            style={{
              padding: '10px 22px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === 'notes' ? 700 : 500, fontSize: '14px',
              color: activeTab === 'notes' ? 'var(--green)' : 'var(--text-light)',
              borderBottom: activeTab === 'notes' ? '2px solid var(--green)' : '2px solid transparent',
              marginBottom: '-2px',
            }}
          >
            Saisie des Notes
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            style={{
              padding: '10px 22px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: activeTab === 'alerts' ? 700 : 500, fontSize: '14px',
              color: activeTab === 'alerts' ? '#f59e0b' : 'var(--text-light)',
              borderBottom: activeTab === 'alerts' ? '2px solid #f59e0b' : '2px solid transparent',
              marginBottom: '-2px',
              display: 'flex', alignItems: 'center', gap: '7px',
            }}
          >
            ⚠️ Élèves signalés
            {alerts.length > 0 && (
              <span style={{ background: '#f59e0b', color: '#fff', borderRadius: '10px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>
                {alerts.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          ONGLET SAISIE DES NOTES
      ══════════════════════════════════════════════════ */}
      {activeTab === 'notes' && (
        <>
          {/* Sélecteur de classe */}
          {isRealTeacher ? (
            myClassSubjects.length === 0 && !loadingData ? (
              <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-light)', fontSize: '14px' }}>
                Aucune classe assignée. Contactez l'administration.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '12px' }}>
                  {classesList.map(item => (
                    <div key={item.classId}
                      className={`class-pill ${selectedClassId === item.classId ? 'active' : ''}`}
                      onClick={() => handleSelectClass(item.classId)}
                    >
                      <div className="cp-name">{item.className}</div>
                      <div className="cp-count">{item.level}</div>
                    </div>
                  ))}
                </div>
                {subjectsOfClass.length > 1 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    {subjectsOfClass.map(cs => (
                      <button key={cs.id}
                        onClick={() => { setSelectedCS(cs); setCoefficient(cs.coefficient || 1); }}
                        style={{
                          padding: '5px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                          cursor: 'pointer', border: '1.5px solid',
                          borderColor: selectedCS?.id === cs.id ? 'var(--green)' : 'var(--border)',
                          background: selectedCS?.id === cs.id ? 'rgba(34,197,94,0.1)' : 'var(--bg)',
                          color: selectedCS?.id === cs.id ? 'var(--green)' : 'var(--text-light)',
                        }}
                      >
                        {cs.subjects?.name || 'Matière'}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '22px' }}>
              {MOCK_CLASSES.map(cls => (
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
                <select className="filter-select" style={{ padding: '8px 12px' }}
                  value={isRealTeacher ? selectedSeqId || '' : selectedSeq}
                  onChange={e => isRealTeacher ? setSelectedSeqId(e.target.value) : setSelectedSeq(e.target.value)}
                >
                  {isRealTeacher
                    ? sequences.map(s => <option key={s.id} value={s.id}>{s.label}</option>)
                    : MOCK_SEQS.map(s => <option key={s} value={s}>{s}</option>)
                  }
                </select>

                {!isRealTeacher && (
                  <select className="filter-select" style={{ padding: '8px 12px' }}
                    value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
                    {['Mathématiques','Français','SVT','Histoire-Géo','Anglais','Physique-Chimie'].map(s => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                )}

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
                &nbsp;— La note est prise en compte dans les bulletins.
              </span>
              {coefficient >= 5 && (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#f97316', background: 'rgba(249,115,22,0.1)', padding: '3px 10px', borderRadius: '20px' }}>
                  ⚠️ Coefficient élevé — impact fort sur la moyenne générale
                </span>
              )}
            </div>

            {loadingData && (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Loader size={20} /> Chargement des données…
              </div>
            )}

            {!loadingData && (
              <>
                {students.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)', fontSize: '14px' }}>
                    {isRealTeacher ? 'Aucun élève inscrit dans cette classe.' : 'Sélectionnez une classe.'}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="notes-entry-table">
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>#</th>
                          <th>Élève</th>
                          <th>Note /20</th>
                          <th style={{ color: 'var(--green)' }}>Pondérée ×{coefficient}</th>
                          <th>Rang</th>
                          <th>Obs.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((student, idx) => {
                          const note     = student.note !== null && student.note !== '' ? Number(student.note) : null;
                          const weighted = note !== null ? (note * coefficient).toFixed(2) : null;
                          return (
                            <tr key={student.id}>
                              <td style={{ color: 'var(--text-light)', fontWeight: 600 }}>{idx + 1}</td>
                              <td><strong>{student.name}</strong></td>
                              <td>
                                <input
                                  className="note-input"
                                  type="number" min="0" max="20" step="0.25"
                                  value={student.note ?? ''}
                                  placeholder="—"
                                  onChange={e => updateNote(student.id, e.target.value)}
                                />
                              </td>
                              <td>
                                {weighted
                                  ? <span style={{ fontWeight: 800, color: 'var(--green)', fontSize: '14px' }}>{weighted}</span>
                                  : <span style={{ color: 'var(--text-light)' }}>—</span>}
                              </td>
                              <td style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 600 }}>
                                {getRank(student.id)}
                              </td>
                              <td>
                                <input
                                  style={{ border: '1.5px solid var(--border)', borderRadius: '8px', padding: '7px 10px', fontSize: '12px', width: '90px', background: 'var(--bg)', color: 'var(--text-dark)' }}
                                  placeholder="Obs..."
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {ranked.length > 0 && (
                  <div style={{ marginTop: '16px', padding: '12px 16px', background: 'var(--bg)', borderRadius: '8px', display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Notés : <strong>{ranked.length}/{students.length}</strong></span>
                    <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Moy. classe : <strong style={{ color: 'var(--blue-accent)' }}>{classAvg}/20</strong></span>
                    <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                      Pondérée : <strong style={{ color: 'var(--green)' }}>{(Number(classAvg) * coefficient).toFixed(2)}</strong>
                      <span style={{ fontSize: '11px' }}> (×{coefficient})</span>
                    </span>
                    <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Max : <strong style={{ color: 'var(--green)' }}>{ranked[0].note.toFixed(2)}</strong></span>
                    <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>Min : <strong style={{ color: '#ef4444' }}>{ranked[ranked.length-1].note.toFixed(2)}</strong></span>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ══════════════════════════════════════════════════
          ONGLET ÉLÈVES SIGNALÉS
      ══════════════════════════════════════════════════ */}
      {activeTab === 'alerts' && isRealTeacher && (
        <div>
          {loadingAlerts ? (
            <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Loader size={20} /> Chargement des signalements…
            </div>
          ) : alerts.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-light)', fontSize: '14px' }}>
              Aucun signalement reçu pour le moment.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {alerts.map(alert => (
                <div key={alert.id} className="card" style={{ borderLeft: '4px solid #f59e0b', overflow: 'hidden' }}>

                  {/* En-tête de la carte */}
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-dark)', marginBottom: '4px' }}>
                        ⚠️ Signalement — {alert.subjectName}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                        Par <strong>{alert.createdBy}</strong> · {alert.className} · {alert.seqLabel} · {new Date(alert.createdAt).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <button
                      onClick={() => setExModal({
                        groupId:     alert.id,
                        subjectName: alert.subjectName,
                        className:   alert.className,
                        seqLabel:    alert.seqLabel,
                        students:    alert.students,
                      })}
                      style={{
                        padding: '8px 16px', borderRadius: '8px', border: 'none',
                        background: 'var(--green)', color: '#fff', fontWeight: 700,
                        fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      + Créer un exercice
                    </button>
                  </div>

                  {/* Liste des élèves */}
                  <div style={{ padding: '12px 20px' }}>
                    {alert.students.map(s => (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '16px' }}>
                          {s.cat?.color === '#ef4444' ? '🔴' : '🟠'}
                        </span>
                        <span style={{ flex: 1, fontWeight: 600, fontSize: '14px', color: 'var(--text-dark)' }}>
                          {s.name}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: s.cat?.color || 'var(--text-light)', minWidth: '60px', textAlign: 'right' }}>
                          {s.avg !== null ? `${Number(s.avg).toFixed(2)}/20` : '—'}
                        </span>
                        {s.cat && (
                          <span style={{
                            fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '20px',
                            background: s.cat.color + '22', color: s.cat.color, minWidth: '90px', textAlign: 'center',
                          }}>
                            {s.cat.label}
                          </span>
                        )}
                      </div>
                    ))}

                    {alert.message && (
                      <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-dark)', fontStyle: 'italic' }}>
                        💬 "{alert.message}"
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          MODALE CRÉATION D'EXERCICE
      ══════════════════════════════════════════════════ */}
      {exModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '500px', margin: 0, maxHeight: '90vh', overflowY: 'auto' }}>

            <div className="card-header" style={{ justifyContent: 'space-between' }}>
              <div>
                <h3>Nouvel exercice</h3>
                <p style={{ marginTop: '2px', fontSize: '12px' }}>{exModal.subjectName} · {exModal.className} · {exModal.seqLabel}</p>
              </div>
              <button
                onClick={() => { setExModal(null); setExForm({ title: '', description: '', due_date: '' }); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '10px 14px', background: 'rgba(245,158,11,0.08)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-dark)' }}>
                Cet exercice sera envoyé à <strong>{exModal.students.length} élève(s)</strong> signalé(s).
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>
                  Titre <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  value={exForm.title}
                  onChange={e => setExForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex : Révisions fractions — Chapitre 3"
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg)', color: 'var(--text-dark)', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>
                  Description / Consignes
                </label>
                <textarea
                  value={exForm.description}
                  onChange={e => setExForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Exercices à faire, pages du manuel, consignes…"
                  rows={4}
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg)', color: 'var(--text-dark)', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>
                  Date limite (optionnel)
                </label>
                <input
                  type="date"
                  value={exForm.due_date}
                  onChange={e => setExForm(f => ({ ...f, due_date: e.target.value }))}
                  style={{ padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: '8px', fontSize: '14px', background: 'var(--bg)', color: 'var(--text-dark)' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
                <button
                  onClick={() => { setExModal(null); setExForm({ title: '', description: '', due_date: '' }); }}
                  style={{ padding: '9px 20px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'none', cursor: 'pointer', fontSize: '14px', color: 'var(--text-light)' }}
                >
                  Annuler
                </button>
                <button
                  onClick={publishExercise}
                  disabled={savingEx || !exForm.title.trim()}
                  style={{
                    padding: '9px 22px', borderRadius: '8px', border: 'none',
                    background: exForm.title.trim() ? 'var(--green)' : 'var(--border)',
                    color: '#fff', fontWeight: 700, fontSize: '14px',
                    cursor: exForm.title.trim() ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  {savingEx && <Loader size={14} />}
                  {savingEx ? 'Publication…' : '✅ Publier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};

export default Grades;

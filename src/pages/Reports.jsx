import React, { useState, useEffect } from 'react';
import { TrendingUp, Loader, AlertTriangle, X, Send, Users, CheckCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#3B82F6', '#00A86B', '#F97316', '#A855F7', '#EF4444', '#EAB308'];

const CAT_CONFIG = {
  excellent:  { label: 'Excellent',     color: '#16a34a', bg: 'rgba(22,163,74,0.1)',  emoji: '🟢' },
  bien:       { label: 'Bien',          color: '#22c55e', bg: 'rgba(34,197,94,0.08)', emoji: '🟡' },
  fragile:    { label: 'Fragile',       color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', emoji: '🟠' },
  difficulte: { label: 'En difficulté', color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  emoji: '🔴' },
};

const categorize = (avg) => {
  if (avg >= 15) return 'excellent';
  if (avg >= 12) return 'bien';
  if (avg >= 10) return 'fragile';
  return 'difficulte';
};


const Reports = () => {
  const { user } = useAuth();
  const isTeacherHead      = user?.role === 'teacher_head' && !user?.isDemo;
  const isCounselor        = user?.role === 'counselor' && !user?.isDemo;
  const isAdminOrCounselor = (user?.role === 'admin' || user?.role === 'sub_admin' || user?.role === 'counselor') && !user?.isDemo;
  // Bug fix #4 : counselor va dans loadAdminData et subjectCategories n'est jamais rempli
  // La catégorisation par matière n'est disponible que pour teacher_head (qui a une classe fixe)
  const canCategorize      = isTeacherHead;

  const [loading,           setLoading]           = useState(true);
  const [myClass,           setMyClass]           = useState(null);
  const [studentCount,      setStudentCount]      = useState(0);
  const [sequences,         setSequences]         = useState([]);
  const [subjects,          setSubjects]          = useState([]);
  const [classAvg,          setClassAvg]          = useState(null);
  const [successRate,       setSuccessRate]       = useState(null);
  const [chartData,         setChartData]         = useState([]);
  const [distribution,      setDistribution]      = useState([]);
  const [levelData,         setLevelData]         = useState([]);
  const [globalAvg,         setGlobalAvg]         = useState(null);
  const [totalStudents,     setTotalStudents]     = useState(null);
  const [subjectCategories, setSubjectCategories] = useState([]);
  const [activeSeqLabel,    setActiveSeqLabel]    = useState('');

  // Raw data stored so we can recompute categories when user switches sequence
  const [rawNoteIndex,      setRawNoteIndex]      = useState({});
  const [rawSubjectList,    setRawSubjectList]    = useState([]);
  const [rawStudentIds,     setRawStudentIds]     = useState([]);
  const [rawStudentNameMap, setRawStudentNameMap] = useState({});
  const [catSeqId,          setCatSeqId]          = useState(null);

  const [alertModal,   setAlertModal]   = useState(null);
  const [alertNote,    setAlertNote]    = useState('');
  const [alertSending, setAlertSending] = useState(false);
  const [toast,        setToast]        = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    if (user?.isDemo)            { setLoading(false); return; }
    if (isTeacherHead)           { loadTeacherHeadData(); }
    else if (isAdminOrCounselor) { loadAdminData(); }
    else                         { setLoading(false); }
  }, [user]);

  // Recompute subject categories whenever the selected sequence changes
  useEffect(() => {
    if (!catSeqId || !rawSubjectList.length) return;
    const cats = rawSubjectList.map(subj => {
      const seqNotes = rawNoteIndex[subj.csId]?.[catSeqId] || {};
      const excellent = [], bien = [], fragile = [], difficulte = [];
      rawStudentIds.forEach(sid => {
        const note = seqNotes[sid];
        if (note == null) return;
        const student = { id: sid, name: rawStudentNameMap[sid], avg: note };
        const cat = categorize(note);
        if (cat === 'excellent')    excellent.push(student);
        else if (cat === 'bien')    bien.push(student);
        else if (cat === 'fragile') fragile.push(student);
        else                        difficulte.push(student);
      });
      [excellent, bien, fragile, difficulte].forEach(arr => arr.sort((a, b) => b.avg - a.avg));
      return {
        csId: subj.csId, classId: subj.classId, name: subj.name,
        teacherId: subj.teacherId, teacherName: subj.teacherName,
        coefficient: subj.coefficient,
        excellent, bien, fragile, difficulte,
        hasAlert: fragile.length > 0 || difficulte.length > 0,
      };
    });
    setSubjectCategories(cats);
  }, [catSeqId, rawNoteIndex, rawSubjectList, rawStudentIds, rawStudentNameMap]);

  /* ── Teacher Head ─────────────────────────────────────────── */
  const loadTeacherHeadData = async () => {
    setLoading(true);
    try {
      // Bug fix #6 : inclure academic_year_id pour filtrer class_subjects et séquences
      const { data: classRows } = await supabase
        .from('classes').select('id, name, level, academic_year_id')
        .eq('head_teacher_id', user.id).limit(1);
      const cls = classRows?.[0];
      if (!cls) { setLoading(false); return; }
      setMyClass(cls);

      const { count: studCount } = await supabase
        .from('students').select('*', { count: 'exact', head: true })
        .eq('class_id', cls.id);
      setStudentCount(studCount ?? 0);

      const { data: studentRows } = await supabase
        .from('students').select('id, profiles(full_name)')
        .eq('class_id', cls.id);
      const studentIds = (studentRows || []).map(s => s.id);
      const studentNameMap = {};
      (studentRows || []).forEach(s => { studentNameMap[s.id] = s.profiles?.full_name || '—'; });

      // Bug fix #6 : filtrer par academic_year_id pour éviter les mélanges entre années
      const { data: csRows } = await supabase
        .from('class_subjects')
        .select('id, coefficient, subjects(id, name), profiles(id, full_name)')
        .eq('class_id', cls.id)
        .eq('academic_year_id', cls.academic_year_id);
      const subjectList = (csRows || []).map(cs => ({
        csId:        cs.id,
        coefficient: cs.coefficient || 1,
        name:        cs.subjects?.name || 'Matière',
        teacherId:   cs.profiles?.id || null,
        teacherName: cs.profiles?.full_name || 'Enseignant inconnu',
        classId:     cls.id,
      }));
      setSubjects(subjectList);

      // Bug fix #5 : filtrer séquences par l'année scolaire de la classe
      const { data: seqRows } = await supabase
        .from('sequences').select('id, label, number, is_active')
        .eq('academic_year_id', cls.academic_year_id)
        .order('number');
      setSequences(seqRows || []);

      if (!subjectList.length || !seqRows?.length) { setLoading(false); return; }

      const csIds = subjectList.map(s => s.csId);
      const { data: gradeRows } = await supabase
        .from('grades')
        .select('student_id, class_subject_id, sequence_id, note')
        .in('class_subject_id', csIds);
      const grades = gradeRows || [];

      // Index simple : csId → seqId → studentId → note
      const noteIndex = {};
      grades.forEach(g => {
        if (!noteIndex[g.class_subject_id]) noteIndex[g.class_subject_id] = {};
        if (!noteIndex[g.class_subject_id][g.sequence_id]) noteIndex[g.class_subject_id][g.sequence_id] = {};
        noteIndex[g.class_subject_id][g.sequence_id][g.student_id] = g.note;
      });

      // Store raw data so sequence selector can recompute categories without re-fetching
      setRawNoteIndex(noteIndex);
      setRawSubjectList(subjectList);
      setRawStudentIds(studentIds);
      setRawStudentNameMap(studentNameMap);

      const chart = subjectList.map(subj =>
        (seqRows || []).map(seq => {
          const seqNotes = noteIndex[subj.csId]?.[seq.id] || {};
          const vals = Object.values(seqNotes).filter(n => n != null);
          return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
        })
      );
      setChartData(chart);

      // Pick the last sequence that actually has grade data; fallback to is_active then last
      const seqsWithData = (seqRows || []).filter(seq =>
        subjectList.some(subj => Object.keys(noteIndex[subj.csId]?.[seq.id] || {}).length > 0)
      );
      const activeSeq = seqsWithData[seqsWithData.length - 1]
        || seqRows.find(s => s.is_active)
        || seqRows[seqRows.length - 1];
      setActiveSeqLabel(activeSeq?.label || '');
      setCatSeqId(activeSeq?.id || null);

      // ── KPIs globaux ──
      const studentFinalAvgs = studentIds.map(sid => {
        let wSum = 0, wTotal = 0;
        subjectList.forEach(subj => {
          const allNotes = Object.values(noteIndex[subj.csId] || {})
            .map(seqMap => seqMap[sid]).filter(n => n != null);
          if (!allNotes.length) return;
          const sAvg = allNotes.reduce((a, b) => a + b, 0) / allNotes.length;
          wSum += sAvg * subj.coefficient; wTotal += subj.coefficient;
        });
        return wTotal > 0 ? wSum / wTotal : null;
      }).filter(a => a !== null);

      if (studentFinalAvgs.length > 0) {
        const avg = studentFinalAvgs.reduce((a, b) => a + b, 0) / studentFinalAvgs.length;
        setClassAvg(avg.toFixed(2));
        setSuccessRate(((studentFinalAvgs.filter(a => a >= 10).length / studentFinalAvgs.length) * 100).toFixed(1));
        setDistribution([
          { label: '0 – 5',   count: studentFinalAvgs.filter(a => a < 5).length },
          { label: '5 – 10',  count: studentFinalAvgs.filter(a => a >= 5  && a < 10).length },
          { label: '10 – 15', count: studentFinalAvgs.filter(a => a >= 10 && a < 15).length },
          { label: '15 – 20', count: studentFinalAvgs.filter(a => a >= 15).length },
        ]);
      }
    } catch (err) {
      console.error('Reports (teacher_head):', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Admin / Counselor ────────────────────────────────────── */
  const loadAdminData = async () => {
    setLoading(true);
    try {
      const { count } = await supabase.from('students').select('*', { count: 'exact', head: true });
      setTotalStudents(count ?? 0);

      const [{ data: classRows }, { data: studentRows }] = await Promise.all([
        supabase.from('classes').select('id, name, level'),
        supabase.from('students').select('class_id'),
      ]);

      const levelMap = {};
      (classRows || []).forEach(c => { levelMap[c.id] = c.level || c.name; });
      const counts = {};
      (studentRows || []).forEach(s => {
        const lvl = levelMap[s.class_id] || 'Non assigné';
        counts[lvl] = (counts[lvl] || 0) + 1;
      });
      setLevelData(
        Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, c]) => ({ label, count: c }))
      );

      const { data: gradeRows } = await supabase.from('grades').select('note');
      if (gradeRows?.length) {
        const allNotes = gradeRows.map(g => g.note).filter(n => n !== null);
        if (allNotes.length) setGlobalAvg((allNotes.reduce((a, b) => a + b, 0) / allNotes.length).toFixed(2));
      }
    } catch (err) {
      console.error('Reports (admin):', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Alerte ───────────────────────────────────────────────── */
  const openAlert = (subj) => {
    const students = [
      ...subj.difficulte.map(s => ({ ...s, cat: 'difficulte' })),
      ...subj.fragile.map(s => ({ ...s, cat: 'fragile' })),
    ];
    setAlertNote('');
    setAlertModal({ subj, students });
  };

  const sendAlert = async () => {
    if (!alertModal) return;
    setAlertSending(true);
    try {
      const { subj, students } = alertModal;
      const activeSeq = sequences.find(s => s.id === catSeqId) || sequences[sequences.length - 1];

      const { error: pgErr } = await supabase.from('performance_groups').insert({
        class_id:         subj.classId,
        class_subject_id: subj.csId,
        sequence_id:      activeSeq?.id,
        created_by:       user.id,
        teacher_id:       subj.teacherId,
        student_ids:      students.map(s => s.id),
        note:             alertNote || null,
      });
      if (pgErr) throw pgErr;

      if (subj.teacherId) {
        await supabase.from('notifications').insert({
          recipient_id: subj.teacherId,
          title:   `⚠️ Élèves à suivre — ${subj.name}`,
          content: `${user?.name || 'Le titulaire'} a signalé ${students.length} élève(s) nécessitant un suivi en ${subj.name} — ${myClass?.name} — ${activeSeq?.label}. Consultez l'onglet "Élèves signalés".`,
          type:    'warning',
          is_read: false,
        });
      }

      setAlertModal(null);
      showToast(`Alerte envoyée à ${subj.teacherName} !`);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      setAlertSending(false);
    }
  };

  /* ── Helpers SVG ──────────────────────────────────────────── */
  const scoreToY = score => 150 - (score / 20) * 120;
  const seqCount = sequences.length;
  const xStart   = 60, xEnd = 375;
  const xStep    = seqCount > 1 ? (xEnd - xStart) / (seqCount - 1) : 0;
  const seqX     = i => seqCount === 1 ? (xStart + xEnd) / 2 : xStart + i * xStep;
  const buildPoints = si => {
    if (!chartData[si]) return '';
    return chartData[si].map((avg, i) => avg !== null ? `${seqX(i)},${scoreToY(avg)}` : null).filter(Boolean).join(' ');
  };
  const maxDist = distribution.length ? Math.max(...distribution.map(d => d.count), 1) : 1;

  /* ── Render ───────────────────────────────────────────────── */
  return (
    <section className="page-section active">

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : 'var(--green)',
          color: '#fff', padding: '13px 20px', borderRadius: '10px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '14px',
        }}>
          {toast.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
          {toast.msg}
        </div>
      )}

      {/* Modale d'alerte */}
      {alertModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.6)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '20px',
        }}
          onClick={e => e.target === e.currentTarget && setAlertModal(null)}
        >
          <div style={{
            background: 'var(--card-bg)', borderRadius: '16px',
            padding: '28px', width: '100%', maxWidth: '520px',
            border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b' }}>
                  <AlertTriangle size={20} /> Alerter {alertModal.subj.teacherName}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-light)' }}>
                  {alertModal.subj.name} · {myClass?.name} · {activeSeqLabel}
                </p>
              </div>
              <button onClick={() => setAlertModal(null)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-light)', padding: '4px', borderRadius: '6px',
              }}>
                <X size={20} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-light)', marginBottom: '12px' }}>
              Les élèves suivants seront signalés :
            </p>

            <div style={{ maxHeight: '260px', overflowY: 'auto', marginBottom: '16px' }}>
              {alertModal.students.map((s, i) => {
                const cfg = CAT_CONFIG[s.cat];
                return (
                  <div key={s.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 10px', borderRadius: '8px', marginBottom: '4px',
                    background: cfg.bg,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px' }}>{cfg.emoji}</span>
                      <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-dark)' }}>{s.name}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px', color: cfg.color }}>{s.avg.toFixed(2)}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-light)', marginLeft: '4px' }}>/20</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>
                Message optionnel pour l'enseignant
              </label>
              <textarea
                value={alertNote}
                onChange={e => setAlertNote(e.target.value)}
                placeholder="Ces élèves ont besoin de renforcement sur…"
                rows={3}
                style={{
                  width: '100%', background: 'var(--bg)', border: '1.5px solid var(--border)',
                  borderRadius: '10px', padding: '10px 12px', color: 'var(--text-dark)',
                  fontSize: '13px', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button onClick={() => setAlertModal(null)} className="btn-sm btn-outline">
                Annuler
              </button>
              <button
                onClick={sendAlert}
                disabled={alertSending}
                className="btn-sm btn-green"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {alertSending ? <Loader size={14} /> : <Send size={14} />}
                {alertSending ? 'Envoi…' : 'Envoyer l\'alerte'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="page-top-bar">
        <div>
          <h3>Rapports &amp; Statistiques</h3>
          {myClass && (
            <p style={{ fontSize: '13px', color: 'var(--text-light)', margin: 0 }}>
              Classe : <strong>{myClass.name}</strong>
              {activeSeqLabel && <> · <strong>{activeSeqLabel}</strong></>}
            </p>
          )}
        </div>
        <button className="btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TrendingUp size={16} /> Exporter Synthèse
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Loader size={20} /> Chargement des statistiques…
        </div>
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="reports-kpi">
            {isTeacherHead ? (
              <>
                <div className="kpi-card">
                  <h4>Moyenne Générale de la Classe</h4>
                  <div className="kpi-val">{classAvg ?? '—'}</div>
                  <div className="kpi-sub" style={{ color: classAvg >= 10 ? 'var(--green)' : classAvg ? 'var(--red)' : 'var(--text-light)' }}>
                    {classAvg ? (Number(classAvg) >= 10 ? '✓ Au-dessus de la moyenne' : '↓ En dessous de la moyenne') : 'Aucune note enregistrée'}
                  </div>
                </div>
                <div className="kpi-card">
                  <h4>Taux de Réussite</h4>
                  <div className="kpi-val">{successRate !== null ? `${successRate}%` : '—'}</div>
                  <div className="kpi-sub" style={{ color: successRate >= 50 ? 'var(--green)' : successRate !== null ? 'var(--red)' : 'var(--text-light)' }}>
                    {successRate !== null ? 'Élèves avec moy. ≥ 10' : 'Données insuffisantes'}
                  </div>
                </div>
                <div className="kpi-card">
                  <h4>Effectif de la Classe</h4>
                  <div className="kpi-val">{studentCount}</div>
                  <div className="kpi-sub" style={{ color: 'var(--text-light)' }}>
                    {myClass?.name} · {subjects.length} matière{subjects.length !== 1 ? 's' : ''}
                  </div>
                </div>
                <div className="kpi-card">
                  <h4>Élèves en difficulté</h4>
                  <div className="kpi-val" style={{ color: '#ef4444' }}>
                    {subjectCategories.reduce((acc, s) => acc + s.difficulte.length + s.fragile.length, 0) || '—'}
                  </div>
                  <div className="kpi-sub" style={{ color: '#f59e0b' }}>
                    Fragiles + en difficulté
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="kpi-card">
                  <h4>Total Élèves Inscrits</h4>
                  <div className="kpi-val">{totalStudents ?? '—'}</div>
                  <div className="kpi-sub" style={{ color: 'var(--green)' }}>Année 2024–2025</div>
                </div>
                <div className="kpi-card">
                  <h4>Moyenne Générale Établ.</h4>
                  <div className="kpi-val">{globalAvg ?? '—'}</div>
                  <div className="kpi-sub" style={{ color: globalAvg >= 10 ? 'var(--green)' : globalAvg ? 'var(--red)' : 'var(--text-light)' }}>
                    {globalAvg ? (Number(globalAvg) >= 10 ? '↑ Au-dessus de 10' : '↓ En dessous de 10') : 'Aucune note encore'}
                  </div>
                </div>
                <div className="kpi-card">
                  <h4>Taux de Présence</h4>
                  <div className="kpi-val">—</div>
                  <div className="kpi-sub" style={{ color: 'var(--text-light)' }}>Table absences non connectée</div>
                </div>
              </>
            )}
          </div>

          {/* ── Graphiques ── */}
          <div className="report-chart-row">
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Évolution des Moyennes par Séquence</h3>
                  <p>{myClass ? `Classe ${myClass.name}` : 'Établissement'} · {seqCount} séquence{seqCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <div className="card-body">
                {isTeacherHead && chartData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)', fontSize: '13px' }}>
                    Aucune note enregistrée pour cette classe.
                  </div>
                ) : (
                  <>
                    <svg viewBox="0 0 430 185" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%' }}>
                      <line x1="50" y1="10" x2="50" y2="155" stroke="#E5E7EB" strokeWidth="1"/>
                      <line x1="50" y1="155" x2="415" y2="155" stroke="#E5E7EB" strokeWidth="1"/>
                      {[0, 5, 10, 15, 20].map(v => (
                        <g key={v}>
                          <line x1="50" y1={scoreToY(v)} x2="415" y2={scoreToY(v)}
                            stroke={v === 10 ? '#F97316' : '#F3F4F6'} strokeWidth="1"
                            strokeDasharray={v === 10 ? '6,3' : '4'} opacity={v === 10 ? 0.6 : 1} />
                          <text x="44" y={scoreToY(v) + 4} fontSize="9" fill="#9CA3AF" textAnchor="end">{v}</text>
                        </g>
                      ))}
                      {isTeacherHead ? (
                        subjects.slice(0, 6).map((subj, si) => {
                          const pts = buildPoints(si);
                          if (!pts) return null;
                          const col = COLORS[si % COLORS.length];
                          return (
                            <g key={subj.csId}>
                              <polyline fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
                              {chartData[si].map((avg, i) => avg !== null ? (
                                <g key={i}>
                                  <circle cx={seqX(i)} cy={scoreToY(avg)} r="4" fill={col} />
                                  <text x={seqX(i)} y={scoreToY(avg) - 7} fontSize="8" fill={col} textAnchor="middle">{avg.toFixed(1)}</text>
                                </g>
                              ) : null)}
                            </g>
                          );
                        })
                      ) : (
                        <>
                          <polyline fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="80,90 150,75 220,82 290,68 360,60" />
                          {[[80,90],[150,75],[220,82],[290,68],[360,60]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="4" fill="#3B82F6"/>)}
                          <polyline fill="none" stroke="#00A86B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="80,100 150,95 220,105 290,92 360,88" />
                          {[[80,100],[150,95],[220,105],[290,92],[360,88]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="4" fill="#00A86B"/>)}
                        </>
                      )}
                      {isTeacherHead ? (
                        sequences.slice(0, 6).map((seq, i) => (
                          <text key={seq.id} x={seqX(i)} y="172" fontSize="9" fill="#9CA3AF" textAnchor="middle">
                            {seq.label || `Séq ${seq.number}`}
                          </text>
                        ))
                      ) : (
                        ['6ème','5ème','4ème','3ème','Lycée'].map((l, i) => (
                          <text key={l} x={80 + i * 70} y="172" fontSize="9" fill="#9CA3AF" textAnchor="middle">{l}</text>
                        ))
                      )}
                    </svg>
                    <div className="chart-legend">
                      {isTeacherHead ? subjects.slice(0, 6).map((subj, si) => (
                        <div key={subj.csId} className="legend-item">
                          <div className="legend-dot" style={{ background: COLORS[si % COLORS.length] }} />{subj.name}
                        </div>
                      )) : (
                        <>
                          <div className="legend-item"><div className="legend-dot" style={{ background: '#3B82F6' }} />Mathématiques</div>
                          <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--green)' }} />Français</div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h3>{isTeacherHead ? 'Répartition des Élèves par Tranche' : 'Répartition par Niveau'}</h3>
                  <p>{isTeacherHead ? `Moyennes générales · ${myClass?.name}` : 'Effectifs inscrits 2024–25'}</p>
                </div>
              </div>
              <div className="card-body">
                {isTeacherHead ? (
                  distribution.every(d => d.count === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)', fontSize: '13px' }}>Aucune donnée disponible.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {distribution.map((d, i) => {
                        const distColors = ['#EF4444', '#F97316', '#00A86B', '#3B82F6'];
                        return (
                          <div key={d.label} className="perf-row">
                            <span style={{ width: '70px', fontSize: '13px' }}>{d.label}</span>
                            <div className="prog-bar-wrap">
                              <div className="prog-bar" style={{ width: `${(d.count / maxDist) * 100}%`, background: distColors[i] }} />
                            </div>
                            <strong style={{ width: '60px', textAlign: 'right', fontSize: '13px' }}>
                              {d.count} élève{d.count !== 1 ? 's' : ''}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  levelData.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(() => {
                        const maxCount = Math.max(...levelData.map(d => d.count), 1);
                        const lvlColors = ['var(--navy-light)', 'var(--blue-accent)', 'var(--green)', '#A855F7', '#F97316'];
                        return levelData.map((l, i) => (
                          <div key={l.label} className="perf-row">
                            <span style={{ width: '90px', fontSize: '12px' }}>{l.label}</span>
                            <div className="prog-bar-wrap">
                              <div className="prog-bar" style={{ width: `${(l.count / maxCount) * 100}%`, background: lvlColors[i % lvlColors.length] }} />
                            </div>
                            <strong style={{ width: '40px', textAlign: 'right' }}>{l.count}</strong>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)', fontSize: '13px' }}>Aucune donnée disponible.</div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* ── Catégorisation par matière (teacher_head / counselor) ── */}
          {canCategorize && rawSubjectList.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ marginBottom: '12px' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>
                  Niveau des Élèves par Matière
                </h3>
                {/* Sequence selector pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {sequences.map(seq => {
                    const hasData = rawSubjectList.some(
                      subj => Object.keys(rawNoteIndex[subj.csId]?.[seq.id] || {}).length > 0
                    );
                    const isSelected = seq.id === catSeqId;
                    return (
                      <button
                        key={seq.id}
                        onClick={() => { setCatSeqId(seq.id); setActiveSeqLabel(seq.label || ''); }}
                        style={{
                          padding: '4px 12px', borderRadius: '20px', fontSize: '12px',
                          fontWeight: isSelected ? 700 : 500, cursor: 'pointer',
                          border: isSelected ? '1.5px solid var(--green)' : '1.5px solid var(--border)',
                          background: isSelected ? 'rgba(0,168,107,0.12)' : 'transparent',
                          color: isSelected ? 'var(--green)' : hasData ? 'var(--text-dark)' : 'var(--text-light)',
                          opacity: hasData ? 1 : 0.5,
                        }}
                      >
                        {seq.label || `Séq ${seq.number}`}
                        {hasData && <span style={{ marginLeft: '4px', fontSize: '10px' }}>●</span>}
                      </button>
                    );
                  })}
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)' }}>
                  Cliquez sur "Alerter" pour signaler des élèves à l'enseignant concerné
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
                {subjectCategories.map(subj => (
                  <div key={subj.csId} className="card" style={{ margin: 0 }}>
                    {/* En-tête matière */}
                    <div style={{
                      padding: '14px 18px 10px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                    }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-dark)' }}>
                          {subj.name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                          Prof. {subj.teacherName} · Coeff {subj.coefficient}
                        </div>
                      </div>
                      {subj.hasAlert && (
                        <button
                          onClick={() => openAlert(subj)}
                          style={{
                            background: 'rgba(245,158,11,0.15)', border: '1px solid #f59e0b',
                            borderRadius: '8px', padding: '5px 12px', cursor: 'pointer',
                            color: '#f59e0b', fontWeight: 700, fontSize: '12px',
                            display: 'flex', alignItems: 'center', gap: '5px',
                            flexShrink: 0, marginLeft: '8px',
                          }}
                        >
                          <AlertTriangle size={13} /> Alerter
                        </button>
                      )}
                    </div>

                    {/* Catégories */}
                    <div style={{ padding: '10px 18px 14px' }}>
                      {(['excellent', 'bien', 'fragile', 'difficulte']).map(catKey => {
                        const cfg = CAT_CONFIG[catKey];
                        const students = subj[catKey];
                        if (students.length === 0) return null;
                        return (
                          <div key={catKey} style={{ marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px' }}>{cfg.emoji}</span>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: cfg.color }}>{cfg.label}</span>
                              <span style={{
                                marginLeft: '4px', background: cfg.bg, color: cfg.color,
                                borderRadius: '20px', padding: '1px 8px', fontSize: '11px', fontWeight: 700,
                              }}>
                                {students.length}
                              </span>
                            </div>
                            <div style={{ paddingLeft: '22px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {students.map(s => (
                                <span key={s.id} title={`${s.name} — ${s.avg.toFixed(2)}/20`} style={{
                                  background: 'rgba(255,255,255,0.04)',
                                  border: `1px solid ${cfg.color}33`,
                                  borderRadius: '6px', padding: '2px 8px',
                                  fontSize: '11px', color: 'var(--text-dark)', fontWeight: 600,
                                }}>
                                  {s.name.split(' ').slice(0, 2).join(' ')}
                                  <span style={{ color: cfg.color, marginLeft: '4px', fontWeight: 700 }}>
                                    {s.avg.toFixed(1)}
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}

                      {subj.excellent.length + subj.bien.length + subj.fragile.length + subj.difficulte.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-light)', fontSize: '13px' }}>
                          Aucune note saisie pour cette séquence.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message si pas de matières catégorisées */}
          {canCategorize && rawSubjectList.length === 0 && !loading && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)', fontSize: '14px' }}>
              <Users size={32} style={{ marginBottom: '12px', opacity: 0.3 }} />
              <p>Aucune matière assignée à cette classe.</p>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default Reports;

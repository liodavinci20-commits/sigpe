import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Loader, Printer, Eye, EyeOff, CheckCircle, AlertTriangle, Download } from 'lucide-react';

// ── Constantes ──────────────────────────────────────────────────────────────
const TRIMESTERS = [
  { value: 1, label: 'Trimestre 1', seqNumbers: [1, 2] },
  { value: 2, label: 'Trimestre 2', seqNumbers: [3, 4] },
  { value: 3, label: 'Trimestre 3', seqNumbers: [5, 6] },
];

const getMention = (avg) => {
  if (avg === null || avg === undefined) return { label: '—',           color: '#888' };
  if (avg >= 16)  return { label: 'Très Bien',   color: '#16a34a' };
  if (avg >= 14)  return { label: 'Bien',         color: '#22c55e' };
  if (avg >= 12)  return { label: 'Assez Bien',   color: '#3b82f6' };
  if (avg >= 10)  return { label: 'Passable',     color: '#f59e0b' };
  return                 { label: 'Insuffisant',  color: '#ef4444' };
};

// ── Moteur de calcul ─────────────────────────────────────────────────────────
const computeBulletins = (students, classSubjects, grades, sequences) => {
  const seqIds = sequences.map(s => s.id);

  return students.map(student => {
    const subjects = classSubjects.map(cs => {
      const csGrades = grades.filter(
        g => g.student_id === student.id &&
             g.class_subject_id === cs.id &&
             seqIds.includes(g.sequence_id)
      );

      // Construire un map seqId → note pour l'affichage colonne par colonne
      const gradeBySeq = {};
      csGrades.forEach(g => { gradeBySeq[g.sequence_id] = Number(g.note); });

      // Moyenne de la matière = moyenne des notes disponibles sur le trimestre
      const noteValues = Object.values(gradeBySeq);
      const avg = noteValues.length > 0
        ? noteValues.reduce((s, n) => s + n, 0) / noteValues.length
        : null;

      return {
        subjectName: cs.subjects?.name || '—',
        coefficient: cs.coefficient   || 1,
        gradeBySeq,
        avg,
      };
    });

    // Moyenne générale pondérée (ne compte que les matières avec au moins une note)
    const noted = subjects.filter(s => s.avg !== null);
    const num   = noted.reduce((s, sub) => s + sub.avg * sub.coefficient, 0);
    const den   = noted.reduce((s, sub) => s + sub.coefficient, 0);
    const overallAvg = den > 0 ? num / den : null;

    return {
      studentId:   student.id,
      studentName: student.profiles?.full_name || student.matricule || '—',
      matricule:   student.matricule || '—',
      subjects,
      overallAvg,
    };
  });
};

// ── Composant bulletin imprimable ────────────────────────────────────────────
const BulletinCard = ({ bulletin, rank, total, className, trimesterLabel, sequences, printRef }) => {
  const mention = getMention(bulletin?.overallAvg);

  return (
    <div ref={printRef} style={{
      background: '#fff', color: '#111',
      maxWidth: '760px', margin: '0 auto',
      border: '2px solid #222', borderRadius: '4px',
      fontFamily: 'Georgia, serif', fontSize: '13px',
    }}>
      {/* ── En-tête établissement ── */}
      <div style={{
        padding: '14px 24px', borderBottom: '2px solid #222',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '17px', letterSpacing: '1px', textTransform: 'uppercase' }}>
            SIGPES
          </div>
          <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
            Système d'Information de Gestion Pédagogique des Établissements Scolaires
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '12px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px' }}>{trimesterLabel}</div>
          <div>Année scolaire 2024–2025</div>
          <div>Classe : <strong>{className}</strong></div>
        </div>
      </div>

      {/* ── Identité élève ── */}
      <div style={{
        padding: '12px 24px', borderBottom: '1px solid #ddd',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '16px' }}>{bulletin.studentName}</div>
          <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
            Matricule : {bulletin.matricule}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '12px' }}>
            Rang : <strong>{rank} / {total}</strong>
          </div>
          <div style={{
            marginTop: '4px', fontWeight: 700, fontSize: '14px',
            color: mention.color,
          }}>
            {mention.label}
          </div>
        </div>
      </div>

      {/* ── Tableau des notes ── */}
      <div style={{ padding: '0 24px 16px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '14px' }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={thStyle('left')}>Matière</th>
              <th style={thStyle()}>Coeff.</th>
              {sequences.map(s => (
                <th key={s.id} style={thStyle()}>{s.label}</th>
              ))}
              <th style={{ ...thStyle(), background: '#dcfce7' }}>Moy. / 20</th>
              <th style={{ ...thStyle(), background: '#dcfce7' }}>Pondérée</th>
            </tr>
          </thead>
          <tbody>
            {bulletin.subjects.map((sub, i) => {
              const m = getMention(sub.avg);
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={tdStyle('left', { fontWeight: 600 })}>{sub.subjectName}</td>
                  <td style={tdStyle('center')}>{sub.coefficient}</td>
                  {sequences.map(seq => (
                    <td key={seq.id} style={tdStyle('center')}>
                      {sub.gradeBySeq[seq.id] !== undefined
                        ? sub.gradeBySeq[seq.id].toFixed(2)
                        : <span style={{ color: '#bbb' }}>—</span>}
                    </td>
                  ))}
                  <td style={tdStyle('center', { fontWeight: 700, color: m.color })}>
                    {sub.avg !== null ? sub.avg.toFixed(2) : <span style={{ color: '#bbb' }}>—</span>}
                  </td>
                  <td style={tdStyle('center', { fontWeight: 700 })}>
                    {sub.avg !== null
                      ? (sub.avg * sub.coefficient).toFixed(2)
                      : <span style={{ color: '#bbb' }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f0fdf4' }}>
              <td
                colSpan={2 + sequences.length}
                style={{ ...tdStyle('right'), fontWeight: 700, fontSize: '13px', paddingRight: '12px' }}
              >
                MOYENNE GÉNÉRALE
              </td>
              <td colSpan={2} style={{
                ...tdStyle('center'),
                fontWeight: 900, fontSize: '17px', color: mention.color,
              }}>
                {bulletin.overallAvg !== null ? bulletin.overallAvg.toFixed(2) : '—'} / 20
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Pied ── */}
      <div style={{
        padding: '10px 24px 14px', borderTop: '1px solid #ddd',
        display: 'flex', justifyContent: 'space-between',
        fontSize: '11px', color: '#777',
      }}>
        <div>Rang : <strong>{rank} / {total}</strong></div>
        <div>Mention : <strong style={{ color: mention.color }}>{mention.label}</strong></div>
        <div>Généré le : {new Date().toLocaleDateString('fr-FR')}</div>
      </div>
    </div>
  );
};

const thStyle = (align = 'center') => ({
  padding: '8px 10px', textAlign: align,
  border: '1px solid #ddd', fontWeight: 700, fontSize: '12px',
});
const tdStyle = (align = 'center', extra = {}) => ({
  padding: '7px 10px', textAlign: align,
  border: '1px solid #ddd', fontSize: '13px', ...extra,
});

// ── Composant principal ──────────────────────────────────────────────────────
const Bulletin = () => {
  const { user } = useAuth();
  const printRef = useRef();

  const isAdmin       = user?.role === 'admin' || user?.role === 'sub_admin';
  const isStudent     = user?.role === 'student';
  const isTeacherHead = user?.role === 'teacher_head';
  const isParent      = user?.role === 'parent';

  const [trimester, setTrimester] = useState(1);

  // ── État admin / teacher_head ──
  const [classes,         setClasses]         = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [bulletins,       setBulletins]       = useState([]);
  const [sequences,       setSequences]       = useState([]);
  const [loading,         setLoading]         = useState(false);
  const [selectedIdx,     setSelectedIdx]     = useState(0);

  // Publication
  const [publication, setPublication] = useState(null);
  const [publishing,  setPublishing]  = useState(false);

  // ── État élève ──
  const [studentBulletin, setStudentBulletin] = useState(null);
  const [studentMeta,     setStudentMeta]     = useState(null); // { rank, total, className, sequences }
  const [isPublished,     setIsPublished]     = useState(false);
  const [studentLoading,  setStudentLoading]  = useState(false);

  const [toast,        setToast]        = useState(null);
  const [exportingPDF, setExportingPDF] = useState(false);
  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Chargement des classes ──
  useEffect(() => {
    if (isAdmin) {
      supabase.from('classes').select('id, name, level').order('name').then(({ data }) => {
        setClasses(data || []);
        if (data?.length) setSelectedClassId(data[0].id);
      });
    } else if (isTeacherHead) {
      supabase.from('classes').select('id, name, level')
        .eq('head_teacher_id', user.id).then(({ data }) => {
          setClasses(data || []);
          if (data?.length) setSelectedClassId(data[0].id);
        });
    }
  }, [user?.id]);

  // ── Générer bulletins à chaque changement classe / trimestre ──
  useEffect(() => {
    if (!selectedClassId || (!isAdmin && !isTeacherHead)) return;
    generateBulletins();
    checkPublication();
  }, [selectedClassId, trimester]);

  // ── Charger bulletin élève ──
  useEffect(() => {
    if (!isStudent) return;
    loadStudentBulletin();
  }, [trimester, user?.id]);

  // ────────────────────────────────────────────────────────────────────────────
  const generateBulletins = async () => {
    setLoading(true);
    setBulletins([]);
    setSequences([]);
    try {
      const tri = TRIMESTERS.find(t => t.value === trimester);

      const [{ data: csRows }, { data: seqRows }, { data: studentRows }] = await Promise.all([
        supabase.from('class_subjects')
          .select('id, coefficient, subjects(id, name)')
          .eq('class_id', selectedClassId),
        supabase.from('sequences')
          .select('id, label, number')
          .in('number', tri.seqNumbers)
          .order('number'),
        supabase.from('students')
          .select('id, matricule, profiles(full_name)')
          .eq('class_id', selectedClassId)
          .order('id'),
      ]);

      const csIds  = (csRows  || []).map(cs => cs.id);
      const seqIds = (seqRows || []).map(s => s.id);
      let gradeRows = [];

      if (csIds.length > 0 && seqIds.length > 0) {
        const { data } = await supabase.from('grades')
          .select('student_id, class_subject_id, sequence_id, note')
          .in('class_subject_id', csIds)
          .in('sequence_id', seqIds);
        gradeRows = data || [];
      }

      const computed = computeBulletins(studentRows || [], csRows || [], gradeRows, seqRows || []);
      const ranked   = [...computed].sort((a, b) => (b.overallAvg ?? -1) - (a.overallAvg ?? -1));
      setSequences(seqRows || []);
      setBulletins(ranked);
      setSelectedIdx(0);
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkPublication = async () => {
    try {
      const { data } = await supabase
        .from('bulletin_publications')
        .select('*')
        .eq('class_id', selectedClassId)
        .eq('trimester', trimester)
        .maybeSingle();
      setPublication(data || null);
    } catch {
      setPublication(null);
    }
  };

  const togglePublication = async () => {
    if (bulletins.length === 0) return;
    setPublishing(true);
    try {
      if (!publication) {
        // Première publication
        const { data, error } = await supabase
          .from('bulletin_publications')
          .insert({
            class_id:     selectedClassId,
            trimester,
            is_published: true,
            published_at: new Date().toISOString(),
            published_by: user.id,
          })
          .select().single();
        if (error) throw error;
        setPublication(data);
        showToast('Bulletins publiés — visibles par les élèves !');
      } else if (publication.is_published) {
        // Dépublier
        await supabase.from('bulletin_publications')
          .update({ is_published: false, published_at: null })
          .eq('id', publication.id);
        setPublication(prev => ({ ...prev, is_published: false, published_at: null }));
        showToast('Bulletins masqués — plus visibles pour les élèves.');
      } else {
        // Re-publier
        await supabase.from('bulletin_publications')
          .update({ is_published: true, published_at: new Date().toISOString(), published_by: user.id })
          .eq('id', publication.id);
        setPublication(prev => ({ ...prev, is_published: true, published_at: new Date().toISOString() }));
        showToast('Bulletins publiés — visibles par les élèves !');
      }
    } catch (err) {
      showToast('Erreur publication : ' + err.message, 'error');
    } finally {
      setPublishing(false);
    }
  };

  const loadStudentBulletin = async () => {
    setStudentLoading(true);
    setStudentBulletin(null);
    try {
      // Récupérer la classe de l'élève
      const { data: studentRow } = await supabase
        .from('students')
        .select('class_id, matricule, profiles(full_name)')
        .eq('id', user.id)
        .single();

      if (!studentRow?.class_id) {
        setIsPublished(false);
        return;
      }

      // Vérifier la publication
      const { data: pub } = await supabase
        .from('bulletin_publications')
        .select('is_published')
        .eq('class_id', studentRow.class_id)
        .eq('trimester', trimester)
        .maybeSingle();

      const published = pub?.is_published === true;
      setIsPublished(published);
      if (!published) return;

      // Charger les données
      const tri = TRIMESTERS.find(t => t.value === trimester);
      const [{ data: csRows }, { data: seqRows }, { data: cls }] = await Promise.all([
        supabase.from('class_subjects')
          .select('id, coefficient, subjects(id, name)')
          .eq('class_id', studentRow.class_id),
        supabase.from('sequences')
          .select('id, label, number')
          .in('number', tri.seqNumbers)
          .order('number'),
        supabase.from('classes')
          .select('name, level')
          .eq('id', studentRow.class_id)
          .single(),
      ]);

      const csIds  = (csRows  || []).map(cs => cs.id);
      const seqIds = (seqRows || []).map(s => s.id);

      // Notes de l'élève (pour son bulletin)
      const { data: myGrades } = await supabase
        .from('grades')
        .select('student_id, class_subject_id, sequence_id, note')
        .eq('student_id', user.id)
        .in('class_subject_id', csIds)
        .in('sequence_id', seqIds);

      // Toutes les notes de la classe (pour calculer le rang)
      const { data: allStudents } = await supabase
        .from('students')
        .select('id, matricule, profiles(full_name)')
        .eq('class_id', studentRow.class_id);

      const { data: allGrades } = await supabase
        .from('grades')
        .select('student_id, class_subject_id, sequence_id, note')
        .in('class_subject_id', csIds)
        .in('sequence_id', seqIds);

      // Calcul rang
      const allBulletins = computeBulletins(allStudents || [], csRows || [], allGrades || [], seqRows || []);
      const ranked = [...allBulletins].sort((a, b) => (b.overallAvg ?? -1) - (a.overallAvg ?? -1));
      const rank   = ranked.findIndex(b => b.studentId === user.id) + 1;

      // Bulletin personnel
      const [myBulletin] = computeBulletins(
        [{ id: user.id, matricule: studentRow.matricule, profiles: studentRow.profiles }],
        csRows || [],
        myGrades || [],
        seqRows || []
      );

      setStudentBulletin(myBulletin);
      setStudentMeta({
        rank,
        total:     ranked.length,
        className: cls?.name || '—',
        sequences: seqRows || [],
      });
    } catch (err) {
      console.error(err);
    } finally {
      setStudentLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    setExportingPDF(true);
    try {
      const html2pdf  = (await import('html2pdf.js')).default;
      const name      = studentBulletin?.studentName || currentBulletin?.studentName || 'bulletin';
      const trimLabel = TRIMESTERS.find(t => t.value === trimester)?.label || '';
      await html2pdf()
        .set({
          margin:      [10, 10, 10, 10],
          filename:    `${name} — ${trimLabel}.pdf`,
          image:       { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
        })
        .from(printRef.current)
        .save();
    } catch (err) {
      console.error('Export PDF :', err);
    } finally {
      setExportingPDF(false);
    }
  };

  const currentBulletin  = bulletins[selectedIdx];
  const selectedClassName = classes.find(c => c.id === selectedClassId)?.name || '—';
  const trimLabel         = TRIMESTERS.find(t => t.value === trimester)?.label || '';

  return (
    <section className="page-section active">

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          background: toast.type === 'error' ? '#ef4444' : 'var(--green)',
          color: '#fff', padding: '13px 22px', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)', fontWeight: 600, fontSize: '14px',
        }}>
          {toast.msg}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ADMIN / PROF TITULAIRE
      ══════════════════════════════════════════════════════════════════ */}
      {(isAdmin || isTeacherHead) && (
        <>
          {/* Barre de contrôle */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
            {/* Classe */}
            <select
              value={selectedClassId || ''}
              onChange={e => setSelectedClassId(e.target.value)}
              style={{
                padding: '9px 14px', borderRadius: '8px',
                border: '1.5px solid var(--border)', background: 'var(--bg)',
                color: 'var(--text-dark)', fontWeight: 600, fontSize: '14px',
              }}
            >
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            {/* Trimestre */}
            <div style={{ display: 'flex', gap: '4px' }}>
              {TRIMESTERS.map(t => (
                <button key={t.value} onClick={() => setTrimester(t.value)} style={{
                  padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: '13px',
                  background: trimester === t.value ? 'var(--blue-accent)' : 'var(--bg-card)',
                  color:      trimester === t.value ? '#fff'               : 'var(--text-light)',
                  transition: 'all 0.15s',
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            {/* Export PDF admin */}
            <button
              onClick={handleExportPDF}
              disabled={exportingPDF || !currentBulletin}
              className="btn-sm btn-outline"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {exportingPDF ? <><Loader size={14} /> Génération…</> : <><Download size={14} /> Exporter PDF</>}
            </button>

            {/* Publier / Dépublier — admin uniquement */}
            {isAdmin && (
              <button
                onClick={togglePublication}
                disabled={publishing || bulletins.length === 0}
                style={{
                  padding: '9px 18px', borderRadius: '8px', border: 'none',
                  background: publication?.is_published ? '#ef4444' : 'var(--green)',
                  color: '#fff', fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '7px',
                  opacity: bulletins.length === 0 ? 0.45 : 1,
                  transition: 'background 0.2s',
                }}
              >
                {publishing
                  ? <Loader size={14} />
                  : publication?.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
                {publishing
                  ? 'En cours…'
                  : publication?.is_published
                    ? 'Masquer aux élèves'
                    : 'Publier aux élèves'}
              </button>
            )}
          </div>

          {/* Bandeau statut publication */}
          {publication?.is_published ? (
            <div style={{
              marginBottom: '16px', padding: '10px 16px', borderRadius: '8px',
              background: 'rgba(34,197,94,0.08)', border: '1.5px solid var(--green)',
              display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px',
            }}>
              <CheckCircle size={16} color="var(--green)" />
              <span style={{ color: 'var(--green)', fontWeight: 600 }}>
                Bulletins publiés — visibles par les élèves depuis le{' '}
                {new Date(publication.published_at).toLocaleDateString('fr-FR')}
              </span>
            </div>
          ) : (
            <div style={{
              marginBottom: '16px', padding: '10px 16px', borderRadius: '8px',
              background: 'rgba(245,158,11,0.08)', border: '1.5px solid #f59e0b',
              display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px',
            }}>
              <AlertTriangle size={16} color="#f59e0b" />
              <span style={{ color: '#92400e', fontWeight: 600 }}>
                {bulletins.length === 0
                  ? 'Aucun bulletin généré — vérifiez que des notes ont été saisies pour cette période.'
                  : 'Bulletins non publiés — invisibles pour les élèves. Cliquez sur "Publier" quand ils sont prêts.'}
              </span>
            </div>
          )}

          {/* Contenu */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <Loader size={22} /> Calcul des bulletins en cours…
            </div>
          ) : bulletins.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-light)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
              <p style={{ fontWeight: 600 }}>Aucune note disponible pour cette classe et ce trimestre.</p>
              <p style={{ fontSize: '13px', marginTop: '6px' }}>
                Les enseignants doivent saisir leurs notes dans «&nbsp;Notes &amp; Évaluations&nbsp;».
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '230px 1fr', gap: '20px', alignItems: 'start' }}>

              {/* Liste des élèves — colonne gauche */}
              <div className="card" style={{ padding: '8px', position: 'sticky', top: '80px' }}>
                <div style={{
                  fontSize: '11px', fontWeight: 700, color: 'var(--text-light)',
                  padding: '8px 10px 6px', letterSpacing: '0.5px',
                }}>
                  CLASSEMENT — {bulletins.length} ÉLÈVE{bulletins.length > 1 ? 'S' : ''}
                </div>
                <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                  {bulletins.map((b, i) => {
                    const m = getMention(b.overallAvg);
                    return (
                      <div
                        key={b.studentId}
                        onClick={() => setSelectedIdx(i)}
                        style={{
                          padding: '9px 10px', borderRadius: '8px', cursor: 'pointer',
                          background: selectedIdx === i ? 'rgba(0,168,107,0.08)' : 'transparent',
                          borderLeft: selectedIdx === i ? '3px solid var(--green)' : '3px solid transparent',
                          marginBottom: '2px', transition: 'all 0.15s',
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-dark)', marginBottom: '2px' }}>
                          {i + 1}. {b.studentName}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                          <span style={{ color: m.color, fontWeight: 700 }}>
                            {b.overallAvg !== null ? b.overallAvg.toFixed(2) + '/20' : '—'}
                          </span>
                          <span style={{ color: 'var(--text-light)' }}>{m.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Bulletin — colonne droite */}
              <div>
                {currentBulletin && (
                  <BulletinCard
                    printRef={printRef}
                    bulletin={currentBulletin}
                    rank={selectedIdx + 1}
                    total={bulletins.length}
                    className={selectedClassName}
                    trimesterLabel={trimLabel}
                    sequences={sequences}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          ÉLÈVE
      ══════════════════════════════════════════════════════════════════ */}
      {isStudent && (
        <>
          {/* Sélecteur trimestre */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
            {TRIMESTERS.map(t => (
              <button key={t.value} onClick={() => setTrimester(t.value)} style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '13px',
                background: trimester === t.value ? 'var(--blue-accent)' : 'var(--bg-card)',
                color:      trimester === t.value ? '#fff'               : 'var(--text-light)',
              }}>
                {t.label}
              </button>
            ))}
          </div>

          {studentLoading ? (
            <div style={{ textAlign: 'center', padding: '64px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <Loader size={22} /> Chargement de votre bulletin…
            </div>
          ) : !isPublished ? (
            <div style={{ textAlign: 'center', padding: '80px 32px' }}>
              <div style={{ fontSize: '52px', marginBottom: '16px' }}>🔒</div>
              <h3 style={{ color: 'var(--text-dark)', marginBottom: '8px', fontSize: '18px' }}>
                Bulletin non disponible
              </h3>
              <p style={{ color: 'var(--text-light)', fontSize: '14px', lineHeight: 1.7 }}>
                L'administration n'a pas encore publié les bulletins du <strong>{trimLabel}</strong>.<br />
                Vous serez notifié(e) dès qu'ils seront accessibles.
              </p>
            </div>
          ) : studentBulletin && studentMeta ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                <button
                  onClick={handleExportPDF}
                  disabled={exportingPDF}
                  className="btn-sm btn-green"
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 18px' }}
                >
                  {exportingPDF
                    ? <><Loader size={14} /> Génération…</>
                    : <><Download size={14} /> Télécharger mon bulletin (PDF)</>}
                </button>
              </div>
              <BulletinCard
                printRef={printRef}
                bulletin={studentBulletin}
                rank={studentMeta.rank}
                total={studentMeta.total}
                className={studentMeta.className}
                trimesterLabel={trimLabel}
                sequences={studentMeta.sequences}
              />
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-light)' }}>
              Aucune donnée disponible.
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          PARENT
      ══════════════════════════════════════════════════════════════════ */}
      {isParent && (
        <div style={{ textAlign: 'center', padding: '80px 32px', color: 'var(--text-light)' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
          <p style={{ fontSize: '14px' }}>La consultation des bulletins pour les parents sera disponible prochainement.</p>
        </div>
      )}
    </section>
  );
};

export default Bulletin;

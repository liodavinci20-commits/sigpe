import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { ArrowLeft, Plus, Loader, CalendarDays } from 'lucide-react';

const DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

const TIME_ROWS = [
  { time: '07:30', isBreak: false },
  { time: '08:30', isBreak: false },
  { time: '09:30', isBreak: false },
  { time: '10:00', isBreak: true,  label: 'Pause'    },
  { time: '10:15', isBreak: false },
  { time: '11:15', isBreak: false },
  { time: '12:00', isBreak: true,  label: 'Déjeuner' },
  { time: '13:00', isBreak: false },
  { time: '14:00', isBreak: false },
  { time: '15:00', isBreak: false },
  { time: '16:00', isBreak: false },
];
const TIME_OPTIONS = TIME_ROWS.filter(t => !t.isBreak).map(t => t.time);

const autoColor = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('math'))                        return 'math';
  if (n.includes('fran'))                        return 'fr';
  if (n.includes('hist') || n.includes('géo'))   return 'hist';
  if (n.includes('phys') || n.includes('chim'))  return 'pc';
  if (n.includes('svt')  || n.includes('bio'))   return 'svt';
  if (n.includes('angl') || n.includes('esp'))   return 'eng';
  if (n.includes('eps')  || n.includes('sport')) return 'sport';
  return 'math';
};

const fmtTime = t => (t ? t.slice(0, 5) : '');

// ── Données démo ───────────────────────────────────────────────
const DEMO_CLASSES = [
  { id: 'c1', name: '3ème A', level: 'Collège' },
  { id: 'c2', name: '3ème B', level: 'Collège' },
  { id: 'c3', name: '2nde A', level: 'Lycée'   },
  { id: 'c4', name: '2nde B', level: 'Lycée'   },
];
const DEMO_SLOTS = [
  { id:1,  day_of_week:1, start_time:'07:30:00', subject_name:'Mathématiques', teacher_name:'M. Kamga',  room:'Salle 12', color:'math' },
  { id:2,  day_of_week:2, start_time:'07:30:00', subject_name:'Français',      teacher_name:'Mme Beyala',room:'Salle 12', color:'fr'   },
  { id:3,  day_of_week:3, start_time:'07:30:00', subject_name:'Histoire-Géo',  teacher_name:'M. Ndongo', room:'Salle 12', color:'hist' },
  { id:4,  day_of_week:4, start_time:'07:30:00', subject_name:'Physique-Chim', teacher_name:'M. Zogo',   room:'Labo B',   color:'pc'   },
  { id:5,  day_of_week:5, start_time:'07:30:00', subject_name:'Mathématiques', teacher_name:'M. Kamga',  room:'Salle 12', color:'math' },
  { id:6,  day_of_week:1, start_time:'10:15:00', subject_name:'SVT',           teacher_name:'Dr Owona',  room:'Labo A',   color:'svt'  },
  { id:7,  day_of_week:2, start_time:'10:15:00', subject_name:'Anglais',       teacher_name:'Mme Smith', room:'Salle 12', color:'eng'  },
  { id:8,  day_of_week:3, start_time:'10:15:00', subject_name:'EPS',           teacher_name:'M. Njoya',  room:'Stade',    color:'sport'},
  { id:9,  day_of_week:1, start_time:'13:00:00', subject_name:'Français',      teacher_name:'Mme Beyala',room:'Salle 12', color:'fr'   },
  { id:10, day_of_week:2, start_time:'13:00:00', subject_name:'Mathématiques', teacher_name:'M. Kamga',  room:'Salle 12', color:'math' },
];

const labelSt = {
  display: 'block', fontSize: '12px', fontWeight: 700,
  color: 'var(--text-light, #94a3b8)', marginBottom: '6px',
};
const inputSt = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1.5px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.04)', color: 'var(--text-dark, #f1f5f9)',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
};

// ── HELPERS requêtes ────────────────────────────────────────────

// Récupère l'ID de l'année scolaire courante
const getCurrentYearId = async () => {
  const { data } = await supabase
    .from('academic_years').select('id').eq('is_current', true).limit(1).single();
  return data?.id || null;
};

// Récupère les créneaux d'une classe (via class_subjects → schedule_slots)
const fetchSlotsForClass = async (classId) => {
  // 1. IDs des class_subjects de cette classe
  const { data: csRows } = await supabase
    .from('class_subjects')
    .select('id, teacher_id, subjects(id, name)')
    .eq('class_id', classId);

  if (!csRows?.length) return [];

  const csMap = {};
  const teacherIds = [];
  csRows.forEach(cs => {
    csMap[cs.id] = cs;
    if (cs.teacher_id) teacherIds.push(cs.teacher_id);
  });

  // 2. Noms des profs
  let teacherMap = {};
  if (teacherIds.length) {
    const { data: profs } = await supabase
      .from('profiles').select('id, full_name')
      .in('id', [...new Set(teacherIds)]);
    (profs || []).forEach(p => { teacherMap[p.id] = p.full_name; });
  }

  // 3. Créneaux
  const { data: slots } = await supabase
    .from('schedule_slots')
    .select('id, day_of_week, start_time, end_time, room, class_subject_id')
    .in('class_subject_id', csRows.map(cs => cs.id))
    .order('day_of_week').order('start_time');

  return (slots || []).map(s => {
    const cs = csMap[s.class_subject_id];
    const subName = cs?.subjects?.name || '—';
    return {
      ...s,
      subject_name: subName,
      teacher_name: teacherMap[cs?.teacher_id] || '—',
      color:        autoColor(subName),
    };
  });
};

// ── COMPOSANT PRINCIPAL ─────────────────────────────────────────
const Schedule = () => {
  const { user } = useAuth();
  const isAdmin        = user?.role === 'admin' || user?.role === 'sub_admin';
  const isCounselor    = user?.role === 'counselor';
  const isTeacherCourse= user?.role === 'teacher_course';
  const isTeacherHead  = user?.role === 'teacher_head';
  const isStudent      = user?.role === 'student';
  const isParent       = user?.role === 'parent';

  const [view,           setView]           = useState('list');
  const [classes,        setClasses]        = useState([]);
  const [slotCounts,     setSlotCounts]     = useState({});
  const [selectedClass,  setSelectedClass]  = useState(null);
  const [slots,          setSlots]          = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSlots,   setLoadingSlots]   = useState(false);

  // Modal
  const [showModal,       setShowModal]       = useState(false);
  const [modalSubjects,   setModalSubjects]   = useState([]);
  const [loadingModal,    setLoadingModal]    = useState(false);
  const [subjectSearch,   setSubjectSearch]   = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [form, setForm] = useState({
    day: 1, start_time: '07:30', end_time: '08:30',
    classSubjectId: '', subjectName: '', teacherId: '', teacherName: '', room: '',
  });
  const [saving, setSaving] = useState(false);
  const [toast,  setToast]  = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  /* ══ CHARGEMENT INITIAL ════════════════════════════════════ */
  useEffect(() => {
    if (!user) return;
    if (user.isDemo) {
      setClasses(DEMO_CLASSES);
      setSlotCounts({ c1: DEMO_SLOTS.length, c2: 0, c3: 3, c4: 0 });
      setLoadingClasses(false);
      return;
    }
    if (isAdmin || isCounselor) { loadClassList(); }
    else if (isTeacherHead)     { initTeacherHead(); }
    else if (isTeacherCourse)   { initTeacherCourse(); }
    else if (isStudent)         { initStudent(); }
    else if (isParent)          { initParent(); }
    else { setLoadingClasses(false); }
  }, [user]);

  /* ── Admin / Counselor ──────────────────────────────────── */
  const loadClassList = async () => {
    setLoadingClasses(true);
    try {
      const { data: classRows } = await supabase
        .from('classes').select('id, name, level').order('name');
      setClasses(classRows || []);

      if (classRows?.length) {
        // class_subjects pour toutes ces classes
        const { data: allCS } = await supabase
          .from('class_subjects').select('id, class_id')
          .in('class_id', classRows.map(c => c.id));

        if (allCS?.length) {
          const csIdToClassId = {};
          allCS.forEach(cs => { csIdToClassId[cs.id] = cs.class_id; });

          const { data: slotRows } = await supabase
            .from('schedule_slots').select('class_subject_id')
            .in('class_subject_id', allCS.map(cs => cs.id));

          const counts = {};
          (slotRows || []).forEach(r => {
            const cid = csIdToClassId[r.class_subject_id];
            if (cid) counts[cid] = (counts[cid] || 0) + 1;
          });
          setSlotCounts(counts);
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoadingClasses(false); }
  };

  /* ── Teacher Head ───────────────────────────────────────── */
  const initTeacherHead = async () => {
    setLoadingSlots(true);
    try {
      const { data: cls } = await supabase
        .from('classes').select('id, name, level')
        .eq('head_teacher_id', user.id).limit(1);
      if (cls?.[0]) {
        setSelectedClass(cls[0]);
        setSlots(await fetchSlotsForClass(cls[0].id));
        setView('timetable');
      }
    } catch (err) { console.error(err); }
    finally { setLoadingSlots(false); setLoadingClasses(false); }
  };

  /* ── Teacher Course : EDT personnel ────────────────────── */
  const initTeacherCourse = async () => {
    setLoadingSlots(true);
    try {
      const { data: csRows } = await supabase
        .from('class_subjects')
        .select('id, class_id, subjects(id, name), classes(id, name, level)')
        .eq('teacher_id', user.id);

      if (!csRows?.length) { setView('personal'); return; }

      const csMap = {};
      csRows.forEach(cs => { csMap[cs.id] = cs; });

      const { data: slotRows } = await supabase
        .from('schedule_slots')
        .select('id, day_of_week, start_time, end_time, room, class_subject_id')
        .in('class_subject_id', csRows.map(cs => cs.id))
        .order('day_of_week').order('start_time');

      setSlots((slotRows || []).map(s => {
        const cs = csMap[s.class_subject_id];
        const subName = cs?.subjects?.name || '—';
        return {
          ...s,
          subject_name: subName,
          teacher_name: user.name,
          classes:      cs?.classes,
          color:        autoColor(subName),
        };
      }));
      setView('personal');
    } catch (err) { console.error(err); }
    finally { setLoadingSlots(false); setLoadingClasses(false); }
  };

  /* ── Student ────────────────────────────────────────────── */
  const initStudent = async () => {
    setLoadingSlots(true);
    try {
      const { data: st } = await supabase
        .from('students')
        .select('class_id, classes(id, name, level)')
        .eq('id', user.id).single();
      if (st?.classes) {
        setSelectedClass(st.classes);
        setSlots(await fetchSlotsForClass(st.class_id));
        setView('timetable');
      }
    } catch (err) { console.error(err); }
    finally { setLoadingSlots(false); setLoadingClasses(false); }
  };

  /* ── Parent ─────────────────────────────────────────────── */
  const initParent = async () => {
    setLoadingSlots(true);
    try {
      const { data: link } = await supabase
        .from('student_parents').select('student_id')
        .eq('parent_id', user.id).limit(1).single();
      if (link?.student_id) {
        const { data: st } = await supabase
          .from('students')
          .select('class_id, classes(id, name, level)')
          .eq('id', link.student_id).single();
        if (st?.classes) {
          setSelectedClass(st.classes);
          setSlots(await fetchSlotsForClass(st.class_id));
          setView('timetable');
        }
      }
    } catch (err) { console.error(err); }
    finally { setLoadingSlots(false); setLoadingClasses(false); }
  };

  /* ── Ouvrir une classe (admin) ──────────────────────────── */
  const openClass = async (cls) => {
    setSelectedClass(cls);
    setView('timetable');
    if (user?.isDemo) { setSlots(cls.id === 'c1' ? DEMO_SLOTS : []); return; }
    setLoadingSlots(true);
    setSlots(await fetchSlotsForClass(cls.id));
    setLoadingSlots(false);
  };

  /* ── Ouvrir modal (charge matières depuis DB) ───────────── */
  const openModal = async () => {
    setShowModal(true);
    setLoadingModal(true);
    setSubjectSearch('');
    setShowSuggestions(false);
    setForm({ day: 1, start_time: '07:30', end_time: '08:30', classSubjectId: '', subjectName: '', teacherId: '', teacherName: '', room: '' });
    try {
      const { data: csRows } = await supabase
        .from('class_subjects')
        .select('id, teacher_id, subjects(id, name)')
        .eq('class_id', selectedClass.id);

      const teacherIds = [...new Set((csRows || []).map(r => r.teacher_id).filter(Boolean))];
      let teacherMap = {};
      if (teacherIds.length) {
        const { data: profs } = await supabase
          .from('profiles').select('id, full_name').in('id', teacherIds);
        (profs || []).forEach(p => { teacherMap[p.id] = p.full_name; });
      }

      setModalSubjects(
        (csRows || []).filter(cs => cs.subjects?.id).map(cs => ({
          classSubjectId: cs.id,
          subjectId:      cs.subjects.id,
          subjectName:    cs.subjects.name,
          teacherId:      cs.teacher_id,
          teacherName:    teacherMap[cs.teacher_id] || '—',
        }))
      );
    } catch (err) { console.error(err); }
    finally { setLoadingModal(false); }
  };

  const handleSubjectSelect = (subject) => {
    setSubjectSearch(subject.subjectName);
    setShowSuggestions(false);
    setForm(f => ({
      ...f,
      classSubjectId: subject.classSubjectId,
      subjectName:    subject.subjectName,
      teacherId:      subject.teacherId   || '',
      teacherName:    subject.teacherName || '',
    }));
  };

  const filteredSuggestions = subjectSearch.trim()
    ? modalSubjects.filter(s => s.subjectName.toLowerCase().includes(subjectSearch.toLowerCase()))
    : modalSubjects;

  /* ── Ajouter un créneau ─────────────────────────────────── */
  const addSlot = async () => {
    if (!form.classSubjectId) { showToast('Veuillez sélectionner une matière.', 'error'); return; }
    if (form.end_time <= form.start_time) { showToast("L'heure de fin doit être après le début.", 'error'); return; }
    setSaving(true);
    try {
      const yearId = await getCurrentYearId();
      if (!yearId) throw new Error("Aucune année scolaire active trouvée.");

      const { error } = await supabase.from('schedule_slots').insert({
        class_subject_id: form.classSubjectId,
        day_of_week:      Number(form.day),
        start_time:       form.start_time + ':00',
        end_time:         form.end_time   + ':00',
        room:             form.room.trim() || null,
        academic_year_id: yearId,
      });
      if (error) throw error;

      // Notification au professeur
      if (form.teacherId) {
        await supabase.from('notifications').insert({
          recipient_id: form.teacherId,
          title:        'Emploi du temps mis à jour',
          content:      `Nouveau cours : ${form.subjectName} — ${DAYS[Number(form.day) - 1]} de ${form.start_time} à ${form.end_time}, Classe ${selectedClass.name}${form.room ? ` (${form.room})` : ''}.`,
          type:         'info',
          is_read:      false,
        });
      }

      const fresh = await fetchSlotsForClass(selectedClass.id);
      setSlots(fresh);
      setSlotCounts(prev => ({ ...prev, [selectedClass.id]: fresh.length }));
      setShowModal(false);
      showToast("Créneau ajouté ! Notification envoyée à l'enseignant.");
    } catch (err) {
      showToast('Erreur : ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  /* ── Supprimer un créneau ───────────────────────────────── */
  const deleteSlot = async (slotId) => {
    if (user?.isDemo) { showToast('Mode démo — désactivé.', 'info'); return; }
    const { error } = await supabase.from('schedule_slots').delete().eq('id', slotId);
    if (!error) {
      const fresh = slots.filter(s => s.id !== slotId);
      setSlots(fresh);
      if (selectedClass) setSlotCounts(prev => ({ ...prev, [selectedClass.id]: fresh.length }));
      showToast('Créneau supprimé.');
    }
  };

  const getSlot = (dayIdx, time) =>
    slots.find(s => s.day_of_week === dayIdx + 1 && fmtTime(s.start_time) === time);

  const Toast = () => toast ? (
    <div style={{
      position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
      background: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : 'var(--green)',
      color: '#fff', padding: '12px 20px', borderRadius: '10px',
      fontWeight: 600, fontSize: '13px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    }}>{toast.msg}</div>
  ) : null;

  /* ══ GRILLE EDT ════════════════════════════════════════════ */
  const renderGrid = (title, subtitle, showBack, showAdd, isPersonal) => (
    <section className="page-section active">
      <Toast />

      {/* ── Barre de titre ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {showBack && (
            <button onClick={() => { setView('list'); setSlots([]); setSelectedClass(null); }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 16px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-mid)', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.color = 'var(--green)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-mid)'; }}>
              <ArrowLeft size={15} /> Retour
            </button>
          )}
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: 'var(--text-dark)' }}>{title}</h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-light)' }}>{subtitle}</p>
          </div>
        </div>
        {showAdd && (
          <button className="btn-sm btn-green" onClick={openModal}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 18px', fontSize: '13px' }}>
            <Plus size={15} /> Ajouter un créneau
          </button>
        )}
      </div>

      {loadingSlots ? (
        <div style={{ padding: '80px', textAlign: 'center', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <Loader size={22} /> Chargement de l'emploi du temps…
        </div>
      ) : slots.length === 0 ? (
        /* ── État vide ── */
        <div style={{ background: 'var(--bg-card)', border: '2px dashed var(--border)', borderRadius: '16px', padding: '64px 32px', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CalendarDays size={36} color="var(--green)" />
          </div>
          <h3 style={{ color: 'var(--text-dark)', fontSize: '18px', fontWeight: 800, margin: '0 0 8px' }}>
            Aucun emploi du temps{selectedClass ? ` pour ${selectedClass.name}` : ''}
          </h3>
          <p style={{ color: 'var(--text-light)', fontSize: '14px', margin: '0 0 24px', lineHeight: 1.6 }}>
            {showAdd ? 'Commencez par ajouter le premier créneau de la semaine.' : "L'emploi du temps n'a pas encore été configuré par l'administration."}
          </p>
          {showAdd && (
            <button className="btn-sm btn-green" onClick={openModal}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', fontSize: '14px', borderRadius: '10px' }}>
              <Plus size={16} /> Créer l'emploi du temps
            </button>
          )}
        </div>
      ) : (
        /* ── Grille emploi du temps ── */
        <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>

          {/* En-tête des jours */}
          <div style={{ display: 'grid', gridTemplateColumns: '72px repeat(5, 1fr)', borderBottom: '2px solid var(--border)' }}>
            {/* Coin vide */}
            <div style={{ background: 'var(--bg)', borderRight: '1px solid var(--border)' }} />
            {DAYS.map((day, i) => (
              <div key={day} style={{
                padding: '14px 8px', textAlign: 'center',
                background: 'var(--bg)',
                borderRight: i < 4 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-dark)', fontFamily: "'Plus Jakarta Sans', sans-serif", textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                  {day}
                </div>
              </div>
            ))}
          </div>

          {/* Corps de la grille */}
          {TIME_ROWS.map((row, ri) => {
            if (row.isBreak) return (
              <div key={ri} style={{
                display: 'grid', gridTemplateColumns: '72px 1fr',
                background: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(0,0,0,0.015) 4px, rgba(0,0,0,0.015) 8px)',
                borderBottom: '1px solid var(--border)', minHeight: '32px',
              }}>
                <div style={{ borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.5px', textTransform: 'uppercase', transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>
                    {row.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600, opacity: 0.6 }}>— {row.label} —</span>
                </div>
              </div>
            );

            return (
              <div key={ri} style={{
                display: 'grid', gridTemplateColumns: '72px repeat(5, 1fr)',
                borderBottom: ri < TIME_ROWS.length - 1 ? '1px solid var(--border)' : 'none',
                minHeight: '84px',
              }}>
                {/* Heure */}
                <div style={{
                  borderRight: '1px solid var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '8px 4px', background: 'var(--bg)',
                  gap: '2px',
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--navy-mid)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                    {row.time}
                  </span>
                  <div style={{ width: '20px', height: '2px', borderRadius: '2px', background: 'var(--green)', opacity: 0.4 }} />
                </div>

                {/* Cellules jours */}
                {DAYS.map((_, di) => {
                  const slot = getSlot(di, row.time);
                  return (
                    <div key={di} style={{
                      borderRight: di < 4 ? '1px solid var(--border)' : 'none',
                      padding: '6px',
                      background: slot ? 'transparent' : 'transparent',
                      transition: 'background 0.15s',
                      position: 'relative',
                    }}
                      onMouseEnter={e => { if (!slot) e.currentTarget.style.background = 'rgba(0,168,107,0.03)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      {slot ? (
                        <div className={`sg-slot ${slot.color || autoColor(slot.subject_name)}`}
                          style={{ height: '100%', minHeight: '72px', position: 'relative', borderRadius: '10px' }}>
                          <strong style={{ fontSize: '12px', fontWeight: 800, lineHeight: 1.3 }}>
                            {slot.subject_name}
                          </strong>
                          {isPersonal && slot.classes?.name && (
                            <span style={{ fontSize: '11px', fontWeight: 700, opacity: 0.85 }}>
                              {slot.classes.name}
                            </span>
                          )}
                          {slot.teacher_name && !isPersonal && (
                            <span style={{ fontSize: '11px', opacity: 0.75 }}>
                              👤 {slot.teacher_name}
                            </span>
                          )}
                          {slot.room && (
                            <span style={{ fontSize: '10px', opacity: 0.6 }}>
                              📍 {slot.room}
                            </span>
                          )}
                          {isAdmin && !user?.isDemo && (
                            <button
                              onClick={e => { e.stopPropagation(); deleteSlot(slot.id); }}
                              title="Supprimer ce créneau"
                              style={{
                                position: 'absolute', top: '5px', right: '5px',
                                width: '20px', height: '20px',
                                background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
                                borderRadius: '6px', cursor: 'pointer', color: '#ef4444',
                                fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                padding: 0, lineHeight: 1, transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.3)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; }}
                            >×</button>
                          )}
                        </div>
                      ) : (
                        showAdd && (
                          <button onClick={openModal}
                            style={{
                              width: '100%', height: '100%', minHeight: '72px',
                              border: '1.5px dashed transparent', borderRadius: '10px',
                              background: 'transparent', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'var(--border)', fontSize: '18px', transition: 'all 0.2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green)'; e.currentTarget.style.color = 'var(--green)'; e.currentTarget.style.background = 'rgba(0,168,107,0.04)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.color = 'var(--border)'; e.currentTarget.style.background = 'transparent'; }}
                          >+</button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Légende des couleurs ── */}
      {slots.length > 0 && (
        <div style={{ marginTop: '16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Matières :</span>
          {[
            { key: 'math', label: 'Maths',     bg: '#BFDBFE', color: '#1E40AF' },
            { key: 'fr',   label: 'Français',  bg: '#FECACA', color: '#991B1B' },
            { key: 'hist', label: 'Hist-Géo',  bg: '#FDE68A', color: '#92400E' },
            { key: 'pc',   label: 'Physique',  bg: '#E9D5FF', color: '#5B21B6' },
            { key: 'svt',  label: 'SVT',       bg: '#A7F3D0', color: '#065F46' },
            { key: 'eng',  label: 'Langues',   bg: '#FED7AA', color: '#9A3412' },
            { key: 'sport',label: 'EPS',       bg: '#A7F3D0', color: '#047857' },
          ].map(l => (
            <div key={l.key} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 9px', borderRadius: '20px', background: l.bg, fontSize: '11px', fontWeight: 700, color: l.color }}>
              {l.label}
            </div>
          ))}
        </div>
      )}

      {/* ── Modal ajout créneau ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(6,17,42,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: '20px', padding: '28px',
            width: '100%', maxWidth: '480px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
            border: '1px solid var(--border)',
            animation: 'fade-up 0.3s ease',
          }}>
            {/* En-tête modal */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '24px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--green-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <CalendarDays size={22} color="var(--green)" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: 'var(--text-dark)' }}>
                  Nouveau créneau
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-light)' }}>{selectedClass?.name}</p>
              </div>
              <button onClick={() => setShowModal(false)}
                style={{ marginLeft: 'auto', width: '32px', height: '32px', borderRadius: '8px', border: '1.5px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '18px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ×
              </button>
            </div>

            {loadingModal ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Loader size={18} /> Chargement des matières…
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Jour */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '7px' }}>Jour</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {DAYS.map((d, i) => (
                      <button key={i} onClick={() => setForm(f => ({ ...f, day: i + 1 }))}
                        style={{
                          padding: '7px 14px', borderRadius: '8px', border: '1.5px solid',
                          borderColor: Number(form.day) === i + 1 ? 'var(--green)' : 'var(--border)',
                          background: Number(form.day) === i + 1 ? 'var(--green-pale)' : 'var(--bg)',
                          color: Number(form.day) === i + 1 ? 'var(--green)' : 'var(--text-mid)',
                          fontWeight: 700, fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s',
                        }}>
                        {d.slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Horaires */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  {[['Début', 'start_time'], ['Fin', 'end_time']].map(([label, key]) => (
                    <div key={key}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '7px' }}>{label}</label>
                      <select value={form[key]}
                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '9px', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dark)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', outline: 'none' }}>
                        {(key === 'end_time' ? TIME_OPTIONS.filter(t => t > form.start_time) : TIME_OPTIONS)
                          .map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Matière */}
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '7px' }}>
                    Matière *{form.classSubjectId && <span style={{ marginLeft: '8px', color: 'var(--green)', textTransform: 'none', letterSpacing: 0 }}>✓ sélectionnée</span>}
                  </label>
                  {modalSubjects.length === 0 ? (
                    <div style={{ padding: '12px 14px', borderRadius: '9px', background: 'var(--amber-pale)', border: '1px solid #FDE68A', fontSize: '13px', color: '#92400E' }}>
                      Aucune matière assignée à cette classe.
                    </div>
                  ) : (
                    <>
                      <input type="text" placeholder="Rechercher une matière…"
                        value={subjectSearch}
                        onChange={e => { setSubjectSearch(e.target.value); setShowSuggestions(true); if (form.classSubjectId) setForm(f => ({ ...f, classSubjectId: '', subjectName: '', teacherId: '', teacherName: '' })); }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        style={{ width: '100%', padding: '10px 14px', borderRadius: '9px', border: `1.5px solid ${form.classSubjectId ? 'var(--green)' : 'var(--border)'}`, background: form.classSubjectId ? 'var(--green-pale)' : 'var(--bg)', color: 'var(--text-dark)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                        autoComplete="off"
                      />
                      {showSuggestions && filteredSuggestions.length > 0 && (
                        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--bg-card)', border: '1.5px solid var(--border)', borderRadius: '12px', zIndex: 100, boxShadow: 'var(--shadow-lg)', maxHeight: '200px', overflowY: 'auto' }}>
                          {filteredSuggestions.map(s => (
                            <div key={s.classSubjectId} onMouseDown={() => handleSubjectSelect(s)}
                              style={{ padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.15s' }}
                              onMouseEnter={e => e.currentTarget.style.background = 'var(--green-pale)'}
                              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-dark)' }}>{s.subjectName}</span>
                              {s.teacherName && s.teacherName !== '—' && (
                                <span style={{ fontSize: '11px', color: 'var(--text-light)' }}>{s.teacherName}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Enseignant */}
                {form.teacherName && (
                  <div style={{ padding: '11px 14px', borderRadius: '9px', background: 'var(--green-pale)', border: '1.5px solid rgba(0,168,107,0.3)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                      {form.teacherName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--green)', fontWeight: 700 }}>{form.teacherName}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>Enseignant assigné à cette matière</div>
                    </div>
                  </div>
                )}

                {/* Salle */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '7px' }}>Salle / Lieu</label>
                  <input type="text" placeholder="Ex : Salle 12, Labo A, Terrain de sport"
                    value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '9px', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dark)', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {form.teacherId && (
                  <div style={{ padding: '10px 14px', borderRadius: '9px', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)', fontSize: '12px', color: 'var(--text-mid)' }}>
                    📨 Une notification sera envoyée à <strong style={{ color: 'var(--blue-accent)' }}>{form.teacherName}</strong> après enregistrement.
                  </div>
                )}
              </div>
            )}

            {!loadingModal && (
              <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
                <button onClick={() => setShowModal(false)}
                  style={{ flex: 1, padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--text-mid)', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
                  Annuler
                </button>
                <button onClick={addSlot} disabled={saving || !form.classSubjectId}
                  style={{ flex: 2, padding: '12px', borderRadius: '10px', border: 'none', background: saving || !form.classSubjectId ? 'var(--border)' : 'var(--green)', color: saving || !form.classSubjectId ? 'var(--text-light)' : '#fff', cursor: saving || !form.classSubjectId ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', transition: 'background 0.2s' }}>
                  {saving ? <><Loader size={15} /> Enregistrement…</> : <><Plus size={15} /> Ajouter le créneau</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );

  /* ══ ROUTING VUES ══════════════════════════════════════════ */
  if (view === 'timetable') return renderGrid(`Emploi du Temps — ${selectedClass?.name}`, `${selectedClass?.level || ''} · ${slots.length} créneau${slots.length !== 1 ? 'x' : ''}`, isAdmin || isCounselor, isAdmin, false);
  if (view === 'personal')  return renderGrid('Mon Emploi du Temps', `${slots.length} créneau${slots.length !== 1 ? 'x' : ''} cette semaine`, false, false, true);

  /* ══ LISTE DES CLASSES ════════════════════════════════════ */
  return (
    <section className="page-section active">
      <Toast />
      <div className="page-top-bar">
        <div>
          <h3>Emplois du Temps</h3>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-light)' }}>Sélectionnez une classe</p>
        </div>
      </div>

      {loadingClasses ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Loader size={20} /> Chargement des classes…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginTop: '8px' }}>
          {classes.map(cls => {
            const count = slotCounts[cls.id] || 0;
            const has   = count > 0;
            return (
              <div key={cls.id} onClick={() => openClass(cls)}
                style={{ background: 'var(--card-bg, #1e293b)', border: `1.5px solid ${has ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.06)'}`, borderRadius: '14px', padding: '20px', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.2s', display: 'flex', flexDirection: 'column', gap: '12px' }}
                onMouseEnter={e => { e.currentTarget.style.transform='translateY(-3px)'; e.currentTarget.style.boxShadow='0 10px 28px rgba(0,0,0,0.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform='translateY(0)'; e.currentTarget.style.boxShadow='none'; }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0, background: has ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CalendarDays size={20} color={has ? 'var(--green)' : 'var(--text-light)'} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-dark, #f1f5f9)' }}>{cls.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{cls.level || '—'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: has ? 600 : 400, color: has ? 'var(--green)' : 'var(--text-light)', background: has ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: has ? 'var(--green)' : 'rgba(255,255,255,0.2)', display: 'inline-block' }} />
                  {has ? `${count} créneau${count !== 1 ? 'x' : ''} défini${count !== 1 ? 's' : ''}` : (isAdmin ? 'Cliquer pour créer' : 'Pas encore créé')}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default Schedule;

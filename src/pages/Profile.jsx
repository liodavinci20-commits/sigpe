import React, { useState, useEffect, useCallback } from 'react';
import {
  BadgeCheck, Trophy, Eye, School, Hash, Calendar,
  MapPin, User, Users, ClipboardList, Megaphone, FileText,
  TrendingUp, Bell, Loader, Search, BookOpen, X, Download
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

// ── DONNÉES DÉMO ──────────────────────────────────────────────
const MOCK = {
  profile: {
    name: 'Ngo Balla Marie-Claire Épiphanie',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80',
    className: '2nde B · Sciences', matricule: 'ENS-2024-0834',
    dob: '14/03/2009', city: 'Yaoundé, Centre', gender: 'Féminin',
    parentPhone: '+237 699 234 567', guardianType: 'Père',
  },
  stats: { avg: 14.8, absences: 3, rank: '7ème' },
  sequence: 'Séquence 2',
  grades: [
    { sub: 'Mathématiques',  coeff: 4, note: 16.0, prev: 13.5, rang: '3/42' },
    { sub: 'Physique-Chimie',coeff: 3, note: 15.5, prev: 14.0, rang: '4/42' },
    { sub: 'SVT',            coeff: 3, note: 17.0, prev: 16.0, rang: '2/42' },
    { sub: 'Français',       coeff: 4, note: 13.5, prev: 12.0, rang: '12/42' },
  ],
  attendance: { presencePct: 98, presentPct: 97.8, excusedPct: 1.5, absentPct: 0.7, absenceCount: 3 },
  chartData: [{ label: 'Séq. 1', avg: 10.5 }, { label: 'Séq. 2', avg: 12.3 }, { label: 'Séq. 3', avg: 14.81 }],
  notifications: [
    { id: 1, type: 'info',    title: 'Bulletin du 1er Trimestre disponible', body: 'Votre bulletin scolaire est disponible.', time: "Aujourd'hui, 09h14", unread: true },
    { id: 2, type: 'warning', title: 'Rattrapage Physique-Chimie', body: 'Séance programmée le vendredi à 14h.', time: 'Hier, 16h42', unread: true },
  ],
};

// ── HELPERS ───────────────────────────────────────────────────
// Calcule la moyenne générale pondérée depuis { [subName]: { coeff, note } }
const weightedAvgFromSubjects = (subjectsMap) => {
  let pts = 0, totalCoeff = 0;
  Object.values(subjectsMap || {}).forEach(s => {
    if (s.note === null) return;
    pts += s.note * (s.coeff ?? 1);
    totalCoeff += (s.coeff ?? 1);
  });
  return totalCoeff > 0 ? pts / totalCoeff : null;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};
const fmtTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};
const toY = (avg) => 110 - (avg / 20) * 100;
const initials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

// ── COMPOSANT ─────────────────────────────────────────────────
const Profile = () => {
  const { user } = useAuth();
  const isAdmin = (user?.role === 'admin' || user?.role === 'sub_admin' || user?.role === 'counselor') && !user?.isDemo;

  const [allStudents,  setAllStudents]  = useState([]);
  const [search,       setSearch]       = useState('');
  const [selectedId,   setSelectedId]   = useState(null);
  const [loadingList,  setLoadingList]  = useState(false);
  const [data,         setData]         = useState(null);
  const [loading,      setLoading]      = useState(true);

  // état modale exercices
  const [exModal,   setExModal]   = useState(false);
  const [exercises, setExercises] = useState([]);
  const [loadingEx, setLoadingEx] = useState(false);

  // Chargement initial
  useEffect(() => {
    if (!user) return;
    if (user.isDemo)  { setData(MOCK); setLoading(false); return; }
    if (isAdmin)      { loadStudentList(); }
    else              { loadProfile(user.id); }
  }, [user]);

  // Recharge le profil quand l'admin sélectionne un élève
  useEffect(() => {
    if (selectedId && isAdmin) loadProfile(selectedId);
  }, [selectedId]);

  /* ── Liste légère des élèves (bulles) ─────────────────────── */
  const loadStudentList = async () => {
    setLoadingList(true);
    const { data: rows } = await supabase
      .from('students')
      .select('id, matricule, profiles(full_name, avatar_url), classes(name)')
      .order('profiles(full_name)');
    const list = rows || [];
    setAllStudents(list);
    if (list.length) setSelectedId(list[0].id);
    else setLoading(false);
    setLoadingList(false);
  };

  /* ── Profil complet d'un élève ────────────────────────────── */
  const loadProfile = async (studentId) => {
    setLoading(true);
    setData(null);
    try {
      // Bug fix #3 : parent_phone et guardian_type n'existent pas dans students
      // Ces données sont dans student_parents — on les retire du select
      const { data: studentRow } = await supabase
        .from('students')
        .select(`
          matricule, date_of_birth, gender, city,
          profiles ( full_name, avatar_url ),
          classes  ( name, level )
        `)
        .eq('id', studentId)
        .single();

      const { data: allGrades } = await supabase
        .from('grades')
        .select(`
          note,
          class_subjects ( coefficient, subjects ( name ) ),
          sequences      ( id, label, number, is_active )
        `)
        .eq('student_id', studentId)
        .order('sequences(number)');

      const { data: attendanceRows } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', studentId);

      const { data: notifRows } = await supabase
        .from('notifications')
        .select('*')
        .or(`recipient_id.eq.${studentId},target_group.eq.all,target_group.eq.students`)
        .order('created_at', { ascending: false })
        .limit(5);

      // Grouper par (seqNumber, subjectName) — 1 note par combinaison
      const seqSubMap = {};
      (allGrades || []).forEach(g => {
        const num     = g.sequences?.number;
        const subName = g.class_subjects?.subjects?.name;
        const coeff   = g.class_subjects?.coefficient ?? 1;
        if (num == null || !subName) return;
        if (!seqSubMap[num]) seqSubMap[num] = { label: g.sequences.label, isActive: g.sequences.is_active, subjects: {} };
        seqSubMap[num].subjects[subName] = { coeff, note: g.note };
      });

      const chartData = Object.entries(seqSubMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, s]) => ({ label: s.label, avg: weightedAvgFromSubjects(s.subjects) }))
        .filter(s => s.avg !== null);

      const activeSeqNum = Object.entries(seqSubMap).find(([, s]) => s.isActive)?.[0]
        || String(Math.max(...Object.keys(seqSubMap).map(Number), 0));

      const activeSeqData  = seqSubMap[activeSeqNum];
      const prevSeqData    = seqSubMap[String(Number(activeSeqNum) - 1)];
      const activeSeqLabel = activeSeqData?.label || '—';

      const gradesTable = Object.entries(activeSeqData?.subjects || {}).map(([subName, s]) => {
        const prev = prevSeqData?.subjects?.[subName]?.note ?? null;
        return { sub: subName, coeff: s.coeff, note: s.note, prev, rang: '—' };
      }).filter(g => g.note !== null);

      const avg = weightedAvgFromSubjects(activeSeqData?.subjects || {});
      const total  = attendanceRows?.length || 0;
      const pN     = attendanceRows?.filter(a => a.status === 'present').length || 0;
      const eN     = attendanceRows?.filter(a => a.status === 'excused').length || 0;
      const aN     = attendanceRows?.filter(a => a.status === 'absent' || a.status === 'late').length || 0;

      setData({
        profile: {
          name:         studentRow?.profiles?.full_name || '—',
          avatar:       studentRow?.profiles?.avatar_url || null,
          className:    studentRow?.classes ? `${studentRow.classes.name} · ${studentRow.classes.level}` : 'Classe non assignée',
          matricule:    studentRow?.matricule || '—',
          dob:          fmtDate(studentRow?.date_of_birth),
          city:         studentRow?.city || '—',
          gender:       studentRow?.gender === 'F' ? 'Féminin' : studentRow?.gender === 'M' ? 'Masculin' : '—',
          parentPhone:  '—',
          guardianType: '—',
        },
        stats: { avg: avg !== null ? avg.toFixed(2) : '—', absences: aN, rank: '—' },
        sequence: activeSeqLabel,
        grades: gradesTable,
        attendance: {
          presencePct: total > 0 ? Math.round(((pN + eN) / total) * 100) : 0,
          presentPct:  total > 0 ? +((pN / total) * 100).toFixed(1) : 0,
          excusedPct:  total > 0 ? +((eN / total) * 100).toFixed(1) : 0,
          absentPct:   total > 0 ? +((aN / total) * 100).toFixed(1) : 0,
          absenceCount: aN,
        },
        chartData,
        notifications: (notifRows || []).map(n => ({
          id: n.id, type: n.type || 'info', title: n.title,
          body: n.content, time: fmtTime(n.created_at), unread: !n.is_read,
        })),
      });
    } catch (err) {
      console.error('Erreur profil:', err);
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  };

  /* ── Exercices assignés à un élève ─────────────────────── */
  const loadExercises = async (studentId) => {
    if (!studentId) return;
    setExModal(true);
    setLoadingEx(true);
    try {
      const { data: groups, error } = await supabase
        .from('performance_groups')
        .select('id, teacher_id, class_subject_id, classes(name), class_subjects(subjects(name)), sequences(label)')
        .contains('student_ids', [studentId]);

      if (error) throw error;

      // noms des enseignants
      const teacherIds = [...new Set((groups || []).map(g => g.teacher_id).filter(Boolean))];
      let teacherMap = {};
      if (teacherIds.length) {
        const { data: tRows } = await supabase.from('profiles').select('id, full_name').in('id', teacherIds);
        (tRows || []).forEach(t => { teacherMap[t.id] = t.full_name; });
      }

      if (!groups?.length) { setExercises([]); return; }

      const groupIds = groups.map(g => g.id);
      const { data: exRows } = await supabase
        .from('group_exercises')
        .select('id, title, description, due_date, created_at, performance_group_id')
        .in('performance_group_id', groupIds)
        .order('created_at', { ascending: false });

      const groupMap = {};
      groups.forEach(g => { groupMap[g.id] = g; });

      setExercises((exRows || []).map(ex => {
        const g = groupMap[ex.performance_group_id];
        return {
          id:          ex.id,
          title:       ex.title,
          description: ex.description,
          dueDate:     ex.due_date,
          createdAt:   ex.created_at,
          subjectName: g?.class_subjects?.subjects?.name || '—',
          className:   g?.classes?.name || '—',
          seqLabel:    g?.sequences?.label || '—',
          teacherName: teacherMap[g?.teacher_id] || '—',
        };
      }));
    } catch (err) {
      console.error('Erreur exercices:', err);
      setExercises([]);
    } finally {
      setLoadingEx(false);
    }
  };

  /* ── Filtrage bulles ─────────────────────────────────────── */
  const filteredStudents = allStudents.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.profiles?.full_name?.toLowerCase() || '').includes(q)
        || (s.matricule?.toLowerCase() || '').includes(q)
        || (s.classes?.name?.toLowerCase() || '').includes(q);
  });

  /* ── Render profil ───────────────────────────────────────── */
  const renderProfile = () => {
    if (!data) return null;
    const { profile, stats, sequence, grades, attendance, chartData, notifications } = data;
    const chartPoints = chartData.length > 0
      ? chartData.map((s, i) => ({
          x: chartData.length === 1 ? 150 : 70 + (i / (chartData.length - 1)) * 160,
          y: toY(s.avg), label: s.label, avg: s.avg,
        }))
      : [];
    const circumference = 2 * Math.PI * 38;
    const donutDash = `${(attendance.presencePct / 100) * circumference} ${circumference}`;
    const notifIcon = (type) => {
      if (type === 'warning') return { icon: <Calendar size={18} color="var(--amber)" />, bg: 'rgba(251,191,36,0.12)' };
      if (type === 'urgent')  return { icon: <Megaphone size={18} color="var(--red)" />,  bg: 'rgba(239,68,68,0.12)' };
      return { icon: <ClipboardList size={18} color="var(--green)" />, bg: 'rgba(34,197,94,0.12)' };
    };

    return (
      <>
        {/* ── En-tête profil ── */}
        <div className="profile-header">
          <div className="profile-ava-wrap">
            {profile.avatar ? (
              <img className="profile-ava" src={profile.avatar} alt="Élève"
                onError={e => { e.target.style.display = 'none'; }} />
            ) : (
              <div className="profile-ava" style={{
                background: 'linear-gradient(135deg,var(--green),#0891b2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 900, fontSize: '28px'
              }}>
                {initials(profile.name)}
              </div>
            )}
            <div className="profile-status-dot" />
          </div>

          <div className="profile-main-info">
            <h2>{profile.name}</h2>
            <div className="profile-meta">
              <div className="profile-meta-item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><School size={14} /> {profile.className}</div>
              <div className="profile-meta-item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Hash size={14} /> Mat. {profile.matricule}</div>
              <div className="profile-meta-item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={14} /> Né(e) le {profile.dob}</div>
              <div className="profile-meta-item" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={14} /> {profile.city}</div>
            </div>
            <div className="profile-badges">
              <span className="profile-badge pbadge-green" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><BadgeCheck size={14} /> Actif</span>
              {stats.avg !== '—' && Number(stats.avg) >= 14 && (
                <span className="profile-badge pbadge-blue" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Trophy size={14} /> Mention TB</span>
              )}
            </div>
          </div>

          <div className="profile-quick-stats">
            <div className="pqs-item">
              <div className="pqs-val" style={{ color: 'var(--green)' }}>{stats.avg}</div>
              <div className="pqs-label">Moy. Générale</div>
            </div>
            <div className="pqs-item">
              <div className="pqs-val" style={{ color: 'var(--amber)' }}>{stats.absences}</div>
              <div className="pqs-label">Absences</div>
            </div>
            <div className="pqs-item">
              <div className="pqs-val" style={{ color: 'var(--blue-accent)' }}>{stats.rank}</div>
              <div className="pqs-label">Rang</div>
            </div>
          </div>
        </div>

        <div className="profile-grid">

          {/* ── Colonne gauche ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card">
              <div className="card-body">
                <div className="info-block">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={16} /> Informations Personnelles</h4>
                  <div className="info-row"><span className="info-key">Nom complet</span>      <span className="info-val">{profile.name}</span></div>
                  <div className="info-row"><span className="info-key">Date de naissance</span> <span className="info-val">{profile.dob}</span></div>
                  <div className="info-row"><span className="info-key">Sexe</span>              <span className="info-val">{profile.gender}</span></div>
                  {profile.city !== '—' && (
                    <div className="info-row"><span className="info-key">Ville</span>           <span className="info-val">{profile.city}</span></div>
                  )}
                </div>
                <div className="divider" />
                <div className="info-block">
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Users size={16} /> Informations Familiales</h4>
                  <div className="info-row"><span className="info-key">Tél. parent</span>  <span className="info-val">{profile.parentPhone}</span></div>
                  <div className="info-row"><span className="info-key">Tuteur légal</span> <span className="info-val" style={{ textTransform: 'capitalize' }}>{profile.guardianType}</span></div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Bell size={18} /> Notifications Récentes</h3>
                  <p>Messages de l'établissement</p>
                </div>
                {notifications.filter(n => n.unread).length > 0 && (
                  <span className="nav-badge green" style={{ fontSize: '11px' }}>
                    {notifications.filter(n => n.unread).length} nouvelle{notifications.filter(n => n.unread).length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="card-body" style={{ paddingTop: '8px' }}>
                {notifications.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)', fontSize: '13px' }}>
                    Aucune notification pour le moment.
                  </div>
                ) : notifications.map(n => {
                  const { icon, bg } = notifIcon(n.type);
                  const isExercise = n.title?.startsWith('📚');
                  const studentId  = isAdmin ? selectedId : user?.id;
                  return (
                    <div
                      key={n.id}
                      className="notif-item"
                      onClick={isExercise ? () => loadExercises(studentId) : undefined}
                      style={isExercise ? { cursor: 'pointer', transition: 'background 0.15s' } : {}}
                      onMouseEnter={isExercise ? e => e.currentTarget.style.background = 'rgba(34,197,94,0.06)' : undefined}
                      onMouseLeave={isExercise ? e => e.currentTarget.style.background = 'transparent' : undefined}
                    >
                      <div className="notif-icon-wrap" style={{ background: isExercise ? 'rgba(34,197,94,0.12)' : bg }}>
                        {isExercise ? <BookOpen size={18} color="var(--green)" /> : icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <h5>{n.title}</h5>
                        <p>{n.body}</p>
                        <time>{n.time}</time>
                      </div>
                      {isExercise && (
                        <span style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          Voir →
                        </span>
                      )}
                      {n.unread && <div className="unread-dot" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Colonne droite ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={18} /> Notes par Matière — {sequence}
                  </h3>
                </div>
                <button className="btn-sm btn-green" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Eye size={16} /> Bulletin
                </button>
              </div>
              {grades.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px' }}>
                  Aucune note saisie pour cette séquence.
                </div>
              ) : (
                <div style={{ overflow: 'hidden', borderRadius: '0 0 14px 14px' }}>
                  <table className="notes-table">
                    <thead>
                      <tr><th>Matière</th><th>Coeff</th><th>Note /20</th><th>Progression</th><th>Rang</th></tr>
                    </thead>
                    <tbody>
                      {grades.map((n, i) => {
                        const diff = n.prev !== null ? (n.note - n.prev).toFixed(1) : null;
                        const isPos = diff !== null && Number(diff) > 0;
                        const pct = Math.round((n.note / 20) * 100);
                        const nc  = n.note >= 14 ? 'note-high' : n.note >= 10 ? 'note-mid' : 'note-low';
                        return (
                          <tr key={i}>
                            <td><strong>{n.sub}</strong></td>
                            <td style={{ color: 'var(--text-light)' }}>×{n.coeff}</td>
                            <td><span className={`note-badge ${nc}`} style={{ display: 'inline-flex' }}>{Number(n.note).toFixed(1)}</span></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div className="prog-mini">
                                  <div className="prog-mini-fill" style={{ width: `${pct}%`, background: n.note >= 14 ? 'var(--green)' : 'var(--amber)' }} />
                                </div>
                                {diff !== null && (
                                  <span style={{ fontSize: '11px', color: isPos ? 'var(--green)' : 'var(--red)' }}>
                                    {isPos ? '↑' : '↓'} {Math.abs(diff)}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--text-light)' }}>{n.rang}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {/* Présences */}
              <div className="card">
                <div className="card-header">
                  <div><h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={18} /> Suivi des Présences</h3></div>
                </div>
                <div className="card-body">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px' }}>
                    <div className="donut-wrap" style={{ width: '100px', height: '100px' }}>
                      <svg viewBox="0 0 100 100" width="100" height="100">
                        <circle cx="50" cy="50" r="38" fill="none" stroke="#E5E7EB" strokeWidth="10" />
                        <circle cx="50" cy="50" r="38" fill="none" stroke="var(--green)" strokeWidth="10"
                          strokeDasharray={donutDash} strokeLinecap="round" />
                      </svg>
                      <div className="donut-label">
                        <span style={{ fontSize: '18px' }}>{attendance.presencePct}%</span>
                        <small>Présence</small>
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      {[
                        { label: '◉ Présent', pct: attendance.presentPct, color: 'var(--green)' },
                        { label: '◉ Just.',   pct: attendance.excusedPct, color: 'var(--amber)' },
                        { label: '◉ Abs.',    pct: attendance.absentPct,  color: 'var(--red)'   },
                      ].map(row => (
                        <div key={row.label} className="perf-row" style={{ marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>{row.label}</span>
                          <div className="prog-bar-wrap">
                            <div className="prog-bar" style={{ width: `${row.pct}%`, background: row.color }} />
                          </div>
                          <strong style={{ fontSize: '12px', color: 'var(--text-dark)' }}>{row.pct}%</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Graphique progression */}
              <div className="card">
                <div className="card-header">
                  <div><h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={18} /> Progression</h3></div>
                </div>
                <div className="card-body">
                  {chartPoints.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-light)', fontSize: '13px' }}>
                      Pas encore de données.
                    </div>
                  ) : (
                    <svg viewBox="0 0 300 140" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '140px' }}>
                      <defs>
                        <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"   stopColor="rgba(0,168,107,0.3)" />
                          <stop offset="100%" stopColor="rgba(0,168,107,0)"   />
                        </linearGradient>
                      </defs>
                      <line x1="30" y1="10"  x2="30"  y2="110" stroke="#E5E7EB" strokeWidth="1" />
                      <line x1="30" y1="110" x2="290" y2="110" stroke="#E5E7EB" strokeWidth="1" />
                      <text x="20" y="113" fontSize="8" fill="#9CA3AF" textAnchor="end">0</text>
                      <text x="20" y="73"  fontSize="8" fill="#9CA3AF" textAnchor="end">10</text>
                      <text x="20" y="33"  fontSize="8" fill="#9CA3AF" textAnchor="end">20</text>
                      <line x1="30" y1="70" x2="290" y2="70" stroke="#F3F4F6" strokeDasharray="4" strokeWidth="1" />
                      {chartPoints.length > 1 && (
                        <>
                          <polygon fill="url(#pGrad)"
                            points={`${chartPoints.map(p => `${p.x},${p.y}`).join(' ')} ${chartPoints[chartPoints.length-1].x},110 ${chartPoints[0].x},110`}
                            opacity="0.5" />
                          <polyline fill="none" stroke="var(--green)" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round"
                            points={chartPoints.map(p => `${p.x},${p.y}`).join(' ')} />
                        </>
                      )}
                      {chartPoints.map((p, i) => (
                        <g key={i}>
                          <circle cx={p.x} cy={p.y} r="5"
                            fill={i === chartPoints.length - 1 ? 'var(--green)' : '#fff'}
                            stroke="var(--green)" strokeWidth="2" />
                          <text x={p.x} y="130" fontSize="9" fill="#9CA3AF" textAnchor="middle">{p.label}</text>
                          <text x={p.x} y={p.y - 8} fontSize="9"
                            fill={i === chartPoints.length - 1 ? 'var(--green)' : 'var(--text-mid)'}
                            textAnchor="middle" fontWeight={i === chartPoints.length - 1 ? 'bold' : 'normal'}>
                            {Number(p.avg).toFixed(2)}
                          </text>
                        </g>
                      ))}
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  /* ── Rendu principal ────────────────────────────────────────── */
  return (
    <section id="page-profile" className="page-section active">

      {/* ── Sélecteur élève (admin / counselor) ── */}
      {isAdmin && (
        <div style={{ marginBottom: '24px' }}>
          {/* Barre de recherche */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div className="search-bar" style={{ flex: 1, maxWidth: '380px' }}>
              <span><Search size={16} /></span>
              <input
                type="text"
                placeholder="Rechercher un élève, classe…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
              {filteredStudents.length} élève{filteredStudents.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Rangée de bulles style Messenger */}
          {loadingList ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-light)', padding: '8px 0', fontSize: '13px' }}>
              <Loader size={16} /> Chargement des élèves…
            </div>
          ) : allStudents.length === 0 ? (
            <div style={{ color: 'var(--text-light)', fontSize: '13px', padding: '8px 0' }}>
              Aucun élève inscrit pour l'instant.
            </div>
          ) : (
            <div style={{
              display: 'flex', gap: '16px',
              overflowX: 'auto', paddingBottom: '12px',
              scrollbarWidth: 'thin',
            }}>
              {filteredStudents.length === 0 ? (
                <span style={{ color: 'var(--text-light)', fontSize: '13px', padding: '8px 0' }}>
                  Aucun résultat pour « {search} »
                </span>
              ) : filteredStudents.map(s => {
                const isSelected = selectedId === s.id;
                const name = s.profiles?.full_name || s.matricule || '?';
                const firstName = name.split(' ').slice(-1)[0]; // dernier mot = prénom souvent
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedId(s.id)}
                    title={name}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                      cursor: 'pointer', minWidth: '60px', maxWidth: '68px',
                      transition: 'transform 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    {/* Bulle avatar */}
                    <div style={{
                      width: '52px', height: '52px',
                      borderRadius: '50%',
                      border: `3px solid ${isSelected ? 'var(--green)' : 'transparent'}`,
                      padding: '2px',
                      boxSizing: 'border-box',
                      background: isSelected ? 'rgba(34,197,94,0.1)' : 'transparent',
                      transition: 'border-color 0.2s, background 0.2s',
                      flexShrink: 0,
                    }}>
                      {s.profiles?.avatar_url ? (
                        <img src={s.profiles.avatar_url} alt={name}
                          style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{
                          width: '100%', height: '100%', borderRadius: '50%',
                          background: isSelected
                            ? 'linear-gradient(135deg, var(--green), #0891b2)'
                            : 'rgba(255,255,255,0.06)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: isSelected ? '#fff' : 'var(--text-light)',
                          fontWeight: 700, fontSize: '13px',
                          transition: 'background 0.2s, color 0.2s',
                        }}>
                          {initials(name)}
                        </div>
                      )}
                    </div>

                    {/* Prénom */}
                    <span style={{
                      fontSize: '11px', fontWeight: isSelected ? 700 : 400,
                      color: isSelected ? 'var(--green)' : 'var(--text-light)',
                      textAlign: 'center', lineHeight: 1.3,
                      width: '100%', overflow: 'hidden',
                      textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      transition: 'color 0.2s',
                    }}>
                      {firstName}
                    </span>

                    {/* Classe */}
                    {s.classes?.name && (
                      <span style={{
                        fontSize: '9px', color: 'var(--text-light)', opacity: 0.6,
                        textAlign: 'center', whiteSpace: 'nowrap',
                      }}>
                        {s.classes.name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Séparateur */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '8px' }} />
        </div>
      )}

      {/* ── Contenu profil ── */}
      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Loader size={20} /> Chargement du profil…
        </div>
      ) : !data ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)', fontSize: '14px' }}>
          Sélectionnez un élève pour afficher son profil.
        </div>
      ) : (
        renderProfile()
      )}

      {/* ── Styles impression PDF ── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #print-exercise-sheet { display: block !important; }
        }
      `}</style>

      {/* Zone invisible pour l'impression */}
      <div id="print-exercise-sheet" style={{ display: 'none' }} />

      {/* ── Modale Mes Exercices ── */}
      {exModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div className="card" style={{ width: '100%', maxWidth: '580px', margin: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>

            <div className="card-header" style={{ justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <BookOpen size={20} color="var(--green)" />
                <div>
                  <h3 style={{ margin: 0 }}>Mes Exercices</h3>
                  <p style={{ margin: 0, fontSize: '12px' }}>Exercices assignés suite aux signalements</p>
                </div>
              </div>
              <button onClick={() => setExModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
              {loadingEx ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <Loader size={20} /> Chargement…
                </div>
              ) : exercises.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-light)', fontSize: '14px' }}>
                  Aucun exercice assigné pour le moment.
                </div>
              ) : exercises.map(ex => (
                <div key={ex.id} style={{ marginBottom: '16px', padding: '16px', background: 'var(--bg)', borderRadius: '12px', border: '1.5px solid var(--border)', borderLeft: '4px solid var(--green)' }}>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-dark)', marginBottom: '4px' }}>
                        {ex.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                        {ex.subjectName} · {ex.teacherName} · {ex.className} · {ex.seqLabel}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        const sheet = document.getElementById('print-exercise-sheet');
                        if (sheet) {
                          sheet.innerHTML = `
                            <div style="font-family:sans-serif;padding:40px;max-width:680px;margin:auto">
                              <h1 style="font-size:20px;margin-bottom:4px">📚 ${ex.title}</h1>
                              <p style="color:#666;font-size:13px;margin-bottom:20px">
                                ${ex.subjectName} · ${ex.teacherName} · ${ex.className} · ${ex.seqLabel}
                              </p>
                              <hr style="margin-bottom:20px"/>
                              ${ex.description
                                ? `<p style="font-size:14px;line-height:1.7;white-space:pre-wrap">${ex.description}</p>`
                                : '<p style="color:#999">Aucune consigne fournie.</p>'}
                              ${ex.dueDate
                                ? `<p style="margin-top:20px;font-size:13px;color:#666">📅 À rendre avant le : <strong>${new Date(ex.dueDate).toLocaleDateString('fr-FR')}</strong></p>`
                                : ''}
                              <p style="margin-top:32px;font-size:12px;color:#aaa">Publié le ${new Date(ex.createdAt).toLocaleDateString('fr-FR')} — SIGPE · ENS Yaoundé</p>
                            </div>`;
                          sheet.style.display = 'block';
                        }
                        window.print();
                        if (sheet) sheet.style.display = 'none';
                      }}
                      style={{ padding: '6px 14px', borderRadius: '8px', border: '1.5px solid var(--green)', background: 'transparent', color: 'var(--green)', fontWeight: 700, fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap', flexShrink: 0 }}
                    >
                      <Download size={13} /> PDF
                    </button>
                  </div>

                  {ex.description && (
                    <div style={{ fontSize: '13px', color: 'var(--text-dark)', lineHeight: 1.6, marginBottom: '10px', padding: '10px 12px', background: 'rgba(0,0,0,0.03)', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                      {ex.description}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-light)', flexWrap: 'wrap' }}>
                    <span>📅 Posté le {new Date(ex.createdAt).toLocaleDateString('fr-FR')}</span>
                    {ex.dueDate && (
                      <span style={{ color: '#f59e0b', fontWeight: 700 }}>
                        ⏰ À rendre avant le {new Date(ex.dueDate).toLocaleDateString('fr-FR')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Profile;

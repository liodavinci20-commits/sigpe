import React, { useState, useEffect } from 'react';
import {
  BadgeCheck, Trophy, Star, Eye, School, Hash, Calendar,
  MapPin, User, Users, ClipboardList, Megaphone, FileText,
  TrendingUp, Bell, Loader
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

// ── DONNÉES DÉMO (utilisées uniquement en mode simulation) ───
const MOCK = {
  profile: {
    name:         'Ngo Balla Marie-Claire Épiphanie',
    avatar:       'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80',
    className:    '2nde B · Sciences',
    matricule:    'ENS-2024-0834',
    dob:          '14/03/2009',
    city:         'Yaoundé, Centre',
    gender:       'Féminin',
    parentPhone:  '+237 699 234 567',
    guardianType: 'Père',
  },
  stats:    { avg: 14.8, absences: 3, rank: '7ème' },
  sequence: 'Séquence 2',
  grades: [
    { sub: 'Mathématiques', coeff: 4, note: 16.0, prev: 13.5, rang: '3/42' },
    { sub: 'Physique-Chimie', coeff: 3, note: 15.5, prev: 14.0, rang: '4/42' },
    { sub: 'SVT',            coeff: 3, note: 17.0, prev: 16.0, rang: '2/42' },
    { sub: 'Français',       coeff: 4, note: 13.5, prev: 12.0, rang: '12/42' },
  ],
  attendance: { presencePct: 98, presentPct: 97.8, excusedPct: 1.5, absentPct: 0.7, absenceCount: 3 },
  chartData: [
    { label: 'Séq. 1', avg: 10.5 },
    { label: 'Séq. 2', avg: 12.3 },
    { label: 'Séq. 3', avg: 14.81 },
  ],
  notifications: [
    { id: 1, type: 'info',    title: 'Bulletin du 1er Trimestre disponible', body: 'Votre bulletin scolaire est disponible.',           time: "Aujourd'hui, 09h14", unread: true  },
    { id: 2, type: 'warning', title: 'Rattrapage Physique-Chimie',           body: 'Séance programmée le vendredi à 14h.',              time: 'Hier, 16h42',        unread: true  },
    { id: 3, type: 'info',    title: 'Absence justifiée enregistrée',        body: "L'absence du 12/11 a été validée par la scolarité.", time: '12 nov., 10h30',    unread: false },
  ],
};

// ── HELPERS ───────────────────────────────────────────────────
const weightedAvg = (grades) => {
  if (!grades?.length) return null;
  let pts = 0, c = 0;
  grades.forEach(g => {
    const coeff = g.coefficient_override ?? g.class_subjects?.coefficient ?? 1;
    pts += g.note * coeff;
    c   += coeff;
  });
  return c > 0 ? pts / c : null;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const fmtTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// SVG chart: y position pour une note sur 20 dans une zone 10→110
const toY = (avg) => 110 - (avg / 20) * 100;

// ── COMPOSANT ─────────────────────────────────────────────────
const Profile = () => {
  const { user } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    if (user.isDemo) {
      setData(MOCK);
      setLoading(false);
    } else {
      fetchRealData();
    }
  }, [user]);

  const fetchRealData = async () => {
    setLoading(true);
    try {
      // Si l'utilisateur est un parent, on charge le profil de son enfant
      let studentId = user.id;
      if (user.role === 'parent') {
        const { data: link } = await supabase
          .from('student_parents')
          .select('student_id')
          .eq('parent_id', user.id)
          .limit(1)
          .single();
        if (!link?.student_id) {
          setData({ ...MOCK, noChild: true });
          setLoading(false);
          return;
        }
        studentId = link.student_id;
      }

      // 1. Infos élève + profil + classe
      const { data: studentRow } = await supabase
        .from('students')
        .select(`
          matricule, date_of_birth, gender, city, blood_type, parent_phone, guardian_type,
          profiles ( full_name, avatar_url ),
          classes  ( name, level )
        `)
        .eq('id', studentId)
        .single();

      // 2. Toutes les notes (toutes séquences) pour le graphique et le tableau
      const { data: allGrades } = await supabase
        .from('grades')
        .select(`
          note, coefficient_override,
          class_subjects ( coefficient, subjects ( name ) ),
          sequences      ( id, label, number, is_active )
        `)
        .eq('student_id', studentId)
        .order('sequences(number)');

      // 3. Présences
      const { data: attendanceRows } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', studentId);

      // 4. Notifications
      const { data: notifRows } = await supabase
        .from('notifications')
        .select('*')
        .or(`recipient_id.eq.${studentId},target_group.eq.all,target_group.eq.students`)
        .order('created_at', { ascending: false })
        .limit(5);

      // ── Calculs ──

      // Grouper notes par séquence pour le graphique
      const seqMap = {};
      (allGrades || []).forEach(g => {
        const num = g.sequences?.number;
        if (num == null) return;
        if (!seqMap[num]) seqMap[num] = { label: g.sequences.label, grades: [] };
        seqMap[num].grades.push(g);
      });
      const chartData = Object.entries(seqMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, s]) => ({ label: s.label, avg: weightedAvg(s.grades) }))
        .filter(s => s.avg !== null);

      // Trouver la séquence active (ou la plus récente)
      const activeSeqNum = (allGrades || [])
        .find(g => g.sequences?.is_active)?.sequences?.number
        || Math.max(...Object.keys(seqMap).map(Number), 0);

      const activeSeqGrades  = seqMap[activeSeqNum]?.grades || [];
      const prevSeqGrades    = seqMap[activeSeqNum - 1]?.grades || [];
      const activeSeqLabel   = seqMap[activeSeqNum]?.label || '—';

      // Tableau des notes pour la séquence active
      const gradesTable = activeSeqGrades.map(g => {
        const subName  = g.class_subjects?.subjects?.name || '—';
        const coeff    = g.coefficient_override ?? g.class_subjects?.coefficient ?? 1;
        const prevGrade = prevSeqGrades.find(p =>
          p.class_subjects?.subjects?.name === subName
        );
        return {
          sub:   subName,
          coeff,
          note:  g.note,
          prev:  prevGrade?.note ?? null,
          rang:  '—',
        };
      });

      // Moyenne générale courante
      const avg = weightedAvg(activeSeqGrades);

      // Statistiques de présence
      const total      = attendanceRows?.length || 0;
      const presentN   = attendanceRows?.filter(a => a.status === 'present').length  || 0;
      const excusedN   = attendanceRows?.filter(a => a.status === 'excused').length  || 0;
      const absentN    = attendanceRows?.filter(a => a.status === 'absent' || a.status === 'late').length || 0;
      const presentPct = total > 0 ? +((presentN / total) * 100).toFixed(1) : 0;
      const excusedPct = total > 0 ? +((excusedN / total) * 100).toFixed(1) : 0;
      const absentPct  = total > 0 ? +((absentN  / total) * 100).toFixed(1) : 0;

      // Notifications formatées
      const notifications = (notifRows || []).map(n => ({
        id:     n.id,
        type:   n.type || 'info',
        title:  n.title,
        body:   n.content,
        time:   fmtTime(n.created_at),
        unread: !n.is_read,
      }));

      setData({
        profile: {
          name:         studentRow?.profiles?.full_name || user.name,
          avatar:       studentRow?.profiles?.avatar_url || user.avatar,
          className:    studentRow?.classes ? `${studentRow.classes.name} · ${studentRow.classes.level}` : 'Classe non assignée',
          matricule:    studentRow?.matricule || '—',
          dob:          fmtDate(studentRow?.date_of_birth),
          city:         studentRow?.city || '—',
          gender:       studentRow?.gender === 'F' ? 'Féminin' : studentRow?.gender === 'M' ? 'Masculin' : '—',
          parentPhone:  studentRow?.parent_phone || '—',
          guardianType: studentRow?.guardian_type || '—',
        },
        stats: {
          avg:      avg !== null ? avg.toFixed(2) : '—',
          absences: absentN,
          rank:     '—',
        },
        sequence:  activeSeqLabel,
        grades:    gradesTable,
        attendance: {
          presencePct: total > 0 ? Math.round(((presentN + excusedN) / total) * 100) : 0,
          presentPct,
          excusedPct,
          absentPct,
          absenceCount: absentN,
        },
        chartData,
        notifications,
      });
    } catch (err) {
      console.error('Erreur chargement profil:', err);
      setData(MOCK); // fallback démo si erreur
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) {
    return (
      <section className="page-section active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-light)' }}>
          <Loader size={32} style={{ marginBottom: '12px' }} />
          <p>Chargement du profil…</p>
        </div>
      </section>
    );
  }

  const { profile, stats, sequence, grades, attendance, chartData, notifications } = data;

  // Points SVG dynamiques
  const chartPoints = chartData.length > 0
    ? chartData.map((s, i) => {
        const x = chartData.length === 1 ? 150 : 70 + (i / (chartData.length - 1)) * 160;
        return { x, y: toY(s.avg), label: s.label, avg: s.avg };
      })
    : [];

  const circumference = 2 * Math.PI * 38; // ≈ 238.76
  const donutDash = `${(attendance.presencePct / 100) * circumference} ${circumference}`;

  const notifIcon = (type) => {
    if (type === 'warning') return { icon: <Calendar size={18} color="var(--amber)" />, bg: 'var(--amber-pale, #fef9c3)' };
    if (type === 'urgent')  return { icon: <Megaphone size={18} color="var(--red)" />,  bg: 'var(--red-pale, #fee2e2)' };
    return { icon: <ClipboardList size={18} color="var(--green)" />, bg: 'var(--green-pale, #dcfce7)' };
  };

  return (
    <section id="page-profile" className="page-section active">

      {/* ── En-tête profil ── */}
      <div className="profile-header">
        <div className="profile-ava-wrap">
          <img
            className="profile-ava"
            src={profile.avatar || 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80'}
            alt="Élève"
            onError={e => { e.target.style.background = 'var(--green-pale)'; }}
          />
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
            <div className="pqs-label">Rang en classe</div>
          </div>
        </div>
      </div>

      <div className="profile-grid">

        {/* ── Colonne gauche ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Infos personnelles & familiales */}
          <div className="card">
            <div className="card-body">
              <div className="info-block">
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={16} /> Informations Personnelles</h4>
                <div className="info-row"><span className="info-key">Nom complet</span>   <span className="info-val">{profile.name}</span></div>
                <div className="info-row"><span className="info-key">Date de naissance</span><span className="info-val">{profile.dob}</span></div>
                <div className="info-row"><span className="info-key">Sexe</span>           <span className="info-val">{profile.gender}</span></div>
                {profile.city !== '—' && (
                  <div className="info-row"><span className="info-key">Ville</span>        <span className="info-val">{profile.city}</span></div>
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

          {/* Notifications */}
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
                return (
                  <div key={n.id} className="notif-item">
                    <div className="notif-icon-wrap" style={{ background: bg }}>{icon}</div>
                    <div style={{ flex: 1 }}>
                      <h5>{n.title}</h5>
                      <p>{n.body}</p>
                      <time>{n.time}</time>
                    </div>
                    {n.unread && <div className="unread-dot" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Colonne droite ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Tableau de notes */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={18} /> Notes par Matière — {sequence}
                </h3>
              </div>
              <button className="btn-sm btn-green" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Eye size={16} /> Mon Bulletin
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
                    <tr>
                      <th>Matière</th><th>Coeff</th><th>Note /20</th><th>Progression</th><th>Rang</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grades.map((n, i) => {
                      const diff       = n.prev !== null ? (n.note - n.prev).toFixed(1) : null;
                      const isPositive = diff !== null && Number(diff) > 0;
                      const pct        = Math.round((n.note / 20) * 100);
                      const noteClass  = n.note >= 14 ? 'note-high' : n.note >= 10 ? 'note-mid' : 'note-low';
                      return (
                        <tr key={i}>
                          <td><strong>{n.sub}</strong></td>
                          <td style={{ color: 'var(--text-light)' }}>×{n.coeff}</td>
                          <td><span className={`note-badge ${noteClass}`} style={{ display: 'inline-flex' }}>{Number(n.note).toFixed(1)}</span></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div className="prog-mini">
                                <div className="prog-mini-fill" style={{ width: `${pct}%`, background: n.note >= 14 ? 'var(--green)' : 'var(--amber)' }} />
                              </div>
                              {diff !== null && (
                                <span style={{ fontSize: '11px', color: isPositive ? 'var(--green)' : 'var(--red)' }}>
                                  {isPositive ? '↑' : '↓'} {Math.abs(diff)}
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

            {/* Suivi des présences */}
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

            {/* Graphique de progression */}
            <div className="card">
              <div className="card-header">
                <div><h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={18} /> Moyennes</h3></div>
              </div>
              <div className="card-body">
                {chartPoints.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-light)', fontSize: '13px' }}>
                    Pas encore de données pour le graphique.
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
                        <polygon
                          fill="url(#pGrad)"
                          points={`${chartPoints.map(p => `${p.x},${p.y}`).join(' ')} 30,110 290,110`}
                          opacity="0.5"
                        />
                        <polyline
                          fill="none" stroke="var(--green)" strokeWidth="2.5"
                          strokeLinecap="round" strokeLinejoin="round"
                          points={chartPoints.map(p => `${p.x},${p.y}`).join(' ')}
                        />
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
                          textAnchor="middle"
                          fontWeight={i === chartPoints.length - 1 ? 'bold' : 'normal'}>
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
    </section>
  );
};

export default Profile;

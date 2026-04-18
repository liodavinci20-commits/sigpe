import React, { useState, useEffect } from 'react';
import { Calendar, Bell, FileText, ClipboardList, Megaphone, TrendingUp, MessageSquare, Send, Loader } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';

// ── DONNÉES DÉMO ─────────────────────────────────────────────
const MOCK = {
  parentName:  'M. Ngo Balla Emmanuel',
  child: {
    name:      'Marie-Claire Épiphanie',
    className: '2nde B',
    avatar:    'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=120&q=80',
  },
  avg: 14.81,
  sequence: 'Séquence 2 — Trimestre 1',
  grades: [
    { sub: 'SVT',          note: 17.0, coeff: 3, appreciation: 'Très Bien',  noteClass: 'note-high' },
    { sub: 'Mathématiques',note: 16.0, coeff: 4, appreciation: 'Bien',       noteClass: 'note-high' },
    { sub: 'EPS',          note: 18.0, coeff: 1, appreciation: 'Excellent',  noteClass: 'note-high' },
    { sub: 'Français',     note: 13.5, coeff: 4, appreciation: 'Assez Bien', noteClass: 'note-mid'  },
    { sub: 'Anglais',      note: 12.5, coeff: 2, appreciation: 'Assez Bien', noteClass: 'note-mid'  },
  ],
  attendance: { presencePct: 98, presentPct: 97.8, excusedPct: 1.5, absentPct: 0.7, absenceCount: 3 },
  chartData: [
    { label: 'Séq. 1', avg: 10.5  },
    { label: 'Séq. 2', avg: 12.3  },
    { label: 'Séq. 3', avg: 14.81 },
  ],
  notifications: [
    { id: 1, type: 'info',    title: 'Bulletin du 1er Trimestre disponible', body: 'Le bulletin scolaire de Marie-Claire est disponible. Moy. : 14.81/20.',   time: "Aujourd'hui, 09h14", unread: true  },
    { id: 2, type: 'warning', title: 'Réunion Parents-Professeurs',          body: 'Convocation le Mercredi 20 Nov. 2024 à 15h00 — Salle A14.',              time: 'Hier, 16h42',        unread: true  },
    { id: 3, type: 'info',    title: 'Absence justifiée enregistrée',        body: "L'absence du 12/11 a été enregistrée et validée par l'administration.", time: '12 nov., 10h30',    unread: false },
  ],
};

// ── HELPERS ───────────────────────────────────────────────────
const weightedAvg = (grades) => {
  if (!grades?.length) return null;
  let pts = 0, c = 0;
  grades.forEach(g => {
    const coeff = g.coefficient_override ?? g.class_subjects?.coefficient ?? 1;
    pts += g.note * coeff; c += coeff;
  });
  return c > 0 ? pts / c : null;
};

const fmtTime = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

const appreciation = (note) => {
  if (note >= 16) return { text: 'Très Bien',  color: '#1D4ED8' };
  if (note >= 14) return { text: 'Bien',        color: 'var(--green)' };
  if (note >= 12) return { text: 'Assez Bien',  color: 'var(--amber)' };
  if (note >= 10) return { text: 'Passable',    color: 'var(--amber)' };
  return { text: 'Insuffisant', color: 'var(--red)' };
};

const toY = (avg) => 110 - (avg / 20) * 100;

// ── COMPOSANT ─────────────────────────────────────────────────
const Parent = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState(null);

  useEffect(() => {
    if (!user) return;
    if (user.isDemo) { setData(MOCK); setLoading(false); return; }
    fetchRealData();
  }, [user]);

  const fetchRealData = async () => {
    setLoading(true);
    try {
      // 1. Trouver l'enfant lié à ce parent
      const { data: linkRow } = await supabase
        .from('student_parents')
        .select(`
          relationship,
          student_id,
          students (
            id, matricule, date_of_birth,
            profiles ( full_name, avatar_url ),
            classes  ( name, level )
          )
        `)
        .eq('parent_id', user.id)
        .limit(1)
        .single();

      const child    = linkRow?.students;
      const childId  = child?.id;

      if (!childId) {
        setData({ noChild: true, parentName: user.name, child: {}, grades: [], attendance: { presencePct: 0, presentPct: 0, excusedPct: 0, absentPct: 0, absenceCount: 0 }, chartData: [], notifications: [], avg: null, sequence: '—' });
        setLoading(false);
        return;
      }

      // 2. Toutes les notes de l'enfant
      const { data: allGrades } = await supabase
        .from('grades')
        .select(`
          note, coefficient_override,
          class_subjects ( coefficient, subjects ( name ) ),
          sequences      ( id, label, number, is_active )
        `)
        .eq('student_id', childId)
        .order('sequences(number)');

      // 3. Présences de l'enfant
      const { data: attendanceRows } = await supabase
        .from('attendance')
        .select('status')
        .eq('student_id', childId);

      // 4. Notifications pour le parent
      const { data: notifRows } = await supabase
        .from('notifications')
        .select('*')
        .or(`recipient_id.eq.${user.id},target_group.eq.all,target_group.eq.parents`)
        .order('created_at', { ascending: false })
        .limit(5);

      // ── Calculs ──
      const seqMap = {};
      (allGrades || []).forEach(g => {
        const num = g.sequences?.number;
        if (num == null) return;
        if (!seqMap[num]) seqMap[num] = { label: g.sequences.label, isActive: g.sequences.is_active, grades: [] };
        seqMap[num].grades.push(g);
      });

      const chartData = Object.entries(seqMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, s]) => ({ label: s.label, avg: weightedAvg(s.grades) }))
        .filter(s => s.avg !== null);

      const activeSeqNum   = (allGrades || []).find(g => g.sequences?.is_active)?.sequences?.number
        || Math.max(...Object.keys(seqMap).map(Number), 0);
      const activeSeqGrades = seqMap[activeSeqNum]?.grades || [];
      const activeSeqLabel  = seqMap[activeSeqNum]?.label  || '—';
      const avg = weightedAvg(activeSeqGrades);

      const gradesTable = activeSeqGrades.map(g => ({
        sub:       g.class_subjects?.subjects?.name || '—',
        coeff:     g.coefficient_override ?? g.class_subjects?.coefficient ?? 1,
        note:      g.note,
        noteClass: g.note >= 14 ? 'note-high' : g.note >= 10 ? 'note-mid' : 'note-low',
        ...appreciation(g.note),
      }));

      const total      = attendanceRows?.length || 0;
      const presentN   = attendanceRows?.filter(a => a.status === 'present').length || 0;
      const excusedN   = attendanceRows?.filter(a => a.status === 'excused').length || 0;
      const absentN    = attendanceRows?.filter(a => ['absent','late'].includes(a.status)).length || 0;

      setData({
        parentName: user.name,
        child: {
          name:      child.profiles?.full_name || '—',
          className: child.classes?.name || 'Classe non assignée',
          avatar:    child.profiles?.avatar_url,
        },
        avg:      avg !== null ? Number(avg.toFixed(2)) : null,
        sequence: `${activeSeqLabel}`,
        grades:   gradesTable,
        attendance: {
          presencePct: total > 0 ? Math.round(((presentN + excusedN) / total) * 100) : 0,
          presentPct:  total > 0 ? +((presentN / total) * 100).toFixed(1) : 0,
          excusedPct:  total > 0 ? +((excusedN / total) * 100).toFixed(1) : 0,
          absentPct:   total > 0 ? +((absentN  / total) * 100).toFixed(1) : 0,
          absenceCount: absentN,
        },
        chartData,
        notifications: (notifRows || []).map(n => ({
          id: n.id, type: n.type || 'info',
          title: n.title, body: n.content,
          time: fmtTime(n.created_at), unread: !n.is_read,
        })),
      });
    } catch (err) {
      console.error('Erreur portail parent:', err);
      setToast('❌ Impossible de charger les données : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const form     = e.target;
    const recipient = form.querySelector('select[name="recipient"]').value;
    const subject   = form.querySelector('input[name="subject"]').value.trim();
    const content   = form.querySelector('textarea[name="content"]').value.trim();
    if (!content) return;

    if (!user.isDemo) {
      await supabase.from('messages').insert({
        sender_id:    user.id,
        recipient_id: recipient === 'admin' ? user.id : user.id, // à brancher sur vrai ID destinataire
        content:      subject ? `[${subject}] ${content}` : content,
      });
    }

    setToast('✔️ Message envoyé à l\'équipe pédagogique !');
    form.reset();
    setTimeout(() => setToast(null), 5000);
  };

  if (loading || !data) {
    return (
      <section className="page-section active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-light)' }}>
          <Loader size={32} style={{ marginBottom: '12px' }} />
          <p>Chargement du portail…</p>
        </div>
      </section>
    );
  }

  const { parentName, child, avg, sequence, grades, attendance, chartData, notifications } = data;

  const circumference = 2 * Math.PI * 38;
  const donutDash = `${(attendance.presencePct / 100) * circumference} ${circumference}`;

  const chartPoints = chartData?.length > 0
    ? chartData.map((s, i) => ({
        x:     chartData.length === 1 ? 150 : 70 + (i / (chartData.length - 1)) * 160,
        y:     toY(s.avg),
        label: s.label,
        avg:   s.avg,
      }))
    : [];

  const notifIcon = (type) => {
    if (type === 'warning') return { icon: <Calendar size={18} color="var(--amber)" />, bg: 'var(--amber-pale,#fef9c3)' };
    if (type === 'urgent')  return { icon: <Megaphone size={18} color="var(--red)"   />, bg: 'var(--red-pale,#fee2e2)' };
    return                         { icon: <ClipboardList size={18} color="var(--green)" />, bg: 'var(--green-pale,#dcfce7)' };
  };

  return (
    <section className="page-section active">
      {toast && (
        <div style={{
          position: 'fixed', top: '30px', right: '30px', background: 'var(--green)',
          color: '#fff', padding: '16px 24px', borderRadius: '12px', zIndex: 9999,
          boxShadow: '0 8px 24px rgba(0,168,107,0.3)', display: 'flex',
          alignItems: 'center', gap: '12px', animation: 'fadeIn 0.4s', fontWeight: 600
        }}>
          {toast}
        </div>
      )}

      {/* Bannière parent */}
      <div className="parent-banner">
        {/* Avatar de l'enfant */}
        {child.avatar
          ? <img src={child.avatar} alt="Élève" onError={e => { e.target.style.display='none'; }} />
          : (
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.2)', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 700, color: '#fff'
            }}>
              {child.name ? child.name[0].toUpperCase() : '?'}
            </div>
          )
        }
        <div>
          <h3 style={{ margin: '0 0 4px', fontSize: '13px', opacity: 0.8, fontWeight: 500 }}>
            Bonjour, {parentName}
          </h3>
          <p style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>
            Parent de <span style={{ color: '#bbf7d0' }}>{child.name || '—'}</span>
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '13px', opacity: 0.75 }}>
            {child.className || 'Classe non assignée'} · ENS Yaoundé
          </p>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
            {avg !== null ? avg : '—'}
          </div>
          <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)' }}>Moyenne générale actuelle</div>
        </div>
      </div>

      {/* Alerte si enfant non lié */}
      {data.noChild && (
        <div style={{
          margin: '0 0 20px', padding: '14px 18px', borderRadius: '10px',
          background: 'rgba(249,115,22,0.08)', border: '1px solid var(--orange,#f97316)',
          color: 'var(--orange,#f97316)', fontSize: '13px', fontWeight: 600
        }}>
          ⚠️ Aucun enfant n'est encore lié à votre compte. Contactez l'administration pour faire le lien.
        </div>
      )}

      <div className="parent-grid">

        {/* Notes */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><FileText size={18} /> Dernières Notes</h3>
              <p>{sequence}</p>
            </div>
            <button className="btn-sm btn-green" onClick={() => navigate('/bulletin')}>Voir Bulletin</button>
          </div>
          {grades.length === 0 ? (
            <div style={{ padding: '28px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px' }}>
              Aucune note disponible pour cette séquence.
            </div>
          ) : (
            <div style={{ overflow: 'hidden' }}>
              <table className="notes-table">
                <thead>
                  <tr><th>Matière</th><th>Note</th><th>Coeff.</th><th>Appréciation</th></tr>
                </thead>
                <tbody>
                  {grades.map((g, i) => (
                    <tr key={i}>
                      <td>{g.sub}</td>
                      <td><span className={`note-badge ${g.noteClass}`} style={{ display: 'inline-flex' }}>{Number(g.note).toFixed(1)}</span></td>
                      <td>{g.coeff}</td>
                      <td style={{ color: appreciation(g.note).color, fontWeight: 600, fontSize: '12px' }}>
                        {appreciation(g.note).text}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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

        {/* Présences */}
        <div className="card">
          <div className="card-header">
            <div><h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Calendar size={18} /> Suivi des Présences</h3></div>
          </div>
          <div className="card-body">
            {attendance.presencePct === 0 && attendance.absenceCount === 0 ? (
              <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-light)', fontSize: '13px' }}>
                Aucune donnée de présence disponible.
              </div>
            ) : (
              <>
                {/* Donut */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                  <div className="donut-wrap">
                    <svg viewBox="0 0 100 100" width="130" height="130">
                      <circle cx="50" cy="50" r="38" fill="none" stroke="var(--bg, #1e293b)" strokeWidth="10" />
                      <circle cx="50" cy="50" r="38" fill="none" stroke="#E2E8F0" strokeWidth="10" />
                      <circle cx="50" cy="50" r="38" fill="none" stroke="var(--green)" strokeWidth="10"
                        strokeDasharray={donutDash} strokeLinecap="round" />
                    </svg>
                    <div className="donut-label">
                      <span>{attendance.presencePct}%</span>
                      <small>Présence</small>
                    </div>
                  </div>
                </div>
                {/* Barres */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { label: 'Présent',  pct: attendance.presentPct, color: 'var(--green)' },
                    { label: 'Justifié', pct: attendance.excusedPct, color: 'var(--amber)' },
                    { label: 'Absent',   pct: attendance.absentPct,  color: 'var(--red)'   },
                  ].map(row => (
                    <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-mid)', width: '60px', flexShrink: 0 }}>{row.label}</span>
                      <div style={{ flex: 1, height: '8px', background: 'var(--bg, #0f172a)', borderRadius: '20px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.max(row.pct, row.pct > 0 ? 2 : 0)}%`, background: row.color, borderRadius: '20px', transition: 'width 0.8s ease' }} />
                      </div>
                      <strong style={{ fontSize: '12px', color: 'var(--text-dark)', width: '36px', textAlign: 'right' }}>{row.pct}%</strong>
                    </div>
                  ))}
                </div>
                {attendance.absenceCount > 0 && (
                  <div style={{ marginTop: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid var(--red)', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', color: 'var(--red)', fontWeight: 600 }}>
                    ⚠ {attendance.absenceCount} absence{attendance.absenceCount > 1 ? 's' : ''} enregistrée{attendance.absenceCount > 1 ? 's' : ''}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Graphique progression */}
        <div className="card">
          <div className="card-header">
            <div><h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><TrendingUp size={18} /> Progression des Moyennes</h3></div>
          </div>
          <div className="card-body">
            {chartPoints.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-light)', fontSize: '13px' }}>
                Pas encore de données pour le graphique.
              </div>
            ) : (
              <svg viewBox="0 0 300 140" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '140px' }}>
                <defs>
                  <linearGradient id="pGrad2" x1="0" y1="0" x2="0" y2="1">
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
                    <polygon fill="url(#pGrad2)"
                      points={`${chartPoints.map(p => `${p.x},${p.y}`).join(' ')} 30,110 290,110`}
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

        {/* Formulaire de contact */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-header">
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MessageSquare size={18} /> Contacter l'Établissement</h3>
              <p>Envoyer un message sécurisé à l'équipe pédagogique</p>
            </div>
          </div>
          <div className="card-body">
            <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleSendMessage}>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Destinataire :</label>
                <select name="recipient" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dark)' }}>
                  <option value="admin">Administration & Scolarité</option>
                  <option value="teacher_head">Professeur Titulaire</option>
                  <option value="teacher_course">Professeur de Cours</option>
                  <option value="counselor">Conseiller d'Orientation</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Objet :</label>
                <input name="subject" type="text" placeholder="Ex: Justification d'absence, Demande de rendez-vous..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dark)' }} />
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Votre message :</label>
                <textarea name="content" rows="4" required placeholder="Saisissez votre message..."
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dark)', resize: 'vertical' }} />
              </div>
              <button type="submit" className="btn-sm btn-green"
                style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px' }}>
                <Send size={16} /> Envoyer le message
              </button>
            </form>
          </div>
        </div>

      </div>
    </section>
  );
};

export default Parent;

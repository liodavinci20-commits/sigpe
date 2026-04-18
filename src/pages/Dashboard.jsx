import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import {
  GraduationCap, Users, BookOpen, AlertTriangle,
  Clock, CalendarCheck, MessageSquare, Send, Loader,
  Bell, RefreshCw
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [toast, setToast] = useState(null);

  // Stats réelles admin
  const [stats,        setStats]        = useState({ students: 0, teachers: 0, classes: 0, messages: 0 });
  const [activities,   setActivities]   = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Notifications enseignant
  const [teacherNotifs,        setTeacherNotifs]        = useState([]);
  const [loadingTeacherNotifs, setLoadingTeacherNotifs] = useState(false);
  // Vraies classes du prof
  const [myClasses,    setMyClasses]    = useState([]);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'admin' && !user.isDemo) {
      fetchAdminStats();
    } else if (user.role === 'teacher_course' && !user.isDemo) {
      fetchTeacherData();
    } else {
      setLoadingStats(false);
    }
  }, [user]);

  const fetchAdminStats = async () => {
    setLoadingStats(true);
    try {
      const [
        { count: studentsCount },
        { count: teachersCount },
        { count: classesCount },
        { count: messagesCount },
        { data: recentNotifs }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student'),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['teacher_course', 'teacher_head', 'counselor']),
        supabase.from('classes').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('is_read', false),
        supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(6)
      ]);

      setStats({
        students: studentsCount || 0,
        teachers: teachersCount || 0,
        classes:  classesCount  || 0,
        messages: messagesCount || 0,
      });
      setActivities(recentNotifs || []);
    } catch (err) {
      console.error('Erreur chargement stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchTeacherData = async () => {
    setLoadingTeacherNotifs(true);
    try {
      const [{ data: notifRows }, { data: csRows }] = await Promise.all([
        // Notifications visibles par le personnel (all ou staff)
        supabase
          .from('notifications')
          .select('*')
          .in('target_group', ['all', 'staff'])
          .order('created_at', { ascending: false })
          .limit(10),
        // Classes du prof
        supabase
          .from('class_subjects')
          .select('classes(name, level), subjects(name)')
          .eq('teacher_id', user.id),
      ]);
      setTeacherNotifs(notifRows || []);
      setMyClasses(csRows || []);
    } catch (err) {
      console.error('Erreur données enseignant:', err);
    } finally {
      setLoadingTeacherNotifs(false);
      setLoadingStats(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const form     = e.target;
    const group    = form.querySelector('select').value;
    const content  = form.querySelector('textarea').value.trim();
    if (!content) return;

    const { error } = await supabase.from('notifications').insert({
      sender_id:    user.id,
      target_group: group,
      title:        'Message de l\'Administration',
      content,
      type:         'info'
    });

    if (!error) {
      setToast('🔔 Notification envoyée avec succès !');
      form.reset();
      if (user?.role === 'admin') fetchAdminStats();
    } else {
      setToast('❌ Erreur lors de l\'envoi.');
    }
    setTimeout(() => setToast(null), 5000);
  };

  const typeColor = {
    info:    { bg: 'var(--green-pale,#dcfce7)',   color: 'var(--green)',       label: 'Info' },
    warning: { bg: 'var(--amber-pale,#fef9c3)',   color: 'var(--amber,#f59e0b)', label: 'Alerte' },
    urgent:  { bg: 'var(--red-pale,#fee2e2)',     color: 'var(--red)',         label: 'Urgent' },
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <section id="page-dashboard" className="page-section active">
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

      {/* ── ADMIN ── */}
      {user?.role === 'admin' && (
        <>
          {/* Stats grid */}
          <div className="stats-grid">
            {[
              {
                icon: <GraduationCap size={28} />, color: 'green',
                label: 'Total Élèves',
                value: loadingStats ? <Loader size={20} className="spin" /> : stats.students,
                trend: stats.students > 0 ? `${stats.students} inscrit(s)` : 'Aucun élève encore'
              },
              {
                icon: <Users size={28} />, color: 'blue',
                label: 'Enseignants',
                value: loadingStats ? <Loader size={20} /> : stats.teachers,
                trend: stats.teachers > 0 ? `${stats.teachers} actif(s)` : 'Aucun enseignant'
              },
              {
                icon: <BookOpen size={28} />, color: 'amber',
                label: 'Classes Actives',
                value: loadingStats ? <Loader size={20} /> : stats.classes,
                trend: stats.classes > 0 ? 'Tous niveaux' : 'À créer dans Supabase'
              },
              {
                icon: <MessageSquare size={28} />, color: 'amber',
                label: 'Messages non lus',
                value: loadingStats ? <Loader size={20} /> : stats.messages,
                trend: stats.messages > 0 ? 'En attente de réponse' : 'Aucun message'
              },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <div className={`stat-icon ${s.color}`}>{s.icon}</div>
                <div className="stat-info">
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-trend up">{s.trend}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
            {/* Activités récentes depuis la BD */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>⚡ Activités Récentes</h3>
                  <p>Notifications envoyées dans le SIGPE</p>
                </div>
                <button className="btn-sm btn-outline" onClick={fetchAdminStats} style={{ fontSize: '12px' }}>
                  ↻ Actualiser
                </button>
              </div>
              <div className="card-body">
                {loadingStats ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-light)' }}>
                    <Loader size={24} /> Chargement…
                  </div>
                ) : activities.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-light)', fontSize: '13px' }}>
                    Aucune activité pour l'instant.<br />
                    <span style={{ fontSize: '12px' }}>Les notifications envoyées apparaîtront ici.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activities.map(n => {
                      const t = typeColor[n.type] || typeColor.info;
                      return (
                        <div key={n.id} className="notif-item">
                          <span style={{
                            fontSize: '11px', background: t.bg, color: t.color,
                            padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold', whiteSpace: 'nowrap'
                          }}>
                            {t.label}
                          </span>
                          <div style={{ flex: 1, fontSize: '13px', lineHeight: 1.4 }}>
                            <strong>{n.title}</strong><br />
                            <span style={{ color: 'var(--text-light)' }}>{n.content}</span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                            {fmtDate(n.created_at)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Raccourcis admin */}
            <div className="card">
              <div className="card-header">
                <div><h3>⚙️ Gestion du Staff</h3><p>Raccourcis administratifs</p></div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button className="btn-sm btn-outline" style={{ justifyContent: 'center' }}
                  onClick={() => alert('Module : Ajouter un Enseignant — à brancher')}>
                  + Inscrire un Nouvel Enseignant
                </button>
                <button className="btn-sm btn-outline" style={{ justifyContent: 'center' }}
                  onClick={() => alert('Module : Nommer un Sous-Admin — à brancher')}>
                  + Nommer un Sous-Administrateur
                </button>
                <button className="btn-sm btn-green" style={{ justifyContent: 'center' }}
                  onClick={() => window.location.href = '/students'}>
                  + Voir l'Annuaire Élèves
                </button>

                {/* Résumé rapide si données dispo */}
                {!loadingStats && stats.students > 0 && (
                  <div style={{
                    marginTop: '8px', padding: '12px', background: 'var(--bg)',
                    borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px'
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: '8px', color: 'var(--text-dark)' }}>Résumé de l'établissement</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-light)' }}>
                      <span>Élèves inscrits</span><strong style={{ color: 'var(--green)' }}>{stats.students}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-light)', marginTop: '4px' }}>
                      <span>Personnel enseignant</span><strong style={{ color: 'var(--blue-accent)' }}>{stats.teachers}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-light)', marginTop: '4px' }}>
                      <span>Classes configurées</span><strong>{stats.classes}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── TEACHER COURSE ── */}
      {user?.role === 'teacher_course' && (
        <>
          {/* Stats rapides */}
          <div className="stats-grid">
            {[
              { icon: <GraduationCap size={28} />, color: 'green', label: 'Mes Classes',      value: myClasses.length || '—', trend: myClasses.length > 0 ? `${myClasses.length} classe(s) assignée(s)` : 'Aucune classe encore' },
              { icon: <Bell size={28} />,          color: 'blue',  label: 'Notifications',    value: teacherNotifs.filter(n => !n.is_read).length || '—', trend: teacherNotifs.length > 0 ? `${teacherNotifs.length} message(s) admin` : 'Aucun message' },
              { icon: <Clock size={28} />,         color: 'amber', label: "Cours Aujourd'hui", value: '—', trend: 'Emploi du temps à configurer' },
              { icon: <MessageSquare size={28} />, color: 'blue',  label: 'Messages Parents',  value: '—', trend: 'Module en cours' },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <div className={`stat-icon ${s.color}`}>{s.icon}</div>
                <div className="stat-info">
                  <div className="stat-label">{s.label}</div>
                  <div className="stat-value">{s.value}</div>
                  <div className="stat-trend up">{s.trend}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>

            {/* Notifications de l'administration */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bell size={18} /> Notifications Administration
                  </h3>
                  <p>Messages envoyés par l'administration ou la direction</p>
                </div>
                <button className="btn-sm btn-outline" onClick={fetchTeacherData}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                  <RefreshCw size={12} /> Actualiser
                </button>
              </div>
              <div className="card-body">
                {loadingTeacherNotifs ? (
                  <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <Loader size={18} /> Chargement…
                  </div>
                ) : teacherNotifs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-light)', fontSize: '13px' }}>
                    <Bell size={28} style={{ marginBottom: '10px', opacity: 0.3 }} />
                    <p style={{ margin: 0 }}>Aucune notification pour le moment.</p>
                    <p style={{ fontSize: '12px', marginTop: '6px' }}>Les messages de l'administration apparaîtront ici.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {teacherNotifs.map(n => {
                      const t = typeColor[n.type] || typeColor.info;
                      return (
                        <div key={n.id} style={{
                          display: 'flex', gap: '12px', alignItems: 'flex-start',
                          padding: '12px', borderRadius: '10px',
                          background: 'var(--bg)', border: `1px solid ${n.is_read ? 'var(--border)' : t.color}`,
                          position: 'relative'
                        }}>
                          {!n.is_read && (
                            <div style={{ position: 'absolute', top: '10px', right: '10px', width: '8px', height: '8px', borderRadius: '50%', background: t.color }} />
                          )}
                          <span style={{
                            fontSize: '11px', background: t.bg, color: t.color,
                            padding: '2px 8px', borderRadius: '4px', fontWeight: 700,
                            whiteSpace: 'nowrap', flexShrink: 0, height: 'fit-content'
                          }}>
                            {t.label}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-dark)', marginBottom: '3px' }}>{n.title}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-light)', lineHeight: 1.5 }}>{n.content}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-light)', marginTop: '6px' }}>{fmtDate(n.created_at)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Mes classes */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <GraduationCap size={18} /> Mes Classes
                  </h3>
                  <p>Classes assignées lors de votre inscription</p>
                </div>
              </div>
              <div className="card-body">
                {myClasses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-light)', fontSize: '13px' }}>
                    <GraduationCap size={28} style={{ marginBottom: '10px', opacity: 0.3 }} />
                    <p style={{ margin: 0 }}>Aucune classe assignée.</p>
                    <p style={{ fontSize: '12px', marginTop: '6px' }}>Complétez votre profil pour voir vos classes.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {myClasses.map((cs, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: '8px',
                        background: 'var(--bg)', border: '1px solid var(--border)'
                      }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark)' }}>
                            {cs.classes?.name || '—'}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                            {cs.classes?.level || ''}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '12px', fontWeight: 600, color: 'var(--green)',
                          background: 'rgba(34,197,94,0.1)', padding: '3px 10px', borderRadius: '6px'
                        }}>
                          {cs.subjects?.name || '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {user?.role === 'teacher_head' && <React.Fragment />}
      {user?.role === 'counselor'    && <React.Fragment />}

      {/* ── Bloc communication (tous les rôles staff) ── */}
      {['admin', 'counselor', 'teacher_head', 'teacher_course'].includes(user?.role) && (
        <div className="card" style={{ marginTop: '20px', borderLeft: '4px solid var(--blue-accent)' }}>
          <div className="card-header">
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Send size={18} /> Envoyer une Notification
              </h3>
              <p>Diffuser une information aux élèves & parents</p>
            </div>
          </div>
          <div className="card-body">
            <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={handleSendMessage}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
                <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600 }}>Groupe cible :</label>
                  <select name="group" style={{
                    width: '100%', padding: '10px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dark)'
                  }}>
                    <option value="all">Tous (élèves + parents)</option>
                    <option value="students">Tous les élèves</option>
                    <option value="parents">Tous les parents</option>
                    {user?.role === 'admin' && <option value="staff">Tout le personnel</option>}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600 }}>Message :</label>
                <textarea rows="3" required placeholder="Saisissez votre message ou alerte..."
                  style={{
                    width: '100%', padding: '10px', borderRadius: '8px',
                    border: '1px solid var(--border)', background: 'var(--bg)',
                    color: 'var(--text-dark)', resize: 'vertical'
                  }} />
              </div>
              <button type="submit" className="btn-sm btn-green" style={{
                alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px'
              }}>
                <Send size={16} /> Envoyer
              </button>
            </form>
          </div>
        </div>
      )}

      <div style={{ paddingBottom: '40px' }} />
    </section>
  );
};

export default Dashboard;

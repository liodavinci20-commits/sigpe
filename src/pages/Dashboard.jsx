import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import {
  GraduationCap, Users, BookOpen, AlertTriangle,
  Clock, CalendarCheck, MessageSquare, Send, Loader,
  Bell, RefreshCw, School, X, UserCheck
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [toast, setToast] = useState(null);

  // Stats réelles admin
  const [stats,        setStats]        = useState({ students: 0, teachers: 0, classes: 0, messages: 0 });
  const [activities,   setActivities]   = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Établissements
  const [instGroups,  setInstGroups]  = useState([]);
  const [allInstList, setAllInstList] = useState([]);
  const [loadingInst, setLoadingInst] = useState(false);
  const [instModal,   setInstModal]   = useState(null); // { id, name, students[] }
  const [savingId,    setSavingId]    = useState(null);

  // Notifications enseignant
  const [teacherNotifs,        setTeacherNotifs]        = useState([]);
  const [loadingTeacherNotifs, setLoadingTeacherNotifs] = useState(false);
  // Vraies classes du prof
  const [myClasses,          setMyClasses]          = useState([]);
  const [teacherInstitution, setTeacherInstitution] = useState(null);

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
    // Charger les données d'établissements en parallèle
    loadInstitutionData();
  };

  const loadInstitutionData = async () => {
    setLoadingInst(true);
    try {
      const [{ data: instRows }, { data: studentRows }] = await Promise.all([
        supabase.from('institutions').select('id, name, code').order('name'),
        supabase.from('profiles').select('id, full_name, avatar_url, institution_id').eq('role', 'student').order('full_name'),
      ]);
      const insts    = instRows    || [];
      const students = studentRows || [];
      setAllInstList(insts);
      const groups = insts.map(inst => ({
        ...inst,
        students: students.filter(s => s.institution_id === inst.id),
      }));
      const unassigned = students.filter(s => !s.institution_id || !insts.find(i => i.id === s.institution_id));
      setInstGroups([...groups, { id: null, name: 'Non assignés', code: null, students: unassigned }]);
    } catch (err) {
      console.error('Erreur établissements:', err);
    } finally {
      setLoadingInst(false);
    }
  };

  const assignStudent = async (studentId, newInstId) => {
    setSavingId(studentId);
    const { error } = await supabase
      .from('profiles')
      .update({ institution_id: newInstId || null })
      .eq('id', studentId);
    if (!error) {
      // Déplacer l'élève dans l'état local
      let movedStudent = null;
      setInstGroups(prev => {
        const next = prev.map(g => {
          const found = g.students.find(s => s.id === studentId);
          if (found) movedStudent = { ...found, institution_id: newInstId };
          return { ...g, students: g.students.filter(s => s.id !== studentId) };
        });
        return next.map(g => {
          const match = newInstId ? g.id === newInstId : g.id === null;
          return match && movedStudent ? { ...g, students: [...g.students, movedStudent] } : g;
        });
      });
      // Retirer l'élève de la liste du modal (il a changé d'établissement)
      setInstModal(prev => prev ? { ...prev, students: prev.students.filter(s => s.id !== studentId) } : null);
    }
    setSavingId(null);
  };

  const fetchTeacherData = async () => {
    setLoadingTeacherNotifs(true);
    try {
      const [{ data: notifRows }, { data: csRows }, { data: myProfile }] = await Promise.all([
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
        // Établissement du prof
        supabase
          .from('profiles')
          .select('institution_id, institutions(name)')
          .eq('id', user.id)
          .single(),
      ]);
      setTeacherNotifs(notifRows || []);
      setMyClasses(csRows || []);
      setTeacherInstitution(myProfile?.institutions?.name || null);
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

          {/* Bannière établissement */}
          {teacherInstitution ? (
            <div style={{
              marginTop: '20px', padding: '14px 20px', borderRadius: '12px',
              background: 'rgba(0,168,107,0.08)', border: '1.5px solid var(--green)',
              display: 'flex', alignItems: 'center', gap: '14px'
            }}>
              <GraduationCap size={22} color="var(--green)" />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', marginBottom: '2px' }}>Mon Établissement</div>
                <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-dark)' }}>{teacherInstitution}</div>
              </div>
            </div>
          ) : (
            <div style={{
              marginTop: '20px', padding: '14px 20px', borderRadius: '12px',
              background: 'rgba(251,191,36,0.08)', border: '1.5px solid #f59e0b',
              display: 'flex', alignItems: 'center', gap: '14px'
            }}>
              <AlertTriangle size={22} color="#f59e0b" />
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-light)', marginBottom: '2px' }}>Établissement non défini</div>
                <div style={{ fontSize: '13px', color: 'var(--text-dark)' }}>
                  Allez dans <strong>Mon Profil</strong> pour sélectionner votre établissement.
                </div>
              </div>
            </div>
          )}

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

      {/* ── BLOC ÉTABLISSEMENTS (admin uniquement) ── */}
      {user?.role === 'admin' && !user?.isDemo && (
        <>
          <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header">
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <School size={18} /> Établissements — Département du Mfoundi
                </h3>
                <p>Répartition des élèves par établissement · cliquez sur un établissement pour gérer</p>
              </div>
              <button className="btn-sm btn-outline" onClick={loadInstitutionData}
                style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                <RefreshCw size={12} /> Actualiser
              </button>
            </div>
            <div className="card-body">
              {loadingInst ? (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Loader size={18} /> Chargement…
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {instGroups.map((group, idx) => {
                    const pct   = stats.students > 0 ? Math.round((group.students.length / stats.students) * 100) : 0;
                    const isNull = group.id === null;
                    const color  = isNull ? '#f59e0b' : ['var(--green)', 'var(--blue-accent)', '#8b5cf6'][idx % 3];
                    return (
                      <div key={group.id || 'unassigned'} style={{
                        display: 'flex', alignItems: 'center', gap: '16px',
                        padding: '14px 16px', borderRadius: '12px',
                        background: 'var(--bg)', border: `1.5px solid ${isNull ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`,
                        transition: 'border-color 0.2s',
                      }}>
                        {/* Icône */}
                        <div style={{
                          width: '42px', height: '42px', borderRadius: '12px', flexShrink: 0,
                          background: isNull ? 'rgba(245,158,11,0.1)' : 'rgba(0,168,107,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isNull
                            ? <AlertTriangle size={20} color="#f59e0b" />
                            : <School size={20} color="var(--green)" />}
                        </div>

                        {/* Nom + barre */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark)', marginBottom: '6px' }}>
                            {group.name}
                            {group.code && (
                              <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-light)', fontWeight: 400 }}>
                                [{group.code}]
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '20px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '20px', transition: 'width 0.6s ease' }} />
                            </div>
                            <span style={{ fontSize: '12px', color: 'var(--text-light)', whiteSpace: 'nowrap', minWidth: '80px' }}>
                              <strong style={{ color: 'var(--text-dark)' }}>{group.students.length}</strong> élève{group.students.length !== 1 ? 's' : ''} · {pct}%
                            </span>
                          </div>
                        </div>

                        {/* Bouton gérer */}
                        <button
                          onClick={() => setInstModal(group)}
                          style={{
                            padding: '7px 14px', borderRadius: '8px', border: 'none',
                            background: isNull ? 'rgba(245,158,11,0.12)' : 'rgba(0,168,107,0.1)',
                            color: isNull ? '#b45309' : 'var(--green)',
                            fontWeight: 700, fontSize: '12px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0,
                          }}>
                          <UserCheck size={14} />
                          {isNull ? 'Assigner' : 'Gérer'}
                        </button>
                      </div>
                    );
                  })}
                  {instGroups.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)', fontSize: '13px' }}>
                      Aucun établissement trouvé. Vérifiez la table <code>institutions</code>.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Modal assignation élèves ── */}
          {instModal && (
            <div style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
              zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
            }}>
              <div className="card" style={{ width: '100%', maxWidth: '560px', margin: 0, maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>

                {/* En-tête */}
                <div className="card-header" style={{ flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                      background: instModal.id ? 'rgba(0,168,107,0.1)' : 'rgba(245,158,11,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {instModal.id ? <School size={18} color="var(--green)" /> : <AlertTriangle size={18} color="#f59e0b" />}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '15px' }}>{instModal.name}</h3>
                      <p style={{ margin: 0, fontSize: '12px' }}>
                        {instModal.students.length} élève{instModal.students.length !== 1 ? 's' : ''} —
                        {instModal.id ? ' modifier ou transférer vers un autre établissement' : ' assigner un établissement'}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setInstModal(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: '4px' }}>
                    <X size={20} />
                  </button>
                </div>

                {/* Corps */}
                <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px' }}>
                  {instModal.students.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-light)', fontSize: '13px' }}>
                      <School size={32} style={{ opacity: 0.3, marginBottom: '12px' }} /><br />
                      Aucun élève dans cet établissement.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {instModal.students.map(student => (
                        <div key={student.id} style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 14px', borderRadius: '10px',
                          background: 'var(--bg)', border: '1px solid var(--border)'
                        }}>
                          {/* Avatar */}
                          {student.avatar_url ? (
                            <img src={student.avatar_url} alt="" style={{ width: '34px', height: '34px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>
                              {student.full_name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'}
                            </div>
                          )}

                          {/* Nom */}
                          <div style={{ flex: 1, fontWeight: 600, fontSize: '13px', color: 'var(--text-dark)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {student.full_name || '—'}
                          </div>

                          {/* Dropdown établissement */}
                          <select
                            value={student.institution_id || ''}
                            disabled={savingId === student.id}
                            onChange={e => assignStudent(student.id, e.target.value || null)}
                            style={{
                              padding: '6px 10px', borderRadius: '8px',
                              border: '1.5px solid var(--border)', background: 'var(--bg-card)',
                              color: 'var(--text-dark)', fontSize: '12px', cursor: 'pointer',
                              flexShrink: 0, maxWidth: '200px',
                            }}
                          >
                            <option value="">-- Non assigné --</option>
                            {allInstList.map(inst => (
                              <option key={inst.id} value={inst.id}>{inst.name}</option>
                            ))}
                          </select>

                          {/* Spinner */}
                          {savingId === student.id && <Loader size={14} style={{ flexShrink: 0, color: 'var(--green)' }} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pied */}
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', flexShrink: 0, display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="btn-sm btn-green" onClick={() => setInstModal(null)}>Fermer</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

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

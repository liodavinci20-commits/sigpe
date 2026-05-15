import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import {
  GraduationCap, Users, BookOpen, AlertTriangle,
  MessageSquare, Send, Loader,
  Bell, RefreshCw, School, X, Building2, TrendingUp, ShieldAlert, Plus, Clock
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [toast, setToast] = useState(null);

  // Stats admin (par établissement)
  const [stats,        setStats]        = useState({ students: 0, teachers: 0, classes: 0, messages: 0 });
  const [activities,   setActivities]   = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Stats super_admin (globales)
  const [superStats,       setSuperStats]       = useState({ institutions: 0, students: 0, teachers: 0 });
  const [instCards,        setInstCards]        = useState([]);
  const [loadingSuper,     setLoadingSuper]     = useState(false);
  const [adminInstitution, setAdminInstitution] = useState(null);

  // Création établissement
  const [showInstModal, setShowInstModal] = useState(false);
  const [instForm,      setInstForm]      = useState({ name: '', code: '' });
  const [savingInst,    setSavingInst]    = useState(false);
  const [instError,     setInstError]     = useState('');

  // Notifications enseignant
  const [teacherNotifs,        setTeacherNotifs]        = useState([]);
  const [loadingTeacherNotifs, setLoadingTeacherNotifs] = useState(false);
  const [myClasses,            setMyClasses]            = useState([]);
  const [teacherInstitution,   setTeacherInstitution]   = useState(null);

  useEffect(() => {
    if (!user) return;
    if (user.role === 'super_admin' && !user.isDemo) {
      fetchSuperAdminStats();
    } else if (user.role === 'admin' && !user.isDemo) {
      fetchAdminStats();
    } else if (user.role === 'teacher_course' && !user.isDemo) {
      fetchTeacherData();
    } else {
      setLoadingStats(false);
    }
  }, [user]);

  // ── Stats Délégué Départemental (vue globale) ──────────────────
  const fetchSuperAdminStats = async () => {
    setLoadingSuper(true);
    try {
      const [{ data: institutions }, { data: profiles }] = await Promise.all([
        supabase.from('institutions').select('id, name, code').order('name'),
        supabase.from('profiles').select('id, role, institution_id')
          .in('role', ['student', 'teacher_course', 'teacher_head', 'counselor']),
      ]);

      const insts    = institutions || [];
      const profiles_ = profiles   || [];

      // Agréger par institution
      const cards = insts.map(inst => {
        const instProfiles = profiles_.filter(p => p.institution_id === inst.id);
        return {
          ...inst,
          students: instProfiles.filter(p => p.role === 'student').length,
          teachers: instProfiles.filter(p => ['teacher_course','teacher_head','counselor'].includes(p.role)).length,
        };
      });

      setSuperStats({
        institutions: insts.length,
        students:     profiles_.filter(p => p.role === 'student').length,
        teachers:     profiles_.filter(p => ['teacher_course','teacher_head','counselor'].includes(p.role)).length,
      });
      setInstCards(cards);
    } catch (err) {
      console.error('Erreur super_admin stats:', err);
    } finally {
      setLoadingSuper(false);
      setLoadingStats(false);
    }
  };

  const createInstitution = async () => {
    if (!instForm.name.trim()) { setInstError('Le nom est obligatoire.'); return; }
    setSavingInst(true);
    setInstError('');
    try {
      const { error } = await supabase.from('institutions').insert({
        name: instForm.name.trim(),
        code: instForm.code.trim() || null,
      });
      if (error) throw error;
      setInstForm({ name: '', code: '' });
      setShowInstModal(false);
      setToast('✅ Établissement créé avec succès !');
      setTimeout(() => setToast(null), 4000);
      fetchSuperAdminStats(); // Rafraîchir la liste
    } catch (err) {
      setInstError('Erreur : ' + err.message);
    } finally {
      setSavingInst(false);
    }
  };

  // ── Stats Admin (filtrés par son établissement) ─────────────────
  const fetchAdminStats = async () => {
    setLoadingStats(true);
    const instId = user.institutionId;
    try {
      // Nom de l'établissement de l'admin
      if (instId) {
        const { data: inst } = await supabase.from('institutions').select('name').eq('id', instId).single();
        setAdminInstitution(inst?.name || null);
      }

      const studentsQ = supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'student');
      const teachersQ = supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['teacher_course', 'teacher_head', 'counselor']);
      const classesQ  = supabase.from('classes').select('*', { count: 'exact', head: true });
      const messagesQ = supabase.from('messages').select('*', { count: 'exact', head: true }).eq('is_read', false);
      const notifsQ   = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(6);

      if (instId) {
        studentsQ.eq('institution_id', instId);
        teachersQ.eq('institution_id', instId);
      }

      const [
        { count: studentsCount },
        { count: teachersCount },
        { count: classesCount },
        { count: messagesCount },
        { data: recentNotifs }
      ] = await Promise.all([studentsQ, teachersQ, classesQ, messagesQ, notifsQ]);

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

      {/* ── DÉLÉGUÉ DÉPARTEMENTAL (super_admin) ── */}
      {user?.role === 'super_admin' && (
        <>
          {/* Bannière rôle */}
          <div style={{
            marginBottom: '24px', padding: '16px 22px', borderRadius: '14px',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.05))',
            border: '1.5px solid rgba(245,158,11,0.3)',
            display: 'flex', alignItems: 'center', gap: '14px',
          }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldAlert size={22} color="#f59e0b" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-dark)' }}>Délégué Départemental</div>
              <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '1px' }}>
                Vue globale — tous les établissements du département
              </div>
            </div>
          </div>

          {/* Stats globales */}
          {loadingSuper ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Loader size={22} /> Chargement des statistiques globales…
            </div>
          ) : (
            <>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                {[
                  { icon: <Building2 size={28} />, color: 'amber', label: 'Établissements', value: superStats.institutions, trend: 'Dans le département' },
                  { icon: <GraduationCap size={28} />, color: 'green', label: 'Total Élèves', value: superStats.students, trend: 'Tous établissements' },
                  { icon: <Users size={28} />, color: 'blue', label: 'Total Enseignants', value: superStats.teachers, trend: 'Corps enseignant global' },
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

              {/* Cartes par établissement */}
              <div className="card" style={{ marginTop: '24px' }}>
                <div className="card-header">
                  <div>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building2 size={18} /> Établissements enregistrés
                    </h3>
                    <p>Effectifs par établissement</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn-sm btn-outline" onClick={fetchSuperAdminStats}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                      <RefreshCw size={12} /> Actualiser
                    </button>
                    <button className="btn-sm btn-green" onClick={() => { setInstForm({ name: '', code: '' }); setInstError(''); setShowInstModal(true); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                      <Plus size={13} /> Nouvel établissement
                    </button>
                  </div>
                </div>
                <div className="card-body">
                  {instCards.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)', fontSize: '13px' }}>
                      Aucun établissement trouvé. Ajoutez-en dans la table <code>institutions</code>.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {instCards.map((inst, idx) => {
                        const colors = ['var(--green)', 'var(--blue-accent)', '#8b5cf6', '#f59e0b', '#ef4444'];
                        const color  = colors[idx % colors.length];
                        const total  = inst.students + inst.teachers;
                        return (
                          <div key={inst.id} style={{
                            display: 'flex', alignItems: 'center', gap: '16px',
                            padding: '14px 16px', borderRadius: '12px',
                            background: 'var(--bg)', border: '1px solid var(--border)',
                          }}>
                            <div style={{
                              width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                              background: color + '18',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <School size={20} color={color} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark)', marginBottom: '6px' }}>
                                {inst.name}
                                {inst.code && <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-light)', fontWeight: 400 }}>[{inst.code}]</span>}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ flex: 1, height: '5px', background: 'var(--border)', borderRadius: '20px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: superStats.students > 0 ? `${Math.round((inst.students / superStats.students) * 100)}%` : '0%', background: color, borderRadius: '20px', transition: 'width 0.6s ease' }} />
                                </div>
                                <span style={{ fontSize: '12px', color: 'var(--text-light)', whiteSpace: 'nowrap' }}>
                                  <strong style={{ color: 'var(--text-dark)' }}>{inst.students}</strong> élèves ·{' '}
                                  <strong style={{ color: 'var(--text-dark)' }}>{inst.teachers}</strong> enseignants
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── Modal création établissement ── */}
      {showInstModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)', zIndex: 1300,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: '20px', padding: '28px',
            width: '100%', maxWidth: '420px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
            border: '1px solid var(--border)',
            animation: 'fade-up 0.3s ease',
          }}>
            {/* En-tête */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '22px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: 'rgba(0,168,107,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Building2 size={22} color="var(--green)" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>
                  Nouvel établissement
                </h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-light)' }}>
                  Sera disponible lors de l'inscription des admins
                </p>
              </div>
              <button onClick={() => setShowInstModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>

            {/* Formulaire */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '7px' }}>
                  Nom de l'établissement *
                </label>
                <input
                  type="text"
                  placeholder="Ex : Lycée Général Leclerc"
                  value={instForm.name}
                  onChange={e => setInstForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: '10px',
                    border: `1.5px solid ${instError ? '#ef4444' : 'var(--border)'}`,
                    background: 'var(--bg)', color: 'var(--text-dark)',
                    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.2s',
                  }}
                  onKeyDown={e => e.key === 'Enter' && createInstitution()}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '7px' }}>
                  Code / Sigle <span style={{ fontWeight: 400, textTransform: 'none' }}>(optionnel)</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex : LGL, CES-MVOG"
                  value={instForm.code}
                  onChange={e => setInstForm(f => ({ ...f, code: e.target.value }))}
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: '10px',
                    border: '1.5px solid var(--border)',
                    background: 'var(--bg)', color: 'var(--text-dark)',
                    fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                  }}
                  onKeyDown={e => e.key === 'Enter' && createInstitution()}
                />
              </div>

              {instError && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px',
                  background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                  fontSize: '13px', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  <AlertTriangle size={14} /> {instError}
                </div>
              )}
            </div>

            {/* Boutons */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
              <button onClick={() => setShowInstModal(false)}
                style={{
                  flex: 1, padding: '11px', borderRadius: '10px',
                  border: '1.5px solid var(--border)', background: 'transparent',
                  color: 'var(--text-mid)', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
                }}>
                Annuler
              </button>
              <button onClick={createInstitution} disabled={savingInst || !instForm.name.trim()}
                style={{
                  flex: 2, padding: '11px', borderRadius: '10px', border: 'none',
                  background: savingInst || !instForm.name.trim() ? 'var(--border)' : 'var(--green)',
                  color: savingInst || !instForm.name.trim() ? 'var(--text-light)' : '#fff',
                  cursor: savingInst || !instForm.name.trim() ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '14px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px',
                  transition: 'background 0.2s',
                }}>
                {savingInst ? <><Loader size={14} /> Création…</> : <><Plus size={14} /> Créer l'établissement</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ADMIN (par établissement) ── */}
      {user?.role === 'admin' && (
        <>
          {/* Bannière établissement */}
          {adminInstitution && (
            <div style={{
              marginBottom: '20px', padding: '13px 18px', borderRadius: '12px',
              background: 'rgba(59,130,246,0.07)', border: '1.5px solid rgba(59,130,246,0.25)',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}>
              <Building2 size={18} color="var(--blue-accent)" />
              <div style={{ fontSize: '13px' }}>
                <span style={{ color: 'var(--text-light)' }}>Vous gérez l'établissement : </span>
                <strong style={{ color: 'var(--blue-accent)' }}>{adminInstitution}</strong>
              </div>
            </div>
          )}

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

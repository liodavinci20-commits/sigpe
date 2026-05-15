import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, Search, Bell, Mail, GraduationCap, Users, Loader, X, CheckCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

// Groupes de notifs visibles par rôle
const targetGroupsForRole = (role) => {
  if (role === 'admin' || role === 'sub_admin') return null; // tout voir
  if (role === 'teacher_course' || role === 'teacher_head' || role === 'counselor') return ['all', 'staff'];
  if (role === 'student')  return ['all', 'students'];
  if (role === 'parent')   return ['all', 'parents'];
  return ['all'];
};

const Header = () => {
  const { user }  = useAuth();
  const navigate  = useNavigate();

  // ── Notifications ──────────────────────────────────────────
  const [unreadCount,    setUnreadCount]    = useState(0);
  const [ringing,        setRinging]        = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [notifs,         setNotifs]         = useState([]);
  const [loadingNotifs,  setLoadingNotifs]  = useState(false);
  const bellRef    = useRef(null);
  const channelRef = useRef(null);

  // ── Recherche ──────────────────────────────────────────────
  const [query,       setQuery]       = useState('');
  const [results,     setResults]     = useState({ students: [], classes: [] });
  const [searching,   setSearching]   = useState(false);
  const [showDrop,    setShowDrop]    = useState(false);
  const searchRef  = useRef(null);
  const debounceRef = useRef(null);

  // Charger le compteur initial de notifs non lues
  useEffect(() => {
    if (!user || user.isDemo) return;
    loadUnreadCount();
    subscribeToNotifications();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [user]);

  const loadUnreadCount = async () => {
    try {
      const groups = targetGroupsForRole(user.role);
      let query = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false);

      if (groups) query = query.in('target_group', groups);

      const { count } = await query;
      setUnreadCount(count || 0);
    } catch (err) {
      console.error('Erreur notifs:', err);
    }
  };

  const subscribeToNotifications = () => {
    const groups = targetGroupsForRole(user.role);

    const channel = supabase
      .channel(`notifs-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const tg = payload.new?.target_group;
          // Vérifier si cette notif concerne ce rôle
          const relevant = !groups || groups.includes(tg);
          if (!relevant) return;

          // Incrémenter le compteur
          setUnreadCount(prev => prev + 1);

          // Déclencher l'animation de la cloche
          setRinging(true);
          setTimeout(() => setRinging(false), 1200);
        }
      )
      .subscribe();

    channelRef.current = channel;
  };

  // Fermer le panneau si clic en dehors
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setShowNotifPanel(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchNotifications = async () => {
    setLoadingNotifs(true);
    try {
      const groups = targetGroupsForRole(user.role);
      let q = supabase
        .from('notifications')
        .select('id, title, content, type, created_at, is_read, target_group')
        .order('created_at', { ascending: false })
        .limit(20);
      if (groups) q = q.in('target_group', groups);
      const { data } = await q;
      setNotifs(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  const handleBellClick = async () => {
    const next = !showNotifPanel;
    setShowNotifPanel(next);
    if (next) {
      setUnreadCount(0);
      fetchNotifications();
    }
  };

  const fmtDate = (iso) => {
    if (!iso) return '';
    const d   = new Date(iso);
    const now  = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60)   return 'À l\'instant';
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  };

  const typeColor = {
    info:    { bg: '#dcfce7', color: '#16a34a', label: 'Info' },
    warning: { bg: '#fef9c3', color: '#ca8a04', label: 'Alerte' },
    urgent:  { bg: '#fee2e2', color: '#ef4444', label: 'Urgent' },
  };

  // ── Recherche avec debounce 300ms ─────────────────────────
  const handleSearch = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    if (!q.trim() || q.trim().length < 2) { setResults({ students: [], classes: [] }); setShowDrop(false); return; }
    debounceRef.current = setTimeout(() => runSearch(q.trim()), 300);
  };

  const runSearch = useCallback(async (q) => {
    if (!user || user.isDemo) return;
    setSearching(true);
    setShowDrop(true);
    try {
      const isTeacher = user.role === 'teacher_course' || user.role === 'teacher_head';

      // Pour un enseignant : limiter aux classes qui lui sont assignées
      let classIds = null;
      if (isTeacher) {
        const { data: csRows } = await supabase
          .from('class_subjects')
          .select('class_id')
          .eq('teacher_id', user.id);
        classIds = (csRows || []).map(r => r.class_id);
      }

      // Recherche élèves par nom ou matricule
      let studentQuery = supabase
        .from('profiles')
        .select('id, full_name, avatar_url, students(matricule, class_id, classes(name))')
        .eq('role', 'student')
        .ilike('full_name', `%${q}%`)
        .limit(5);

      // Recherche par matricule
      let matriculeQuery = supabase
        .from('students')
        .select('id, matricule, class_id, profiles(full_name, avatar_url), classes(name)')
        .ilike('matricule', `%${q}%`)
        .limit(4);

      // Recherche classes
      let classQuery = supabase
        .from('classes')
        .select('id, name, level')
        .ilike('name', `%${q}%`)
        .limit(4);

      // Si enseignant, filtrer sur ses classes uniquement
      if (classIds !== null && classIds.length > 0) {
        studentQuery   = studentQuery.in('students.class_id', classIds);
        matriculeQuery = matriculeQuery.in('class_id', classIds);
        classQuery     = classQuery.in('id', classIds);
      } else if (classIds !== null && classIds.length === 0) {
        // Enseignant sans classe assignée → rien
        setResults({ students: [], classes: [] });
        setSearching(false);
        return;
      }

      const [{ data: byName }, { data: byMatricule }, { data: classRows }] = await Promise.all([
        studentQuery, matriculeQuery, classQuery
      ]);

      // Fusionner et dédupliquer les élèves
      const seen = new Set();
      const students = [];
      (byName || []).filter(p => p.students).forEach(p => {
        if (seen.has(p.id)) return; seen.add(p.id);
        students.push({ id: p.id, name: p.full_name, avatar: p.avatar_url, matricule: p.students?.matricule, className: p.students?.classes?.name });
      });
      (byMatricule || []).forEach(s => {
        if (seen.has(s.id)) return; seen.add(s.id);
        students.push({ id: s.id, name: s.profiles?.full_name, avatar: s.profiles?.avatar_url, matricule: s.matricule, className: s.classes?.name });
      });

      setResults({ students, classes: classRows || [] });
    } catch (err) {
      console.error('Erreur recherche:', err);
    } finally {
      setSearching(false);
    }
  }, [user]);

  // Fermer le dropdown si clic en dehors
  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowDrop(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const goToStudent = (studentId) => {
    setShowDrop(false); setQuery('');
    navigate('/students');
  };

  const goToClass = (classId) => {
    setShowDrop(false); setQuery('');
    navigate('/grades');
  };

  const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';

  return (
    <header className="header">
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes bell-ring {
          0%   { transform: rotate(0deg);   }
          10%  { transform: rotate(18deg);  }
          20%  { transform: rotate(-16deg); }
          30%  { transform: rotate(14deg);  }
          40%  { transform: rotate(-12deg); }
          50%  { transform: rotate(10deg);  }
          60%  { transform: rotate(-8deg);  }
          70%  { transform: rotate(6deg);   }
          80%  { transform: rotate(-4deg);  }
          90%  { transform: rotate(2deg);   }
          100% { transform: rotate(0deg);   }
        }
        .bell-ringing {
          animation: bell-ring 0.9s ease-in-out;
          transform-origin: top center;
          color: var(--green) !important;
        }
        .bell-badge {
          position: absolute;
          top: -4px; right: -4px;
          min-width: 16px; height: 16px;
          background: #ef4444;
          color: #fff;
          font-size: 10px; font-weight: 800;
          border-radius: 8px;
          display: flex; align-items: center; justify-content: center;
          padding: 0 3px;
          border: 2px solid var(--card-bg, #1e293b);
          pointer-events: none;
        }
      `}</style>

      <button className="hamburger" aria-label="Menu"><Menu size={20} /></button>

      <div className="header-breadcrumb">
        <h2>Tableau de Bord</h2>
        <p>Vue d'ensemble</p>
      </div>

      {/* Barre de recherche avec dropdown Supabase */}
      <div className="header-search" ref={searchRef} style={{ position: 'relative' }}>
        <span>{searching ? <Loader size={16} style={{ animation: 'spin 0.8s linear infinite' }} /> : <Search size={16} />}</span>
        <input
          type="text"
          placeholder="Rechercher un élève, classe…"
          value={query}
          onChange={handleSearch}
          onFocus={() => { if (query.length >= 2) setShowDrop(true); }}
          autoComplete="off"
        />
        {query && (
          <button onClick={() => { setQuery(''); setShowDrop(false); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', padding: '0 4px', display: 'flex' }}>
            <X size={14} />
          </button>
        )}

        {/* Dropdown résultats */}
        {showDrop && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
            background: 'var(--card-bg, #1e293b)',
            border: '1.5px solid rgba(255,255,255,0.1)',
            borderRadius: '14px', boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
            zIndex: 9999, overflow: 'hidden', minWidth: '340px',
          }}>

            {/* Élèves */}
            {results.students.length > 0 && (
              <div>
                <div style={{ padding: '8px 14px 4px', fontSize: '10px', fontWeight: 800, color: 'var(--text-light)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Élèves
                </div>
                {results.students.map(s => (
                  <div key={s.id} onClick={() => goToStudent(s.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {s.avatar
                      ? <img src={s.avatar} alt="" style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      : <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--green)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                          {initials(s.name)}
                        </div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-dark)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name || '—'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>
                        {s.matricule || 'Sans matricule'}{s.className ? ` · ${s.className}` : ''}
                      </div>
                    </div>
                    <Users size={13} color="var(--text-light)" />
                  </div>
                ))}
              </div>
            )}

            {/* Séparateur */}
            {results.students.length > 0 && results.classes.length > 0 && (
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />
            )}

            {/* Classes */}
            {results.classes.length > 0 && (
              <div>
                <div style={{ padding: '8px 14px 4px', fontSize: '10px', fontWeight: 800, color: 'var(--text-light)', letterSpacing: '1px', textTransform: 'uppercase' }}>
                  Classes
                </div>
                {results.classes.map(c => (
                  <div key={c.id} onClick={() => goToClass(c.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(59,130,246,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <GraduationCap size={15} color="var(--blue-accent, #3b82f6)" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-dark)' }}>{c.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-light)' }}>{c.level || 'Classe'}</div>
                    </div>
                    <GraduationCap size={13} color="var(--text-light)" />
                  </div>
                ))}
              </div>
            )}

            {/* Aucun résultat */}
            {!searching && results.students.length === 0 && results.classes.length === 0 && (
              <div style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px' }}>
                Aucun résultat pour « {query} »
              </div>
            )}

            {/* Chargement */}
            {searching && (
              <div style={{ padding: '16px 14px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Loader size={14} /> Recherche en cours…
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cloche avec animation, badge et panneau */}
      <div ref={bellRef} style={{ position: 'relative' }}>
        <div
          className="header-notif"
          title={unreadCount > 0 ? `${unreadCount} notification(s) non lue(s)` : 'Notifications'}
          onClick={handleBellClick}
          style={{ position: 'relative', cursor: 'pointer', background: showNotifPanel ? 'var(--green-pale)' : undefined, borderColor: showNotifPanel ? 'var(--green)' : undefined }}
        >
          <Bell
            size={18}
            className={ringing ? 'bell-ringing' : ''}
            style={{ transition: 'color 0.3s', color: showNotifPanel || unreadCount > 0 ? 'var(--green)' : undefined }}
          />
          {unreadCount > 0 && (
            <span className="bell-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>

        {/* ── Panneau notifications ── */}
        {showNotifPanel && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 12px)', right: 0,
            width: '360px', maxHeight: '480px',
            background: 'var(--bg-card)',
            border: '1.5px solid var(--border)',
            borderRadius: '16px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            zIndex: 9999, display: 'flex', flexDirection: 'column',
            overflow: 'hidden', animation: 'fade-up 0.2s ease',
          }}>
            {/* En-tête */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={15} color="var(--green)" />
                <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text-dark)' }}>Notifications</span>
              </div>
              <button onClick={() => setShowNotifPanel(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', display: 'flex', padding: '2px' }}>
                <X size={16} />
              </button>
            </div>

            {/* Liste */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingNotifs ? (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '13px' }}>
                  <Loader size={16} /> Chargement…
                </div>
              ) : notifs.length === 0 ? (
                <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-light)' }}>
                  <Bell size={32} style={{ opacity: 0.2, marginBottom: '10px' }} />
                  <p style={{ fontSize: '13px', margin: 0 }}>Aucune notification pour le moment.</p>
                </div>
              ) : (
                notifs.map((n, i) => {
                  const t = typeColor[n.type] || typeColor.info;
                  return (
                    <div key={n.id} style={{
                      padding: '12px 16px',
                      borderBottom: i < notifs.length - 1 ? '1px solid var(--bg)' : 'none',
                      display: 'flex', gap: '10px', alignItems: 'flex-start',
                      transition: 'background 0.15s',
                      cursor: 'default',
                    }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Badge type */}
                      <span style={{
                        flexShrink: 0, marginTop: '2px',
                        fontSize: '10px', fontWeight: 800,
                        padding: '2px 7px', borderRadius: '4px',
                        background: t.bg, color: t.color,
                      }}>
                        {t.label}
                      </span>

                      {/* Contenu */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-dark)', marginBottom: '3px', lineHeight: 1.3 }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-light)', lineHeight: 1.5, marginBottom: '5px' }}>
                          {n.content}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-light)', opacity: 0.7 }}>
                          {fmtDate(n.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pied */}
            {notifs.length > 0 && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CheckCheck size={13} /> {notifs.length} notification{notifs.length > 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="header-notif" title="Messages">
        <Mail size={18} />
      </div>

      <img
        className="header-avatar"
        src={user?.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80'}
        alt={user?.name || 'User'}
        onError={e => { e.target.style.background = 'var(--green)'; }}
      />
    </header>
  );
};

export default Header;

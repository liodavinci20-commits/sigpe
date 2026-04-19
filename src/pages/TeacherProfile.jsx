import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import {
  User, Phone, BookOpen, GraduationCap, School,
  Camera, Loader, CheckCircle, AlertTriangle
} from 'lucide-react';

const TeacherProfile = () => {
  const { user, setUser } = useAuth();

  const [loading,       setLoading]       = useState(true);
  const [profile,       setProfile]       = useState(null);
  const [myClass,       setMyClass]       = useState(null);   // teacher_head seulement
  const [classSubjects, setClassSubjects] = useState([]);      // cours enseignés
  const [notification,  setNotification]  = useState(null);
  const [avatarFile,    setAvatarFile]    = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving,        setSaving]        = useState(false);

  const showNotif = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4500);
  };

  useEffect(() => {
    if (!user || user.isDemo) { setLoading(false); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Profil de base
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, role')
        .eq('id', user.id)
        .single();
      setProfile(profileRow);

      // 2. Classe du titulaire (teacher_head)
      if (user.role === 'teacher_head') {
        const { data: cls } = await supabase
          .from('classes')
          .select('id, name, level')
          .eq('head_teacher_id', user.id)
          .limit(1);
        setMyClass(cls?.[0] || null);
      }

      // 3. Matières enseignées (teacher_course et teacher_head peuvent enseigner)
      const { data: csRows } = await supabase
        .from('class_subjects')
        .select('coefficient, classes(name, level), subjects(name)')
        .eq('teacher_id', user.id)
        .order('classes(name)');
      setClassSubjects(csRows || []);
    } catch (err) {
      console.error('TeacherProfile load:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let avatarUrl = null;
      if (avatarFile) {
        const ext  = avatarFile.name.split('.').pop();
        const path = `avatars/${user.id}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('avatars').upload(path, avatarFile, { upsert: true });
        if (uploadErr) showNotif('error', `Photo non sauvegardée : ${uploadErr.message}`);
        else {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          avatarUrl = urlData.publicUrl;
        }
      }

      const update = { updated_at: new Date().toISOString() };
      if (avatarUrl) update.avatar_url = avatarUrl;

      const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
      if (error) throw error;

      if (avatarUrl) {
        setProfile(prev => ({ ...prev, avatar_url: avatarUrl }));
        setUser(prev => ({ ...prev, avatar: avatarUrl }));
      }
      showNotif('success', 'Profil mis à jour avec succès !');
    } catch (err) {
      showNotif('error', 'Erreur : ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const initials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <section className="page-section active" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-light)' }}>
          <Loader size={32} style={{ marginBottom: '12px' }} />
          <p>Chargement du profil…</p>
        </div>
      </section>
    );
  }

  const displayName  = profile?.full_name  || user?.name  || '—';
  const displayAvatar = avatarPreview || profile?.avatar_url || user?.avatar || null;

  return (
    <section className="page-section active">

      {/* Notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          background: notification.type === 'success' ? 'var(--green)' : '#ef4444',
          color: '#fff', padding: '13px 20px', borderRadius: '10px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '10px',
          fontWeight: 600, fontSize: '14px',
        }}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {notification.text}
        </div>
      )}

      <div className="page-top-bar">
        <h3>Mon Profil Enseignant</h3>
        {!user?.isDemo && (
          <button className="btn-sm btn-green" onClick={handleSave} disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {saving ? <Loader size={14} /> : <CheckCircle size={14} />}
            {saving ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>

        {/* ── Carte identité ── */}
        <div className="card">
          <div className="card-header">
            <div><h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><User size={17} /> Informations Personnelles</h3></div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>

            {/* Avatar */}
            <div style={{ position: 'relative' }}>
              <div style={{
                width: '96px', height: '96px', borderRadius: '50%',
                border: '3px solid var(--green)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(34,197,94,0.08)',
              }}>
                {displayAvatar ? (
                  <img src={displayAvatar} alt="avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontWeight: 900, fontSize: '28px', color: 'var(--green)' }}>
                    {initials(displayName)}
                  </span>
                )}
              </div>
              {!user?.isDemo && (
                <label htmlFor="avatar-tp" style={{
                  position: 'absolute', bottom: '0', right: '0',
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: 'var(--green)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}>
                  <Camera size={14} color="#fff" />
                  <input id="avatar-tp" type="file" accept="image/*"
                    style={{ display: 'none' }} onChange={handleAvatarChange} />
                </label>
              )}
            </div>

            {/* Nom + rôle */}
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ margin: '0 0 4px', fontSize: '18px', color: 'var(--text-dark)' }}>{displayName}</h2>
              <span style={{
                padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                background: 'rgba(34,197,94,0.1)', color: 'var(--green)',
              }}>
                {user?.displayRole || user?.role}
              </span>
            </div>

            {/* Infos */}
            <div style={{ width: '100%', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
              <div className="info-row">
                <span className="info-key">Email</span>
                <span className="info-val" style={{ fontSize: '12px' }}>{user?.email || '—'}</span>
              </div>
              {myClass && (
                <div className="info-row">
                  <span className="info-key">Classe titulaire</span>
                  <span className="info-val">
                    <span style={{
                      padding: '3px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                      background: 'rgba(102,126,234,0.12)', color: '#667EEA',
                    }}>
                      {myClass.name}
                    </span>
                  </span>
                </div>
              )}
              <div className="info-row">
                <span className="info-key">Cours enseignés</span>
                <span className="info-val" style={{ fontWeight: 700, color: 'var(--green)' }}>
                  {classSubjects.length} classe{classSubjects.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Matières & Classes ── */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={17} /> Mes Matières &amp; Classes
              </h3>
              <p>{classSubjects.length} affectation{classSubjects.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="card-body">
            {user?.isDemo ? (
              /* Démo mock */
              [
                { sub: 'Mathématiques', cls: '3ème B', coeff: 4 },
                { sub: 'Mathématiques', cls: '2nde A', coeff: 4 },
                { sub: 'Algèbre',       cls: 'Tle C',  coeff: 3 },
              ].map((r, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: 'rgba(59,130,246,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <BookOpen size={16} color="#3B82F6" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark)' }}>{r.sub}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <School size={11} /> {r.cls}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                    background: 'rgba(34,197,94,0.1)', color: 'var(--green)',
                  }}>×{r.coeff}</span>
                </div>
              ))
            ) : classSubjects.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)', fontSize: '13px' }}>
                Aucune matière assignée pour l'instant.<br />
                Contactez l'administration.
              </div>
            ) : (
              classSubjects.map((cs, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: i < classSubjects.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '10px',
                      background: 'rgba(59,130,246,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <BookOpen size={16} color="#3B82F6" />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark)' }}>
                        {cs.subjects?.name || '—'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <School size={11} /> {cs.classes?.name || '—'} {cs.classes?.level ? `· ${cs.classes.level}` : ''}
                      </div>
                    </div>
                  </div>
                  <span style={{
                    padding: '3px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: 700,
                    background: 'rgba(34,197,94,0.1)', color: 'var(--green)',
                  }}>×{cs.coefficient || 1}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Classe titulaire (teacher_head seulement) ── */}
        {(user?.role === 'teacher_head' || user?.isDemo) && (
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-header">
              <div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <GraduationCap size={17} /> Ma Classe Titulaire
                </h3>
                <p>{myClass ? `${myClass.name} · ${myClass.level}` : 'Aucune classe assignée'}</p>
              </div>
            </div>
            <div className="card-body">
              {myClass || user?.isDemo ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '16px',
                  padding: '16px', borderRadius: '12px',
                  background: 'rgba(102,126,234,0.07)', border: '1px solid rgba(102,126,234,0.2)',
                }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '16px',
                    background: 'linear-gradient(135deg, #667EEA, #764BA2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <GraduationCap size={26} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text-dark)' }}>
                      {user?.isDemo ? '3ème B' : myClass?.name}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '4px' }}>
                      {user?.isDemo ? 'Collège' : myClass?.level} · En tant que Professeur Titulaire
                    </div>
                    <div style={{ fontSize: '12px', color: '#667EEA', marginTop: '6px', fontWeight: 600 }}>
                      Responsable du suivi académique, des bulletins et de la communication avec les parents
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)', fontSize: '13px' }}>
                  Aucune classe titulaire assignée. Contactez l'administration.
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </section>
  );
};

export default TeacherProfile;

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Camera, Loader, CheckCircle, AlertTriangle, ShieldAlert, Mail, Phone, Building2, Save } from 'lucide-react';

const SuperAdminProfile = () => {
  const { user, setUser } = useAuth();

  const [profile,       setProfile]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [saving,        setSaving]        = useState(false);
  const [notification,  setNotification]  = useState(null);

  const [fullName,      setFullName]      = useState('');
  const [phone,         setPhone]         = useState('');
  const [avatarFile,    setAvatarFile]    = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const showNotif = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4500);
  };

  useEffect(() => {
    if (!user || user.isDemo) { setLoading(false); return; }
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, phone, role')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data);
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
        setAvatarPreview(data.avatar_url || null);
      }
    } catch (err) {
      console.error(err);
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
    if (!fullName.trim()) { showNotif('error', 'Le nom est obligatoire.'); return; }
    setSaving(true);
    try {
      let avatarUrl = profile?.avatar_url || null;

      // Upload photo si nouvelle sélectionnée
      if (avatarFile) {
        const ext  = avatarFile.name.split('.').pop();
        const path = `avatars/${user.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true });
        if (upErr) {
          showNotif('error', 'Upload photo échoué : ' + upErr.message);
          setSaving(false);
          return;
        }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      const { error } = await supabase.from('profiles').update({
        full_name:  fullName.trim(),
        phone:      phone.trim() || null,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id);

      if (error) throw error;

      // Mettre à jour le contexte Auth
      setUser(prev => ({
        ...prev,
        name:   fullName.trim(),
        avatar: avatarUrl || prev.avatar,
      }));

      setProfile(prev => ({ ...prev, full_name: fullName.trim(), avatar_url: avatarUrl }));
      setAvatarFile(null);
      if (avatarUrl) setAvatarPreview(avatarUrl);
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

  if (loading) return (
    <section className="page-section active">
      <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <Loader size={22} /> Chargement du profil…
      </div>
    </section>
  );

  return (
    <section className="page-section active">

      {/* Toast */}
      {notification && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 9999,
          background: notification.type === 'success' ? 'var(--green)' : '#ef4444',
          color: '#fff', padding: '13px 22px', borderRadius: '10px',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '14px',
        }}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {notification.text}
        </div>
      )}

      {/* ── Bannière header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #06112A 0%, #0D2149 100%)',
        borderRadius: '16px', padding: '28px', marginBottom: '24px',
        display: 'flex', alignItems: 'center', gap: '24px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Cercle décoratif */}
        <div style={{
          position: 'absolute', width: '220px', height: '220px', borderRadius: '50%',
          background: 'rgba(245,158,11,0.08)', border: '40px solid rgba(245,158,11,0.06)',
          right: '-60px', top: '-60px', pointerEvents: 'none',
        }} />

        {/* Avatar cliquable */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <input id="avatar-superadmin" type="file" accept="image/*"
            style={{ display: 'none' }} onChange={handleAvatarChange} />

          <div
            onClick={() => document.getElementById('avatar-superadmin').click()}
            title="Cliquer pour changer la photo"
            style={{
              width: '100px', height: '100px', borderRadius: '20px',
              border: '3px solid #f59e0b', cursor: 'pointer',
              overflow: 'hidden',
              background: 'rgba(245,158,11,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: '6px',
            }}
          >
            {avatarPreview ? (
              <img
                key={avatarPreview}
                src={avatarPreview}
                alt="avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <>
                <Camera size={24} color="#f59e0b" />
                <span style={{ fontSize: '10px', color: '#f59e0b', fontWeight: 700, textAlign: 'center', lineHeight: 1.3 }}>
                  Ajouter<br />une photo
                </span>
              </>
            )}
          </div>
        </div>

        {/* Infos rapides */}
        <div style={{ flex: 1, zIndex: 1 }}>
          <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: 800, margin: '0 0 4px' }}>
            {profile?.full_name || user?.name || '—'}
          </h2>
          <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '12px' }}>
            Délégué Départemental · SIGPES
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: 'rgba(245,158,11,0.2)', color: '#fbbf24', border: '1px solid rgba(245,158,11,0.3)' }}>
              <ShieldAlert size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
              super_admin
            </span>
            <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)' }}>
              Vision globale — tous établissements
            </span>
          </div>
        </div>

        {avatarFile && (
          <div style={{ padding: '8px 14px', borderRadius: '10px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#86efac', fontSize: '12px', fontWeight: 600, zIndex: 1 }}>
            📷 Nouvelle photo — cliquez sur <strong>Enregistrer</strong>
          </div>
        )}
      </div>

      {/* ── Formulaire ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Colonne gauche : infos modifiables */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Mes informations</h3>
              <p>Modifiez votre nom et votre photo de profil</p>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Photo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px', borderRadius: '12px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '14px', flexShrink: 0,
                overflow: 'hidden', background: 'var(--green-pale)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontWeight: 800, fontSize: '18px', color: '#f59e0b' }}>{initials(fullName || user?.name)}</span>
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-dark)', marginBottom: '4px' }}>
                  Photo de profil
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>JPG ou PNG recommandé</div>
              </div>
              <button
                onClick={() => document.getElementById('avatar-superadmin').click()}
                className="btn-sm btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}
              >
                <Camera size={13} /> Changer
              </button>
            </div>

            {/* Nom */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '7px' }}>
                Nom complet *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Votre nom et prénom"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: '10px',
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text-dark)', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--green)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Téléphone */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '7px' }}>
                Téléphone professionnel
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+237 699 000 000"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: '10px',
                  border: '1.5px solid var(--border)', background: 'var(--bg)',
                  color: 'var(--text-dark)', fontSize: '14px', outline: 'none',
                  boxSizing: 'border-box', transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'var(--green)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Bouton sauvegarder */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-sm btn-green"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '12px', fontSize: '14px', borderRadius: '10px', marginTop: '4px' }}
            >
              {saving ? <><Loader size={15} /> Enregistrement…</> : <><Save size={15} /> Enregistrer les modifications</>}
            </button>
          </div>
        </div>

        {/* Colonne droite : infos non modifiables */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Mon compte</h3>
              <p>Informations système non modifiables</p>
            </div>
          </div>
          <div className="card-body">
            {[
              {
                icon: <Mail size={16} color="var(--blue-accent)" />,
                label: 'Adresse e-mail',
                value: profile?.email || user?.email || '—',
              },
              {
                icon: <ShieldAlert size={16} color="#f59e0b" />,
                label: 'Rôle système',
                value: 'Délégué Départemental',
              },
              {
                icon: <Building2 size={16} color="var(--green)" />,
                label: 'Périmètre',
                value: 'Tous les établissements',
              },
              {
                icon: <Phone size={16} color="var(--text-light)" />,
                label: 'Téléphone enregistré',
                value: phone || '—',
              },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 0',
                borderBottom: i < 3 ? '1px solid var(--bg)' : 'none',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
                  background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {row.icon}
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600, marginBottom: '2px' }}>
                    {row.label}
                  </div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-dark)' }}>
                    {row.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SuperAdminProfile;

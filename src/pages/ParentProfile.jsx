import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Camera, Loader, CheckCircle, AlertTriangle, Save, Mail, Phone, UserSquare2 } from 'lucide-react';

const ParentProfile = () => {
  const { user, setUser } = useAuth();

  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [notification, setNotification] = useState(null);

  const [fullName,      setFullName]      = useState('');
  const [phone,         setPhone]         = useState('');
  const [avatarFile,    setAvatarFile]    = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [email,         setEmail]         = useState('');

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
        .select('full_name, email, avatar_url, phone')
        .eq('id', user.id)
        .single();
      if (data) {
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
        setEmail(data.email || user.email || '');
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
      let avatarUrl = null;

      if (avatarFile) {
        const ext  = avatarFile.name.split('.').pop();
        const path = `avatars/${user.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('avatars').upload(path, avatarFile, { upsert: true });
        if (upErr) { showNotif('error', 'Upload photo : ' + upErr.message); setSaving(false); return; }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      }

      const update = {
        full_name:  fullName.trim(),
        phone:      phone.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (avatarUrl) update.avatar_url = avatarUrl;

      const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
      if (error) throw error;

      setUser(prev => ({
        ...prev,
        name:   fullName.trim(),
        ...(avatarUrl ? { avatar: avatarUrl } : {}),
      }));
      if (avatarUrl) setAvatarPreview(avatarUrl);
      setAvatarFile(null);
      showNotif('success', 'Profil mis à jour !');
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
        <Loader size={22} /> Chargement…
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
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '14px',
        }}>
          {notification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          {notification.text}
        </div>
      )}

      {/* Bannière */}
      <div style={{
        background: 'linear-gradient(135deg, #667EEA 0%, #764BA2 100%)',
        borderRadius: '16px', padding: '28px', marginBottom: '24px',
        display: 'flex', alignItems: 'center', gap: '24px',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.07)', right: '-50px', top: '-50px', pointerEvents: 'none' }} />

        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <input id="avatar-parent" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          <div
            onClick={() => document.getElementById('avatar-parent').click()}
            style={{
              width: '90px', height: '90px', borderRadius: '20px',
              border: '3px solid rgba(255,255,255,0.6)', cursor: 'pointer',
              overflow: 'hidden', background: 'rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '5px',
            }}
          >
            {avatarPreview ? (
              <img key={avatarPreview} src={avatarPreview} alt="avatar"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <>
                <Camera size={22} color="rgba(255,255,255,0.8)" />
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
                  Ajouter<br />photo
                </span>
              </>
            )}
          </div>
          {/* Bouton caméra */}
          <button onClick={() => document.getElementById('avatar-parent').click()}
            style={{
              position: 'absolute', bottom: '-6px', right: '-6px',
              width: '26px', height: '26px', borderRadius: '50%',
              background: '#fff', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
            }}>
            <Camera size={13} color="#764BA2" />
          </button>
        </div>

        {/* Infos */}
        <div style={{ zIndex: 1 }}>
          <h2 style={{ color: '#fff', fontSize: '22px', fontWeight: 800, margin: '0 0 4px' }}>
            {fullName || user?.name || '—'}
          </h2>
          <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', marginBottom: '10px' }}>
            Parent d'élève · SIGPES
          </div>
          <span style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 700, background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
            Portail Parents
          </span>
        </div>

        {avatarFile && (
          <div style={{ marginLeft: 'auto', padding: '8px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '12px', fontWeight: 600, zIndex: 1 }}>
            📷 Cliquez sur <strong>Enregistrer</strong>
          </div>
        )}
      </div>

      {/* Formulaire */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

        {/* Infos modifiables */}
        <div className="card">
          <div className="card-header">
            <div><h3>Mes informations</h3><p>Modifiez votre profil</p></div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Aperçu photo */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px', borderRadius: '12px', background: 'var(--bg)', border: '1px solid var(--border)' }}>
              <div style={{ width: '50px', height: '50px', borderRadius: '12px', overflow: 'hidden', background: '#667EEA22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {avatarPreview
                  ? <img key={avatarPreview} src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontWeight: 800, fontSize: '16px', color: '#667EEA' }}>{initials(fullName)}</span>
                }
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-dark)', marginBottom: '2px' }}>Photo de profil</div>
                <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>JPG ou PNG · Visible dans l'app</div>
              </div>
              <button onClick={() => document.getElementById('avatar-parent').click()}
                className="btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                <Camera size={13} /> Changer
              </button>
            </div>

            {/* Nom */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '7px' }}>
                Nom complet *
              </label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Votre nom complet"
                style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dark)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#667EEA'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* Téléphone */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '7px' }}>
                Téléphone
              </label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="+237 699 000 000"
                style={{ width: '100%', padding: '11px 14px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dark)', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                onFocus={e => e.target.style.borderColor = '#667EEA'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            <button onClick={handleSave} disabled={saving} className="btn-sm btn-green"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '12px', fontSize: '14px', borderRadius: '10px', marginTop: '4px' }}>
              {saving ? <><Loader size={15} /> Enregistrement…</> : <><Save size={15} /> Enregistrer</>}
            </button>
          </div>
        </div>

        {/* Infos compte */}
        <div className="card">
          <div className="card-header">
            <div><h3>Mon compte</h3><p>Informations non modifiables</p></div>
          </div>
          <div className="card-body">
            {[
              { icon: <Mail size={16} color="#667EEA" />,          label: 'Adresse e-mail',  value: email || '—' },
              { icon: <UserSquare2 size={16} color="var(--green)" />, label: 'Rôle',           value: 'Parent d\'élève' },
              { icon: <Phone size={16} color="var(--text-light)" />, label: 'Téléphone',       value: phone || 'Non renseigné' },
            ].map((row, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0', borderBottom: i < 2 ? '1px solid var(--bg)' : 'none' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {row.icon}
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-light)', fontWeight: 600, marginBottom: '2px' }}>{row.label}</div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-dark)' }}>{row.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ParentProfile;

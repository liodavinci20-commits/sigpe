import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { ShieldAlert, Camera, CheckCircle, AlertTriangle, ChevronRight, ChevronLeft, Building2, Loader } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Mon identité'     },
  { id: 2, label: 'Mon établissement' },
];

const OnboardingAdmin = () => {
  const { user, setUser, logout } = useAuth();
  const navigate           = useNavigate();

  const [step,         setStep]         = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [notification, setNotification] = useState(null);

  // Étape 1
  const [fullName,      setFullName]      = useState(user?.name || '');
  const [phone,         setPhone]         = useState('');
  const [avatarFile,    setAvatarFile]    = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // Étape 2
  const [institutions,  setInstitutions]  = useState([]);
  const [loadingInst,   setLoadingInst]   = useState(false);
  const [institutionId, setInstitutionId] = useState('');

  const showNotif = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4500);
  };

  useEffect(() => {
    if (step === 2) loadInstitutions();
  }, [step]);

  const loadInstitutions = async () => {
    setLoadingInst(true);
    const { data } = await supabase
      .from('institutions')
      .select('id, name, code')
      .order('name');
    setInstitutions(data || []);
    setLoadingInst(false);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleNext = () => {
    if (step === 1) {
      if (!fullName.trim()) { showNotif('error', 'Veuillez saisir votre nom complet.'); return; }
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!institutionId) { showNotif('error', 'Veuillez sélectionner votre établissement.'); return; }
    setLoading(true);
    try {
      let avatarUrl = null;

      if (avatarFile) {
        const ext  = avatarFile.name.split('.').pop();
        const path = `avatars/${user.id}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('avatars').upload(path, avatarFile, { upsert: true });
        if (!upErr) {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          avatarUrl = urlData.publicUrl;
        }
      }

      const profileUpdate = {
        full_name:            fullName.trim(),
        phone:                phone.trim() || null,
        institution_id:       institutionId,
        onboarding_completed: true,
        updated_at:           new Date().toISOString(),
      };
      if (avatarUrl) profileUpdate.avatar_url = avatarUrl;

      const { error } = await supabase.from('profiles').update(profileUpdate).eq('id', user.id);
      if (error) throw error;

      setUser(prev => ({
        ...prev,
        name:                fullName.trim(),
        institutionId,
        onboardingCompleted: true,
        ...(avatarUrl ? { avatar: avatarUrl } : {}),
      }));

      showNotif('success', `Bienvenue, ${fullName.trim()} !`);
      setTimeout(() => navigate('/dashboard'), 1400);
    } catch (err) {
      showNotif('error', 'Erreur : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #06112A 0%, #0D2149 50%, #0B2D5A 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      {notification && (
        <div style={{
          position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
          background: notification.type === 'success' ? 'var(--green)' : '#ef4444',
          color: '#fff', padding: '14px 24px', borderRadius: '10px', zIndex: 9999,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
          gap: '10px', fontWeight: 600, fontSize: '14px',
        }}>
          {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          {notification.text}
        </div>
      )}

      <div style={{
        background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '24px', padding: '40px', width: '100%', maxWidth: '520px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '60px', height: '60px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px',
          }}>
            <ShieldAlert size={30} color="#fff" />
          </div>
          <h2 style={{ color: '#f1f5f9', margin: '0 0 6px', fontSize: '20px', fontWeight: 800 }}>
            Espace Administrateur
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
            Configurez votre profil pour accéder à la gestion de votre établissement.
          </p>
        </div>

        {/* Indicateur étapes */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
          {STEPS.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                padding: '5px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                background: step === s.id ? '#3b82f6' : step > s.id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)',
                color: step === s.id ? '#fff' : step > s.id ? '#93c5fd' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.3s',
              }}>
                {step > s.id && <CheckCircle size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                {s.label}
              </div>
              {s.id < STEPS.length && (
                <div style={{ width: '20px', height: '2px', background: step > s.id ? '#3b82f6' : 'rgba(255,255,255,0.1)', borderRadius: '2px' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── ÉTAPE 1 : Identité ── */}
        {step === 1 && (
          <div>
            {/* Avatar */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '90px', height: '90px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)', border: '3px dashed rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', marginBottom: '10px', cursor: 'pointer',
              }} onClick={() => document.getElementById('avatar-admin').click()}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Camera size={28} color="rgba(255,255,255,0.3)" />
                }
              </div>
              <input id="avatar-admin" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                onClick={() => document.getElementById('avatar-admin').click()}>
                Ajouter une photo (optionnel)
              </span>
            </div>

            <AdminField label="Nom complet *">
              <input type="text" placeholder="Ex : M. Jean Mballa" value={fullName}
                onChange={e => setFullName(e.target.value)} style={inputSt} />
            </AdminField>
            <AdminField label="Téléphone professionnel">
              <input type="tel" placeholder="Ex : +237 699 000 000" value={phone}
                onChange={e => setPhone(e.target.value)} style={inputSt} />
            </AdminField>
          </div>
        )}

        {/* ── ÉTAPE 2 : Établissement ── */}
        {step === 2 && (
          <div>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', marginBottom: '20px', lineHeight: 1.7 }}>
              Sélectionnez l'<strong style={{ color: '#f1f5f9' }}>établissement</strong> dont vous êtes responsable.
              Vous ne gérerez que les données de cet établissement.
            </p>

            {loadingInst ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Loader size={20} /> Chargement des établissements…
              </div>
            ) : institutions.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}>
                Aucun établissement trouvé.<br />
                <span style={{ fontSize: '12px', opacity: 0.6 }}>Contactez le Délégué Départemental.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                {institutions.map(inst => {
                  const selected = institutionId === inst.id;
                  return (
                    <div key={inst.id} onClick={() => setInstitutionId(inst.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '14px 16px', borderRadius: '12px', cursor: 'pointer',
                        border: `1.5px solid ${selected ? '#3b82f6' : 'rgba(255,255,255,0.1)'}`,
                        background: selected ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.03)',
                        transition: 'all 0.2s',
                      }}>
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                        background: selected ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.07)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Building2 size={20} color={selected ? '#93c5fd' : 'rgba(255,255,255,0.4)'} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: selected ? '#93c5fd' : '#f1f5f9' }}>
                          {inst.name}
                        </div>
                        {inst.code && (
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                            Code : {inst.code}
                          </div>
                        )}
                      </div>
                      {selected && <CheckCircle size={20} color="#3b82f6" />}
                    </div>
                  );
                })}
              </div>
            )}

            {institutionId && (
              <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', fontSize: '13px', color: '#93c5fd', fontWeight: 600 }}>
                ✓ Vous gérerez les données de : <strong>{institutions.find(i => i.id === institutionId)?.name}</strong>
              </div>
            )}
          </div>
        )}

        {/* Boutons navigation */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : logout()}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '11px 20px', borderRadius: '10px',
              border: '1.5px solid rgba(255,255,255,0.15)', background: 'transparent',
              color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 600, fontSize: '14px',
            }}>
            <ChevronLeft size={16} /> Retour
          </button>

          {step < STEPS.length ? (
            <button onClick={handleNext} style={{
              display: 'flex', alignItems: 'center', gap: '6px', flex: 1,
              padding: '12px 20px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '14px', justifyContent: 'center',
            }}>
              Continuer <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading || !institutionId} style={{
              display: 'flex', alignItems: 'center', gap: '6px', flex: 1,
              padding: '12px 20px', borderRadius: '10px', border: 'none',
              background: loading || !institutionId ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              color: '#fff', cursor: loading || !institutionId ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '14px', justifyContent: 'center',
            }}>
              {loading
                ? <><Loader size={15} /> Enregistrement…</>
                : <><CheckCircle size={16} /> Accéder à mon tableau de bord</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const AdminField = ({ label, children }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {label}
    </label>
    {children}
  </div>
);

const inputSt = {
  width: '100%', padding: '11px 14px', borderRadius: '10px',
  border: '1.5px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)', color: '#f1f5f9',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};

export default OnboardingAdmin;

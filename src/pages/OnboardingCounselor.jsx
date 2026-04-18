import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Camera, CheckCircle, AlertTriangle, ChevronRight, ChevronLeft, Loader, Compass } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Mon identité'   },
  { id: 2, label: 'Mes classes'    },
];


const OnboardingCounselor = () => {
  const { user, setUser } = useAuth();
  const navigate          = useNavigate();

  const [step,         setStep]         = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [notification, setNotification] = useState(null);

  // Étape 1
  const [fullName,      setFullName]      = useState(user?.name || '');
  const [phone,         setPhone]         = useState('');
  const [avatarFile,    setAvatarFile]    = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // Étape 2
  const [classes,         setClasses]         = useState([]);
  const [loadingClasses,  setLoadingClasses]  = useState(false);
  const [selectedClasses, setSelectedClasses] = useState(new Set());

  const showNotif = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4500);
  };

  useEffect(() => {
    if (step === 2) loadClasses();
  }, [step]);

  const loadClasses = async () => {
    setLoadingClasses(true);
    const { data } = await supabase
      .from('classes')
      .select('id, name, level')
      .order('level').order('name');
    setClasses(data || []);
    setLoadingClasses(false);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const toggleClass = (id) => {
    setSelectedClasses(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleNext = () => {
    if (!fullName.trim()) { showNotif('error', 'Veuillez saisir votre nom complet.'); return; }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (selectedClasses.size === 0) { showNotif('error', 'Veuillez sélectionner au moins une classe.'); return; }
    setLoading(true);

    try {
      let avatarUrl = null;

      if (avatarFile) {
        const ext  = avatarFile.name.split('.').pop();
        const path = `avatars/${user.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true });
        if (uploadError) {
          showNotif('error', `Photo non sauvegardée : ${uploadError.message}`);
          await new Promise(r => setTimeout(r, 2000));
        } else {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          avatarUrl = urlData.publicUrl;
        }
      }

      // Mettre à jour le profil
      const profileUpdate = {
        full_name:            fullName.trim(),
        onboarding_completed: true,
        updated_at:           new Date().toISOString(),
      };
      if (avatarUrl) profileUpdate.avatar_url = avatarUrl;

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);
      if (profileError) throw profileError;

      // Insérer dans class_subjects pour lier le conseiller à ses classes
      // (teacher_id = conseiller, pas de subject_id → on récupère l'année active)
      const { data: yearRow } = await supabase
        .from('academic_years')
        .select('id')
        .eq('is_current', true)
        .limit(1)
        .single();

      // Enregistrer les classes suivies dans notifications (info conseiller)
      const classNames = [...selectedClasses]
        .map(id => classes.find(c => c.id === id)?.name)
        .filter(Boolean)
        .join(', ');

      await supabase.from('notifications').insert({
        sender_id:    user.id,
        target_group: 'staff',
        title:        `${fullName.trim()} — Conseiller(ère) d'orientation inscrit(e)`,
        content:      `Classes suivies : ${classNames}.`,
        type:         'info',
      });

      setUser(prev => ({
        ...prev,
        name:               fullName.trim(),
        avatarUrl:          avatarUrl || prev.avatarUrl,
        onboardingCompleted: true,
      }));

      showNotif('success', `Bienvenue, ${fullName.trim()} ! Votre espace est prêt.`);
      setTimeout(() => navigate('/dashboard'), 1800);

    } catch (err) {
      showNotif('error', 'Erreur : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg-dark, #0f172a)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', fontFamily: 'var(--font, sans-serif)'
    }}>

      {notification && (
        <div style={{
          position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
          background: notification.type === 'success' ? '#0891b2' : '#ef4444',
          color: '#fff', padding: '14px 24px', borderRadius: '10px', zIndex: 9999,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
          gap: '10px', fontWeight: 600, fontSize: '14px', maxWidth: '90vw'
        }}>
          {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          {notification.text}
        </div>
      )}

      <div style={{
        background: 'var(--card-bg, #1e293b)', borderRadius: '20px',
        padding: '40px', width: '100%', maxWidth: '540px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)'
      }}>

        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg, #0891b2, #0e7490)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px'
          }}>
            <Compass size={28} color="#fff" />
          </div>
          <h2 style={{ color: 'var(--text-dark, #f1f5f9)', margin: '0 0 6px', fontSize: '20px' }}>
            Espace Conseiller d'Orientation
          </h2>
          <p style={{ color: 'var(--text-light, #94a3b8)', fontSize: '13px', margin: 0 }}>
            Configurez votre profil pour accompagner les élèves dans leur parcours.
          </p>
        </div>

        {/* Indicateur étapes */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
          {STEPS.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                background: step === s.id ? 'linear-gradient(135deg,#0891b2,#0e7490)' : step > s.id ? 'rgba(8,145,178,0.15)' : 'rgba(255,255,255,0.05)',
                color: step === s.id ? '#fff' : step > s.id ? '#0891b2' : 'var(--text-light, #94a3b8)',
                transition: 'all 0.3s'
              }}>
                {step > s.id && <CheckCircle size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                {s.label}
              </div>
              {s.id < STEPS.length && (
                <div style={{ width: '20px', height: '2px', background: step > s.id ? '#0891b2' : 'rgba(255,255,255,0.1)' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── ÉTAPE 1 : Identité ── */}
        {step === 1 && (
          <div>
            {/* Photo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '90px', height: '90px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)', border: '3px dashed rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', marginBottom: '10px', cursor: 'pointer'
              }} onClick={() => document.getElementById('avatar-counselor').click()}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Camera size={28} color="#64748b" />
                }
              </div>
              <input id="avatar-counselor" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              <span style={{ fontSize: '12px', color: 'var(--text-light, #94a3b8)', cursor: 'pointer' }}
                onClick={() => document.getElementById('avatar-counselor').click()}>
                Ajouter une photo (optionnel)
              </span>
            </div>

            <Field label="Nom complet *">
              <input type="text" placeholder="Ex : Dr. Kamga Boris" value={fullName}
                onChange={e => setFullName(e.target.value)} style={inputStyle} />
            </Field>

            <Field label="Téléphone professionnel">
              <input type="tel" placeholder="Ex : +237 699 000 000" value={phone}
                onChange={e => setPhone(e.target.value)} style={inputStyle} />
            </Field>

            <div style={{
              marginTop: '4px', padding: '12px 16px', borderRadius: '10px',
              background: 'rgba(8,145,178,0.07)', border: '1px solid #0891b2',
              fontSize: '13px', color: '#94a3b8', lineHeight: 1.6
            }}>
              ℹ️ En tant que <strong style={{ color: '#f1f5f9' }}>Conseiller d'Orientation</strong>, vous guidez les élèves dans leurs choix de parcours scolaire et professionnel.
            </div>
          </div>
        )}

        {/* ── ÉTAPE 2 : Classes ── */}
        {step === 2 && (
          <div>
            <p style={{ color: 'var(--text-light, #94a3b8)', fontSize: '13px', marginBottom: '16px', lineHeight: 1.6 }}>
              Sélectionnez les <strong style={{ color: 'var(--text-dark, #f1f5f9)' }}>classes</strong> dont vous assurez le suivi d'orientation.
            </p>

            {loadingClasses ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Loader size={20} /> Chargement des classes…
              </div>
            ) : classes.length === 0 ? (
              <div style={{ padding: '18px', borderRadius: '10px', background: 'rgba(249,115,22,0.07)', border: '1px solid var(--orange,#f97316)', color: 'var(--orange,#f97316)', fontSize: '13px' }}>
                Aucune classe disponible. Contactez l'administration.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                {classes.map(cls => {
                  const selected = selectedClasses.has(cls.id);
                  return (
                    <div key={cls.id} onClick={() => toggleClass(cls.id)} style={{
                      padding: '14px', borderRadius: '12px', cursor: 'pointer',
                      border: `1.5px solid ${selected ? '#0891b2' : 'rgba(255,255,255,0.1)'}`,
                      background: selected ? 'rgba(8,145,178,0.1)' : 'rgba(255,255,255,0.03)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'all 0.2s',
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark, #f1f5f9)' }}>{cls.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-light, #94a3b8)', marginTop: '2px' }}>{cls.level}</div>
                      </div>
                      {selected && <CheckCircle size={18} color="#0891b2" />}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedClasses.size > 0 && (
              <div style={{ marginTop: '14px', padding: '10px 16px', borderRadius: '8px', background: 'rgba(8,145,178,0.08)', border: '1px solid #0891b2', fontSize: '13px', color: '#0891b2', fontWeight: 600 }}>
                ✓ {selectedClasses.size} classe{selectedClasses.size > 1 ? 's' : ''} sélectionnée{selectedClasses.size > 1 ? 's' : ''}
              </div>
            )}
          </div>
        )}

        {/* Boutons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '28px', gap: '12px' }}>
          {step > 1 ? (
            <button onClick={() => setStep(s => s - 1)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '11px 20px', borderRadius: '10px', border: '1.5px solid rgba(255,255,255,0.15)',
              background: 'transparent', color: 'var(--text-light, #94a3b8)',
              cursor: 'pointer', fontWeight: 600, fontSize: '14px'
            }}>
              <ChevronLeft size={16} /> Retour
            </button>
          ) : <div />}

          {step < STEPS.length ? (
            <button onClick={handleNext} style={{
              display: 'flex', alignItems: 'center', gap: '6px', flex: 1,
              padding: '12px 20px', borderRadius: '10px', border: 'none',
              background: 'linear-gradient(135deg, #0891b2, #0e7490)',
              color: '#fff', cursor: 'pointer', fontWeight: 700,
              fontSize: '14px', justifyContent: 'center'
            }}>
              Continuer <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading || selectedClasses.size === 0} style={{
              display: 'flex', alignItems: 'center', gap: '6px', flex: 1,
              padding: '12px 20px', borderRadius: '10px', border: 'none',
              background: loading || selectedClasses.size === 0 ? 'rgba(8,145,178,0.4)' : 'linear-gradient(135deg,#0891b2,#0e7490)',
              color: '#fff', cursor: loading || selectedClasses.size === 0 ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '14px', justifyContent: 'center'
            }}>
              {loading ? 'Enregistrement…' : <><CheckCircle size={16} /> Accéder à mon espace</>}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

const Field = ({ label, children }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-light, #94a3b8)', marginBottom: '6px' }}>
      {label}
    </label>
    {children}
  </div>
);

const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: '10px',
  border: '1.5px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.05)', color: 'var(--text-dark, #f1f5f9)',
  fontSize: '14px', outline: 'none', boxSizing: 'border-box'
};

export default OnboardingCounselor;

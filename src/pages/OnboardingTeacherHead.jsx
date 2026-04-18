import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { BookOpen, Camera, CheckCircle, AlertTriangle, ChevronRight, ChevronLeft, Loader, GraduationCap } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Mon identité' },
  { id: 2, label: 'Ma classe'    },
];

const OnboardingTeacherHead = () => {
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
  const [classes,        setClasses]        = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedClass,  setSelectedClass]  = useState(null);

  const showNotif = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4500);
  };

  useEffect(() => {
    if (step === 2) loadClasses();
  }, [step]);

  const loadClasses = async () => {
    setLoadingClasses(true);
    // Charger les classes disponibles (sans prof titulaire assigné ou déjà assigné à cet enseignant)
    const { data } = await supabase
      .from('classes')
      .select('id, name, level, head_teacher_id, profiles(full_name)')
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

  const handleNext = () => {
    if (!fullName.trim()) { showNotif('error', 'Veuillez saisir votre nom complet.'); return; }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!selectedClass) { showNotif('error', 'Veuillez sélectionner votre classe.'); return; }
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

      // Assigner le prof titulaire à la classe choisie
      const { error: classError } = await supabase
        .from('classes')
        .update({ head_teacher_id: user.id })
        .eq('id', selectedClass.id);
      if (classError) throw classError;

      setUser(prev => ({
        ...prev,
        name:               fullName.trim(),
        avatarUrl:          avatarUrl || prev.avatarUrl,
        onboardingCompleted: true,
      }));

      showNotif('success', `Bienvenue, ${fullName.trim()} ! Vous êtes maintenant titulaire de la classe ${selectedClass.name}.`);
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
          background: notification.type === 'success' ? 'var(--green)' : '#ef4444',
          color: '#fff', padding: '14px 24px', borderRadius: '10px', zIndex: 9999,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
          gap: '10px', fontWeight: 600, fontSize: '14px', maxWidth: '90vw', textAlign: 'center'
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
            background: 'linear-gradient(135deg, #667EEA, #764BA2)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px'
          }}>
            <GraduationCap size={28} color="#fff" />
          </div>
          <h2 style={{ color: 'var(--text-dark, #f1f5f9)', margin: '0 0 6px', fontSize: '20px' }}>
            Espace Professeur Titulaire
          </h2>
          <p style={{ color: 'var(--text-light, #94a3b8)', fontSize: '13px', margin: 0 }}>
            Configurez votre profil pour accéder à la gestion de votre classe.
          </p>
        </div>

        {/* Indicateur étapes */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
          {STEPS.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                background: step === s.id ? 'linear-gradient(135deg,#667EEA,#764BA2)' : step > s.id ? 'rgba(102,126,234,0.15)' : 'rgba(255,255,255,0.05)',
                color: step === s.id ? '#fff' : step > s.id ? '#667EEA' : 'var(--text-light, #94a3b8)',
                transition: 'all 0.3s'
              }}>
                {step > s.id && <CheckCircle size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                {s.label}
              </div>
              {s.id < STEPS.length && (
                <div style={{ width: '20px', height: '2px', background: step > s.id ? '#667EEA' : 'rgba(255,255,255,0.1)' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── ÉTAPE 1 : Identité ── */}
        {step === 1 && (
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '90px', height: '90px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)', border: '3px dashed rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', marginBottom: '10px', cursor: 'pointer'
              }} onClick={() => document.getElementById('avatar-thead').click()}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Camera size={28} color="#64748b" />
                }
              </div>
              <input id="avatar-thead" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              <span style={{ fontSize: '12px', color: 'var(--text-light, #94a3b8)', cursor: 'pointer' }}
                onClick={() => document.getElementById('avatar-thead').click()}>
                Ajouter une photo (optionnel)
              </span>
            </div>

            <Field label="Nom complet *">
              <input type="text" placeholder="Ex : Mme. Biya Anastasie" value={fullName}
                onChange={e => setFullName(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Téléphone professionnel">
              <input type="tel" placeholder="Ex : +237 699 000 000" value={phone}
                onChange={e => setPhone(e.target.value)} style={inputStyle} />
            </Field>

            <div style={{
              marginTop: '8px', padding: '12px 16px', borderRadius: '10px',
              background: 'rgba(102,126,234,0.07)', border: '1px solid #667EEA',
              fontSize: '13px', color: '#94a3b8', lineHeight: 1.6
            }}>
              ℹ️ En tant que <strong style={{ color: '#f1f5f9' }}>Professeur Titulaire</strong>, vous gérez une classe entière — suivi des élèves, bulletins, communication avec les parents.
            </div>
          </div>
        )}

        {/* ── ÉTAPE 2 : Classe ── */}
        {step === 2 && (
          <div>
            <p style={{ color: 'var(--text-light, #94a3b8)', fontSize: '13px', marginBottom: '16px', lineHeight: 1.6 }}>
              Choisissez la <strong style={{ color: 'var(--text-dark, #f1f5f9)' }}>classe</strong> dont vous êtes le professeur titulaire.
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
                {classes.map(cls => {
                  const isSelected = selectedClass?.id === cls.id;
                  const alreadyTaken = cls.head_teacher_id && cls.head_teacher_id !== user.id;
                  return (
                    <div key={cls.id}
                      onClick={() => !alreadyTaken && setSelectedClass(cls)}
                      style={{
                        padding: '14px', borderRadius: '12px',
                        cursor: alreadyTaken ? 'not-allowed' : 'pointer',
                        border: `1.5px solid ${isSelected ? '#667EEA' : alreadyTaken ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)'}`,
                        background: isSelected ? 'rgba(102,126,234,0.12)' : alreadyTaken ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.03)',
                        opacity: alreadyTaken ? 0.5 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark, #f1f5f9)' }}>{cls.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-light, #94a3b8)', marginTop: '2px' }}>
                          {alreadyTaken
                            ? `Titulaire : ${cls.profiles?.full_name || 'Assigné'}`
                            : cls.level || 'Classe disponible'
                          }
                        </div>
                      </div>
                      {isSelected && <CheckCircle size={18} color="#667EEA" />}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedClass && (
              <div style={{ marginTop: '14px', padding: '12px 16px', borderRadius: '10px', background: 'rgba(102,126,234,0.08)', border: '1px solid #667EEA', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <GraduationCap size={18} color="#667EEA" />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark, #f1f5f9)' }}>
                    {selectedClass.name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                    Vous serez le professeur titulaire de cette classe
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Boutons navigation */}
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
              background: 'linear-gradient(135deg, #667EEA, #764BA2)',
              color: '#fff', cursor: 'pointer', fontWeight: 700,
              fontSize: '14px', justifyContent: 'center'
            }}>
              Continuer <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading || !selectedClass} style={{
              display: 'flex', alignItems: 'center', gap: '6px', flex: 1,
              padding: '12px 20px', borderRadius: '10px', border: 'none',
              background: loading || !selectedClass ? 'rgba(102,126,234,0.4)' : 'linear-gradient(135deg,#667EEA,#764BA2)',
              color: '#fff', cursor: loading || !selectedClass ? 'not-allowed' : 'pointer',
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

export default OnboardingTeacherHead;

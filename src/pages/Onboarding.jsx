import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { GraduationCap, User, Camera, CheckCircle, AlertTriangle, ChevronRight, ChevronLeft, Loader } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Identité',  icon: <User size={18} /> },
  { id: 2, label: 'Scolarité', icon: <GraduationCap size={18} /> },
  { id: 3, label: 'Famille',   icon: <User size={18} /> },
];

const Onboarding = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]         = useState(1);
  const [loading, setLoading]   = useState(false);
  const [notification, setNotification] = useState(null);

  // Étape 1 — Identité
  const [fullName,      setFullName]      = useState(user?.name || '');
  const [dob,           setDob]           = useState('');
  const [gender,        setGender]        = useState('');
  const [city,          setCity]          = useState('');
  const [bloodType,     setBloodType]     = useState('');
  const [avatarFile,    setAvatarFile]    = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // Étape 2 — Scolarité
  const [classes,       setClasses]       = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState('');

  // Étape 3 — Famille
  const [parentPhone,   setParentPhone]   = useState('');
  const [guardianType,  setGuardianType]  = useState('');

  // Charger les classes quand on arrive à l'étape 2
  useEffect(() => {
    if (step !== 2 || classes.length > 0) return;
    setLoadingClasses(true);
    supabase.from('classes').select('id, name, level').order('name')
      .then(({ data }) => { setClasses(data || []); setLoadingClasses(false); });
  }, [step]);

  const showNotif = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const validateStep1 = () => {
    if (!fullName.trim()) { showNotif('error', 'Veuillez saisir votre nom complet.'); return false; }
    if (!dob)             { showNotif('error', 'Veuillez saisir votre date de naissance.'); return false; }
    if (!gender)          { showNotif('error', 'Veuillez sélectionner votre sexe.'); return false; }
    if (!city.trim())     { showNotif('error', 'Veuillez saisir votre ville.'); return false; }
    return true;
  };

  const validateStep3 = () => {
    if (!parentPhone.trim()) { showNotif('error', 'Veuillez saisir le numéro du parent/tuteur.'); return false; }
    if (!guardianType)       { showNotif('error', 'Veuillez préciser le lien de parenté.'); return false; }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !selectedClassId) { showNotif('error', 'Veuillez choisir votre classe.'); return; }
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    if (!validateStep3()) return;
    setLoading(true);

    try {
      let avatarUrl = null;

      // Upload photo si fournie
      if (avatarFile) {
        const ext  = avatarFile.name.split('.').pop();
        const path = `avatars/${user.id}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true });

        if (uploadError) {
          // Bucket manquant ou erreur réseau — on prévient mais on continue
          console.error('Avatar upload error:', uploadError.message);
          showNotif('error', `Photo non sauvegardée : ${uploadError.message}`);
          await new Promise(r => setTimeout(r, 2500));
        } else {
          const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
          avatarUrl = urlData.publicUrl;
        }
      }

      // Mettre à jour profiles
      const profileUpdate = {
        full_name:            fullName.trim(),
        onboarding_completed: true,
        updated_at:           new Date().toISOString()
      };
      if (avatarUrl) profileUpdate.avatar_url = avatarUrl;

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Mettre à jour students
      const { error: studentError } = await supabase
        .from('students')
        .update({
          date_of_birth: dob,
          gender:        gender,
          blood_type:    bloodType || null,
          city:          city.trim(),
          parent_phone:  parentPhone.trim(),
          guardian_type: guardianType,
          class_id:      selectedClassId || null,
        })
        .eq('id', user.id);

      if (studentError) throw studentError;

      // Mettre à jour le contexte local pour que Profile voit immédiatement la photo
      setUser(prev => ({
        ...prev,
        name:      fullName.trim(),
        avatarUrl: avatarUrl || prev.avatarUrl,
        onboardingCompleted: true
      }));

      showNotif('success', 'Profil complété ! Bienvenue sur SIGPE.');
      setTimeout(() => navigate('/profile'), 1500);

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

      {/* Toast notification */}
      {notification && (
        <div style={{
          position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
          background: notification.type === 'success' ? 'var(--green)' : 'var(--red)',
          color: '#fff', padding: '14px 24px', borderRadius: '10px', zIndex: 9999,
          boxShadow: '0 8px 30px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center',
          gap: '10px', fontWeight: 600, fontSize: '14px', animation: 'fadeIn 0.3s'
        }}>
          {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          {notification.text}
        </div>
      )}

      <div style={{
        background: 'var(--card-bg, #1e293b)', borderRadius: '20px',
        padding: '40px', width: '100%', maxWidth: '520px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)'
      }}>

        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'var(--green)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: '16px'
          }}>
            <GraduationCap size={28} color="#fff" />
          </div>
          <h2 style={{ color: 'var(--text-dark, #f1f5f9)', margin: '0 0 6px' }}>
            Complétez votre profil
          </h2>
          <p style={{ color: 'var(--text-light, #94a3b8)', fontSize: '14px', margin: 0 }}>
            Ces informations sont nécessaires avant d'accéder à SIGPE.
          </p>
        </div>

        {/* Indicateur d'étapes */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '32px' }}>
          {STEPS.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                background: step === s.id ? 'var(--green)' : step > s.id ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                color: step === s.id ? '#fff' : step > s.id ? 'var(--green)' : 'var(--text-light, #94a3b8)',
                transition: 'all 0.3s'
              }}>
                {step > s.id ? <CheckCircle size={14} /> : s.icon}
                {s.label}
              </div>
              {s.id < STEPS.length && (
                <div style={{ width: '20px', height: '2px', background: step > s.id ? 'var(--green)' : 'rgba(255,255,255,0.1)' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── ÉTAPE 1 : Identité ── */}
        {step === 1 && (
          <div style={{ animation: 'fadeIn 0.3s' }}>

            {/* Photo de profil */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '90px', height: '90px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)', border: '3px dashed rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', marginBottom: '10px', cursor: 'pointer', position: 'relative'
              }}
                onClick={() => document.getElementById('avatar-input').click()}
              >
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Camera size={28} color="#64748b" />
                }
              </div>
              <input id="avatar-input" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              <span style={{ fontSize: '12px', color: 'var(--text-light, #94a3b8)', cursor: 'pointer' }}
                onClick={() => document.getElementById('avatar-input').click()}>
                Ajouter une photo (optionnel)
              </span>
            </div>

            <Field label="Nom complet *">
              <input type="text" placeholder="Ex : Fouda Marie-Claire" value={fullName}
                onChange={e => setFullName(e.target.value)} style={inputStyle} />
            </Field>

            <Field label="Date de naissance *">
              <input type="date" value={dob} onChange={e => setDob(e.target.value)} style={inputStyle} />
            </Field>

            <Field label="Sexe *">
              <select value={gender} onChange={e => setGender(e.target.value)} style={inputStyle}>
                <option value="">-- Choisir --</option>
                <option value="F">Féminin</option>
                <option value="M">Masculin</option>
              </select>
            </Field>

            <Field label="Ville de résidence *">
              <input type="text" placeholder="Ex : Yaoundé" value={city}
                onChange={e => setCity(e.target.value)} style={inputStyle} />
            </Field>

            <Field label="Groupe sanguin">
              <select value={bloodType} onChange={e => setBloodType(e.target.value)} style={inputStyle}>
                <option value="">-- Optionnel --</option>
                {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {/* ── ÉTAPE 2 : Scolarité ── */}
        {step === 2 && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <p style={{ color: 'var(--text-light, #94a3b8)', fontSize: '13px', marginBottom: '18px', lineHeight: 1.6 }}>
              Choisissez la <strong style={{ color: 'var(--text-dark, #f1f5f9)' }}>classe</strong> dans laquelle vous êtes inscrit(e) pour l'année 2024–2025.
            </p>

            {loadingClasses ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Loader size={20} /> Chargement des classes…
              </div>
            ) : classes.length === 0 ? (
              <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(249,115,22,0.07)', border: '1px solid var(--orange,#f97316)', color: 'var(--orange,#f97316)', fontSize: '13px' }}>
                Aucune classe disponible pour le moment. Contactez l'administration.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '280px', overflowY: 'auto' }}>
                {classes.map(cls => {
                  const selected = selectedClassId === cls.id;
                  return (
                    <div key={cls.id} onClick={() => setSelectedClassId(cls.id)} style={{
                      padding: '14px', borderRadius: '12px', cursor: 'pointer',
                      border: `1.5px solid ${selected ? 'var(--green)' : 'rgba(255,255,255,0.1)'}`,
                      background: selected ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      transition: 'all 0.2s',
                    }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark, #f1f5f9)' }}>{cls.name}</div>
                        {cls.level && <div style={{ fontSize: '11px', color: 'var(--text-light, #94a3b8)', marginTop: '2px' }}>{cls.level}</div>}
                      </div>
                      {selected && <CheckCircle size={18} color="var(--green)" />}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedClassId && (
              <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(34,197,94,0.07)', fontSize: '13px', color: 'var(--green)', fontWeight: 600 }}>
                ✓ Classe sélectionnée : {classes.find(c => c.id === selectedClassId)?.name}
              </div>
            )}
          </div>
        )}

        {/* ── ÉTAPE 3 : Famille ── */}
        {step === 3 && (
          <div style={{ animation: 'fadeIn 0.3s' }}>
            <Field label="Lien de parenté du tuteur légal *">
              <select value={guardianType} onChange={e => setGuardianType(e.target.value)} style={inputStyle}>
                <option value="">-- Choisir --</option>
                <option value="père">Père</option>
                <option value="mère">Mère</option>
                <option value="tuteur">Tuteur légal</option>
                <option value="autre">Autre</option>
              </select>
            </Field>

            <Field label="Téléphone du parent / tuteur *">
              <input type="tel" placeholder="Ex : +237 699 000 000" value={parentPhone}
                onChange={e => setParentPhone(e.target.value)} style={inputStyle} />
            </Field>

            <div style={{
              marginTop: '16px', padding: '14px 16px',
              background: 'rgba(34,197,94,0.07)', border: '1px solid var(--green)',
              borderRadius: '10px'
            }}>
              <p style={{ color: 'var(--text-light, #94a3b8)', fontSize: '12px', margin: 0, lineHeight: 1.6 }}>
                🔒 Ces informations sont confidentielles et uniquement accessibles à l'administration et à vos enseignants.
              </p>
            </div>
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
              background: 'var(--green)', color: '#fff',
              cursor: 'pointer', fontWeight: 700, fontSize: '14px', justifyContent: 'center'
            }}>
              Continuer <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} style={{
              display: 'flex', alignItems: 'center', gap: '6px', flex: 1,
              padding: '12px 20px', borderRadius: '10px', border: 'none',
              background: loading ? 'rgba(34,197,94,0.5)' : 'var(--green)', color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700,
              fontSize: '14px', justifyContent: 'center'
            }}>
              {loading ? 'Enregistrement…' : <><CheckCircle size={16} /> Terminer mon profil</>}
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

// Composant champ de formulaire
const Field = ({ label, children }) => (
  <div style={{ marginBottom: '16px' }}>
    <label style={{
      display: 'block', fontSize: '12px', fontWeight: 700,
      color: 'var(--text-light, #94a3b8)', marginBottom: '6px', letterSpacing: '0.3px'
    }}>
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

export default Onboarding;

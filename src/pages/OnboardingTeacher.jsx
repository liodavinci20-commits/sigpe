import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { BookOpen, Camera, CheckCircle, AlertTriangle, ChevronRight, ChevronLeft, Search, Loader } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Mon identité'  },
  { id: 2, label: 'Ma matière'    },
  { id: 3, label: 'Mes classes'   },
];

const OnboardingTeacher = () => {
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

  // Étape 2 — matière
  const [subjectQuery,   setSubjectQuery]   = useState('');
  const [subjectResults, setSubjectResults] = useState([]);
  const [searchingSubj,  setSearchingSubj]  = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);

  // Étape 3 — classes
  const [classes,         setClasses]         = useState([]);
  const [loadingClasses,  setLoadingClasses]  = useState(false);
  const [selectedClasses, setSelectedClasses] = useState(new Set());

  const showNotif = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4500);
  };

  // Charger les classes quand on arrive à l'étape 3
  useEffect(() => {
    if (step === 3) loadClasses();
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

  // Recherche de matière dans Supabase
  const handleSubjectSearch = async (q) => {
    setSubjectQuery(q);
    setSelectedSubject(null);
    if (q.trim().length < 2) { setSubjectResults([]); return; }
    setSearchingSubj(true);
    const { data } = await supabase
      .from('subjects')
      .select('id, name, code')
      .ilike('name', `%${q.trim()}%`)
      .limit(8);
    setSubjectResults(data || []);
    setSearchingSubj(false);
  };

  const toggleClass = (id) => {
    setSelectedClasses(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleNext = () => {
    if (step === 1) {
      if (!fullName.trim()) { showNotif('error', 'Veuillez saisir votre nom complet.'); return; }
    }
    if (step === 2) {
      if (!selectedSubject) { showNotif('error', 'Veuillez sélectionner votre matière.'); return; }
    }
    setStep(s => s + 1);
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

      // Récupérer l'année scolaire active
      const { data: yearRow } = await supabase
        .from('academic_years')
        .select('id')
        .eq('is_current', true)
        .limit(1)
        .single();

      if (!yearRow) throw new Error("Aucune année scolaire active. Contactez l'administration.");

      // Lier l'enseignant à ses classes dans class_subjects
      const rows = [...selectedClasses].map(classId => ({
        class_id:        classId,
        subject_id:      selectedSubject.id,
        teacher_id:      user.id,
        coefficient:     1,
        academic_year_id: yearRow.id,
      }));

      const { error: linkError } = await supabase
        .from('class_subjects')
        .upsert(rows, { onConflict: 'class_id,subject_id,academic_year_id' });
      if (linkError) throw linkError;

      setUser(prev => ({
        ...prev,
        name:               fullName.trim(),
        avatarUrl:          avatarUrl || prev.avatarUrl,
        onboardingCompleted: true,
      }));

      showNotif('success', `Profil complété ! Bienvenue, ${fullName.trim()}.`);
      setTimeout(() => navigate('/grades'), 1500);

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
          gap: '10px', fontWeight: 600, fontSize: '14px'
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
            background: 'var(--green)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: '14px'
          }}>
            <BookOpen size={28} color="#fff" />
          </div>
          <h2 style={{ color: 'var(--text-dark, #f1f5f9)', margin: '0 0 6px', fontSize: '20px' }}>
            Espace Enseignant
          </h2>
          <p style={{ color: 'var(--text-light, #94a3b8)', fontSize: '13px', margin: 0 }}>
            Configurez votre profil pour accéder à vos outils pédagogiques.
          </p>
        </div>

        {/* Indicateur étapes */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '28px', flexWrap: 'wrap' }}>
          {STEPS.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{
                padding: '5px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                background: step === s.id ? 'var(--green)' : step > s.id ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                color: step === s.id ? '#fff' : step > s.id ? 'var(--green)' : 'var(--text-light, #94a3b8)',
                transition: 'all 0.3s'
              }}>
                {step > s.id && <CheckCircle size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                {s.label}
              </div>
              {s.id < STEPS.length && (
                <div style={{ width: '16px', height: '2px', background: step > s.id ? 'var(--green)' : 'rgba(255,255,255,0.1)' }} />
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
              }} onClick={() => document.getElementById('avatar-teacher').click()}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Camera size={28} color="#64748b" />
                }
              </div>
              <input id="avatar-teacher" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              <span style={{ fontSize: '12px', color: 'var(--text-light, #94a3b8)', cursor: 'pointer' }}
                onClick={() => document.getElementById('avatar-teacher').click()}>
                Ajouter une photo (optionnel)
              </span>
            </div>

            <Field label="Nom complet *">
              <input type="text" placeholder="Ex : M. Essono Pierre" value={fullName}
                onChange={e => setFullName(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Téléphone professionnel">
              <input type="tel" placeholder="Ex : +237 699 000 000" value={phone}
                onChange={e => setPhone(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        )}

        {/* ── ÉTAPE 2 : Matière ── */}
        {step === 2 && (
          <div>
            <p style={{ color: 'var(--text-light, #94a3b8)', fontSize: '13px', marginBottom: '16px', lineHeight: 1.6 }}>
              Recherchez la <strong style={{ color: 'var(--text-dark, #f1f5f9)' }}>matière</strong> que vous enseignez dans notre base.
            </p>

            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Ex : Mathématiques, Physique, SVT…"
                value={subjectQuery}
                onChange={e => handleSubjectSearch(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '40px' }}
              />
              {searchingSubj && (
                <Loader size={16} color="#64748b" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              )}
            </div>

            {subjectResults.length > 0 && !selectedSubject && (
              <div style={{ border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
                {subjectResults.map(s => (
                  <div key={s.id}
                    onClick={() => { setSelectedSubject(s); setSubjectQuery(s.name); setSubjectResults([]); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <BookOpen size={16} color="var(--green)" />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-dark, #f1f5f9)' }}>{s.name}</div>
                      {s.code && <div style={{ fontSize: '12px', color: 'var(--text-light, #94a3b8)' }}>{s.code}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {subjectQuery.length >= 2 && subjectResults.length === 0 && !searchingSubj && !selectedSubject && (
              <div style={{
                padding: '14px 16px', borderRadius: '10px', marginBottom: '12px',
                background: 'rgba(249,115,22,0.07)', border: '1px solid var(--orange, #f97316)',
                color: 'var(--orange, #f97316)', fontSize: '13px'
              }}>
                Matière introuvable. Demandez à l'administration de l'ajouter dans le système.
              </div>
            )}

            {selectedSubject && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 16px', borderRadius: '12px',
                background: 'rgba(34,197,94,0.08)', border: '1.5px solid var(--green)',
              }}>
                <BookOpen size={20} color="var(--green)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-dark, #f1f5f9)' }}>{selectedSubject.name}</div>
                  {selectedSubject.code && <div style={{ fontSize: '12px', color: 'var(--text-light)' }}>{selectedSubject.code}</div>}
                </div>
                <CheckCircle size={20} color="var(--green)" />
                <button onClick={() => { setSelectedSubject(null); setSubjectQuery(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>×</button>
              </div>
            )}
          </div>
        )}

        {/* ── ÉTAPE 3 : Classes ── */}
        {step === 3 && (
          <div>
            <p style={{ color: 'var(--text-light, #94a3b8)', fontSize: '13px', marginBottom: '16px', lineHeight: 1.6 }}>
              Sélectionnez toutes les <strong style={{ color: 'var(--text-dark, #f1f5f9)' }}>classes</strong> auxquelles vous enseignez <strong style={{ color: 'var(--green)' }}>{selectedSubject?.name}</strong>.
            </p>

            {loadingClasses ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-light)' }}>
                <Loader size={24} style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: '13px' }}>Chargement des classes…</div>
              </div>
            ) : classes.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px' }}>
                Aucune classe disponible. Contactez l'administration.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
                {classes.map(cls => {
                  const selected = selectedClasses.has(cls.id);
                  return (
                    <div key={cls.id}
                      onClick={() => toggleClass(cls.id)}
                      style={{
                        padding: '14px 16px', borderRadius: '12px', cursor: 'pointer',
                        border: `1.5px solid ${selected ? 'var(--green)' : 'rgba(255,255,255,0.1)'}`,
                        background: selected ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.03)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark, #f1f5f9)' }}>{cls.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-light, #94a3b8)', marginTop: '2px' }}>{cls.level}</div>
                      </div>
                      {selected && <CheckCircle size={18} color="var(--green)" />}
                    </div>
                  );
                })}
              </div>
            )}

            {selectedClasses.size > 0 && (
              <div style={{ marginTop: '14px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(34,197,94,0.07)', fontSize: '13px', color: 'var(--green)', fontWeight: 600 }}>
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
              background: 'var(--green)', color: '#fff',
              cursor: 'pointer', fontWeight: 700, fontSize: '14px', justifyContent: 'center'
            }}>
              Continuer <ChevronRight size={16} />
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading} style={{
              display: 'flex', alignItems: 'center', gap: '6px', flex: 1,
              padding: '12px 20px', borderRadius: '10px', border: 'none',
              background: loading ? 'rgba(34,197,94,0.4)' : 'var(--green)',
              color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '14px', justifyContent: 'center'
            }}>
              {loading ? 'Enregistrement…' : <><CheckCircle size={16} /> Accéder à mes cours</>}
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

export default OnboardingTeacher;

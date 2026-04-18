import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { Users, Camera, CheckCircle, AlertTriangle, ChevronRight, ChevronLeft, Search, Loader } from 'lucide-react';

const STEPS = [
  { id: 1, label: 'Mon identité' },
  { id: 2, label: 'Mon enfant'   },
];

const OnboardingParent = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();

  const [step,         setStep]         = useState(1);
  const [loading,      setLoading]      = useState(false);
  const [notification, setNotification] = useState(null);

  // Étape 1
  const [fullName,      setFullName]      = useState(user?.name || '');
  const [relationship,  setRelationship]  = useState('');
  const [avatarFile,    setAvatarFile]    = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // Étape 2
  const [searchQuery,   setSearchQuery]   = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching,     setSearching]     = useState(false);
  const [selectedChild, setSelectedChild] = useState(null);

  const showNotif = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 4500);
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleNext = () => {
    if (!fullName.trim())  { showNotif('error', 'Veuillez saisir votre nom complet.'); return; }
    if (!relationship)     { showNotif('error', 'Veuillez préciser votre lien de parenté.'); return; }
    setStep(2);
  };

  // Recherche de l'enfant en temps réel dans Supabase
  const handleSearch = async (q) => {
    setSearchQuery(q);
    setSelectedChild(null);
    if (q.trim().length < 2) { setSearchResults([]); return; }

    setSearching(true);
    try {
      // Recherche par nom dans profiles (rôle student)
      const { data: byName } = await supabase
        .from('profiles')
        .select(`
          id, full_name, avatar_url,
          students ( matricule, classes ( name, level ) )
        `)
        .eq('role', 'student')
        .ilike('full_name', `%${q.trim()}%`)
        .limit(6);

      // Recherche par matricule dans students
      const { data: byMatricule } = await supabase
        .from('students')
        .select(`
          id, matricule,
          profiles ( full_name, avatar_url ),
          classes  ( name, level )
        `)
        .ilike('matricule', `%${q.trim()}%`)
        .limit(4);

      // Normaliser byName au même format que byMatricule
      const fromName = (byName || [])
        .filter(p => p.students)
        .map(p => ({
          id:       p.id,
          matricule: p.students?.matricule,
          profiles: { full_name: p.full_name, avatar_url: p.avatar_url },
          classes:  p.students?.classes,
        }));

      // Fusionner et dédupliquer par id
      const seen = new Set();
      const merged = [...fromName, ...(byMatricule || [])].filter(s => {
        if (!s.profiles?.full_name || seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      setSearchResults(merged);
    } catch (err) {
      console.error('Recherche élève:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedChild) { showNotif('error', 'Veuillez sélectionner votre enfant.'); return; }
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

      // Mettre à jour le profil parent
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

      // Lier parent ↔ enfant dans student_parents
      const { error: linkError } = await supabase
        .from('student_parents')
        .upsert({
          parent_id:    user.id,
          student_id:   selectedChild.id,
          relationship: relationship,
          is_primary:   true,
        }, { onConflict: 'student_id,parent_id' });

      if (linkError) throw linkError;

      // Mettre à jour le contexte local
      setUser(prev => ({
        ...prev,
        name:               fullName.trim(),
        avatarUrl:          avatarUrl || prev.avatarUrl,
        onboardingCompleted: true,
        childName:          selectedChild.profiles?.full_name,
      }));

      showNotif('success', `Profil complété ! Bienvenue, ${fullName.trim()}.`);
      setTimeout(() => navigate('/parent'), 1500);

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
        padding: '40px', width: '100%', maxWidth: '500px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)'
      }}>

        {/* En-tête */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'var(--green)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', marginBottom: '14px'
          }}>
            <Users size={28} color="#fff" />
          </div>
          <h2 style={{ color: 'var(--text-dark, #f1f5f9)', margin: '0 0 6px', fontSize: '20px' }}>
            Créez votre espace parent
          </h2>
          <p style={{ color: 'var(--text-light, #94a3b8)', fontSize: '13px', margin: 0 }}>
            Complétez ces informations pour accéder au suivi de votre enfant.
          </p>
        </div>

        {/* Indicateur étapes */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px' }}>
          {STEPS.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                padding: '6px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                background: step === s.id ? 'var(--green)' : step > s.id ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                color: step === s.id ? '#fff' : step > s.id ? 'var(--green)' : 'var(--text-light, #94a3b8)',
                transition: 'all 0.3s'
              }}>
                {step > s.id ? <CheckCircle size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} /> : null}
                {s.label}
              </div>
              {s.id < STEPS.length && (
                <div style={{ width: '20px', height: '2px', background: step > s.id ? 'var(--green)' : 'rgba(255,255,255,0.1)' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── ÉTAPE 1 ── */}
        {step === 1 && (
          <div>
            {/* Photo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{
                width: '90px', height: '90px', borderRadius: '50%',
                background: 'rgba(255,255,255,0.05)', border: '3px dashed rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', marginBottom: '10px', cursor: 'pointer'
              }} onClick={() => document.getElementById('avatar-parent').click()}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <Camera size={28} color="#64748b" />
                }
              </div>
              <input id="avatar-parent" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              <span style={{ fontSize: '12px', color: 'var(--text-light, #94a3b8)', cursor: 'pointer' }}
                onClick={() => document.getElementById('avatar-parent').click()}>
                Ajouter une photo (optionnel)
              </span>
            </div>

            <Field label="Votre nom complet *">
              <input type="text" placeholder="Ex : Ngo Balla Emmanuel" value={fullName}
                onChange={e => setFullName(e.target.value)} style={inputStyle} />
            </Field>

            <Field label="Votre lien de parenté *">
              <select value={relationship} onChange={e => setRelationship(e.target.value)} style={inputStyle}>
                <option value="">-- Choisir --</option>
                <option value="père">Père</option>
                <option value="mère">Mère</option>
                <option value="tuteur">Tuteur légal</option>
                <option value="autre">Autre</option>
              </select>
            </Field>
          </div>
        )}

        {/* ── ÉTAPE 2 ── */}
        {step === 2 && (
          <div>
            <p style={{ color: 'var(--text-light, #94a3b8)', fontSize: '13px', marginBottom: '16px', lineHeight: 1.6 }}>
              Recherchez votre enfant par <strong style={{ color: 'var(--text-dark, #f1f5f9)' }}>nom</strong> ou <strong style={{ color: 'var(--text-dark, #f1f5f9)' }}>matricule</strong>.
            </p>

            {/* Barre de recherche */}
            <div style={{ position: 'relative', marginBottom: '12px' }}>
              <Search size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Tapez un nom ou un matricule…"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '40px' }}
              />
              {searching && (
                <Loader size={16} color="#64748b" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', animation: 'spin 1s linear infinite' }} />
              )}
            </div>

            {/* Résultats */}
            {searchResults.length > 0 && !selectedChild && (
              <div style={{
                border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: '12px',
                overflow: 'hidden', marginBottom: '12px'
              }}>
                {searchResults.map(s => (
                  <div key={s.id}
                    onClick={() => { setSelectedChild(s); setSearchQuery(s.profiles?.full_name || ''); setSearchResults([]); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '12px 16px', cursor: 'pointer',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(34,197,94,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: 'rgba(34,197,94,0.2)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      overflow: 'hidden'
                    }}>
                      {s.profiles?.avatar_url
                        ? <img src={s.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--green)' }}>
                            {(s.profiles?.full_name || '?')[0].toUpperCase()}
                          </span>
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-dark, #f1f5f9)' }}>
                        {s.profiles?.full_name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-light, #94a3b8)' }}>
                        {s.matricule || 'Matricule en cours'} · {s.classes?.name || 'Classe non assignée'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && !searching && !selectedChild && (
              <div style={{
                padding: '14px 16px', borderRadius: '10px', marginBottom: '12px',
                background: 'rgba(249,115,22,0.07)', border: '1px solid var(--orange, #f97316)',
                color: 'var(--orange, #f97316)', fontSize: '13px'
              }}>
                Aucun élève trouvé. Vérifiez le nom ou le matricule.
              </div>
            )}

            {/* Enfant sélectionné */}
            {selectedChild && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '14px 16px', borderRadius: '12px',
                background: 'rgba(34,197,94,0.08)', border: '1.5px solid var(--green)',
                marginBottom: '12px'
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '50%',
                  background: 'rgba(34,197,94,0.2)', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {selectedChild.profiles?.avatar_url
                    ? <img src={selectedChild.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--green)' }}>
                        {(selectedChild.profiles?.full_name || '?')[0].toUpperCase()}
                      </span>
                  }
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-dark, #f1f5f9)' }}>
                    {selectedChild.profiles?.full_name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-light, #94a3b8)', marginTop: '2px' }}>
                    {selectedChild.matricule || 'Matricule en cours'} · {selectedChild.classes?.name || 'Classe non assignée'}
                  </div>
                </div>
                <CheckCircle size={20} color="var(--green)" />
                <button
                  onClick={() => { setSelectedChild(null); setSearchQuery(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
                >×</button>
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
            <button onClick={handleSubmit} disabled={loading || !selectedChild} style={{
              display: 'flex', alignItems: 'center', gap: '6px', flex: 1,
              padding: '12px 20px', borderRadius: '10px', border: 'none',
              background: loading || !selectedChild ? 'rgba(34,197,94,0.4)' : 'var(--green)',
              color: '#fff', cursor: loading || !selectedChild ? 'not-allowed' : 'pointer',
              fontWeight: 700, fontSize: '14px', justifyContent: 'center'
            }}>
              {loading ? 'Enregistrement…' : <><CheckCircle size={16} /> Accéder au portail</>}
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

export default OnboardingParent;

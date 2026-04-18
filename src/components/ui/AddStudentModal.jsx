import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { CheckCircle, AlertTriangle, Loader } from 'lucide-react';

const AddStudentModal = ({ isOpen, onClose, onStudentAdded }) => {
  const [classes,  setClasses]  = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [notif,    setNotif]    = useState(null);

  // Champs du formulaire
  const [lastName,    setLastName]    = useState('');
  const [firstName,   setFirstName]   = useState('');
  const [dob,         setDob]         = useState('');
  const [gender,      setGender]      = useState('M');
  const [classId,     setClassId]     = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [bloodType,   setBloodType]   = useState('');
  const [city,        setCity]        = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');

  useEffect(() => {
    if (isOpen) fetchClasses();
  }, [isOpen]);

  const fetchClasses = async () => {
    const { data } = await supabase.from('classes').select('id, name').order('name');
    setClasses(data || []);
  };

  const showNotif = (type, text) => {
    setNotif({ type, text });
    setTimeout(() => setNotif(null), 5000);
  };

  const resetForm = () => {
    setLastName(''); setFirstName(''); setDob(''); setGender('M');
    setClassId(''); setParentPhone(''); setBloodType(''); setCity('');
    setEmail(''); setPassword('');
  };

  const handleSubmit = async () => {
    if (!lastName || !firstName || !email || !password) {
      showNotif('error', 'Nom, prénom, email et mot de passe sont obligatoires.');
      return;
    }
    if (password.length < 6) {
      showNotif('error', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setLoading(true);
    const fullName = `${lastName.toUpperCase()} ${firstName}`;

    try {
      // Créer le compte auth sans affecter la session admin
      // On utilise un client temporaire sans persistance de session
      const { createClient } = await import('@supabase/supabase-js');
      const tempClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data: authData, error: authError } = await tempClient.auth.signUp({
        email,
        password,
        options: {
          data: { role: 'student', full_name: fullName }
        }
      });

      if (authError) { showNotif('error', 'Erreur compte : ' + authError.message); return; }

      const newUserId = authData.user?.id;
      if (!newUserId) { showNotif('error', 'Impossible de récupérer l\'ID du nouvel élève.'); return; }

      // Mettre à jour le profil (le trigger a déjà tout créé)
      await supabase.from('profiles').update({
        onboarding_completed: true
      }).eq('id', newUserId);

      // Compléter les infos de l'élève
      const updatePayload = {
        date_of_birth: dob      || null,
        gender:        gender   || null,
        blood_type:    bloodType || null,
        city:          city     || null,
        parent_phone:  parentPhone || null,
        guardian_type: 'père',
      };
      if (classId) updatePayload.class_id = classId;

      await supabase.from('students').update(updatePayload).eq('id', newUserId);

      showNotif('success', `${fullName} inscrit(e) avec succès !`);
      resetForm();
      onStudentAdded?.();
      setTimeout(onClose, 1800);

    } catch (err) {
      showNotif('error', 'Erreur inattendue : ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`modal-overlay ${isOpen ? 'open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h3>👨‍🎓 Inscrire un Nouvel Élève</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Toast interne */}
        {notif && (
          <div style={{
            margin: '0 20px 12px', padding: '10px 16px', borderRadius: '8px',
            background: notif.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${notif.type === 'success' ? 'var(--green)' : 'var(--red)'}`,
            color: notif.type === 'success' ? 'var(--green)' : 'var(--red)',
            display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600
          }}>
            {notif.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
            {notif.text}
          </div>
        )}

        <div className="modal-body">
          <div style={{
            marginBottom: '16px', padding: '10px 14px',
            background: 'rgba(59,130,246,0.07)', borderRadius: '8px',
            border: '1px solid var(--blue-accent)', fontSize: '12px',
            color: 'var(--text-light)'
          }}>
            ℹ️ Un compte de connexion sera créé pour l'élève. Communiquez-lui l'email et le mot de passe temporaire.
          </div>

          {/* Identité */}
          <div className="form-row">
            <div className="input-group">
              <label>Nom de famille *</label>
              <input type="text" placeholder="KAMGA" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Prénom(s) *</label>
              <input type="text" placeholder="Boris Rodrigue" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
          </div>

          <div className="form-row">
            <div className="input-group">
              <label>Date de naissance</label>
              <input type="date" value={dob} onChange={e => setDob(e.target.value)} />
            </div>
            <div className="input-group">
              <label>Sexe</label>
              <select value={gender} onChange={e => setGender(e.target.value)}>
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
            </div>
          </div>

          {/* Scolarité */}
          <div className="form-row">
            <div className="input-group">
              <label>Classe</label>
              <select value={classId} onChange={e => setClassId(e.target.value)}>
                <option value="">— Non assignée —</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Téléphone Parent</label>
              <input type="text" placeholder="+237 6XX XXX XXX" value={parentPhone} onChange={e => setParentPhone(e.target.value)} />
            </div>
          </div>

          {/* Santé & Adresse */}
          <div className="form-row">
            <div className="input-group">
              <label>Groupe Sanguin</label>
              <select value={bloodType} onChange={e => setBloodType(e.target.value)}>
                <option value="">—</option>
                {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label>Ville</label>
              <input type="text" placeholder="Yaoundé" value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </div>

          {/* Compte de connexion */}
          <div style={{
            marginTop: '8px', padding: '14px', borderRadius: '8px',
            border: '1.5px dashed var(--border)', background: 'var(--bg)'
          }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-light)', marginBottom: '10px', letterSpacing: '0.5px' }}>
              COMPTE DE CONNEXION DE L'ÉLÈVE
            </div>
            <div className="form-row" style={{ marginBottom: 0 }}>
              <div className="input-group">
                <label>Email *</label>
                <input type="email" placeholder="eleve@ens.cm" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Mot de passe temp. *</label>
                <input type="text" placeholder="Min. 6 caractères" value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-sm btn-outline" onClick={onClose} disabled={loading}>
            Annuler
          </button>
          <button className="btn-sm btn-green" onClick={handleSubmit} disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {loading ? <><Loader size={14} /> Inscription…</> : '✓ Enregistrer l\'élève'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddStudentModal;

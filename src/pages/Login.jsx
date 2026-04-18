import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../supabaseClient';
import { ShieldAlert, Users, GraduationCap, UsersRound, BookOpen, Map, BrainCircuit, School, KeyRound, UserPlus, CheckCircle, AlertTriangle } from 'lucide-react';
import heroImage from "../assets/images/_L’éducation, clé de l’avenir africain_.jpeg";

const Login = () => {
  const { login } = useAuth();
  
  // Vue principale : mockup démo, connexion réelle ou inscription
  const [authMode, setAuthMode] = useState('demo'); // 'demo' | 'login' | 'register'
  
  // States - Demo mode
  const [selectedTier, setSelectedTier] = useState('admin');
  const [role, setRole] = useState('admin');
  const [email, setEmail] = useState('');

  // Saisie réelle
  const [realEmail, setRealEmail] = useState('');
  const [realPassword, setRealPassword] = useState('');
  const [realRole, setRealRole] = useState('');
  
  // Custom Interface Notification (Au lieu des vieux Alertes système)
  const [notification, setNotification] = useState(null);

  const showNotification = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000); // Disparaît après 5 secondes
  };

  const handleTierClick = (tier) => {
    setSelectedTier(tier);
    if (tier === 'admin') setRole('admin');
    if (tier === 'parent') setRole('parent');
    if (tier === 'student') setRole('student');
    if (tier === 'teacher') setRole('teacher_course'); // Default subrole
  };

  const doDemoLogin = (e) => {
    e.preventDefault();
    login(role, email || `${role}@ens-yaounde.cm`);
  };

  const handleRealLogin = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: realEmail,
      password: realPassword
    });
    
    if (error) {
      showNotification('error', "Erreur de connexion : " + error.message);
    } else {
      showNotification('success', "Identifiants validés. Connexion au serveur...");
    }
  };

  const handleRealRegister = async (e) => {
    e.preventDefault();
    if (!realRole) {
      showNotification('error', "Veuillez choisir un type de profil dans le menu déroulant !");
      return;
    }
    
    const { data, error } = await supabase.auth.signUp({
      email: realEmail,
      password: realPassword,
      options: {
        data: {
          role: realRole,
          full_name: realEmail.split('@')[0]
        }
      }
    });

    if (error) {
      showNotification('error', "Échec : " + error.message);
    } else {
      showNotification('success', "Profil SIGPE généré ! Vous pouvez maintenant vous connecter.");
      setAuthMode('login'); // On bascule vers la page de login
    }
  };

  return (
    <div id="login-page">
      {/* 🌟 NOTIFICATIONS TOAST INTEGREES (Remplacement absolu du alert()) */}
      {notification && (
        <div style={{
          position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)',
          background: notification.type === 'success' ? 'var(--green)' : 'var(--red)',
          color: 'white', padding: '14px 24px', borderRadius: '10px', zIndex: 9999,
          boxShadow: '0 8px 30px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '12px',
          animation: 'fadeIn 0.3s', fontWeight: 600, fontSize: '14px'
        }}>
          {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          {notification.text}
        </div>
      )}
      
      <div className="login-glow"></div>
      <div className="login-glow2"></div>
      <div className="login-container">
        <div className="login-hero">
          <div className="login-hero-logo">
            <div className="logo-icon"><School size={32} /></div>
            <div className="logo-text">
              <h2>SIGPE</h2>
              <span>Cameroun — ENS Yaoundé</span>
            </div>
          </div>
          <div className="login-hero-img">
            <img src={heroImage} alt="Élèves secondaire" />
          </div>
          <div className="login-hero-tagline">
            <strong>Pilotage pédagogique intelligent</strong>
            Centralisez les profils élèves, suivez les performances et prenez des décisions éducatives basées sur les données.
          </div>
        </div>

        <div className="login-form-panel">
          {authMode === 'demo' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3>Espace de Démonstration</h3>
                <button className="btn-sm btn-outline" style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={() => setAuthMode('login')}>
                  <KeyRound size={14} /> Accès Réel
                </button>
              </div>
              <p>Simulez la connexion sous différents rôles système.</p>

              <div className="role-selector" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                <div className={`role-card ${selectedTier === 'admin' ? 'active' : ''}`} onClick={() => handleTierClick('admin')} style={{ cursor: 'pointer' }}>
                  <div className="role-icon"><ShieldAlert size={24} /></div>
                  <div className="role-info"><strong>Administration</strong><span>Direction</span></div>
                </div>
                <div className={`role-card ${selectedTier === 'teacher' ? 'active' : ''}`} onClick={() => handleTierClick('teacher')} style={{ cursor: 'pointer' }}>
                  <div className="role-icon"><Users size={24} /></div>
                  <div className="role-info"><strong>Enseignants</strong><span>Professeurs</span></div>
                </div>
                <div className={`role-card ${selectedTier === 'student' ? 'active' : ''}`} onClick={() => handleTierClick('student')} style={{ cursor: 'pointer' }}>
                  <div className="role-icon"><GraduationCap size={24} /></div>
                  <div className="role-info"><strong>Élève</strong><span>Personnel</span></div>
                </div>
                <div className={`role-card ${selectedTier === 'parent' ? 'active' : ''}`} onClick={() => handleTierClick('parent')} style={{ cursor: 'pointer' }}>
                  <div className="role-icon"><UsersRound size={24} /></div>
                  <div className="role-info"><strong>Parent</strong><span>Suivi</span></div>
                </div>
              </div>

              {selectedTier === 'teacher' && (
                <div style={{ marginTop: '15px', padding: '12px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--green)', animation: 'fadeIn 0.3s' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-light)', marginBottom: '8px', display: 'block' }}>Fonction spécifique :</label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <button type="button" className={`btn-sm ${role === 'teacher_course' ? 'btn-green' : 'btn-outline'}`} onClick={() => setRole('teacher_course')} style={{display: 'flex', alignItems: 'center', gap: '4px'}}><BookOpen size={16} /> Cours</button>
                    <button type="button" className={`btn-sm ${role === 'teacher_head' ? 'btn-green' : 'btn-outline'}`} onClick={() => setRole('teacher_head')} style={{display: 'flex', alignItems: 'center', gap: '4px'}}><Map size={16} /> Titulaire</button>
                    <button type="button" className={`btn-sm ${role === 'counselor' ? 'btn-green' : 'btn-outline'}`} onClick={() => setRole('counselor')} style={{display: 'flex', alignItems: 'center', gap: '4px'}}><BrainCircuit size={16} /> Orienter</button>
                  </div>
                </div>
              )}

              <form onSubmit={doDemoLogin} style={{ marginTop: '20px' }}>
                <div className="form-group" style={{ display: 'none' }}>
                   {/* Caché, car en mode démo le rôle suffit, mais gardé en background au cas où */}
                  <label>Identifiant Simulation</label>
                  <input type="text" value={email} onChange={e => setEmail(e.target.value)} />
                </div>
                <button type="submit" className="btn-login" style={{ marginTop: '10px' }}>◉ &nbsp;Valider la simulation en tant que {role}</button>
              </form>
            </>
          )}

          {authMode === 'login' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3>Connexion</h3>
              </div>
              <p>Authentifiez-vous avec votre adresse E-mail.</p>
              
              <form onSubmit={handleRealLogin} style={{ marginTop: '20px' }}>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>Adresse E-mail :</label>
                  <input type="email" placeholder="votre.email@ens.cm" required value={realEmail} onChange={(e) => setRealEmail(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dark)' }} />
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>Mot de passe :</label>
                  <input type="password" placeholder="••••••••" required value={realPassword} onChange={(e) => setRealPassword(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dark)' }} />
                </div>
                <button type="submit" className="btn-login" style={{ background: 'var(--blue-accent)' }}>
                  Se Connecter
                </button>
              </form>
              
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-dark)' }}>Nouveau sur SIGPE ? <strong style={{ color: 'var(--blue-accent)', cursor: 'pointer' }} onClick={() => setAuthMode('register')}>Créer un compte</strong></span>
                <span style={{ fontSize: '13px', color: 'var(--text-light)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setAuthMode('demo')}>Retour au Mode Démo</span>
              </div>
            </div>
          )}

          {authMode === 'register' && (
            <div style={{ animation: 'fadeIn 0.3s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ display:'flex', gap:'8px', alignItems:'center' }}><UserPlus size={20}/> Inscription</h3>
              </div>
              <p>Créez votre compte sécurisé.</p>
              
              <form onSubmit={handleRealRegister} style={{ marginTop: '20px' }}>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>Type de profil demandé :</label>
                  <select required value={realRole} onChange={(e) => setRealRole(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dark)' }}>
                    <option value="" disabled>-- Choisissez votre rôle --</option>
                    <option value="student">Élève</option>
                    <option value="parent">Parent d'élève</option>
                    <optgroup label="Corps Enseignant">
                      <option value="teacher_course">Enseignant de Cours Standard</option>
                      <option value="teacher_head">Professeur Titulaire (Gestion de classe)</option>
                      <option value="counselor">Conseiller d'Orientation</option>
                    </optgroup>
                    <optgroup label="Équipe de Direction">
                      <option value="admin">Administration & Scolarité</option>
                    </optgroup>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>Adresse E-mail :</label>
                  <input type="email" placeholder="votre.email@domaine.com" required value={realEmail} onChange={(e) => setRealEmail(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dark)' }} />
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)', display: 'block', marginBottom: '6px' }}>Mot de passe :</label>
                  <input type="password" placeholder="Minimum 6 caractères" minLength={6} required value={realPassword} onChange={(e) => setRealPassword(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text-dark)' }} />
                </div>
                <button type="submit" className="btn-login" style={{ background: 'var(--green)' }}>
                  Créer mon Compte
                </button>
              </form>
              
              <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-dark)' }}>Déjà inscrit(e) ? <strong style={{ color: 'var(--green)', cursor: 'pointer' }} onClick={() => setAuthMode('login')}>Se Connecter</strong></span>
                <span style={{ fontSize: '13px', color: 'var(--text-light)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setAuthMode('demo')}>Retour au Mode Démo</span>
              </div>
            </div>
          )}

          <div className="login-footer" style={{ marginTop: '20px' }}>© 2025 SIGPE — ENS Yaoundé &nbsp;|&nbsp; Support: support@sigpe.cm</div>
        </div>
      </div>
    </div>
  );
};

export default Login;

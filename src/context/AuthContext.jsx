import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadRealProfile(session.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadRealProfile(session.user);
      } else {
        setUser((prev) => prev?.isDemo ? prev : null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadRealProfile = async (realUser) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', realUser.id)
      .single();

    if (profile) {
      setUser({
        isDemo:               false,
        id:                   realUser.id,
        email:                realUser.email,
        role:                 profile.role,
        name:                 profile.full_name || realUser.email.split('@')[0],
        displayRole:          getDisplayRole(profile.role),
        avatar:               profile.avatar_url || 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&q=80',
        onboardingCompleted:  profile.onboarding_completed
      });
      routeByRole(profile.role, profile.onboarding_completed);
    } else {
      setUser({
        isDemo: false,
        id:     realUser.id,
        email:  realUser.email,
        role:   'student',
        name:   realUser.email.split('@')[0],
        onboardingCompleted: false
      });
      routeByRole('student', false);
    }
  };

  const getDisplayRole = (role) => {
    const map = {
      admin:          'Administrateur',
      sub_admin:      'Sous-Administrateur',
      parent:         'Parent',
      student:        'Élève',
      teacher_course: 'Enseignant Cours',
      teacher_head:   'Prof. Titulaire',
      counselor:      'Conseiller Orientation',
    };
    return map[role] || role;
  };

  const routeByRole = (role, onboardingCompleted = true) => {
    // Élève non onboardé → page de complétion de profil
    if (role === 'student' && !onboardingCompleted) {
      navigate('/onboarding');
      return;
    }
    if (role === 'parent')  { navigate('/parent');    return; }
    if (role === 'student') { navigate('/profile');   return; }
    navigate('/dashboard');
  };

  // DEMO LOGIN
  const login = (role, email = '') => {
    const names = {
      admin:          'M. Jean Mballa',
      parent:         'M. Ngo Balla Emmanuel',
      student:        'Ngo Balla Marie',
      teacher_course: 'M. Essono Pierre',
      teacher_head:   'Mme. Biya Anastasie',
      counselor:      'Dr. Kamga Boris',
    };
    setUser({
      isDemo:              true,
      email,
      role,
      name:                names[role] || 'Visiteur',
      displayRole:         getDisplayRole(role),
      onboardingCompleted: true  // démo : pas d'onboarding
    });
    routeByRole(role, true);
  };

  const logout = async () => {
    if (user && !user.isDemo) await supabase.auth.signOut();
    setUser(null);
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

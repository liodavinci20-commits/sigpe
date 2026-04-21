import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { GraduationCap, LayoutDashboard, Users, UserSquare2, FileText, ClipboardList, CalendarDays, TrendingUp, Contact, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../supabaseClient';

const Sidebar = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [studentCount, setStudentCount] = useState(null);

  useEffect(() => {
    if (!user || user.isDemo) return;
    loadStudentCount();
  }, [user]);

  const loadStudentCount = async () => {
    try {
      if (user.role === 'admin' || user.role === 'sub_admin') {
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true });
        setStudentCount(count ?? 0);

      } else if (user.role === 'teacher_course') {
        const { data: csRows } = await supabase
          .from('class_subjects')
          .select('class_id')
          .eq('teacher_id', user.id);
        const classIds = [...new Set((csRows || []).map(r => r.class_id))];
        if (classIds.length === 0) { setStudentCount(0); return; }
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .in('class_id', classIds);
        setStudentCount(count ?? 0);

      } else if (user.role === 'teacher_head') {
        const { data: clsRows } = await supabase
          .from('classes')
          .select('id')
          .eq('head_teacher_id', user.id);
        const classIds = (clsRows || []).map(r => r.id);
        if (classIds.length === 0) { setStudentCount(0); return; }
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true })
          .in('class_id', classIds);
        setStudentCount(count ?? 0);

      } else if (user.role === 'counselor') {
        const { count } = await supabase
          .from('students')
          .select('*', { count: 'exact', head: true });
        setStudentCount(count ?? 0);
      }
    } catch (err) {
      console.error('Erreur comptage élèves:', err);
    }
  };
  
  const handleLogout = () => {
    logout();
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="s-logo-icon"><GraduationCap size={24} color="white" /></div>
        <div>
          <h1>SIGPE</h1>
          <span>ENS Yaoundé · 2024–25</span>
        </div>
      </div>

      <div className="sidebar-user">
        <img 
          className="s-user-avatar" 
          src={user?.avatar} 
          alt={user?.name || "User"} 
          onError={(e) => { e.target.style.background = 'var(--green)'; }} 
        />
        <div className="s-user-info">
          <strong>{user?.name || "Visiteur"}</strong>
          <span style={{ textTransform: 'capitalize' }}>{user?.displayRole || user?.role || "Inconnu"}</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Menu Principal</div>
        
        {(user?.role === 'admin' || user?.role === 'teacher_course' || user?.role === 'teacher_head' || user?.role === 'counselor') && (
          <NavLink to="/dashboard" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><LayoutDashboard size={18} /></span> Tableau de Bord
          </NavLink>
        )}
        
        {(user?.role === 'admin' || user?.role === 'teacher_course' || user?.role === 'teacher_head' || user?.role === 'counselor') && (
          <NavLink to="/students" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><Users size={18} /></span> Élèves
            {studentCount !== null && (
              <span className="nav-badge green">{studentCount.toLocaleString('fr-FR')}</span>
            )}
          </NavLink>
        )}
        
        {(user?.role === 'admin' || user?.role === 'counselor' || user?.role === 'student') && (
          <NavLink to="/profile" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><UserSquare2 size={18} /></span> Profil Élève
          </NavLink>
        )}
        {(user?.role === 'teacher_course' || user?.role === 'teacher_head') && (
          <NavLink to="/teacher-profile" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><UserSquare2 size={18} /></span> Mon Profil
          </NavLink>
        )}
        {user?.role === 'parent' && (
          <NavLink to="/profile" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><UserSquare2 size={18} /></span> Profil de mon enfant
          </NavLink>
        )}
        
        {user?.role === 'teacher_course' && (
          <NavLink to="/grades" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><FileText size={18} /></span> Notes & Évaluations
            <span className="nav-badge">3</span>
          </NavLink>
        )}
        
        {(user?.role === 'admin' || user?.role === 'teacher_head' || user?.role === 'parent') && (
          <NavLink to="/bulletin" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon"><ClipboardList size={18} /></span> Bulletins
          </NavLink>
        )}
        
        <NavLink to="/schedule" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
          <span className="nav-icon"><CalendarDays size={18} /></span> Emplois du Temps
        </NavLink>

        {(user?.role === 'admin' || user?.role === 'counselor' || user?.role === 'teacher_head') && (
          <>
            <div className="nav-section-label">Analyse</div>
            <NavLink to="/reports" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><TrendingUp size={18} /></span> Rapports & Stats
            </NavLink>
          </>
        )}

        {(user?.role === 'admin' || user?.role === 'parent') && (
          <>
            <div className="nav-section-label">Portail</div>
            <NavLink to="/parent" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon"><Contact size={18} /></span> Portail Parents
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-bottom">
        <div className="nav-item">
          <span className="nav-icon"><Settings size={18} /></span> Paramètres
        </div>
        <div className="nav-item" onClick={handleLogout}>
          <span className="nav-icon"><LogOut size={18} /></span> Déconnexion
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

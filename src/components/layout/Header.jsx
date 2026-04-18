import React from 'react';
import { Menu, Search, Moon, Bell, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Header = () => {
  const { user } = useAuth();
  const toggleDarkMode = () => {
    document.body.classList.toggle('dark-mode');
  };

  const toggleSidebar = () => {
    // Will be handled via context or state later
  };

  return (
    <header className="header">
      <button className="hamburger" onClick={toggleSidebar} aria-label="Menu"><Menu size={20} /></button>
      
      <div className="header-breadcrumb">
        <h2>Tableau de Bord</h2>
        <p>Vue d'ensemble · Année 2024–2025</p>
      </div>

      <div className="header-search">
        <span><Search size={16} /></span>
        <input type="text" placeholder="Rechercher un élève, classe, matière..." />
      </div>

      <button className="dark-toggle" onClick={toggleDarkMode} title="Mode sombre"><Moon size={18} /></button>
      
      <div className="header-notif" title="Notifications">
        <Bell size={18} /><div className="notif-dot"></div>
      </div>
      
      <div className="header-notif" title="Messages"><Mail size={18} /></div>
      
      <img 
        className="header-avatar" 
        src={user?.avatar || "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80"} 
        alt={user?.name || "User"} 
        onError={(e) => { e.target.style.background = 'var(--green)'; }} 
      />
    </header>
  );
};

export default Header;

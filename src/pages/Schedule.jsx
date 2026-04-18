import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Calendar as CalendarIcon, Settings, Edit3 } from 'lucide-react';

const Schedule = () => {
  const { user } = useAuth();
  
  return (
    <section className="page-section active">
      <div className="page-top-bar">
        <h3>Emploi du Temps</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <select className="filter-select">
            <option>Ma Classe (3ème B)</option>
            <option>Salles</option>
            <option>Enseignants</option>
          </select>
          {user?.role === 'admin' && (
            <button className="btn-sm btn-green" onClick={() => alert("Ouverture du module de création croisée des emplois du temps (Gestion des conflits d'enseignants)")} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Edit3 size={16} /> Créer / Éditer pour une Classe
            </button>
          )}
        </div>
      </div>

      <div className="schedule-grid" style={{ overflow: 'hidden', padding: 0 }}>
        {/* Header de la grille */}
        <div className="sg-col-header" style={{ marginLeft: '60px' }}>Lundi</div>
        <div className="sg-col-header">Mardi</div>
        <div className="sg-col-header">Mercredi</div>
        <div className="sg-col-header">Jeudi</div>
        <div className="sg-col-header">Vendredi</div>

        {/* 08h00 */}
        <div className="sg-time-label">08:00</div>
        <div className="sg-cell"><div className="sg-slot math"><strong>Mathématiques</strong><span>M. Kamga</span><span>Salle 12</span></div></div>
        <div className="sg-cell"><div className="sg-slot fr"><strong>Français</strong><span>Mme Beyala</span><span>Salle 12</span></div></div>
        <div className="sg-cell"><div className="sg-slot hist"><strong>Histoire</strong><span>M. Ndongo</span><span>Salle 12</span></div></div>
        <div className="sg-cell"><div className="sg-slot pc"><strong>Physique</strong><span>M. Zogo</span><span>Labo B</span></div></div>
        <div className="sg-cell"><div className="sg-slot math"><strong>Mathématiques</strong><span>M. Kamga</span><span>Salle 12</span></div></div>

        {/* Break */}
        <div className="sg-time-label">10:00</div>
        <div className="sg-cell" style={{ gridColumn: 'span 5' }}>
          <div style={{ background: '#F8FAFC', border: '1px dashed #CBD5E1', color: '#94A3B8', textAlign: 'center', fontSize: '11px', padding: '6px', borderRadius: '4px' }}>PAUSE</div>
        </div>

        {/* 10h15 */}
        <div className="sg-time-label">10:15</div>
        <div className="sg-cell"><div className="sg-slot svt"><strong>SVT</strong><span>Dr Owona</span><span>Labo A</span></div></div>
        <div className="sg-cell"><div className="sg-slot eng"><strong>Anglais</strong><span>Mme Smith</span><span>Salle 12</span></div></div>
        <div className="sg-cell"><div className="sg-slot sport"><strong>EPS</strong><span>M. Njoya</span><span>Stade</span></div></div>
        <div className="sg-cell"><div className="sg-slot fr"><strong>Français</strong><span>Mme Beyala</span><span>Salle 12</span></div></div>
        <div className="sg-cell"><div className="sg-slot svt"><strong>SVT</strong><span>Dr Owona</span><span>Labo A</span></div></div>
      </div>
    </section>
  );
};

export default Schedule;

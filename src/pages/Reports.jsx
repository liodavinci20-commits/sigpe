import React from 'react';
import { TrendingUp, BarChart2, PieChart } from 'lucide-react';

const Reports = () => {
  return (
    <section className="page-section active">
      <div className="page-top-bar">
        <h3>Rapports & Statistiques</h3>
        <button className="btn-sm btn-outline" style={{display:'flex', alignItems:'center', gap:'6px'}}>
          <TrendingUp size={16} /> Exporter Synthèse
        </button>
      </div>
      <div className="reports-kpi">
        <div className="kpi-card">
          <h4>Taux de Réussite Global</h4>
          <div className="kpi-val">78.4%</div>
          <div className="kpi-sub" style={{ color: 'var(--green)' }}>↑ +3.2% vs année précédente</div>
        </div>
        <div className="kpi-card">
          <h4>Moyenne Générale Établ.</h4>
          <div className="kpi-val">11.82</div>
          <div className="kpi-sub" style={{ color: 'var(--green)' }}>↑ +0.45 points · Objectif : 12.00</div>
        </div>
        <div className="kpi-card">
          <h4>Taux de Présence</h4>
          <div className="kpi-val">94.3%</div>
          <div className="kpi-sub" style={{ color: 'var(--red)' }}>↓ -0.8% vs mois dernier</div>
        </div>
      </div>

      <div className="report-chart-row">
        <div className="card">
          <div className="card-header">
            <div><h3>Évolution des Moyennes</h3><p>Trimestre 1 — Séquences 1 & 2</p></div>
          </div>
          <div className="card-body">
            <svg className="line-chart-svg" viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%' }}>
              <line x1="40" y1="10" x2="40" y2="150" stroke="#E5E7EB" strokeWidth="1"/>
              <line x1="40" y1="150" x2="390" y2="150" stroke="#E5E7EB" strokeWidth="1"/>
              <line x1="40" y1="110" x2="390" y2="110" stroke="#F3F4F6" strokeWidth="1" strokeDasharray="4"/>
              <line x1="40" y1="70" x2="390" y2="70" stroke="#F3F4F6" strokeWidth="1" strokeDasharray="4"/>
              <line x1="40" y1="30" x2="390" y2="30" stroke="#F3F4F6" strokeWidth="1" strokeDasharray="4"/>
              
              <text x="30" y="153" fontSize="9" fill="#9CA3AF" textAnchor="end">0</text>
              <text x="30" y="113" fontSize="9" fill="#9CA3AF" textAnchor="end">5</text>
              <text x="30" y="73" fontSize="9" fill="#9CA3AF" textAnchor="end">10</text>
              <text x="30" y="33" fontSize="9" fill="#9CA3AF" textAnchor="end">15</text>
              
              <polyline fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="80,90 150,75 220,82 290,68 360,60" />
              <circle cx="80" cy="90" r="4" fill="#3B82F6"/>
              <circle cx="150" cy="75" r="4" fill="#3B82F6"/>
              <circle cx="220" cy="82" r="4" fill="#3B82F6"/>
              <circle cx="290" cy="68" r="4" fill="#3B82F6"/>
              <circle cx="360" cy="60" r="4" fill="#3B82F6"/>
              
              <polyline fill="none" stroke="#00A86B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="80,100 150,95 220,105 290,92 360,88" />
              <circle cx="80" cy="100" r="4" fill="#00A86B"/>
              <circle cx="150" cy="95" r="4" fill="#00A86B"/>
              <circle cx="220" cy="105" r="4" fill="#00A86B"/>
              <circle cx="290" cy="92" r="4" fill="#00A86B"/>
              <circle cx="360" cy="88" r="4" fill="#00A86B"/>
              
              <text x="80" y="168" fontSize="9" fill="#9CA3AF" textAnchor="middle">6ème</text>
              <text x="150" y="168" fontSize="9" fill="#9CA3AF" textAnchor="middle">5ème</text>
              <text x="220" y="168" fontSize="9" fill="#9CA3AF" textAnchor="middle">4ème</text>
              <text x="290" y="168" fontSize="9" fill="#9CA3AF" textAnchor="middle">3ème</text>
              <text x="360" y="168" fontSize="9" fill="#9CA3AF" textAnchor="middle">Lycée</text>
            </svg>
            <div className="chart-legend">
              <div className="legend-item"><div className="legend-dot" style={{background:'#3B82F6'}}></div>Mathématiques</div>
              <div className="legend-item"><div className="legend-dot" style={{background:'var(--green)'}}></div>Français</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div><h3>Répartition par Niveau</h3><p>Effectifs inscrits 2024–25</p></div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="perf-row">
                <span style={{ width: '80px' }}>Terminale</span>
                <div className="prog-bar-wrap"><div className="prog-bar" style={{ width: '25%', background: 'var(--navy-light)' }}></div></div>
                <strong style={{ width: '50px', textAlign: 'right' }}>312</strong>
              </div>
              <div className="perf-row">
                <span style={{ width: '80px' }}>Première</span>
                <div className="prog-bar-wrap"><div className="prog-bar" style={{ width: '22%', background: 'var(--blue-accent)' }}></div></div>
                <strong style={{ width: '50px', textAlign: 'right' }}>278</strong>
              </div>
              <div className="perf-row">
                <span style={{ width: '80px' }}>Seconde</span>
                <div className="prog-bar-wrap"><div className="prog-bar" style={{ width: '24%', background: 'var(--green)' }}></div></div>
                <strong style={{ width: '50px', textAlign: 'right' }}>295</strong>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Reports;

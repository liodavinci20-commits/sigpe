import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Eye, Loader, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import AddStudentModal from '../components/ui/AddStudentModal';

const Students = () => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [students,   setStudents]   = useState([]);
  const [classes,    setClasses]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [classFilter, setClassFilter] = useState('');

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          matricule,
          gender,
          city,
          created_at,
          profiles ( full_name, avatar_url ),
          classes  ( name, level )
        `)
        .order('created_at', { ascending: false });

      if (!error) setStudents(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name')
      .order('name');
    setClasses(data || []);
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, [fetchStudents, fetchClasses]);

  // Filtre côté client (recherche + classe)
  const filtered = students.filter(s => {
    const name      = s.profiles?.full_name?.toLowerCase() || '';
    const matricule = s.matricule?.toLowerCase() || '';
    const matchSearch = !search || name.includes(search.toLowerCase()) || matricule.includes(search.toLowerCase());
    const matchClass  = !classFilter || s.classes?.name === classFilter;
    return matchSearch && matchClass;
  });

  const initials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <section id="page-students" className="page-section active">
      <div className="page-top-bar" style={{ marginBottom: 0 }}>
        <div className="filter-row">
          <div className="search-bar">
            <span><Search size={16} /></span>
            <input
              type="text"
              placeholder="Filtrer par nom, matricule..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="filter-select"
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
          >
            <option value="">Toutes les classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-sm btn-outline" onClick={fetchStudents} title="Actualiser"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <RefreshCw size={14} />
          </button>
          <button
            className="btn-sm btn-green"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => setIsModalOpen(true)}
          >
            <Plus size={16} /> Nouvel Élève
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <div>
            <h3>Liste des Élèves Inscrits</h3>
            <p>
              {loading
                ? 'Chargement…'
                : `${filtered.length} élève${filtered.length !== 1 ? 's' : ''} · Année 2024–2025`}
            </p>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
              <Loader size={20} /> Chargement des élèves…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-light)' }}>
              {students.length === 0
                ? <>
                    <GraduationCapEmpty />
                    <p style={{ marginTop: '12px', fontWeight: 600 }}>Aucun élève inscrit pour l'instant.</p>
                    <p style={{ fontSize: '13px' }}>Les élèves apparaîtront ici après leur inscription via la page de connexion.</p>
                  </>
                : <p>Aucun résultat pour « {search} »</p>
              }
            </div>
          ) : (
            <table className="students-table">
              <thead>
                <tr>
                  <th>Élève</th>
                  <th>Matricule</th>
                  <th>Classe</th>
                  <th>Ville</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {s.profiles?.avatar_url ? (
                          <img
                            src={s.profiles.avatar_url}
                            alt="avatar"
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'var(--green)', color: '#fff',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 700
                          }}>
                            {initials(s.profiles?.full_name)}
                          </div>
                        )}
                        <strong>{s.profiles?.full_name || '—'}</strong>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{s.matricule}</td>
                    <td>
                      {s.classes?.name
                        ? <span className="status-badge" style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--blue-accent)' }}>{s.classes.name}</span>
                        : <span style={{ color: 'var(--text-light)', fontSize: '12px' }}>Non assignée</span>
                      }
                    </td>
                    <td style={{ fontSize: '13px', color: 'var(--text-light)' }}>{s.city || '—'}</td>
                    <td><span className="status-badge badge-active">Actif</span></td>
                    <td>
                      <div className="action-btns">
                        <button className="icon-btn" title="Voir profil"
                          onClick={() => alert(`Profil de ${s.profiles?.full_name} — navigation à brancher`)}>
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <AddStudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onStudentAdded={fetchStudents}
      />
    </section>
  );
};

// Icône vide décorative
const GraduationCapEmpty = () => (
  <div style={{ fontSize: '40px' }}>🎓</div>
);

export default Students;

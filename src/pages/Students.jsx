import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Eye, Loader, RefreshCw, Check } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import AddStudentModal from '../components/ui/AddStudentModal';

const Students = () => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [students,    setStudents]    = useState([]);
  const [classes,     setClasses]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [classFilter, setClassFilter] = useState('');

  // id de l'élève en cours de sauvegarde de classe
  const [savingClass, setSavingClass] = useState(null);
  // id de l'élève qui vient d'être sauvegardé (pour afficher ✓ brièvement)
  const [savedClass,  setSavedClass]  = useState(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      // Déterminer les classes autorisées selon le rôle
      let allowedClassIds = null; // null = tout voir (admin)

      if (user?.role === 'teacher_course') {
        const { data: csRows } = await supabase
          .from('class_subjects')
          .select('class_id')
          .eq('teacher_id', user.id);
        allowedClassIds = [...new Set((csRows || []).map(r => r.class_id))];
      } else if (user?.role === 'teacher_head') {
        const { data: clsRows } = await supabase
          .from('classes')
          .select('id')
          .eq('head_teacher_id', user.id);
        allowedClassIds = (clsRows || []).map(r => r.id);
      }

      if (allowedClassIds !== null && allowedClassIds.length === 0) {
        setStudents([]);
        setLoading(false);
        return;
      }

      let query = supabase
        .from('students')
        .select(`
          id, matricule, gender, city, class_id, created_at,
          profiles ( full_name, avatar_url ),
          classes  ( id, name, level )
        `)
        .order('created_at', { ascending: false });

      if (allowedClassIds !== null) {
        query = query.in('class_id', allowedClassIds);
      }

      const { data, error } = await query;
      if (!error) setStudents(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const isAdmin = user?.role === 'admin' || user?.role === 'sub_admin';

  const fetchClasses = useCallback(async () => {
    const { data } = await supabase
      .from('classes')
      .select('id, name, level')
      .order('name');
    setClasses(data || []);
  }, []);

  useEffect(() => {
    fetchStudents();
    fetchClasses();
  }, [fetchStudents, fetchClasses]);

  // Assigner une classe à un élève
  const assignClass = async (studentId, classId) => {
    setSavingClass(studentId);
    const { error } = await supabase
      .from('students')
      .update({ class_id: classId || null })
      .eq('id', studentId);

    if (!error) {
      // Mettre à jour localement sans refetch complet
      setStudents(prev => prev.map(s => {
        if (s.id !== studentId) return s;
        const cls = classes.find(c => c.id === classId);
        return { ...s, class_id: classId, classes: cls || null };
      }));
      setSavedClass(studentId);
      setTimeout(() => setSavedClass(null), 2000);
    }
    setSavingClass(null);
  };

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
          {isAdmin && (
            <button className="btn-sm btn-green"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => setIsModalOpen(true)}>
              <Plus size={16} /> Nouvel Élève
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '20px' }}>
        <div className="card-header">
          <div>
            <h3>Liste des Élèves Inscrits</h3>
            <p>Année 2024–2025</p>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
            Colonne Classe : modifiable directement
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
                    <div style={{ fontSize: '40px' }}>🎓</div>
                    <p style={{ marginTop: '12px', fontWeight: 600 }}>Aucun élève inscrit pour l'instant.</p>
                    <p style={{ fontSize: '13px' }}>Les élèves apparaîtront ici après leur inscription.</p>
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
                  <th>Classe assignée</th>
                  <th>Ville</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    {/* Avatar + Nom */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {s.profiles?.avatar_url ? (
                          <img src={s.profiles.avatar_url} alt="avatar"
                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
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

                    {/* Matricule */}
                    <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{s.matricule || '—'}</td>

                    {/* Classe */}
                    <td>
                      {isAdmin ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <select
                            value={s.class_id || ''}
                            onChange={e => assignClass(s.id, e.target.value || null)}
                            disabled={savingClass === s.id}
                            style={{
                              padding: '5px 10px', borderRadius: '8px', fontSize: '12px',
                              border: `1.5px solid ${s.class_id ? 'var(--green)' : 'rgba(255,255,255,0.15)'}`,
                              background: s.class_id ? 'rgba(34,197,94,0.08)' : 'var(--bg)',
                              color: s.class_id ? 'var(--green)' : 'var(--text-light)',
                              fontWeight: s.class_id ? 700 : 400,
                              cursor: 'pointer', outline: 'none', maxWidth: '150px',
                            }}
                          >
                            <option value="">— Non assignée —</option>
                            {classes.map(c => (
                              <option key={c.id} value={c.id}>
                                {c.name} {c.level ? `· ${c.level}` : ''}
                              </option>
                            ))}
                          </select>
                          {savingClass === s.id && <Loader size={14} color="var(--text-light)" />}
                          {savedClass === s.id && <Check size={14} color="var(--green)" />}
                        </div>
                      ) : (
                        <span style={{
                          padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                          background: s.classes ? 'rgba(34,197,94,0.08)' : 'transparent',
                          color: s.classes ? 'var(--green)' : 'var(--text-light)',
                        }}>
                          {s.classes?.name || '—'}
                        </span>
                      )}
                    </td>

                    {/* Ville */}
                    <td style={{ fontSize: '13px', color: 'var(--text-light)' }}>{s.city || '—'}</td>

                    {/* Statut */}
                    <td><span className="status-badge badge-active">Actif</span></td>

                    {/* Actions */}
                    <td>
                      <div className="action-btns">
                        <button className="icon-btn" title="Voir profil">
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

export default Students;

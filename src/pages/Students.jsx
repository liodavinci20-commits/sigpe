import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Eye, Loader, RefreshCw, Check, Trash2, AlertTriangle, X, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import AddStudentModal from '../components/ui/AddStudentModal';

const ROLE_LABELS = {
  teacher_course: 'Enseignant Cours',
  teacher_head:   'Prof. Titulaire',
  counselor:      'Conseiller',
};

const Students = () => {
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tab, setTab] = useState('students'); // 'students' | 'staff'

  // ── Élèves ──
  const [students,    setStudents]    = useState([]);
  const [classes,     setClasses]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [savingClass, setSavingClass] = useState(null);
  const [savedClass,  setSavedClass]  = useState(null);

  // ── Personnel ──
  const [staff,        setStaff]        = useState([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [searchStaff,  setSearchStaff]  = useState('');

  // ── Suppression ──
  const [confirmDelete, setConfirmDelete] = useState(null); // { id, name, type: 'student'|'staff' }
  const [deleting,      setDeleting]      = useState(false);

  const isAdmin      = user?.role === 'admin' || user?.role === 'sub_admin';
  const isSuperAdmin = user?.role === 'super_admin';

  // ── Super admin : élèves groupés par établissement ──
  const [instGroups,    setInstGroups]    = useState([]); // [{ id, name, code, students[] }]
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [openInst,      setOpenInst]      = useState({}); // { instId: true/false }
  const [searchSuper,   setSearchSuper]   = useState('');

  // ── Fetch élèves ──
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      let allowedClassIds = null;

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

      if (allowedClassIds !== null) query = query.in('class_id', allowedClassIds);

      const { data, error } = await query;
      if (!error) setStudents(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ── Fetch classes ──
  const fetchClasses = useCallback(async () => {
    const { data } = await supabase.from('classes').select('id, name, level').order('name');
    setClasses(data || []);
  }, []);

  // ── Fetch personnel ──
  const fetchStaff = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, email')
        .in('role', ['teacher_course', 'teacher_head', 'counselor'])
        .order('full_name');
      setStaff(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStaff(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchInstGroups();
    } else {
      fetchStudents();
      fetchClasses();
      if (isAdmin) fetchStaff();
    }
  }, [fetchStudents, fetchClasses, fetchStaff, isAdmin, isSuperAdmin]);

  // ── Fetch élèves groupés par établissement (super_admin) ──
  const fetchInstGroups = async () => {
    setLoadingGroups(true);
    try {
      const [{ data: institutions }, { data: studentRows }] = await Promise.all([
        supabase.from('institutions').select('id, name, code').order('name'),
        supabase.from('profiles')
          .select('id, full_name, avatar_url, institution_id')
          .eq('role', 'student')
          .order('full_name'),
      ]);

      const insts    = institutions || [];
      const students = studentRows  || [];

      // Grouper
      const groups = insts.map(inst => ({
        ...inst,
        students: students.filter(s => s.institution_id === inst.id),
      }));

      // Non assignés
      const unassigned = students.filter(s => !insts.find(i => i.id === s.institution_id));
      if (unassigned.length > 0) {
        groups.push({ id: null, name: 'Non assignés', code: null, students: unassigned });
      }

      setInstGroups(groups);
      // Ouvrir le premier établissement par défaut
      if (groups.length > 0) setOpenInst({ [groups[0].id || 'null']: true });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGroups(false);
    }
  };

  // ── Assignation classe ──
  const assignClass = async (studentId, classId) => {
    setSavingClass(studentId);
    const { error } = await supabase
      .from('students')
      .update({ class_id: classId || null })
      .eq('id', studentId);

    if (!error) {
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

  // ── Suppression ──
  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      if (confirmDelete.type === 'student') {
        await supabase.from('students').delete().eq('id', confirmDelete.id);
        await supabase.from('profiles').delete().eq('id', confirmDelete.id);
        setStudents(prev => prev.filter(s => s.id !== confirmDelete.id));
      } else {
        await supabase.from('profiles').delete().eq('id', confirmDelete.id);
        setStaff(prev => prev.filter(s => s.id !== confirmDelete.id));
      }
      setConfirmDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setDeleting(false);
    }
  };

  // ── Filtres ──
  const filteredStudents = students.filter(s => {
    const name      = s.profiles?.full_name?.toLowerCase() || '';
    const matricule = s.matricule?.toLowerCase() || '';
    const matchSearch = !search || name.includes(search.toLowerCase()) || matricule.includes(search.toLowerCase());
    const matchClass  = !classFilter || s.classes?.name === classFilter;
    return matchSearch && matchClass;
  });

  const filteredStaff = staff.filter(s => {
    const name = s.full_name?.toLowerCase() || '';
    return !searchStaff || name.includes(searchStaff.toLowerCase());
  });

  const initials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  };

  // ── Filtre recherche super_admin ──
  const filteredGroups = instGroups.map(group => ({
    ...group,
    students: searchSuper.trim()
      ? group.students.filter(s => s.full_name?.toLowerCase().includes(searchSuper.toLowerCase()))
      : group.students,
  })).filter(group => group.students.length > 0 || !searchSuper.trim());

  return (
    <section id="page-students" className="page-section active">

      {/* ══════════════════════════════════════════════════════════
          VUE DÉLÉGUÉ DÉPARTEMENTAL — élèves par établissement
      ══════════════════════════════════════════════════════════ */}
      {isSuperAdmin && (
        <>
          <div className="page-top-bar" style={{ marginBottom: '20px' }}>
            <div className="search-bar">
              <span><Search size={16} /></span>
              <input
                type="text"
                placeholder="Rechercher un élève par nom…"
                value={searchSuper}
                onChange={e => setSearchSuper(e.target.value)}
              />
            </div>
            <button className="btn-sm btn-outline" onClick={fetchInstGroups}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={14} /> Actualiser
            </button>
          </div>

          {loadingGroups ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <Loader size={22} /> Chargement des élèves par établissement…
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredGroups.map(group => {
                const key      = group.id || 'null';
                const isOpen   = !!openInst[key];
                const isNull   = group.id === null;
                const color    = isNull ? '#f59e0b' : 'var(--green)';
                const bgColor  = isNull ? 'rgba(245,158,11,0.08)' : 'rgba(0,168,107,0.07)';

                return (
                  <div key={key} className="card" style={{ overflow: 'hidden' }}>
                    {/* En-tête établissement — cliquable pour ouvrir/fermer */}
                    <div
                      onClick={() => setOpenInst(prev => ({ ...prev, [key]: !prev[key] }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '14px',
                        padding: '14px 20px', cursor: 'pointer',
                        background: isOpen ? bgColor : 'transparent',
                        borderBottom: isOpen ? '1px solid var(--border)' : 'none',
                        transition: 'background 0.2s',
                      }}
                    >
                      <div style={{
                        width: '40px', height: '40px', borderRadius: '10px', flexShrink: 0,
                        background: isNull ? 'rgba(245,158,11,0.12)' : 'rgba(0,168,107,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Building2 size={20} color={color} />
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text-dark)' }}>
                          {group.name}
                          {group.code && (
                            <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 400, color: 'var(--text-light)' }}>
                              [{group.code}]
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-light)', marginTop: '2px' }}>
                          <strong style={{ color }}>{group.students.length}</strong>{' '}
                          élève{group.students.length !== 1 ? 's' : ''} inscrit{group.students.length !== 1 ? 's' : ''}
                        </div>
                      </div>

                      <div style={{ color: 'var(--text-light)', transition: 'transform 0.2s', transform: isOpen ? 'rotate(90deg)' : 'none' }}>
                        <ChevronRight size={18} />
                      </div>
                    </div>

                    {/* Liste des élèves */}
                    {isOpen && (
                      <div>
                        {group.students.length === 0 ? (
                          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-light)', fontSize: '13px' }}>
                            Aucun élève dans cet établissement.
                          </div>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table className="students-table">
                              <thead>
                                <tr>
                                  <th>Élève</th>
                                  <th>Établissement</th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.students.map(s => (
                                  <tr key={s.id}>
                                    <td>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {s.avatar_url ? (
                                          <img src={s.avatar_url} alt="avatar"
                                            style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                          <div style={{
                                            width: '32px', height: '32px', borderRadius: '50%',
                                            background: 'var(--green)', color: '#fff',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: '12px', fontWeight: 700,
                                          }}>
                                            {initials(s.full_name)}
                                          </div>
                                        )}
                                        <strong style={{ fontSize: '13px' }}>{s.full_name || '—'}</strong>
                                      </div>
                                    </td>
                                    <td>
                                      <span style={{
                                        padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
                                        background: isNull ? 'rgba(245,158,11,0.1)' : 'rgba(0,168,107,0.08)',
                                        color: isNull ? '#b45309' : 'var(--green)',
                                      }}>
                                        {group.name}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredGroups.length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-light)' }}>
                  <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔍</div>
                  <p>Aucun élève trouvé pour « {searchSuper} »</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Onglets Élèves / Personnel (admin uniquement) ── */}
      {!isSuperAdmin && isAdmin && (
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
          {[
            { key: 'students', label: `Élèves (${students.length})` },
            { key: 'staff',    label: `Personnel (${staff.length})` },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 20px', borderRadius: '8px', border: 'none',
                fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                background: tab === t.key ? 'var(--green)' : 'var(--bg-card)',
                color: tab === t.key ? '#fff' : 'var(--text-light)',
                transition: 'all 0.2s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* ══════════════ ONGLET ÉLÈVES ══════════════ */}
      {!isSuperAdmin && tab === 'students' && (
        <>
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
                <p>Liste des élèves inscrits</p>
              </div>
              {isAdmin && (
                <div style={{ fontSize: '12px', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
                  Classe modifiable · Suppression disponible
                </div>
              )}
            </div>

            <div style={{ overflowX: 'auto' }}>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <Loader size={20} /> Chargement des élèves…
                </div>
              ) : filteredStudents.length === 0 ? (
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
                    {filteredStudents.map(s => (
                      <tr key={s.id}>
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

                        <td style={{ fontFamily: 'monospace', fontSize: '13px' }}>{s.matricule || '—'}</td>

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
                              {savedClass  === s.id && <Check size={14} color="var(--green)" />}
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

                        <td style={{ fontSize: '13px', color: 'var(--text-light)' }}>{s.city || '—'}</td>

                        <td><span className="status-badge badge-active">Actif</span></td>

                        <td>
                          <div className="action-btns">
                            <button className="icon-btn" title="Voir profil">
                              <Eye size={16} />
                            </button>
                            {isAdmin && (
                              <button
                                className="icon-btn"
                                title="Supprimer cet élève"
                                onClick={() => setConfirmDelete({ id: s.id, name: s.profiles?.full_name || '—', type: 'student' })}
                                style={{ color: 'var(--red, #ef4444)' }}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* ══════════════ ONGLET PERSONNEL ══════════════ */}
      {!isSuperAdmin && tab === 'staff' && isAdmin && (
        <>
          <div className="page-top-bar" style={{ marginBottom: 0 }}>
            <div className="filter-row">
              <div className="search-bar">
                <span><Search size={16} /></span>
                <input
                  type="text"
                  placeholder="Filtrer par nom..."
                  value={searchStaff}
                  onChange={e => setSearchStaff(e.target.value)}
                />
              </div>
            </div>
            <button className="btn-sm btn-outline" onClick={fetchStaff} title="Actualiser"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={14} />
            </button>
          </div>

          <div className="card" style={{ marginTop: '20px' }}>
            <div className="card-header">
              <div>
                <h3>Personnel Enseignant & Conseillers</h3>
                <p>Enseignants cours, titulaires et conseillers d'orientation</p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              {loadingStaff ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                  <Loader size={20} /> Chargement du personnel…
                </div>
              ) : filteredStaff.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-light)' }}>
                  <div style={{ fontSize: '40px' }}>👨‍🏫</div>
                  <p style={{ marginTop: '12px', fontWeight: 600 }}>Aucun membre du personnel trouvé.</p>
                </div>
              ) : (
                <table className="students-table">
                  <thead>
                    <tr>
                      <th>Nom</th>
                      <th>Email</th>
                      <th>Rôle</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map(s => (
                      <tr key={s.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {s.avatar_url ? (
                              <img src={s.avatar_url} alt="avatar"
                                style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{
                                width: '32px', height: '32px', borderRadius: '50%',
                                background: 'var(--blue-accent)', color: '#fff',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '12px', fontWeight: 700
                              }}>
                                {initials(s.full_name)}
                              </div>
                            )}
                            <strong>{s.full_name || '—'}</strong>
                          </div>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-light)' }}>{s.email || '—'}</td>
                        <td>
                          <span style={{
                            padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 700,
                            background: 'rgba(59,130,246,0.08)', color: 'var(--blue-accent)',
                          }}>
                            {ROLE_LABELS[s.role] || s.role}
                          </span>
                        </td>
                        <td>
                          <div className="action-btns">
                            <button className="icon-btn" title="Voir profil">
                              <Eye size={16} />
                            </button>
                            <button
                              className="icon-btn"
                              title="Supprimer ce membre du personnel"
                              onClick={() => setConfirmDelete({ id: s.id, name: s.full_name || '—', type: 'staff' })}
                              style={{ color: 'var(--red, #ef4444)' }}
                            >
                              <Trash2 size={16} />
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
        </>
      )}

      {/* ══════════════ MODAL CONFIRMATION SUPPRESSION ══════════════ */}
      {confirmDelete && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
        }}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: '16px', padding: '28px',
            maxWidth: '400px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px', flexShrink: 0,
                background: 'rgba(239,68,68,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <AlertTriangle size={22} color="#ef4444" />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-dark)' }}>
                  Confirmer la suppression
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-light)', marginTop: '2px' }}>
                  Cette action est irréversible
                </div>
              </div>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-dark)', lineHeight: 1.6, margin: '0 0 24px' }}>
              Vous êtes sur le point de supprimer{' '}
              <strong style={{ color: '#ef4444' }}>{confirmDelete.name}</strong>{' '}
              {confirmDelete.type === 'student' ? 'de la liste des élèves' : 'du personnel'}.
              <br />
              <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                Le compte de connexion restera actif côté Supabase Auth — supprimez-le manuellement dans la console si nécessaire.
              </span>
            </p>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                style={{
                  padding: '9px 20px', borderRadius: '8px', border: '1.5px solid var(--border)',
                  background: 'transparent', color: 'var(--text-dark)',
                  fontWeight: 600, fontSize: '13px', cursor: 'pointer'
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  padding: '9px 20px', borderRadius: '8px', border: 'none',
                  background: '#ef4444', color: '#fff',
                  fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                {deleting ? <><Loader size={14} /> Suppression…</> : <><Trash2 size={14} /> Supprimer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddStudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onStudentAdded={fetchStudents}
      />
    </section>
  );
};

export default Students;

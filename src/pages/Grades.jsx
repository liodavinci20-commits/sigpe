import React, { useState } from 'react';

const mockClasses = [
  { name: "3ème A", count: "38 élèves" },
  { name: "3ème B", count: "42 élèves" },
  { name: "2nde A", count: "45 élèves" },
  { name: "2nde B", count: "41 élèves" },
  { name: "Tle C",  count: "36 élèves" }
];

const initialStudents = [
  { id: 1, name: "Abanda Christelle", d1: 14,   d2: 15,   comp: null },
  { id: 2, name: "Ateba Serge",       d1: 9,    d2: 10,   comp: null },
  { id: 3, name: "Biya Rodrigue",     d1: 17,   d2: 16,   comp: null },
  { id: 4, name: "Fouda Célestine",   d1: 11,   d2: null, comp: null },
  { id: 5, name: "Kamga Boris",       d1: 7,    d2: 8,    comp: null },
];

const calcAvg = (d1, d2, comp) => {
  const vals = [d1, d2, comp].filter(v => v !== null && v !== '' && !isNaN(v));
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + Number(b), 0) / vals.length;
};

const Grades = () => {
  const [selectedClass,   setSelectedClass]   = useState("3ème B");
  const [selectedSubject, setSelectedSubject] = useState("Mathématiques");
  const [selectedSeq,     setSelectedSeq]     = useState("Séquence 2");
  const [coefficient,     setCoefficient]     = useState(4);
  const [students,        setStudents]        = useState(initialStudents);

  const updateNote = (id, field, value) => {
    setStudents(prev => prev.map(s =>
      s.id === id ? { ...s, [field]: value === '' ? null : Number(value) } : s
    ));
  };

  const studentsWithAvg = students.map(s => ({
    ...s,
    avg: calcAvg(s.d1, s.d2, s.comp)
  }));

  const ranked = [...studentsWithAvg]
    .filter(s => s.avg !== null)
    .sort((a, b) => b.avg - a.avg);

  const getRank = (id) => {
    const idx = ranked.findIndex(s => s.id === id);
    return idx === -1 ? '—' : `${idx + 1}/${ranked.length}`;
  };

  const classAvg = ranked.length > 0
    ? (ranked.reduce((s, r) => s + r.avg, 0) / ranked.length).toFixed(2)
    : null;

  return (
    <section className="page-section active">

      {/* Sélecteur de classe */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '22px' }}>
        {mockClasses.map((cls, idx) => (
          <div
            key={idx}
            className={`class-pill ${selectedClass === cls.name ? 'active' : ''}`}
            onClick={() => setSelectedClass(cls.name)}
          >
            <div className="cp-name">{cls.name}</div>
            <div className="cp-count">{cls.count}</div>
          </div>
        ))}
      </div>

      <div className="card">

        {/* En-tête */}
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3>Saisie des Notes — <span>{selectedClass}</span></h3>
            <p style={{ marginTop: '2px' }}>{selectedSubject} · {selectedSeq} · M. Essono Pierre</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="filter-select"
              style={{ padding: '8px 12px' }}
              value={selectedSeq}
              onChange={e => setSelectedSeq(e.target.value)}
            >
              <option>Séquence 1</option>
              <option>Séquence 2</option>
              <option>Séquence 3</option>
              <option>Séquence 4</option>
              <option>Séquence 5</option>
              <option>Séquence 6</option>
            </select>

            <select
              className="filter-select"
              style={{ padding: '8px 12px' }}
              value={selectedSubject}
              onChange={e => setSelectedSubject(e.target.value)}
            >
              <option>Mathématiques</option>
              <option>Français</option>
              <option>SVT</option>
              <option>Histoire-Géo</option>
              <option>Anglais</option>
              <option>Physique-Chimie</option>
            </select>

            {/* Sélecteur de coefficient */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: 'var(--bg)', border: '2px solid var(--green)',
              borderRadius: '10px', padding: '5px 12px'
            }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-light)', letterSpacing: '0.5px' }}>COEFF.</span>
              <select
                value={coefficient}
                onChange={e => setCoefficient(Number(e.target.value))}
                style={{
                  background: 'transparent', border: 'none',
                  fontWeight: 900, fontSize: '18px',
                  color: 'var(--green)', cursor: 'pointer', outline: 'none', width: '38px'
                }}
              >
                {[1, 2, 3, 4, 5, 6].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <button className="btn-sm btn-green">💾 Enregistrer</button>
          </div>
        </div>

        {/* Bandeau coefficient info */}
        <div style={{
          margin: '4px 0 16px 0', padding: '10px 16px',
          background: 'rgba(34,197,94,0.07)', borderRadius: '8px',
          border: '1px solid var(--green)',
          display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap'
        }}>
          <span style={{ fontSize: '13px', color: 'var(--text-dark)' }}>
            📐 <strong>{selectedSubject}</strong> — Coefficient&nbsp;
            <strong style={{ color: 'var(--green)', fontSize: '17px' }}>×{coefficient}</strong>
            &nbsp;—&nbsp;
            La note pondérée de chaque élève sera prise en compte dans les bulletins et rapports selon ce coefficient.
          </span>
          {coefficient >= 5 && (
            <span style={{
              fontSize: '11px', fontWeight: 700, color: 'var(--orange, #f97316)',
              background: 'rgba(249,115,22,0.1)', padding: '3px 10px', borderRadius: '20px'
            }}>
              ⚠️ Coefficient élevé — impact fort sur la moyenne générale
            </span>
          )}
        </div>

        {/* Tableau */}
        <div style={{ overflowX: 'auto' }}>
          <table className="notes-entry-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Élève</th>
                <th>Devoir 1</th>
                <th>Devoir 2</th>
                <th>Composition</th>
                <th>Moy. /20</th>
                <th style={{ color: 'var(--green)' }}>Pondérée ×{coefficient}</th>
                <th>Rang</th>
                <th>Obs.</th>
              </tr>
            </thead>
            <tbody>
              {studentsWithAvg.map((student, idx) => {
                const avg      = student.avg;
                const avgStr   = avg !== null ? avg.toFixed(2) : null;
                const weighted = avg !== null ? (avg * coefficient).toFixed(2) : null;
                const avgClass = avgStr
                  ? (avg >= 14 ? 'note-high' : avg >= 8 ? 'note-mid' : 'note-low')
                  : '';

                return (
                  <tr key={student.id}>
                    <td style={{ color: 'var(--text-light)', fontWeight: 600 }}>{idx + 1}</td>
                    <td><strong>{student.name}</strong></td>
                    <td>
                      <input
                        className="note-input"
                        type="number" min="0" max="20" step="0.25"
                        defaultValue={student.d1 ?? ''}
                        placeholder="—"
                        onChange={e => updateNote(student.id, 'd1', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="note-input"
                        type="number" min="0" max="20" step="0.25"
                        defaultValue={student.d2 ?? ''}
                        placeholder="—"
                        onChange={e => updateNote(student.id, 'd2', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="note-input"
                        type="number" min="0" max="20" step="0.25"
                        defaultValue={student.comp ?? ''}
                        placeholder="—"
                        onChange={e => updateNote(student.id, 'comp', e.target.value)}
                      />
                    </td>
                    <td>
                      {avgStr ? (
                        <span className={`note-badge ${avgClass}`} style={{ display: 'inline-flex' }}>{avgStr}</span>
                      ) : (
                        <span style={{ color: 'var(--text-light)' }}>—</span>
                      )}
                    </td>
                    <td>
                      {weighted ? (
                        <span style={{ fontWeight: 800, color: 'var(--green)', fontSize: '14px' }}>
                          {weighted}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-light)' }}>—</span>
                      )}
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-light)', fontWeight: 600 }}>
                      {getRank(student.id)}
                    </td>
                    <td>
                      <input
                        style={{
                          border: '1.5px solid var(--border)', borderRadius: '8px',
                          padding: '7px 10px', fontSize: '12px', width: '90px',
                          background: 'var(--bg)', color: 'var(--text-dark)'
                        }}
                        placeholder="Obs..."
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pied de tableau — statistiques */}
        <div style={{
          marginTop: '16px', padding: '12px 16px',
          background: 'var(--bg)', borderRadius: '8px',
          display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'center'
        }}>
          <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
            Notés : <strong>{ranked.length}/{students.length}</strong>
          </span>
          {classAvg && (
            <>
              <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                Moy. classe : <strong style={{ color: 'var(--blue-accent)' }}>{classAvg}/20</strong>
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                Moy. pondérée classe : <strong style={{ color: 'var(--green)' }}>
                  {(Number(classAvg) * coefficient).toFixed(2)}
                </strong>
                <span style={{ fontSize: '11px', color: 'var(--text-light)' }}> (coeff ×{coefficient})</span>
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                Max : <strong style={{ color: 'var(--green)' }}>{ranked[0].avg.toFixed(2)}</strong>
              </span>
              <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                Min : <strong style={{ color: 'var(--red)' }}>{ranked[ranked.length - 1].avg.toFixed(2)}</strong>
              </span>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default Grades;

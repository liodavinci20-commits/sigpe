import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Loader } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#3B82F6', '#00A86B', '#F97316', '#A855F7', '#EF4444', '#EAB308'];

const Reports = () => {
  const { user } = useAuth();
  const isTeacherHead       = user?.role === 'teacher_head' && !user?.isDemo;
  const isAdminOrCounselor  = (user?.role === 'admin' || user?.role === 'sub_admin' || user?.role === 'counselor') && !user?.isDemo;

  const [loading,       setLoading]       = useState(true);
  const [myClass,       setMyClass]       = useState(null);
  const [studentCount,  setStudentCount]  = useState(0);
  const [sequences,     setSequences]     = useState([]);
  const [subjects,      setSubjects]      = useState([]);
  const [classAvg,      setClassAvg]      = useState(null);
  const [successRate,   setSuccessRate]   = useState(null);
  const [chartData,     setChartData]     = useState([]); // [subjectIdx][seqIdx] = avg | null
  const [distribution,  setDistribution]  = useState([]);
  const [levelData,     setLevelData]     = useState([]);
  const [globalAvg,     setGlobalAvg]     = useState(null);
  const [totalStudents, setTotalStudents] = useState(null);

  useEffect(() => {
    if (user?.isDemo)       { setLoading(false); return; }
    if (isTeacherHead)      { loadTeacherHeadData(); }
    else if (isAdminOrCounselor) { loadAdminData(); }
    else                    { setLoading(false); }
  }, [user]);

  /* ── Teacher Head ──────────────────────────────────────────── */
  const loadTeacherHeadData = async () => {
    setLoading(true);
    try {
      // 1. Classe du titulaire
      const { data: classRows } = await supabase
        .from('classes')
        .select('id, name, level')
        .eq('head_teacher_id', user.id)
        .limit(1);
      const cls = classRows?.[0];
      if (!cls) { setLoading(false); return; }
      setMyClass(cls);

      // 2. Effectif
      const { count: studCount } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', cls.id);
      setStudentCount(studCount ?? 0);

      // 3. IDs des élèves
      const { data: studentRows } = await supabase
        .from('students')
        .select('id')
        .eq('class_id', cls.id);
      const studentIds = (studentRows || []).map(s => s.id);

      // 4. Matières (class_subjects) de la classe
      const { data: csRows } = await supabase
        .from('class_subjects')
        .select('id, coefficient, subjects(id, name)')
        .eq('class_id', cls.id);
      const subjectList = (csRows || []).map(cs => ({
        csId:        cs.id,
        coefficient: cs.coefficient || 1,
        name:        cs.subjects?.name || 'Matière',
      }));
      setSubjects(subjectList);

      // 5. Séquences
      const { data: seqRows } = await supabase
        .from('sequences')
        .select('id, label, number')
        .order('number');
      setSequences(seqRows || []);

      if (!subjectList.length || !seqRows?.length) { setLoading(false); return; }

      // 6. Toutes les notes de ces matières (3 colonnes par ligne)
      const csIds = subjectList.map(s => s.csId);
      const { data: gradeRows } = await supabase
        .from('grades')
        .select('student_id, class_subject_id, sequence_id, note_devoir1, note_devoir2, note_composition')
        .in('class_subject_id', csIds);
      const grades = gradeRows || [];

      // Calcul de la moyenne d'une ligne de notes
      const rowAvg = g => {
        const vals = [g.note_devoir1, g.note_devoir2, g.note_composition].filter(n => n !== null && !isNaN(n));
        return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : null;
      };

      // 7. Tableau chart : par matière × séquence → moyenne classe
      const gradeMap = {};
      grades.forEach(g => {
        const avg = rowAvg(g);
        if (avg === null) return;
        if (!gradeMap[g.class_subject_id]) gradeMap[g.class_subject_id] = {};
        if (!gradeMap[g.class_subject_id][g.sequence_id]) gradeMap[g.class_subject_id][g.sequence_id] = [];
        gradeMap[g.class_subject_id][g.sequence_id].push({ studentId: g.student_id, avg });
      });

      const chart = subjectList.map(subj =>
        (seqRows || []).map(seq => {
          const entries = gradeMap[subj.csId]?.[seq.id] || [];
          return entries.length ? entries.reduce((s,e) => s + e.avg, 0) / entries.length : null;
        })
      );
      setChartData(chart);

      // 8. Moyenne générale + taux de réussite par élève
      const studentFinalAvgs = studentIds.map(sid => {
        let wSum = 0, wTotal = 0;
        subjectList.forEach(subj => {
          const sg = grades.filter(g => g.class_subject_id === subj.csId && g.student_id === sid);
          if (!sg.length) return;
          const avg = sg.map(rowAvg).filter(a => a !== null);
          if (!avg.length) return;
          const subjAvg = avg.reduce((a,b) => a+b, 0) / avg.length;
          wSum   += subjAvg * subj.coefficient;
          wTotal += subj.coefficient;
        });
        return wTotal > 0 ? wSum / wTotal : null;
      }).filter(a => a !== null);

      if (studentFinalAvgs.length > 0) {
        const avg = studentFinalAvgs.reduce((a,b) => a+b, 0) / studentFinalAvgs.length;
        setClassAvg(avg.toFixed(2));
        const passing = studentFinalAvgs.filter(a => a >= 10).length;
        setSuccessRate(((passing / studentFinalAvgs.length) * 100).toFixed(1));

        setDistribution([
          { label: '0 – 5',   count: studentFinalAvgs.filter(a => a < 5).length },
          { label: '5 – 10',  count: studentFinalAvgs.filter(a => a >= 5  && a < 10).length },
          { label: '10 – 15', count: studentFinalAvgs.filter(a => a >= 10 && a < 15).length },
          { label: '15 – 20', count: studentFinalAvgs.filter(a => a >= 15).length },
        ]);
      }
    } catch (err) {
      console.error('Reports (teacher_head):', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Admin / Counselor ─────────────────────────────────────── */
  const loadAdminData = async () => {
    setLoading(true);
    try {
      const { count } = await supabase.from('students').select('*', { count: 'exact', head: true });
      setTotalStudents(count ?? 0);

      const [{ data: classRows }, { data: studentRows }] = await Promise.all([
        supabase.from('classes').select('id, name, level'),
        supabase.from('students').select('class_id'),
      ]);

      const levelMap = {};
      (classRows || []).forEach(c => { levelMap[c.id] = c.level || c.name; });
      const counts = {};
      (studentRows || []).forEach(s => {
        const lvl = levelMap[s.class_id] || 'Non assigné';
        counts[lvl] = (counts[lvl] || 0) + 1;
      });
      setLevelData(
        Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,5).map(([label,c]) => ({ label, count: c }))
      );

      const { data: gradeRows } = await supabase
        .from('grades')
        .select('note_devoir1, note_devoir2, note_composition');
      if (gradeRows?.length) {
        const allNotes = gradeRows.flatMap(g =>
          [g.note_devoir1, g.note_devoir2, g.note_composition].filter(n => n !== null)
        );
        if (allNotes.length) {
          const avg = allNotes.reduce((a,b) => a+b, 0) / allNotes.length;
          setGlobalAvg(avg.toFixed(2));
        }
      }
    } catch (err) {
      console.error('Reports (admin):', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Helpers SVG ───────────────────────────────────────────── */
  const scoreToY  = score => 150 - (score / 20) * 120;
  const seqCount  = sequences.length;
  const xStart    = 60;
  const xEnd      = 375;
  const xStep     = seqCount > 1 ? (xEnd - xStart) / (seqCount - 1) : 0;
  const seqX      = i => seqCount === 1 ? (xStart + xEnd) / 2 : xStart + i * xStep;

  const buildPoints = subjIdx => {
    if (!chartData[subjIdx]) return '';
    return chartData[subjIdx]
      .map((avg, i) => avg !== null ? `${seqX(i)},${scoreToY(avg)}` : null)
      .filter(Boolean).join(' ');
  };

  const maxDist = distribution.length ? Math.max(...distribution.map(d => d.count), 1) : 1;

  /* ── Render ────────────────────────────────────────────────── */
  return (
    <section className="page-section active">
      <div className="page-top-bar">
        <div>
          <h3>Rapports &amp; Statistiques</h3>
          {myClass && (
            <p style={{ fontSize: '13px', color: 'var(--text-light)', margin: 0 }}>
              Classe : <strong>{myClass.name}</strong>
            </p>
          )}
        </div>
        <button className="btn-sm btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TrendingUp size={16} /> Exporter Synthèse
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <Loader size={20} /> Chargement des statistiques…
        </div>
      ) : (
        <>
          {/* ── KPIs ── */}
          <div className="reports-kpi">
            {isTeacherHead ? (
              <>
                <div className="kpi-card">
                  <h4>Moyenne Générale de la Classe</h4>
                  <div className="kpi-val">{classAvg ?? '—'}</div>
                  <div className="kpi-sub" style={{ color: classAvg >= 10 ? 'var(--green)' : classAvg ? 'var(--red)' : 'var(--text-light)' }}>
                    {classAvg
                      ? (Number(classAvg) >= 10 ? '✓ Au-dessus de la moyenne' : '↓ En dessous de la moyenne')
                      : 'Aucune note enregistrée'}
                  </div>
                </div>
                <div className="kpi-card">
                  <h4>Taux de Réussite</h4>
                  <div className="kpi-val">{successRate !== null ? `${successRate}%` : '—'}</div>
                  <div className="kpi-sub" style={{ color: successRate >= 50 ? 'var(--green)' : successRate !== null ? 'var(--red)' : 'var(--text-light)' }}>
                    {successRate !== null ? 'Élèves avec moy. ≥ 10' : 'Données insuffisantes'}
                  </div>
                </div>
                <div className="kpi-card">
                  <h4>Effectif de la Classe</h4>
                  <div className="kpi-val">{studentCount}</div>
                  <div className="kpi-sub" style={{ color: 'var(--text-light)' }}>
                    {myClass?.name} · {subjects.length} matière{subjects.length !== 1 ? 's' : ''}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="kpi-card">
                  <h4>Total Élèves Inscrits</h4>
                  <div className="kpi-val">{totalStudents ?? '—'}</div>
                  <div className="kpi-sub" style={{ color: 'var(--green)' }}>Année 2024–2025</div>
                </div>
                <div className="kpi-card">
                  <h4>Moyenne Générale Établ.</h4>
                  <div className="kpi-val">{globalAvg ?? '—'}</div>
                  <div className="kpi-sub" style={{ color: globalAvg >= 10 ? 'var(--green)' : globalAvg ? 'var(--red)' : 'var(--text-light)' }}>
                    {globalAvg ? (Number(globalAvg) >= 10 ? '↑ Au-dessus de 10' : '↓ En dessous de 10') : 'Aucune note encore'}
                  </div>
                </div>
                <div className="kpi-card">
                  <h4>Taux de Présence</h4>
                  <div className="kpi-val">—</div>
                  <div className="kpi-sub" style={{ color: 'var(--text-light)' }}>Table absences non connectée</div>
                </div>
              </>
            )}
          </div>

          <div className="report-chart-row">

            {/* ── Graphique 1 : Évolution des moyennes par séquence ── */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>Évolution des Moyennes par Séquence</h3>
                  <p>
                    {myClass ? `Classe ${myClass.name}` : 'Établissement'} · {seqCount} séquence{seqCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="card-body">
                {isTeacherHead && chartData.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)', fontSize: '13px' }}>
                    Aucune note enregistrée pour cette classe.
                  </div>
                ) : (
                  <>
                    <svg viewBox="0 0 430 185" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%' }}>
                      {/* Axes */}
                      <line x1="50" y1="10"  x2="50"  y2="155" stroke="#E5E7EB" strokeWidth="1"/>
                      <line x1="50" y1="155" x2="415" y2="155" stroke="#E5E7EB" strokeWidth="1"/>
                      {/* Grille horizontale + labels Y */}
                      {[0, 5, 10, 15, 20].map(v => (
                        <g key={v}>
                          <line x1="50" y1={scoreToY(v)} x2="415" y2={scoreToY(v)}
                            stroke={v === 10 ? '#F97316' : '#F3F4F6'}
                            strokeWidth="1"
                            strokeDasharray={v === 10 ? '6,3' : '4'}
                            opacity={v === 10 ? 0.6 : 1}
                          />
                          <text x="44" y={scoreToY(v) + 4} fontSize="9" fill="#9CA3AF" textAnchor="end">{v}</text>
                        </g>
                      ))}

                      {/* Courbes par matière (données réelles) */}
                      {isTeacherHead ? (
                        subjects.slice(0, 6).map((subj, si) => {
                          const pts = buildPoints(si);
                          if (!pts) return null;
                          const col = COLORS[si % COLORS.length];
                          return (
                            <g key={subj.csId}>
                              <polyline fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
                              {chartData[si].map((avg, i) => avg !== null ? (
                                <g key={i}>
                                  <circle cx={seqX(i)} cy={scoreToY(avg)} r="4" fill={col} />
                                  <text x={seqX(i)} y={scoreToY(avg) - 7} fontSize="8" fill={col} textAnchor="middle">
                                    {avg.toFixed(1)}
                                  </text>
                                </g>
                              ) : null)}
                            </g>
                          );
                        })
                      ) : (
                        /* Courbes démo pour admin/counselor/demo */
                        <>
                          <polyline fill="none" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="80,90 150,75 220,82 290,68 360,60" />
                          {[[80,90],[150,75],[220,82],[290,68],[360,60]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="4" fill="#3B82F6"/>)}
                          <polyline fill="none" stroke="#00A86B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" points="80,100 150,95 220,105 290,92 360,88" />
                          {[[80,100],[150,95],[220,105],[290,92],[360,88]].map(([x,y],i) => <circle key={i} cx={x} cy={y} r="4" fill="#00A86B"/>)}
                        </>
                      )}

                      {/* Labels X (séquences ou niveaux démo) */}
                      {isTeacherHead ? (
                        sequences.slice(0, 6).map((seq, i) => (
                          <text key={seq.id} x={seqX(i)} y="172" fontSize="9" fill="#9CA3AF" textAnchor="middle">
                            {seq.label || `Séq ${seq.number}`}
                          </text>
                        ))
                      ) : (
                        ['6ème','5ème','4ème','3ème','Lycée'].map((l, i) => (
                          <text key={l} x={80 + i * 70} y="172" fontSize="9" fill="#9CA3AF" textAnchor="middle">{l}</text>
                        ))
                      )}
                    </svg>

                    <div className="chart-legend">
                      {isTeacherHead ? (
                        subjects.slice(0, 6).map((subj, si) => (
                          <div key={subj.csId} className="legend-item">
                            <div className="legend-dot" style={{ background: COLORS[si % COLORS.length] }} />
                            {subj.name}
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="legend-item"><div className="legend-dot" style={{ background: '#3B82F6' }} />Mathématiques</div>
                          <div className="legend-item"><div className="legend-dot" style={{ background: 'var(--green)' }} />Français</div>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Graphique 2 : Répartition ── */}
            <div className="card">
              <div className="card-header">
                <div>
                  <h3>{isTeacherHead ? 'Répartition des Élèves par Tranche' : 'Répartition par Niveau'}</h3>
                  <p>{isTeacherHead ? `Moyennes générales · ${myClass?.name}` : 'Effectifs inscrits 2024–25'}</p>
                </div>
              </div>
              <div className="card-body">
                {isTeacherHead ? (
                  distribution.every(d => d.count === 0) ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)', fontSize: '13px' }}>
                      Aucune donnée disponible.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {distribution.map((d, i) => {
                        const distColors = ['#EF4444', '#F97316', '#00A86B', '#3B82F6'];
                        return (
                          <div key={d.label} className="perf-row">
                            <span style={{ width: '70px', fontSize: '13px' }}>{d.label}</span>
                            <div className="prog-bar-wrap">
                              <div className="prog-bar" style={{ width: `${(d.count / maxDist) * 100}%`, background: distColors[i] }} />
                            </div>
                            <strong style={{ width: '60px', textAlign: 'right', fontSize: '13px' }}>
                              {d.count} élève{d.count !== 1 ? 's' : ''}
                            </strong>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  levelData.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {(() => {
                        const maxCount = Math.max(...levelData.map(d => d.count), 1);
                        const lvlColors = ['var(--navy-light)', 'var(--blue-accent)', 'var(--green)', '#A855F7', '#F97316'];
                        return levelData.map((l, i) => (
                          <div key={l.label} className="perf-row">
                            <span style={{ width: '90px', fontSize: '12px' }}>{l.label}</span>
                            <div className="prog-bar-wrap">
                              <div className="prog-bar" style={{ width: `${(l.count / maxCount) * 100}%`, background: lvlColors[i % lvlColors.length] }} />
                            </div>
                            <strong style={{ width: '40px', textAlign: 'right' }}>{l.count}</strong>
                          </div>
                        ));
                      })()}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-light)', fontSize: '13px' }}>
                      Aucune donnée disponible.
                    </div>
                  )
                )}
              </div>
            </div>

          </div>
        </>
      )}
    </section>
  );
};

export default Reports;

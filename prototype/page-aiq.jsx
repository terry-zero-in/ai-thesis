/* /aiq/[ticker] */
const AiqEditor = ({ ticker, navigate }) => {
  const baseRubric = window.AIQ_TSM;
  const u = window.UNIVERSE.find(x => x.tk === ticker) || window.UNIVERSE.find(x => x.tk === 'TSM');
  const [dims, setDims] = useState(baseRubric.dims.map(d => ({ ...d })));

  const update = (key, field, val) => {
    setDims(ds => ds.map(d => d.key === key ? { ...d, [field]: val } : d));
  };

  const total = dims.reduce((s, d) => s + d.score, 0);
  const baseTotal = baseRubric.dims.reduce((s, d) => s + d.score, 0);
  const delta = total - baseTotal;
  const changed = dims.some((d, i) => d.score !== baseRubric.dims[i].score || d.notes !== baseRubric.dims[i].notes || d.sourceUrl !== baseRubric.dims[i].sourceUrl);

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Universe', onClick: () => navigate('universe') },
          { label: u.tk, onClick: () => navigate('detail', { ticker: u.tk }) },
          { label: 'AIQ' },
        ]}
        title={`AIQ Rubric · ${u.tk}`}
        meta={`Last scored ${baseRubric.scoredAt} · ${baseTotal} / 100 · 6 dimensions`}
        right={
          <>
            <button className="btn btn-ghost" onClick={() => setDims(baseRubric.dims.map(d => ({ ...d })))} disabled={!changed}>
              Discard
            </button>
            <button className="btn btn-primary" disabled={!changed}>
              {changed ? <>Save · <span className="mono" style={{ marginLeft: 4 }}>{total}{delta !== 0 ? ` (${delta > 0 ? '+' : ''}${delta})` : ''}</span></> : 'No changes'}
            </button>
          </>
        }
      />
      <div className="section-divider" />

      <div className="callout mb-20">
        <Icon name="info" size={14} className="muted" />
        <span className="muted" style={{ fontSize: 13 }}>
          Edits write a new row to <span className="mono accent-c">aiq_rubric</span> with a new <span className="mono accent-c">scored_at</span> timestamp.
          History is preserved · never overwritten.
        </span>
      </div>

      {dims.map((d, i) => {
        const base = baseRubric.dims[i];
        const dimChanged = d.score !== base.score || d.notes !== base.notes;
        return (
          <div key={d.key} className="dim-block">
            <div className="dim-head">
              <div className="dim-title">
                <span className="mono muted">{String(i + 1).padStart(2, '0')}</span>
                <span>{d.title}</span>
                <span className="max">/ {d.max}</span>
                {dimChanged && <span className="chip active mono">EDITED</span>}
              </div>
              <input
                type="number"
                min="0"
                max={d.max}
                className="score-input"
                value={d.score}
                onChange={(e) => update(d.key, 'score', Math.max(0, Math.min(d.max, parseInt(e.target.value) || 0)))}
              />
            </div>
            <div className="factor-bar" style={{ marginBottom: 6 }}>
              <div className="factor-fill" style={{ width: `${(d.score / d.max) * 100}%` }} />
            </div>
            <textarea
              className="dim-notes"
              rows={2}
              value={d.notes}
              onChange={(e) => update(d.key, 'notes', e.target.value)}
            />
            <div className="dim-source">
              <Icon name="ext" size={12} className="muted" />
              <span className="muted">Source:</span>
              <a href={`https://${d.sourceUrl}`} target="_blank" rel="noopener">{d.sourceUrl}</a>
            </div>
          </div>
        );
      })}

      <div className="dim-block" style={{ borderBottom: 'none', borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 18 }}>
        <div className="dim-head">
          <div className="label-cap">Total · current revision</div>
          <div className="mono" style={{ fontSize: 28, fontWeight: 500, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            {total} <span className="muted">/ 100</span>
            {delta !== 0 && (
              <span className={delta > 0 ? 'delta-up' : 'delta-down'} style={{ fontSize: 14, marginLeft: 8 }}>
                {delta > 0 ? '+' : ''}{delta}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="section-divider"></div>

      <div className="row-flex" style={{ justifyContent: 'flex-end', gap: 12 }}>
        <button className="btn btn-ghost" onClick={() => setDims(baseRubric.dims.map(d => ({ ...d })))} disabled={!changed}>
          Discard changes
        </button>
        <button className="btn btn-primary" disabled={!changed}>
          {changed ? <>Save revision · {total}/100</> : 'Saved'}
        </button>
      </div>
    </>
  );
};

const AiqEditorRail = () => {
  return (
    <>
      <div className="rail-section">
        <RailHeader icon="clock" label="History" />
        <div>
          {window.AIQ_TSM.history.map((h, i) => (
            <div key={i} className="rail-event">
              <span className="date">
                {h.date} {i === 0 && <span className="accent-c">· CURRENT</span>}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="mono bright" style={{ fontSize: 14, fontWeight: 500 }}>{h.score}</span>
                {h.delta !== 0 && (
                  <span className={`mono ${h.delta > 0 ? 'delta-up' : 'delta-down'}`} style={{ fontSize: 11 }}>
                    {h.delta > 0 ? '+' : ''}{h.delta}
                  </span>
                )}
              </div>
              <span className="desc" style={{ fontSize: 12 }}>{h.note}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rail-section">
        <RailHeader icon="check" label="Agent pipeline · 8/8" />
        <div className="audit-list">
          {window.AIQ_AGENTS.map((a, i) => (
            <div key={i} className="audit-row">
              <span className="audit-status">
                <Icon name="check" size={9} strokeWidth="2.5" />
              </span>
              <span style={{ flex: 1 }}>{a.name}</span>
              <span className="timing">{a.timing}</span>
            </div>
          ))}
        </div>
        <div className="muted mono mt-8" style={{ fontSize: 11 }}>
          Total runtime <span className="bright">1m 55s</span> · Sonnet 4.5
        </div>
      </div>

      <div className="rail-section">
        <RailHeader icon="info" label="Rubric weights" />
        <div className="col-flex" style={{ gap: 6, fontSize: 12.5 }}>
          <div className="rail-row"><span className="lbl">Disclosure</span><span className="val">20</span></div>
          <div className="rail-row"><span className="lbl">Defensibility</span><span className="val">20</span></div>
          <div className="rail-row"><span className="lbl">Concentration</span><span className="val">15</span></div>
          <div className="rail-row"><span className="lbl">Capex efficiency</span><span className="val">15</span></div>
          <div className="rail-row"><span className="lbl">Indep. demand</span><span className="val">15</span></div>
          <div className="rail-row"><span className="lbl">Accounting</span><span className="val">15</span></div>
          <div className="rail-row" style={{ paddingTop: 8, borderTop: '1px solid var(--border-subtle)', marginTop: 6 }}>
            <span className="lbl bright">Total</span><span className="val bright">100</span>
          </div>
        </div>
      </div>
    </>
  );
};

Object.assign(window, { AiqEditor, AiqEditorRail });

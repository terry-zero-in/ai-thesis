/* /n/[ticker] */
const NameDetail = ({ ticker, navigate }) => {
  const u = window.UNIVERSE.find(x => x.tk === ticker) || window.UNIVERSE[0];
  const macro = window.MACRO;
  const effective = u.comp * macro.multiplier;
  const pos = window.PORTFOLIO.positions.find(p => p.tk === u.tk);
  const history12w = window.SCORE_HISTORY_12W(u.tk);
  const activity = window.ACTIVITY[u.tk] || [
    { date: 'May 14', kind: 'score', desc: `Composite ${u.d7 > 0 ? '+' : ''}${u.d7.toFixed(1)}` },
    { date: 'May 12', kind: 'rubric', desc: 'AIQ rubric refresh' },
    { date: 'May 08', kind: 'macro', desc: 'NAAIM gate triggered 0.95×' },
  ];

  // Score history chart
  const HistoryChart = ({ data, height = 120, width = 660 }) => {
    if (!data || data.length < 2) return null;
    const min = Math.min(40, ...data) - 4;
    const max = Math.max(95, ...data) + 4;
    const range = max - min;
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 12) - 6;
      return [x, y];
    });
    const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const yFor = (v) => height - ((v - min) / range) * (height - 12) - 6;
    const yHigh = yFor(75);
    const yMed = yFor(60);
    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {/* threshold lines */}
        <line x1="0" y1={yHigh} x2={width} y2={yHigh} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
        <line x1="0" y1={yMed} x2={width} y2={yMed} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray="3 3" />
        <text x={width - 4} y={yHigh - 4} textAnchor="end" fill="var(--text-3)" fontSize="9" fontFamily="JetBrains Mono">HIGH · 75</text>
        <text x={width - 4} y={yMed - 4} textAnchor="end" fill="var(--text-3)" fontSize="9" fontFamily="JetBrains Mono">MED · 60</text>
        {/* fill */}
        <path d={`${path} L${width},${height} L0,${height} Z`} fill="var(--accent)" opacity="0.10" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* end dot */}
        <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="3" fill="var(--accent)" />
      </svg>
    );
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Universe', onClick: () => navigate('universe') },
          { label: u.tk },
        ]}
        title=""
        right={
          <>
            <button className="btn btn-ghost" onClick={() => navigate('aiq', { ticker: u.tk })}>
              <Icon name="sliders" size={13} /> Edit AIQ rubric
            </button>
            <button className="btn btn-secondary">
              <Icon name="bell" size={13} /> Watch
            </button>
          </>
        }
      />

      <div className="detail-head mb-20">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <span className="detail-ticker">{u.tk}</span>
          <span className="detail-name">{u.nm}</span>
        </div>
        <div className="detail-meta mono">
          <span className="chip">{u.lay} {window.LAYERS[u.lay].label}</span>
          <span className="bullet">·</span>
          <span>{u.seg}</span>
          <span className="bullet">·</span>
          <span>Scored May 15 23:24 CT</span>
          <span className="bullet">·</span>
          <TierBadge tier={u.tier} />
          {u.depr !== null && (
            <>
              <span className="bullet">·</span>
              <span className="depr-flag">
                <Icon name="alert" size={10} /> Depreciation <span className="num">{u.depr}</span>
              </span>
            </>
          )}
        </div>
      </div>

      <div className="section-divider"></div>

      {/* 5-card detail header — Recommendation / Composite / Conviction / Target / Bear Case */}
      <div className="detail-cards-row mb-20">
        <div className="detail-card">
          <span className="detail-card-label">Recommendation</span>
          <span className={`reco-pill ${u.tier === 'high' ? 'buy' : u.tier === 'medium' ? 'hold' : u.tier === 'low' ? 'hold' : 'sell'}`}>
            {u.tier === 'high' ? 'Buy' : u.tier === 'medium' ? 'Hold' : u.tier === 'low' ? 'Watch' : 'Avoid'}
          </span>
          <span className="detail-card-sub">
            <TierBadge tier={u.tier} />
          </span>
        </div>
        <div className="detail-card">
          <span className="detail-card-label">Composite score</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="detail-card-value">{u.comp.toFixed(1)}</span>
            <span className={`detail-card-sub ${u.d7 > 0 ? 'delta-up' : u.d7 < 0 ? 'delta-down' : ''}`}>
              {u.d7 > 0 ? '+' : ''}{u.d7.toFixed(1)} 7d
            </span>
          </div>
          <span className="detail-card-sub">{(u.comp * macro.multiplier).toFixed(1)} effective · {macro.multiplier.toFixed(2)}×</span>
        </div>
        <div className="detail-card">
          <span className="detail-card-label">Conviction</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="detail-card-value">{u.conv}<span className="muted" style={{ fontSize: 14 }}> /10</span></span>
          </div>
          <Conviction value={u.conv} />
        </div>
        <div className="detail-card">
          <span className="detail-card-label">Time horizon</span>
          <span className="detail-card-value">12–18 <span className="muted" style={{ fontSize: 14 }}>mo</span></span>
          <span className="detail-card-sub">Through FY2027</span>
        </div>
        <div className="detail-card">
          <span className="detail-card-label">Bear case floor</span>
          <span className="detail-card-value danger-c">{formatDollar(u.price * 0.78)}</span>
          <span className="detail-card-sub danger-c">−22% downside</span>
        </div>
      </div>

      {/* Factor decomposition */}
      <div className="section-title-row">
        <h2 className="section-title">Factor decomposition</h2>
        <span className="sub mono">hover row for sub-factor breakdown</span>
      </div>
      <div className="mb-32" style={{ maxWidth: 720 }}>
        <div className="factors">
          <FactorBar label="Q" score={u.q} />
          <FactorBar label="G" score={u.g} />
          <FactorBar label="V" score={u.v} />
          <FactorBar label="AIQ" score={u.aiq} />
        </div>
      </div>

      {/* Investment thesis prose */}
      <div className="section-divider"></div>
      <div className="section-title-row">
        <h2 className="section-title">Investment thesis</h2>
        <span className="sub mono">synthesized {window.AIQ_TSM.scoredAt} · 8/8 agents complete</span>
      </div>
      <div className="thesis-prose mb-32">
        {u.tk === 'TSM' && (
          <p>
            <strong>TSM</strong> is the structural beneficiary of the 2026 AI capex cycle, with HPC mix
            disclosed at <span className="num">61%</span> of revenue and a foundry monopoly on sub-3nm nodes.
            ASML high-NA backlog booked through <span className="num">2028</span> insulates the moat; 2026 capex
            guided <span className="num">$44B</span> against <span className="num">28%</span> trailing-3yr ROIC —
            best-in-class capex-to-revenue conversion. Customer concentration (NVDA + AAPL =
            <span className="num"> 38%</span>) is material but the end-demand is broader hyperscaler capex,
            not vendor-specific. <strong>Setup supports a constructive 12–18 month thesis</strong> with
            disciplined entry near current levels. <span className="accent">Bear case</span> hinges on geopolitical
            tail risk and HPC demand digestion mid-cycle.
          </p>
        )}
        {u.tk !== 'TSM' && (
          <p>
            <strong>{u.tk}</strong> is positioned in {window.LAYERS[u.lay].label.toLowerCase()} ({u.seg}) with a
            composite score of <span className="num">{u.comp.toFixed(1)}</span> and AIQ rubric of
            <span className="num"> {u.aiq}/100</span>. Factor decomposition shows
            Q <span className="num">{u.q}</span> / G <span className="num">{u.g}</span> / V <span className="num">{u.v}</span>,
            consistent with a <strong>{u.tier === 'high' ? 'High-conviction' : u.tier === 'medium' ? 'Medium-tier' : u.tier === 'low' ? 'Low-tier' : 'Avoid-tier'}</strong> rating.
            {u.depr !== null && (
              <> <span className="accent">Burry depreciation flag:</span> <span className="num">{u.depr}</span> penalty applied to V on accounting check.</>
            )}
            {' '}Macro multiplier <span className="num">{macro.multiplier.toFixed(2)}×</span> reduces effective
            score to <span className="num">{(u.comp * macro.multiplier).toFixed(1)}</span> in current regime.
          </p>
        )}
      </div>

      <div className="section-divider"></div>

      {/* AIQ Rubric */}
      {u.tk === 'TSM' && (
        <>
          <div className="section-title-row">
            <h2 className="section-title">AIQ rubric</h2>
            <button className="btn-link" onClick={() => navigate('aiq', { ticker: u.tk })}>
              Edit rubric <Icon name="arrowRight" size={11} />
            </button>
          </div>
          <div className="mb-32">
            {window.AIQ_TSM.dims.map(d => (
              <div key={d.key} className="rubric-row">
                <span className="nm">{d.title}</span>
                <span className="sc">{d.score}&nbsp;/&nbsp;<span className="muted">{d.max}</span></span>
              </div>
            ))}
            <div className="rubric-total">
              <span className="nm">Total</span>
              <span className="sc">{window.AIQ_TSM.dims.reduce((s, d) => s + d.score, 0)} / 100</span>
            </div>
          </div>
        </>
      )}

      {u.tk !== 'TSM' && (
        <>
          <div className="section-title-row">
            <h2 className="section-title">AIQ rubric</h2>
            <button className="btn-link" onClick={() => navigate('aiq', { ticker: u.tk })}>
              Edit rubric <Icon name="arrowRight" size={11} />
            </button>
          </div>
          <div className="mb-32">
            {['Disclosure', 'Defensibility', 'Concentration', 'Capex efficiency', 'Independent demand', 'Accounting'].map((nm, i) => {
              const max = [20, 20, 15, 15, 15, 15][i];
              const score = Math.round((u.aiq / 100) * max + (i % 2 === 0 ? 0 : -1));
              return (
                <div key={nm} className="rubric-row">
                  <span className="nm">{nm}</span>
                  <span className="sc">{Math.max(0, Math.min(max, score))}&nbsp;/&nbsp;<span className="muted">{max}</span></span>
                </div>
              );
            })}
            <div className="rubric-total">
              <span className="nm">Total</span>
              <span className="sc">{u.aiq} / 100</span>
            </div>
          </div>
        </>
      )}

      <div className="section-divider"></div>

      {/* Score History */}
      <div className="section-title-row">
        <h2 className="section-title">Score history</h2>
        <span className="sub mono">12 weeks · weekly refresh</span>
      </div>
      <div className="score-history-chart mb-32">
        <HistoryChart data={history12w} />
      </div>

      {/* Position */}
      {pos && (
        <>
          <div className="section-divider"></div>
          <div className="section-title-row">
            <h2 className="section-title">Position</h2>
            <span className="sub mono">Held since Apr 3, 2026</span>
          </div>
          <div className="kpi-row mb-20">
            <Kpi
              label="Shares"
              value={pos.sh.toString()}
              deltas={[{ text: `cost ${formatDollar(pos.cost)}/sh` }]}
            />
            <Kpi
              label="Market value"
              value={formatDollar(pos.sh * pos.px)}
              deltas={[{ text: `${pos.pct.toFixed(1)}% of book` }]}
            />
            <Kpi
              label="P&L"
              value={`${pos.px > pos.cost ? '+' : ''}${formatDollar((pos.px - pos.cost) * pos.sh)}`}
              deltas={[{ text: `${((pos.px / pos.cost - 1) * 100).toFixed(1)}%`, tone: pos.px > pos.cost ? 'up' : 'down' }]}
            />
            <Kpi
              label="Current price"
              value={formatDollar(pos.px)}
              deltas={[{ text: 'vs cost', tone: pos.px > pos.cost ? 'up' : 'down' }]}
              spark={u.sparkPrice.slice(8)}
            />
          </div>
        </>
      )}

      {!pos && (
        <>
          <div className="section-divider"></div>
          <div className="callout">
            <Icon name="info" size={14} />
            <span>Not currently held. <span className="accent-c" style={{ cursor: 'pointer' }}>Add to portfolio →</span></span>
          </div>
        </>
      )}
    </>
  );
};

const NameDetailRail = ({ ticker }) => {
  const u = window.UNIVERSE.find(x => x.tk === ticker) || window.UNIVERSE[0];
  const activity = window.ACTIVITY[u.tk] || [
    { date: 'May 14', kind: 'score', desc: `Composite ${u.d7 > 0 ? '+' : ''}${u.d7.toFixed(1)}` },
    { date: 'May 12', kind: 'rubric', desc: 'AIQ rubric refresh' },
    { date: 'May 08', kind: 'macro', desc: 'NAAIM gate triggered 0.95×' },
    { date: 'Apr 30', kind: 'news', desc: 'Q1 earnings released' },
  ];
  return (
    <>
      <div className="rail-section">
        <RailHeader icon="clock" label="Activity" />
        <div>
          {activity.map((a, i) => (
            <div key={i} className="rail-event">
              <span className="date">{a.date} · {a.kind}</span>
              <span className="desc">{a.desc}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rail-section">
        <RailHeader icon="bell" label="Insider · recent" />
        <div className="rail-empty">No Form 4 filings · last 30d</div>
      </div>
      <div className="rail-section">
        <RailHeader icon="fileText" label="News" />
        <div>
          <div className="rail-event">
            <span className="date">APR 16 · earnings</span>
            <span className="desc">Q1 2026: +58% YoY profit, +revenue guide</span>
          </div>
          <div className="rail-event">
            <span className="date">APR 10 · contract</span>
            <span className="desc">Customer concentration shifts, AAPL +orders</span>
          </div>
          <div className="rail-event">
            <span className="date">MAR 22 · macro</span>
            <span className="desc">CHIPS Act extension confirmed</span>
          </div>
        </div>
      </div>
    </>
  );
};

Object.assign(window, { NameDetail, NameDetailRail });

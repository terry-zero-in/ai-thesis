/* AI Thesis — Shared Components */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// ------------------------------------------------------------------
// Icons — Lucide-style inline SVG, stroke 1.5
// ------------------------------------------------------------------
const Icon = ({ name, size = 14, strokeWidth = 1.5, ...rest }) => {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    briefcase: <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
    gauge: <><path d="M12 14l4-4"/><circle cx="12" cy="13" r="9"/></>,
    fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>,
    check: <><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
    sliders: <><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>,
    help: <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12" y2="17"/></>,
    panel: <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="15" y1="3" x2="15" y2="21"/></>,
    filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>,
    up: <><polyline points="18 15 12 9 6 15"/></>,
    down: <><polyline points="6 9 12 15 18 9"/></>,
    arrowUp: <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
    arrowDown: <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>,
    trendUp: <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></>,
    trendDown: <><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></>,
    alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12" y2="17"/></>,
    info: <><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="8"/></>,
    edit: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
    chevR: <><polyline points="9 18 15 12 9 6"/></>,
    chevD: <><polyline points="6 9 12 15 18 9"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    x: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    ext: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    arrowRight: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    listDown: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {paths[name] || null}
    </svg>
  );
};

// ------------------------------------------------------------------
// TierBadge
// ------------------------------------------------------------------
const TierBadge = ({ tier }) => {
  const cls = `tier tier-${tier}`;
  return <span className={cls}>{tier}</span>;
};

// ------------------------------------------------------------------
// Conviction ticks
// ------------------------------------------------------------------
const Conviction = ({ value, max = 10 }) => (
  <span className="conv" aria-label={`${value}/${max} conviction`}>
    {Array.from({ length: max }).map((_, i) =>
      <span key={i} className={`conv-tick ${i < value ? 'on' : ''}`} />
    )}
  </span>
);

// ------------------------------------------------------------------
// Sparkline
// ------------------------------------------------------------------
const Sparkline = ({ data, width = 80, height = 24, color, fill = false }) => {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const start = data[0], end = data[data.length - 1];
  const auto = end > start * 1.005 ? 'var(--success)' : end < start * 0.995 ? 'var(--danger)' : 'var(--text-3)';
  const stroke = color || auto;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y];
  });
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const fillPath = `${path} L${width},${height} L0,${height} Z`;
  return (
    <svg className="spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {fill && <path d={fillPath} fill={stroke} opacity="0.12" />}
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

// ------------------------------------------------------------------
// FactorBar
// ------------------------------------------------------------------
const FactorBar = ({ label, score, max = 100, mode = 'normal', onHover }) => {
  const pct = Math.min(100, (score / max) * 100);
  let cls = 'factor-fill';
  if (mode === 'warn' || score < 40) cls = 'factor-fill warn';
  if (score < 30) cls = 'factor-fill danger';
  const [hover, setHover] = useState(false);
  return (
    <div
      className="factor"
      onMouseEnter={() => { setHover(true); onHover && onHover(true); }}
      onMouseLeave={() => { setHover(false); onHover && onHover(false); }}
      style={{ position: 'relative' }}
    >
      <div className="factor-label">{label}</div>
      <div className="factor-bar"><div className={cls} style={{ width: `${pct}%` }} /></div>
      <div className="factor-score">{score}</div>
      {hover && window.SUBFACTORS && window.SUBFACTORS[label] && (
        <div className="tip visible" style={{ left: '60px', top: '24px' }}>
          <div className="tip-title">{label} decomposition</div>
          {Object.entries(window.SUBFACTORS[label]).map(([k, v]) => (
            <div key={k} className="tip-row">
              <span className="l">{k.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
              <span className="v">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// MacroGauge — tile component
// ------------------------------------------------------------------
const MacroGauge = ({ label, value, delta, deltaLabel, threshold, max, min = 0, hit, hitText, dir = 'top', formatValue }) => {
  // dir 'top' = gate when value > threshold (NAAIM, F&G)
  // dir 'bothSpread' = AAII (gate when |value| > threshold)
  const range = max - min;
  const valPct = ((value - min) / range) * 100;
  const thrPos = dir === 'bothSpread' ? null : ((threshold - min) / range) * 100;
  const displayVal = formatValue ? formatValue(value) : value.toFixed(value % 1 === 0 ? 0 : 2);
  const deltaStr = (delta > 0 ? '+' : '') + delta.toFixed(2);
  const deltaCls = delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat';
  return (
    <div className={`gauge-tile ${hit ? 'hit' : ''}`}>
      <div className="gauge-label">
        <span>{label}</span>
      </div>
      <div className="gauge-value-row">
        <div className="gauge-value">{displayVal}</div>
        <div className={`gauge-delta ${deltaCls}`}>{deltaStr} <span className="muted">{deltaLabel}</span></div>
      </div>
      <div className="gauge-bar-wrap">
        <div className="gauge-bar">
          <div className="gauge-fill" style={{ width: `${Math.max(0, Math.min(100, valPct))}%` }} />
          {thrPos !== null && <div className="gauge-threshold" style={{ left: `${thrPos}%` }} />}
          {dir === 'bothSpread' && (
            <>
              <div className="gauge-threshold" style={{ left: `${((threshold - min) / range) * 100}%` }} />
              <div className="gauge-threshold" style={{ left: `${((-threshold - min) / range) * 100}%` }} />
            </>
          )}
          <div className="gauge-marker" style={{ left: `${Math.max(0, Math.min(100, valPct))}%` }} />
        </div>
        <div className="gauge-scale">
          <span>{min}</span>
          {dir === 'top' && <span>{Math.round((max + min) / 2)}</span>}
          {dir === 'top' && <span>{threshold}</span>}
          {dir === 'bothSpread' && <span>0</span>}
          {dir === 'bothSpread' && <span>+{threshold}</span>}
          <span>{max}</span>
        </div>
      </div>
      <div className={`gate-ribbon ${hit ? '' : 'miss'}`}>
        {hit ? <Icon name="alert" size={10} /> : null}
        {hitText}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// KPI
// ------------------------------------------------------------------
const Kpi = ({ label, value, deltas = [], spark, sparkColor }) => (
  <div className="kpi">
    <div className="kpi-label">{label}</div>
    <div className="kpi-row-2">
      <div>
        <div className="kpi-value">{value}</div>
        <div className="kpi-deltas">
          {deltas.map((d, i) => (
            <span key={i} className={d.tone ? `delta-${d.tone}` : ''}>{d.text}</span>
          ))}
        </div>
      </div>
      {spark && <Sparkline data={spark} width={84} height={36} color={sparkColor} fill />}
    </div>
  </div>
);

// ------------------------------------------------------------------
// Page Header
// ------------------------------------------------------------------
const PageHeader = ({ breadcrumbs, title, meta, right }) => (
  <div className="mb-20">
    {breadcrumbs && (
      <div className="breadcrumb" style={{ marginLeft: 0, marginBottom: 8 }}>
        {breadcrumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            <span className={i === breadcrumbs.length - 1 ? 'crumb-current' : ''} style={{ cursor: c.onClick ? 'pointer' : 'default' }} onClick={c.onClick}>{c.label}</span>
          </React.Fragment>
        ))}
      </div>
    )}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
      <div>
        <h1 className="page-title">{title}</h1>
        {meta && <div className="page-meta">{meta}</div>}
      </div>
      {right && <div className="row-flex">{right}</div>}
    </div>
  </div>
);

// ------------------------------------------------------------------
// Delta cell helper
// ------------------------------------------------------------------
const formatDelta = (v, prec = 1) => {
  if (v === 0 || (Math.abs(v) < 0.05 && prec <= 1)) return <span className="delta-flat">0.0</span>;
  const sign = v > 0 ? '+' : '';
  const cls = v > 0 ? 'delta-up' : 'delta-down';
  return <span className={cls}>{sign}{v.toFixed(prec)}</span>;
};

const formatDollar = (v) => {
  const n = Number(v);
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(n);
  if (abs >= 1000) return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${sign}$${abs.toFixed(2)}`;
};

// ------------------------------------------------------------------
// TickerCell — ticker stack with hover-revealed bear case (§1.6)
// ------------------------------------------------------------------
const TickerCell = ({ tk, nm }) => {
  const [hover, setHover] = useState(false);
  const [ready, setReady] = useState(false);
  const timer = useRef(null);
  const bear = window.bearCaseFor ? window.bearCaseFor(tk) : null;

  const onEnter = () => {
    setHover(true);
    timer.current = setTimeout(() => setReady(true), 380);
  };
  const onLeave = () => {
    setHover(false);
    setReady(false);
    clearTimeout(timer.current);
  };

  return (
    <div
      className="ticker-stack"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{ position: 'relative' }}
    >
      <span className="mono" style={{ color: 'var(--text-1)', fontWeight: 500 }}>{tk}</span>
      <span className="nm">{nm}</span>
      {hover && ready && bear && (
        <div className="bear-pop">
          <div className="bear-pop-head">
            <span className="label-cap">Bear case</span>
            <span className="muted mono" style={{ fontSize: 10.5 }}>{tk} · {bear.invalidationProb} invalidation</span>
          </div>
          <div className="bear-pop-summary">{bear.summary}</div>
          <div className="bear-pop-args">
            {bear.args.slice(0, 3).map((a, i) => (
              <div key={i} className="bear-pop-arg">
                <span className={`sev-pill sev-${a.sev}`} style={{ fontSize: 9 }}>{a.sev}</span>
                <span>{a.title}</span>
              </div>
            ))}
          </div>
          <div className="bear-pop-floor mono">
            <span className="muted">Floor</span>
            <span style={{ color: 'var(--danger)' }}>${bear.floorPrice} · {bear.floorPct}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------------------------------------------------
// Rail header
// ------------------------------------------------------------------
const RailHeader = ({ icon, label }) => (
  <div className="rail-header">
    {icon && <Icon name={icon} size={12} />}
    <span>{label}</span>
  </div>
);

// ------------------------------------------------------------------
// EmptyState — sober, no illustration
// ------------------------------------------------------------------
const EmptyState = ({ icon = 'filter', headline, explainer, actionLabel, onAction }) => (
  <div className="empty-state">
    <div className="empty-icon"><Icon name={icon} size={28} strokeWidth={1.25} /></div>
    <div className="empty-headline">{headline}</div>
    {explainer && <div className="empty-explainer">{explainer}</div>}
    {actionLabel && (
      <button className="empty-action" onClick={onAction}>
        {actionLabel} <Icon name="arrowRight" size={11} />
      </button>
    )}
  </div>
);

// ------------------------------------------------------------------
// SkeletonRow — table loading state
// ------------------------------------------------------------------
const SkeletonTable = ({ rows = 6 }) => (
  <div className="skeleton-table">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="skeleton-row">
        <span className="skeleton" style={{ width: '70%' }} />
        <span className="skeleton short" />
        <span className="skeleton tiny" />
        <span className="skeleton tiny" />
        <span className="skeleton tiny" />
        <span className="skeleton tiny" />
        <span className="skeleton short" />
        <span className="skeleton tiny" />
      </div>
    ))}
  </div>
);

// ------------------------------------------------------------------
// Export to window
// ------------------------------------------------------------------
Object.assign(window, {
  Icon, TierBadge, Conviction, Sparkline, FactorBar, MacroGauge, Kpi,
  PageHeader, formatDelta, formatDollar, RailHeader, EmptyState, SkeletonTable, TickerCell,
  // hooks too — so page files can use them as bare identifiers
  useState, useEffect, useRef, useMemo, useCallback,
});

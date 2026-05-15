/* /regime */
const Regime = () => {
  const m = window.MACRO;
  const trend = window.MACRO_TREND;

  // Trend Chart Multi-line
  const TrendChart = ({ height = 240 }) => {
    const width = 900;
    const series = [
      { key: 'naaim', label: 'NAAIM', data: trend.naaim, color: 'var(--accent)', min: 0, max: 100, threshold: 90, dir: 'top' },
      { key: 'aaii', label: 'AAII spread', data: trend.aaii, color: 'var(--info)', min: -30, max: 50, threshold: 30, dir: 'bothSpread' },
      { key: 'fg', label: 'F&G', data: trend.fg, color: 'var(--text-2)', min: 0, max: 100, threshold: 80, dir: 'top' },
    ];
    return (
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {/* Y grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => (
          <line key={t} x1="0" y1={t * height} x2={width} y2={t * height} stroke="var(--border-subtle)" strokeWidth="0.5" />
        ))}
        {series.map(s => {
          const range = s.max - s.min;
          const pts = s.data.map((v, i) => [
            (i / (s.data.length - 1)) * width,
            height - ((v - s.min) / range) * (height - 12) - 6,
          ]);
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
          const last = pts[pts.length - 1];
          return (
            <g key={s.key}>
              <path d={path} fill="none" stroke={s.color} strokeWidth="1.25" strokeLinejoin="round" />
              <circle cx={last[0]} cy={last[1]} r="2.5" fill={s.color} />
              <text x={last[0] - 8} y={last[1] - 6} textAnchor="end" fill={s.color} fontSize="10" fontFamily="JetBrains Mono">
                {s.data[s.data.length - 1].toFixed(1)}
              </text>
            </g>
          );
        })}
        {/* x labels - months */}
        {['Jun 25', 'Sep', 'Dec', 'Mar 26', 'May'].map((lbl, i) => (
          <text key={i} x={(i / 4) * width} y={height - 2} fill="var(--text-3)" fontSize="9" fontFamily="JetBrains Mono">
            {lbl}
          </text>
        ))}
      </svg>
    );
  };

  return (
    <>
      <PageHeader
        title="Regime"
        meta="Macro gate state · updated May 15 23:24 CT · refresh every 30s during market hours"
      />
      <div className="section-divider" />

      <div className="callout mb-20" style={{ background: 'var(--accent-soft)', borderColor: 'rgba(77, 91, 255, 0.3)', color: 'var(--text-1)' }}>
        <Icon name="gauge" size={14} className="accent-c" />
        <span>
          <span className="mono bright" style={{ fontSize: 15 }}>{m.multiplier.toFixed(2)}×</span>&nbsp;
          multiplier active on <span className="accent-c">High tier</span> · <span className="mono bright">{m.gatesHit}</span> of {m.gatesTotal} gates hit · NAAIM in top-decile
        </span>
      </div>

      <div className="grid-3 mb-32">
        <MacroGauge
          label="NAAIM exposure"
          value={m.naaim.value}
          delta={m.naaim.delta}
          deltaLabel="wk"
          threshold={90}
          max={100}
          dir="top"
          hit={true}
          hitText="GATE HIT  >90 top decile"
        />
        <MacroGauge
          label="AAII bull-bear"
          value={m.aaii.value}
          delta={m.aaii.delta}
          deltaLabel="wk"
          threshold={30}
          max={50}
          min={-30}
          dir="bothSpread"
          hit={false}
          hitText="In range (gate ±30)"
        />
        <MacroGauge
          label="Fear & Greed"
          value={m.fearGreed.value}
          delta={m.fearGreed.delta}
          deltaLabel="d"
          threshold={80}
          max={100}
          dir="top"
          hit={false}
          hitText="Greed (gate at 80)"
        />
      </div>

      <div className="section-divider"></div>

      <div className="section-title-row">
        <h2 className="section-title">12-month trend</h2>
        <span className="sub mono">3 gauges · weekly samples</span>
      </div>
      <div className="trend-chart mb-32">
        <div className="trend-legend">
          <div className="trend-legend-item"><span className="trend-swatch" style={{ background: 'var(--accent)' }}></span> NAAIM exposure</div>
          <div className="trend-legend-item"><span className="trend-swatch" style={{ background: 'var(--info)' }}></span> AAII bull-bear spread</div>
          <div className="trend-legend-item"><span className="trend-swatch" style={{ background: 'var(--text-2)' }}></span> Fear &amp; Greed</div>
        </div>
        <TrendChart />
      </div>

      <div className="section-divider"></div>

      <div className="section-title-row">
        <h2 className="section-title">Gate-state history</h2>
        <span className="sub mono">last 5 changes</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Event</th>
            <th className="num">From</th>
            <th className="num">To</th>
            <th className="num">Δ</th>
          </tr>
        </thead>
        <tbody>
          {window.REGIME_HISTORY.map((h, i) => {
            const from = parseFloat(h.from);
            const to = parseFloat(h.to);
            const change = to - from;
            return (
              <tr key={i}>
                <td className="mono" style={{ color: 'var(--text-3)' }}>{h.date}</td>
                <td>{h.event}</td>
                <td className="num">{h.from}</td>
                <td className="num bright">{h.to}</td>
                <td className="num">
                  <span className={change > 0 ? 'delta-up' : change < 0 ? 'delta-down' : 'delta-flat'}>
                    {change > 0 ? '+' : ''}{change.toFixed(2)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="section-divider"></div>

      <div className="section-title-row">
        <h2 className="section-title">Strategy backtest</h2>
        <span className="sub mono">Jan 2024 → May 2026 · 30 months · vs SPY</span>
      </div>

      <div className="kpi-row mb-20">
        <Kpi label="Total return" value={`+${window.BACKTEST.metrics.totalReturn.toFixed(1)}%`}
          deltas={[
            { text: `SPY +${window.BACKTEST.metrics.spyReturn.toFixed(1)}%` },
            { text: `α ${window.BACKTEST.metrics.alpha} bps`, tone: 'up' },
          ]}
          spark={window.BACKTEST.strategy} sparkColor="var(--accent)" />
        <Kpi label="Sharpe ratio" value={window.BACKTEST.metrics.sharpe.toFixed(2)}
          deltas={[
            { text: `SPY ${window.BACKTEST.metrics.spySharpe.toFixed(2)}` },
            { text: 'monthly · rf 4.7%' },
          ]} />
        <Kpi label="Max drawdown" value={`${window.BACKTEST.metrics.maxDD.toFixed(1)}%`}
          deltas={[
            { text: `SPY ${window.BACKTEST.metrics.spyMaxDD.toFixed(1)}%`, tone: 'down' },
            { text: 'Aug–Oct 25' },
          ]} />
        <Kpi label="Hit rate" value={`${window.BACKTEST.metrics.hitRate.toFixed(1)}%`}
          deltas={[
            { text: `${window.BACKTEST.metrics.winners}/${window.BACKTEST.metrics.trades} trades` },
            { text: `R-multiple ${window.BACKTEST.metrics.avgTradeR.toFixed(2)}`, tone: 'up' },
          ]} />
      </div>

      <BacktestChart />

      <div className="section-divider"></div>

      <div className="section-title-row">
        <h2 className="section-title">Drawdown history</h2>
        <span className="sub mono">3 episodes ≥ 8% · all recovered</span>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Period</th>
            <th className="num">Depth</th>
            <th className="num">Duration</th>
            <th>Recovered</th>
            <th>Catalyst</th>
          </tr>
        </thead>
        <tbody>
          {window.BACKTEST.drawdowns.map((d, i) => (
            <tr key={i}>
              <td className="mono" style={{ color: 'var(--text-2)' }}>{d.from} → {d.to}</td>
              <td className="num bright"><span className="delta-down">{d.dd.toFixed(1)}%</span></td>
              <td className="num">3 mo</td>
              <td className="mono">{d.recovered}</td>
              <td className="muted" style={{ fontSize: 12.5 }}>
                {i === 0 && 'NAAIM gate hit; macro multiplier engaged'}
                {i === 1 && 'AAII spread blowout; tactical de-risk'}
                {i === 2 && 'Earnings cycle digestion across L1; rotation to L4'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────
// BacktestChart — strategy vs SPY equity curve with drawdown shading
// ─────────────────────────────────────────────────────────────────
const BacktestChart = () => {
  const bt = window.BACKTEST;
  const width = 900;
  const height = 260;
  const padL = 36, padR = 12, padT = 8, padB = 22;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const allVals = [...bt.strategy, ...bt.spy];
  const min = Math.min(...allVals) - 4;
  const max = Math.max(...allVals) + 4;
  const range = max - min;
  const xFor = (i) => padL + (i / (bt.months.length - 1)) * w;
  const yFor = (v) => padT + h - ((v - min) / range) * h;

  const stratPath = bt.strategy.map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ');
  const spyPath   = bt.spy.map((v, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ');
  const stratFill = `${stratPath} L${xFor(bt.strategy.length - 1).toFixed(1)},${padT + h} L${padL},${padT + h} Z`;

  const lastStrat = bt.strategy[bt.strategy.length - 1];
  const lastSpy   = bt.spy[bt.spy.length - 1];

  return (
    <div className="trend-chart mb-20">
      <div className="trend-legend">
        <div className="trend-legend-item">
          <span className="trend-swatch" style={{ background: 'var(--accent)' }}></span>
          AI Thesis strategy <span className="mono bright" style={{ marginLeft: 6 }}>+{(lastStrat - 100).toFixed(1)}%</span>
        </div>
        <div className="trend-legend-item">
          <span className="trend-swatch" style={{ background: 'var(--text-2)' }}></span>
          SPY benchmark <span className="mono" style={{ marginLeft: 6, color: 'var(--text-2)' }}>+{(lastSpy - 100).toFixed(1)}%</span>
        </div>
        <div className="trend-legend-item" style={{ marginLeft: 'auto' }}>
          <span className="trend-swatch" style={{ background: 'var(--danger)', opacity: 0.3 }}></span>
          Drawdown ≥ 8%
        </div>
      </div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ display: 'block' }}>
        {/* y grid */}
        {[100, 125, 150, 175].map(v => v <= max && v >= min && (
          <g key={v}>
            <line x1={padL} y1={yFor(v)} x2={width - padR} y2={yFor(v)} stroke="var(--border-subtle)" strokeWidth="0.5" strokeDasharray="2 4" />
            <text x={padL - 6} y={yFor(v) + 3} textAnchor="end" fill="var(--text-3)" fontSize="9.5" fontFamily="JetBrains Mono">{v}</text>
          </g>
        ))}
        {/* baseline 100 */}
        <line x1={padL} y1={yFor(100)} x2={width - padR} y2={yFor(100)} stroke="var(--border)" strokeWidth="0.75" />
        {/* drawdown shading — Aug 25 to Oct 25 (indices 19 to 21) */}
        {bt.drawdowns.map((dd, i) => {
          const fromIdx = bt.months.findIndex(m => m === dd.from);
          const toIdx = bt.months.findIndex(m => m === dd.to);
          if (fromIdx < 0 || toIdx < 0) return null;
          return (
            <rect key={i}
              x={xFor(fromIdx)} y={padT}
              width={xFor(toIdx) - xFor(fromIdx)}
              height={h}
              fill="var(--danger)" opacity="0.06" />
          );
        })}
        {/* SPY first (in background) */}
        <path d={spyPath} fill="none" stroke="var(--text-2)" strokeWidth="1.25" opacity="0.7" strokeLinejoin="round" />
        {/* Strategy fill + line */}
        <path d={stratFill} fill="var(--accent)" opacity="0.10" />
        <path d={stratPath} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        {/* end dots + labels */}
        <circle cx={xFor(bt.strategy.length - 1)} cy={yFor(lastStrat)} r="3" fill="var(--accent)" />
        <circle cx={xFor(bt.spy.length - 1)} cy={yFor(lastSpy)} r="2.5" fill="var(--text-2)" />
        {/* x labels */}
        {bt.months.map((m, i) => (i % 6 === 0) && (
          <text key={i} x={xFor(i)} y={height - 4} textAnchor="middle" fill="var(--text-3)" fontSize="9.5" fontFamily="JetBrains Mono">
            {m}
          </text>
        ))}
      </svg>
    </div>
  );
};
  
const RegimeRail = () => (
  <>
    <div className="rail-section">
      <RailHeader icon="info" label="NAAIM legend" />
      <div className="col-flex" style={{ gap: 8, fontSize: 12.5 }}>
        <div className="rail-row"><span className="mono lbl" style={{ minWidth: 50, color: 'var(--text-2)' }}>0 – 30</span><span className="lbl">Bottom decile</span></div>
        <div className="rail-row"><span className="mono lbl" style={{ minWidth: 50, color: 'var(--text-2)' }}>30 – 90</span><span className="lbl">Neutral range</span></div>
        <div className="rail-row"><span className="mono lbl warning-c" style={{ minWidth: 50 }}>{'>'} 90</span><span className="lbl warning-c">Top decile · gate</span></div>
      </div>
    </div>
    <div className="rail-section">
      <RailHeader icon="info" label="AAII legend" />
      <div className="col-flex" style={{ gap: 8, fontSize: 12.5 }}>
        <div className="rail-row"><span className="mono lbl" style={{ minWidth: 50, color: 'var(--text-2)' }}>&lt; −20</span><span className="lbl">Floor (bullish)</span></div>
        <div className="rail-row"><span className="mono lbl" style={{ minWidth: 50, color: 'var(--text-2)' }}>−20 – +30</span><span className="lbl">Normal range</span></div>
        <div className="rail-row"><span className="mono lbl warning-c" style={{ minWidth: 50 }}>{'>'} +30</span><span className="lbl warning-c">Frothy · gate</span></div>
      </div>
    </div>
    <div className="rail-section">
      <RailHeader icon="info" label="F&G legend" />
      <div className="col-flex" style={{ gap: 8, fontSize: 12.5 }}>
        <div className="rail-row"><span className="mono lbl" style={{ minWidth: 50, color: 'var(--text-2)' }}>0 – 20</span><span className="lbl">Extreme fear</span></div>
        <div className="rail-row"><span className="mono lbl" style={{ minWidth: 50, color: 'var(--text-2)' }}>20 – 60</span><span className="lbl">Neutral</span></div>
        <div className="rail-row"><span className="mono lbl" style={{ minWidth: 50, color: 'var(--text-2)' }}>60 – 80</span><span className="lbl">Greed</span></div>
        <div className="rail-row"><span className="mono lbl warning-c" style={{ minWidth: 50 }}>{'>'} 80</span><span className="lbl warning-c">Extreme greed · gate</span></div>
      </div>
    </div>
    <div className="rail-section">
      <RailHeader icon="sliders" label="Multiplier logic" />
      <div className="col-flex" style={{ gap: 6, fontSize: 12.5 }}>
        <div className="rail-row"><span className="mono lbl bright" style={{ minWidth: 40 }}>1.00×</span><span className="lbl">0 gates hit</span></div>
        <div className="rail-row"><span className="mono lbl bright" style={{ minWidth: 40 }}>0.95×</span><span className="lbl">1 gate hit</span></div>
        <div className="rail-row"><span className="mono lbl bright" style={{ minWidth: 40 }}>0.90×</span><span className="lbl">2 gates hit</span></div>
        <div className="rail-row"><span className="mono lbl bright" style={{ minWidth: 40 }}>0.85×</span><span className="lbl">3 gates hit</span></div>
      </div>
      <div className="muted mt-8" style={{ fontSize: 11.5 }}>
        Applied to High tier only.
      </div>
    </div>
  </>
);

Object.assign(window, { Regime, RegimeRail });

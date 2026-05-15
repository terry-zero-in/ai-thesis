/* /portfolio */
const Portfolio = ({ navigate }) => {
  const p = window.PORTFOLIO;
  const positions = p.positions.map(pos => {
    const u = window.UNIVERSE.find(x => x.tk === pos.tk);
    const value = pos.sh * pos.px;
    const pnl = (pos.px - pos.cost) * pos.sh;
    const pnlPct = (pos.px / pos.cost - 1) * 100;
    return { ...pos, u, value, pnl, pnlPct };
  });

  // Allocation by layer
  const layerAlloc = {};
  positions.forEach(pos => {
    const lay = pos.u.lay;
    layerAlloc[lay] = (layerAlloc[lay] || 0) + pos.value;
  });
  const total = 100000; // book size
  const sortedLayers = Object.entries(layerAlloc)
    .map(([code, value]) => ({ code, value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader
        title="Portfolio"
        meta={`Deployed ${formatDollar(p.deployed)} · Reserve ${formatDollar(p.reserve)} · ${p.positions.length} positions · Book size $100,000`}
        right={
          <>
            <button className="btn btn-secondary"><Icon name="ext" size={13} /> Export</button>
            <button className="btn btn-secondary"><Icon name="plus" size={13} /> New position</button>
          </>
        }
      />
      <div className="section-divider" />

      <div className="kpi-row mb-32">
        <Kpi
          label="Portfolio value"
          value={formatDollar(p.value)}
          deltas={[
            { text: '+1.44% day', tone: 'up' },
            { text: 'vs cost +9.3%', tone: 'up' },
          ]}
          spark={window.UNIVERSE[0].sparkPrice.slice(8)}
          sparkColor="var(--success)"
        />
        <Kpi
          label="Day P&L"
          value={`+${formatDollar(p.dayPnl)}`}
          deltas={[
            { text: `+${p.dayPct.toFixed(2)}%`, tone: 'up' },
          ]}
          spark={window.UNIVERSE[1].sparkPrice.slice(12)}
          sparkColor="var(--success)"
        />
        <Kpi
          label="30D return"
          value={`+${p.ret30d.toFixed(2)}%`}
          deltas={[
            { text: `SPY +${p.spyRet30d.toFixed(2)}%` },
          ]}
          spark={window.UNIVERSE[2].sparkPrice}
          sparkColor="var(--accent)"
        />
        <Kpi
          label="Alpha vs SPY"
          value={`+${p.alphaBps} bps`}
          deltas={[
            { text: '30D', tone: 'up' },
            { text: 'Sharpe 1.84' },
          ]}
        />
      </div>

      <div className="section-title-row">
        <h2 className="section-title">Positions</h2>
        <span className="sub mono">{positions.length} · sorted by % book</span>
      </div>
      <div className="table-scroll mb-32">
      <table className="data-table">
        <thead>
          <tr>
            <th>Ticker / Name</th>
            <th>Layer</th>
            <th className="num">Sh</th>
            <th className="num">Cost</th>
            <th className="num">Price</th>
            <th className="num">Value</th>
            <th className="num">P&L</th>
            <th className="num">P&L %</th>
            <th className="num">% Book</th>
            <th className="num">Comp</th>
            <th>Trend</th>
            <th className="ctr">Tier</th>
          </tr>
        </thead>
        <tbody>
          {positions.map(pos => (
            <tr key={pos.tk} onClick={() => navigate('detail', { ticker: pos.tk })}>
              <td>
                <div className="ticker-stack">
                  <span className="mono" style={{ color: 'var(--text-1)', fontWeight: 500 }}>{pos.tk}</span>
                  <span className="nm">{pos.u.nm}</span>
                </div>
              </td>
              <td><span className="chip">{pos.u.lay}</span></td>
              <td className="num">{pos.sh}</td>
              <td className="num">{formatDollar(pos.cost)}</td>
              <td className="num bright">{formatDollar(pos.px)}</td>
              <td className="num bright">{formatDollar(pos.value)}</td>
              <td className="num"><span className={pos.pnl > 0 ? 'delta-up' : 'delta-down'}>{pos.pnl > 0 ? '+' : ''}{formatDollar(pos.pnl)}</span></td>
              <td className="num"><span className={pos.pnlPct > 0 ? 'delta-up' : 'delta-down'}>{pos.pnlPct > 0 ? '+' : ''}{pos.pnlPct.toFixed(1)}%</span></td>
              <td className="num">{pos.pct.toFixed(1)}%</td>
              <td className="num bright">{pos.u.comp.toFixed(1)}</td>
              <td><Sparkline data={pos.u.sparkPrice.slice(12)} width={56} height={20} /></td>
              <td className="ctr"><TierBadge tier={pos.u.tier} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className="grid-2">
        <div>
          <div className="section-title-row">
            <h2 className="section-title">Allocation · by layer</h2>
            <span className="sub mono">% of $100K book</span>
          </div>
          {sortedLayers.map(l => (
            <div key={l.code} className="alloc-row">
              <span className="alloc-label">{l.code} · {window.LAYERS[l.code].label}</span>
              <div className="alloc-bar"><div className="alloc-fill" style={{ width: `${l.pct}%` }} /></div>
              <span className="alloc-pct">{l.pct.toFixed(1)}%</span>
            </div>
          ))}
          <div className="alloc-row">
            <span className="alloc-label">Cash</span>
            <div className="alloc-bar"><div className="alloc-fill cash" style={{ width: `${(p.cash / total) * 100}%` }} /></div>
            <span className="alloc-pct muted">{((p.cash / total) * 100).toFixed(1)}%</span>
          </div>
          <div className="callout warn mt-16">
            <Icon name="alert" size={14} />
            <span>Concentration · L1 {sortedLayers.find(l => l.code === 'L1')?.pct.toFixed(1)}% · approaching 35% cap</span>
          </div>
        </div>

        <div>
          <div className="section-title-row">
            <h2 className="section-title">Allocation · by tier</h2>
            <span className="sub mono">conviction weighting</span>
          </div>
          {['high', 'medium', 'low', 'avoid'].map(t => {
            const sum = positions.filter(pos => pos.u.tier === t).reduce((s, pos) => s + pos.value, 0);
            const pct = (sum / total) * 100;
            if (pct === 0) return null;
            return (
              <div key={t} className="alloc-row">
                <span className="alloc-label"><TierBadge tier={t} /></span>
                <div className="alloc-bar"><div className="alloc-fill" style={{ width: `${pct}%` }} /></div>
                <span className="alloc-pct">{pct.toFixed(1)}%</span>
              </div>
            );
          })}
          <div className="alloc-row">
            <span className="alloc-label">Cash</span>
            <div className="alloc-bar"><div className="alloc-fill cash" style={{ width: `${(p.cash / total) * 100}%` }} /></div>
            <span className="alloc-pct muted">{((p.cash / total) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="section-divider"></div>

      <div className="section-title-row">
        <h2 className="section-title">Pre-committed triggers</h2>
        <span className="sub mono">$20,000 reserve · auto-deploy on fire</span>
      </div>
      <div className="grid-2">
        <div className="gauge-tile">
          <div className="gauge-label"><span>Trigger 1 — position drawdown</span><span className="gate-ribbon miss">Not fired</span></div>
          <div className="muted" style={{ fontSize: 13 }}>
            Any High-tier name <span className="mono bright">−7%</span> from cost basis triggers
            <span className="mono bright"> $10K</span> tranche into that name.
          </div>
          <div className="mono muted" style={{ fontSize: 12 }}>Closest: <span className="bright">NVDA −3.9% above cost</span> · ASML +2.2% above cost</div>
        </div>
        <div className="gauge-tile">
          <div className="gauge-label"><span>Trigger 2 — broad-market stress</span><span className="gate-ribbon miss">Not fired</span></div>
          <div className="muted" style={{ fontSize: 13 }}>
            SPY <span className="mono bright">−5%</span> in 5 sessions OR VIX <span className="mono bright">{'>'}25</span> for 3 sessions triggers
            <span className="mono bright"> $10K</span> equal-weight across top-3 High names.
          </div>
          <div className="mono muted" style={{ fontSize: 12 }}>SPY 5D: <span className="success-c">+0.8%</span> · VIX: <span className="bright">14.2</span> (3D peak 16.4)</div>
        </div>
      </div>
    </>
  );
};

const PortfolioRail = () => {
  const p = window.PORTFOLIO;
  return (
    <>
      <div className="rail-section">
        <RailHeader icon="briefcase" label="Reserve" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="mono" style={{ fontSize: 26, fontWeight: 500, color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            ${(p.reserve).toLocaleString()}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>Cash in deployment reserve</div>
        </div>
      </div>

      <div className="rail-section">
        <RailHeader icon="alert" label="Trigger 1" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="muted" style={{ fontSize: 12 }}>Position −7% from cost</div>
          <div className="mono" style={{ fontSize: 14, color: 'var(--text-1)' }}>
            <Icon name="check" size={12} style={{ verticalAlign: '-2px' }} /> none above threshold
          </div>
        </div>
        <button className="btn btn-secondary disabled mt-8" disabled style={{ width: '100%' }}>
          <Icon name="plus" size={12} /> Add $10K tranche
        </button>
      </div>

      <div className="rail-section">
        <RailHeader icon="alert" label="Trigger 2" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div className="muted" style={{ fontSize: 12 }}>SPY −5% (5d) OR VIX {'>'}25 (3d)</div>
          <div className="mono" style={{ fontSize: 14, color: 'var(--text-1)' }}>
            <Icon name="check" size={12} style={{ verticalAlign: '-2px' }} /> no condition met
          </div>
        </div>
        <button className="btn btn-secondary disabled mt-8" disabled style={{ width: '100%' }}>
          <Icon name="plus" size={12} /> Add $10K tranche
        </button>
      </div>

      <div className="rail-section">
        <RailHeader icon="info" label="Concentration caps" />
        <div className="col-flex" style={{ gap: 6, fontSize: 12 }}>
          <div className="rail-row"><span className="lbl">Single name</span><span className="val">15%</span></div>
          <div className="rail-row"><span className="lbl">Single layer</span><span className="val warning-c">35%</span></div>
          <div className="rail-row"><span className="lbl">High tier</span><span className="val">50%</span></div>
          <div className="rail-row"><span className="lbl">Reserve floor</span><span className="val">15%</span></div>
        </div>
      </div>
    </>
  );
};

Object.assign(window, { Portfolio, PortfolioRail });

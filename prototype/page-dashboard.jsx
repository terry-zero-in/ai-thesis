/* /dashboard */
const Dashboard = ({ navigate }) => {
  const portfolio = window.PORTFOLIO;
  const macro = window.MACRO;
  const movers = window.MOVERS.slice(0, 6);
  const portSpark = window.UNIVERSE[0].sparkPrice.slice(8);

  return (
    <>
      <div className="greet-strip">
        <h1 className="page-title">Good evening, Terry</h1>
        <div className="greet-meta">
          <span className="live-dot warn"></span>
          <span className="status-tag closed">Markets closed</span>
          <span className="meta-dot"></span>
          <span>Friday, May 15, 2026 · <span className="num">23:24 CT</span></span>
          <span className="meta-dot"></span>
          <span>Next refresh <span className="num">Sun 22:00</span></span>
          <span className="meta-dot"></span>
          <span>Last sync <span className="num">8s</span> ago</span>
        </div>
      </div>
      <div className="section-divider" style={{ margin: '16px 0 24px' }}></div>

      <div className="index-strip">
        {window.INDICES.map((idx, i) => (
          <div key={i} className={`index-cell ${idx.label === 'Regime' ? 'regime' : ''}`}>
            <span className="index-label">{idx.label}</span>
            <span className="index-value">{idx.value}</span>
            <span className={`index-delta ${idx.tone === 'up' ? 'delta-up' : idx.tone === 'down' ? 'delta-down' : idx.tone === 'flat' ? 'muted' : ''}`}>
              {idx.delta}
            </span>
          </div>
        ))}
      </div>

      <div className="section-divider"></div>

      <div className="kpi-row mb-32">
        <Kpi
          label="Portfolio value"
          value="$87,420.50"
          deltas={[
            { text: '+1.44% today', tone: 'up' },
            { text: 'vs cost +9.3%', tone: 'up' },
          ]}
          spark={portSpark}
          sparkColor="var(--success)"
        />
        <Kpi
          label="Day P&L"
          value="+$1,240"
          deltas={[
            { text: '+1.44%', tone: 'up' },
            { text: 'SPY +0.62%' },
          ]}
          spark={window.UNIVERSE[1].sparkPrice.slice(12)}
          sparkColor="var(--success)"
        />
        <Kpi
          label="30D return"
          value="+4.81%"
          deltas={[
            { text: 'vs SPY +1.20%' },
            { text: 'α +361 bps', tone: 'up' },
          ]}
          spark={window.UNIVERSE[2].sparkPrice}
          sparkColor="var(--accent)"
        />
        <Kpi
          label="High-tier names"
          value="4 / 12"
          deltas={[
            { text: '33% of book' },
            { text: 'L1 weighted' },
          ]}
          spark={null}
        />
      </div>

      <div className="section-title-row">
        <h2 className="section-title">Score movers</h2>
        <span className="sub mono">last 7 days · {movers.length} of 70</span>
      </div>
      <div className="table-scroll mb-32">
      <table className="data-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Layer</th>
            <th>Segment</th>
            <th className="num">Composite</th>
            <th className="num">Δ 7D</th>
            <th>Driver</th>
            <th className="num">Conviction</th>
            <th className="ctr">Tier</th>
          </tr>
        </thead>
        <tbody>
          {movers.map(m => (
            <tr key={m.tk} onClick={() => navigate('detail', { ticker: m.tk })}>
              <td>
                <TickerCell tk={m.tk} nm={m.nm} />
              </td>
              <td><span className="chip">{m.lay} {window.LAYERS[m.lay].label}</span></td>
              <td className="muted" style={{ fontSize: 12.5 }}>{m.seg}</td>
              <td className="num bright mono">{m.comp.toFixed(1)}</td>
              <td className="num">{formatDelta(m.d7)}</td>
              <td className="mono" style={{ fontSize: 12.5, color: 'var(--text-2)' }}>
                {m.driver.name}&nbsp;
                <span className={m.driver.val > 0 ? 'delta-up' : 'delta-down'}>
                  {m.driver.val > 0 ? '+' : ''}{m.driver.val}
                </span>
              </td>
              <td className="num"><Conviction value={m.conv} /></td>
              <td className="ctr"><TierBadge tier={m.tier} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className="section-title-row">
        <h2 className="section-title">Regime · macro gate state</h2>
        <span className="sub mono">{macro.gatesHit} of {macro.gatesTotal} gates hit · {macro.multiplier.toFixed(2)}× multiplier active on High tier</span>
      </div>
      <div className="grid-3 mb-20">
        <MacroGauge
          label="NAAIM exposure"
          value={macro.naaim.value}
          delta={macro.naaim.delta}
          deltaLabel="wk"
          threshold={90}
          max={100}
          dir="top"
          hit={true}
          hitText="GATE HIT  >90 top decile"
        />
        <MacroGauge
          label="AAII bull-bear"
          value={macro.aaii.value}
          delta={macro.aaii.delta}
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
          value={macro.fearGreed.value}
          delta={macro.fearGreed.delta}
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
        <h2 className="section-title">High-tier concentration</h2>
        <span className="sub mono">4 names · 33.1% of book · L1 weighted</span>
      </div>
      <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Ticker</th>
            <th>Layer</th>
            <th>Segment</th>
            <th className="num">Composite</th>
            <th className="num">AIQ</th>
            <th className="num">% Book</th>
            <th className="num">P&L</th>
            <th className="ctr">Tier</th>
          </tr>
        </thead>
        <tbody>
          {window.UNIVERSE.filter(u => u.tier === 'high').slice(0, 4).map(u => {
            const pos = portfolio.positions.find(p => p.tk === u.tk);
            const pnl = pos ? ((u.price / pos.cost - 1) * 100) : null;
            return (
              <tr key={u.tk} onClick={() => navigate('detail', { ticker: u.tk })}>
                <td>
                  <TickerCell tk={u.tk} nm={u.nm} />
                </td>
                <td><span className="chip">{u.lay}</span></td>
                <td className="muted" style={{ fontSize: 12.5 }}>{u.seg}</td>
                <td className="num bright">{u.comp.toFixed(1)}</td>
                <td className="num">{u.aiq}</td>
                <td className="num">{pos ? `${pos.pct.toFixed(1)}%` : '—'}</td>
                <td className="num">{pnl !== null ? <span className={pnl > 0 ? 'delta-up' : 'delta-down'}>{pnl > 0 ? '+' : ''}{pnl.toFixed(1)}%</span> : <span className="muted">—</span>}</td>
                <td className="ctr"><TierBadge tier={u.tier} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
};

const DashboardRail = () => {
  const macro = window.MACRO;
  const ups = window.UNIVERSE.filter(u => u.d7 > 0).sort((a, b) => b.d7 - a.d7).slice(0, 4);
  const downs = window.UNIVERSE.filter(u => u.d7 < 0).sort((a, b) => a.d7 - b.d7).slice(0, 4);
  return (
    <>
      <div className="rail-section">
        <RailHeader icon="trendUp" label="Top movers · 7d ↑" />
        <div className="rail-list">
          {ups.map(u => (
            <div key={u.tk} className="rail-row">
              <span className="tk">{u.tk}</span>
              <span className="lbl">{u.lay}</span>
              <span className="val delta-up">+{u.d7.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rail-section">
        <RailHeader icon="trendDown" label="Top movers · 7d ↓" />
        <div className="rail-list">
          {downs.map(u => (
            <div key={u.tk} className="rail-row">
              <span className="tk">{u.tk}</span>
              <span className="lbl">{u.lay}</span>
              <span className="val delta-down">{u.d7.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rail-section">
        <RailHeader icon="alert" label="Insider · today" />
        <div className="rail-empty">— none flagged</div>
      </div>
      <div className="rail-section">
        <RailHeader icon="gauge" label="Macro gates" />
        <div className="rail-list">
          <div className="rail-row">
            <span className="lbl">NAAIM</span>
            <span className="val warning-c">{macro.naaim.value.toFixed(2)} ⚠</span>
          </div>
          <div className="rail-row">
            <span className="lbl">AAII spread</span>
            <span className="val">+{macro.aaii.value.toFixed(2)}</span>
          </div>
          <div className="rail-row">
            <span className="lbl">Fear & Greed</span>
            <span className="val">{macro.fearGreed.value}</span>
          </div>
          <div className="rail-row" style={{ paddingTop: 10, borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}>
            <span className="lbl bright">Multiplier</span>
            <span className="val bright">{macro.multiplier.toFixed(2)}×</span>
          </div>
        </div>
      </div>
    </>
  );
};

Object.assign(window, { Dashboard, DashboardRail });

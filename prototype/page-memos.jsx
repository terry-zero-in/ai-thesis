/* /memos — list of pending + recent memos
   /memo/[id] — detail view per Investment Portal Mockup v4 */

// ─────────────────────────────────────────────────────────────────
// /memos — list view
// ─────────────────────────────────────────────────────────────────
const Memos = ({ navigate }) => {
  const memos = window.MEMOS;
  const pending = memos.filter(m => m.status === 'pending');
  const recent  = memos.filter(m => m.status !== 'pending');
  const todayCost = memos.filter(m => m.ts.includes('May 15')).reduce((s, m) => s + m.cost, 0);

  return (
    <>
      <PageHeader
        title="Memos"
        meta={`${pending.length} pending approval · ${memos.length} this week · synthesized by claude-sonnet-4.6`}
        right={
          <>
            <button className="btn btn-secondary"><Icon name="refresh" size={13} /> Refresh queue</button>
            <button className="btn btn-secondary"><Icon name="ext" size={13} /> Export</button>
          </>
        }
      />
      <div className="section-divider" />

      <div className="kpi-row mb-32">
        <Kpi label="Pending review" value={pending.length}
          deltas={[{ text: 'oldest 8h 03m', tone: 'down' }, { text: 'avg 5h ago' }]} />
        <Kpi label="Acceptance · 30d" value="71%"
          deltas={[{ text: '24 of 34 approved', tone: 'up' }, { text: 'baseline 65%' }]} />
        <Kpi label="Memo cost · today" value={`$${todayCost.toFixed(2)}`}
          deltas={[{ text: `${pending.length} memos × 13 agents` }, { text: 'cap $50/day' }]} />
        <Kpi label="Avg time to decide" value="14m"
          deltas={[{ text: 'last 30d', tone: 'up' }, { text: 'median 9m' }]} />
      </div>

      <div className="section-title-row">
        <h2 className="section-title">Awaiting your review</h2>
        <span className="sub mono">{pending.length} pending · oldest first</span>
      </div>
      <div className="memo-queue mb-32">
        {pending.map(m => <MemoQueueCard key={m.id} memo={m} navigate={navigate} />)}
      </div>

      <div className="section-divider" />
      <div className="section-title-row">
        <h2 className="section-title">Recent decisions</h2>
        <span className="sub mono">{recent.length} memos · last 7d</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Memo</th>
              <th>Ticker</th>
              <th>Trigger</th>
              <th className="ctr">Rec</th>
              <th className="num">Conv</th>
              <th className="num">Target</th>
              <th className="num">Upside</th>
              <th className="ctr">Decision</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {recent.map(m => {
              const u = window.UNIVERSE.find(x => x.tk === m.tk);
              return (
                <tr key={m.id} onClick={() => navigate('memo-detail', { id: m.id })}>
                  <td className="mono" style={{ color: 'var(--text-2)', fontSize: 12 }}>{m.id}</td>
                  <td>
                    <div className="ticker-stack">
                      <span className="mono" style={{ color: 'var(--text-1)', fontWeight: 500 }}>{m.tk}</span>
                      <span className="nm">{u ? u.nm : ''}</span>
                    </div>
                  </td>
                  <td className="muted" style={{ fontSize: 12.5 }}>{m.trigger}</td>
                  <td className="ctr">
                    <span className={`reco-pill ${m.rec.toLowerCase() === 'buy' ? 'buy' : m.rec.toLowerCase() === 'hold' ? 'hold' : 'sell'}`} style={{ fontSize: 10.5, padding: '3px 8px' }}>
                      {m.rec}
                    </span>
                  </td>
                  <td className="num"><Conviction value={m.conv} /></td>
                  <td className="num bright">${m.targetPx}</td>
                  <td className="num">
                    <span className={m.upside > 0 ? 'delta-up' : 'delta-down'}>{m.upside > 0 ? '+' : ''}{m.upside.toFixed(1)}%</span>
                  </td>
                  <td className="ctr">
                    <span className={`tier tier-${m.status === 'approved' ? 'high' : 'avoid'}`} style={{ background: m.status === 'approved' ? 'var(--success-soft)' : 'var(--danger-soft)', color: m.status === 'approved' ? 'var(--success)' : 'var(--danger)', borderColor: m.status === 'approved' ? 'rgba(91,184,128,0.20)' : 'rgba(224,120,120,0.20)' }}>
                      {m.status}
                    </span>
                  </td>
                  <td className="muted mono" style={{ fontSize: 11.5 }}>{m.ts}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────
// MemoQueueCard — rich preview card for pending memos
// ─────────────────────────────────────────────────────────────────
const MemoQueueCard = ({ memo, navigate }) => {
  const u = window.UNIVERSE.find(x => x.tk === memo.tk);
  return (
    <div className="memo-card" onClick={() => navigate('memo-detail', { id: memo.id })}>
      <div className="memo-card-left">
        <div className="memo-tk">{memo.tk}</div>
        <div className="memo-nm">{u ? u.nm : ''}</div>
        <div className="memo-id mono">{memo.id}</div>
      </div>
      <div className="memo-card-mid">
        <div className="memo-trigger">
          <span className={`memo-trigger-chip ${memo.triggerKind}`}>{memo.triggerKind}</span>
          <span className="memo-trigger-text">{memo.trigger}</span>
        </div>
        <div className="memo-meta mono">
          <span><Icon name="clock" size={10} /> {memo.age} ago</span>
          <span className="bullet">·</span>
          <span>{memo.agents}/13 agents · {memo.runtime}</span>
          <span className="bullet">·</span>
          <span>cost ${memo.cost.toFixed(2)}</span>
        </div>
      </div>
      <div className="memo-card-right">
        <span className={`reco-pill ${memo.rec.toLowerCase() === 'buy' ? 'buy' : memo.rec.toLowerCase() === 'hold' ? 'hold' : 'sell'}`}>{memo.rec}</span>
        <div className="memo-target mono">
          <span>{`$${memo.targetPx}`}</span>
          <span className={memo.upside > 0 ? 'delta-up' : 'delta-down'} style={{ fontSize: 11 }}>
            {memo.upside > 0 ? '+' : ''}{memo.upside.toFixed(1)}%
          </span>
        </div>
        <Conviction value={memo.conv} />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// /memo/[id] — detail view (Investment Portal Mockup v4 pattern)
// ─────────────────────────────────────────────────────────────────
const MemoDetail = ({ id, navigate }) => {
  const memo = window.MEMOS.find(m => m.id === id) || window.MEMOS[0];
  const u = window.UNIVERSE.find(x => x.tk === memo.tk) || window.UNIVERSE[0];
  const bear = window.bearCaseFor(memo.tk);

  const [decision, setDecision] = useState({
    posSize: '3.50%',
    conv: memo.conv,
    rationale: memo.status === 'pending'
      ? ''
      : (memo.rationale || ''),
  });

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: 'Memos', onClick: () => navigate('memos') },
          { label: memo.id },
        ]}
        title=""
        right={
          memo.status === 'pending' ? (
            <span className="status-badge warning">
              <span className="status-dot"></span>
              Pending approval
            </span>
          ) : (
            <span className={`status-badge ${memo.status}`}>
              <span className="status-dot"></span>
              {memo.status === 'approved' ? 'Approved' : 'Rejected'} · {memo.ts}
            </span>
          )
        }
      />

      {/* ticker header strip */}
      <div className="detail-head mb-20">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <span className="detail-ticker">{memo.tk}</span>
          <span className="detail-name">{u.nm}</span>
          <span className="mono" style={{ color: u.d7 >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 13 }}>
            ${u.price.toFixed(2)} {u.d7 >= 0 ? '+' : ''}{u.d7.toFixed(1)}%
          </span>
        </div>
        <div className="detail-meta mono">
          <span>{memo.id}</span>
          <span className="bullet">·</span>
          <span>Created {memo.ts}</span>
          <span className="bullet">·</span>
          <span>{memo.agents}/13 agents complete</span>
          <span className="bullet">·</span>
          <span>Cost <span style={{ color: 'var(--text-1)' }}>${memo.cost.toFixed(2)}</span></span>
          <span className="bullet">·</span>
          <span>Runtime {memo.runtime}</span>
        </div>
      </div>

      {/* 5-card KPI strip — gradient hairline + reco prominent */}
      <div className="detail-cards-row mb-20">
        <div className="detail-card">
          <span className="detail-card-label">Recommendation</span>
          <span className={`reco-pill ${memo.rec.toLowerCase() === 'buy' ? 'buy' : memo.rec.toLowerCase() === 'hold' ? 'hold' : 'sell'}`} style={{ fontSize: 14, padding: '7px 14px' }}>
            {memo.rec}
          </span>
        </div>
        <div className="detail-card">
          <span className="detail-card-label">Conviction</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span className="detail-card-value">{memo.conv}</span>
            <span className="muted mono" style={{ fontSize: 13 }}>/ 10</span>
          </div>
          <Conviction value={memo.conv} />
        </div>
        <div className="detail-card">
          <span className="detail-card-label">Target price</span>
          <span className="detail-card-value">${memo.targetPx}</span>
          <span className={`detail-card-sub ${memo.upside > 0 ? 'delta-up' : 'delta-down'}`}>
            {memo.upside > 0 ? '+' : ''}{memo.upside.toFixed(1)}% upside
          </span>
        </div>
        <div className="detail-card">
          <span className="detail-card-label">Horizon</span>
          <span className="detail-card-value" style={{ fontFamily: 'var(--sans)', fontSize: 17 }}>{memo.horizon}</span>
          <span className="detail-card-sub">Through FY2027</span>
        </div>
        <div className="detail-card">
          <span className="detail-card-label">Bear floor</span>
          <span className="detail-card-value danger-c">${bear.floorPrice || Math.round(u.price * 0.78)}</span>
          <span className="detail-card-sub danger-c">{bear.floorPct.toFixed(1)}% downside</span>
        </div>
      </div>

      {/* Trigger context strip — info-soft banner */}
      <div className="trigger-strip mb-32">
        <div className="trigger-strip-icon">
          <Icon name="filter" size={14} />
        </div>
        <div className="trigger-strip-text">
          <strong>{memo.trigger}</strong> fired this research job at <span className="num">{memo.ts}</span>.
          {' '}13 agents ran in {memo.runtime} · synthesis by Sonnet 4.6 · total cost <span className="num">${memo.cost.toFixed(2)}</span>.
        </div>
        <span className="chip">Auto-research</span>
      </div>

      {/* Two-column: thesis + decision card */}
      <div className="memo-grid">
        <div>
          {/* Memo body */}
          <div className="section-title-row">
            <h2 className="section-title">Investment thesis</h2>
            <span className="sub mono">synthesized · 4,210 tokens</span>
          </div>
          <div className="thesis-prose mb-32">
            <div className="thesis-section-label">Executive summary</div>
            <p style={{ marginBottom: 16 }}>
              <strong>{memo.tk}</strong> is positioned in {window.LAYERS[u.lay].label.toLowerCase()} ({u.seg}) with a
              composite of <span className="num">{u.comp.toFixed(1)}</span> and AIQ rubric
              <span className="num"> {u.aiq}/100</span>. Factor decomposition shows
              Q <span className="num">{u.q}</span> / G <span className="num">{u.g}</span> / V <span className="num">{u.v}</span>,
              consistent with a <strong>{u.tier === 'high' ? 'High-conviction' : u.tier === 'medium' ? 'Medium-tier' : u.tier === 'low' ? 'Low-tier' : 'Avoid-tier'}</strong> rating.
              The trigger fired on <span className="num">{memo.trigger.split('·')[0].trim()}</span>; agent
              pipeline rated {memo.conv}/10 conviction with a {memo.horizon} horizon.
            </p>

            <div className="thesis-section-label">Investment thesis</div>
            <p style={{ marginBottom: 16 }}>
              {memo.tk === 'TSM' && 'TSM is the structural beneficiary of the 2026 AI capex cycle, with HPC mix disclosed at 61% of revenue and a foundry monopoly on sub-3nm nodes. ASML high-NA backlog booked through 2028 insulates the moat. Customer concentration (NVDA + AAPL = 38%) is material but the end-demand is broader hyperscaler capex, not vendor-specific.'}
              {memo.tk === 'NVDA' && 'Blackwell is a generational architecture transition with multi-year visibility from the four largest hyperscalers, all of whom raised FY26 capex on the post-earnings call. Software attach (CUDA, Omniverse, NIM microservices) is structurally widening the moat versus AMD MI300/MI325 and the custom silicon programs at AWS/Google.'}
              {memo.tk !== 'TSM' && memo.tk !== 'NVDA' && `${memo.tk} sits in ${u.seg.toLowerCase()} with a clear ${u.tier}-tier setup. The current cycle position favors structural beneficiaries with disclosed AI revenue mix and durable capex efficiency. Setup supports a ${memo.horizon} thesis with disciplined entry near current levels.`}
            </p>

            <div className="thesis-section-label">Valuation</div>
            <table className="mini-data-table">
              <thead>
                <tr><th>Multiple</th><th className="r">Current</th><th className="r">5yr median</th><th className="r">Δ</th><th className="r">Percentile</th></tr>
              </thead>
              <tbody>
                <tr><td>P/E (NTM)</td><td className="r mono">35.2</td><td className="r mono">42.7</td><td className="r mono delta-up">−17.6%</td><td className="r mono">38th</td></tr>
                <tr><td>EV/EBITDA</td><td className="r mono">28.1</td><td className="r mono">31.4</td><td className="r mono delta-up">−10.5%</td><td className="r mono">42nd</td></tr>
                <tr><td>EV/Revenue</td><td className="r mono">17.4</td><td className="r mono">14.8</td><td className="r mono delta-down">+17.6%</td><td className="r mono">71st</td></tr>
                <tr><td>FCF yield</td><td className="r mono">3.8%</td><td className="r mono">2.4%</td><td className="r mono delta-up">+140bps</td><td className="r mono">68th</td></tr>
              </tbody>
            </table>
            <p style={{ marginTop: 14 }}>
              DCF intrinsic range: bear <span className="num">${bear.floorPrice || Math.round(u.price*0.78)}</span>,
              base <span className="num">${Math.round(u.price * 1.10)}</span>,
              bull <span className="num">${memo.targetPx}</span>.
              Base assumes <span className="num">10%</span> WACC, <span className="num">3%</span> terminal growth.
            </p>
          </div>

          {/* Bear case — steelmanned */}
          <div className="section-divider" />
          <div className="section-title-row">
            <h2 className="section-title">Bear case (steelmanned)</h2>
            <span className="sub mono">agent 10 · always runs last · invalidation: {bear.invalidationProb}</span>
          </div>
          <div className="bear-args mb-32">
            {bear.args.map((a, i) => (
              <div key={i} className="bear-arg">
                <div className="bear-arg-head">
                  <div className="bear-arg-title">{a.title}</div>
                  <span className={`sev-pill sev-${a.sev}`}>{a.sev}</span>
                </div>
                <div className="bear-arg-text">{a.text}</div>
              </div>
            ))}
            <div className="bear-floor">
              <span className="label-cap">Fair value, bear</span>
              <span className="mono" style={{ color: 'var(--danger)', fontSize: 17, fontWeight: 500 }}>${bear.floorPrice || Math.round(u.price * 0.78)}</span>
              <span className="muted" style={{ fontSize: 12.5 }}>{bear.summary}</span>
            </div>
          </div>

          {/* Risk review */}
          <div className="section-divider" />
          <div className="section-title-row">
            <h2 className="section-title">Risk review</h2>
            <span className="sub mono">agent 13 · advisory only</span>
          </div>
          <div className="risk-grid mb-32">
            <div className="risk-cell">
              <div className="label-cap" style={{ marginBottom: 8 }}>Sector concentration</div>
              <div style={{ color: 'var(--text-1)', fontSize: 13.5 }}>
                Tech weight <span className="mono">42.0%</span> · {memo.tk} contribution <span className="mono">12.0%</span>
              </div>
            </div>
            <div className="risk-cell">
              <div className="label-cap" style={{ marginBottom: 8 }}>30d correlation</div>
              <div style={{ color: 'var(--text-1)', fontSize: 13.5 }}>
                SMH <span className="mono">0.91</span> · no divergence flag
              </div>
            </div>
            <div className="risk-cell">
              <div className="label-cap" style={{ marginBottom: 8 }}>Data quality</div>
              <div style={{ color: 'var(--text-1)', fontSize: 13.5 }}>3 sources cross-checked · no gaps</div>
            </div>
            <div className="risk-cell">
              <div className="label-cap" style={{ marginBottom: 8 }}>Overall rating</div>
              <div style={{ color: 'var(--warning)', fontSize: 13.5, fontWeight: 500 }}>Medium</div>
            </div>
          </div>
        </div>

        {/* Right column — decision card */}
        <div>
          <div className="decision-card">
            <div className="decision-status-row">
              <span className={`stage-pill ${memo.status === 'pending' ? '' : memo.status}`}>{memo.status === 'pending' ? 'Awaiting decision' : memo.status}</span>
              <span className="muted" style={{ fontSize: 11 }}>· You · 1 of 1 approver</span>
            </div>
            <div className="decision-title">{memo.status === 'pending' ? 'Approval decision' : `${memo.status === 'approved' ? 'Approved' : 'Rejected'} by ${memo.decidedBy || 'TT'}`}</div>
            <div className="decision-sub">
              Memo synthesized in <span className="num">{memo.runtime}</span> from 13 agent runs.
              Every action writes to the immutable audit log.
            </div>

            <div className="form-grid">
              <div className="form-field">
                <label>Position size</label>
                <input className="form-input mono" value={decision.posSize}
                  onChange={(e) => setDecision(d => ({ ...d, posSize: e.target.value }))}
                  readOnly={memo.status !== 'pending'} />
              </div>
              <div className="form-field">
                <label>Conviction</label>
                <div className="form-input" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px' }}>
                  <Conviction value={decision.conv} />
                  <span className="mono accent-c" style={{ marginLeft: 'auto', fontSize: 12 }}>{decision.conv}/10</span>
                </div>
              </div>
            </div>

            <div className="form-field" style={{ marginTop: 14 }}>
              <label>Rationale</label>
              <textarea
                className="form-input form-textarea"
                value={decision.rationale}
                placeholder="Required for approval. Stored in audit log alongside agent outputs and decision metadata."
                onChange={(e) => setDecision(d => ({ ...d, rationale: e.target.value }))}
                readOnly={memo.status !== 'pending'}
              />
            </div>

            <div className="decision-actions">
              {memo.status === 'pending' ? (
                <>
                  <button className="btn btn-ghost danger-c">Reject</button>
                  <button className="btn btn-secondary">Revise & rerun</button>
                  <button className="btn btn-primary" style={{ marginLeft: 'auto' }}>
                    Approve <Icon name="arrowRight" size={11} />
                  </button>
                </>
              ) : (
                <>
                  <span className="muted" style={{ fontSize: 12 }}>Decided {memo.ts}</span>
                  <button className="btn btn-secondary" style={{ marginLeft: 'auto' }} onClick={() => navigate('memos')}>
                    Back to queue
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Disclosure */}
          <div className="disclosure mt-16">
            <strong>Personal use only.</strong> This research does not constitute investment advice.
            All output is analytical, not advisory. Human judgment is required at every decision point by design.
          </div>
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────
// Memos list rail — system pulse: cost, queue, run states
// ─────────────────────────────────────────────────────────────────
const MemosRail = () => (
  <>
    <div className="rail-section">
      <RailHeader icon="info" label="System pulse" />
      <div className="rail-list">
        <div className="rail-row"><span className="lbl">LLM spend · today</span><span className="val">$24.80 / $50</span></div>
        <div className="alloc-bar" style={{ height: 4, marginTop: -2 }}><div className="alloc-fill" style={{ width: '49.6%' }} /></div>
        <div className="rail-row" style={{ marginTop: 6 }}><span className="lbl">Agent runs · today</span><span className="val">38</span></div>
        <div className="rail-row"><span className="lbl">Inngest queue</span><span className="val">2 active</span></div>
        <div className="rail-row"><span className="lbl">Free tier</span><span className="val">14,212 / 25K</span></div>
      </div>
    </div>
    <div className="rail-section">
      <RailHeader icon="clock" label="Data sources" />
      <div className="rail-list">
        <div className="rail-row"><span className="glow-dot success" /><span className="lbl">Polygon</span><span className="val mono">8s</span></div>
        <div className="rail-row"><span className="glow-dot success" /><span className="lbl">FMP</span><span className="val mono">14s</span></div>
        <div className="rail-row"><span className="glow-dot success" /><span className="lbl">EDGAR</span><span className="val mono">2m</span></div>
        <div className="rail-row"><span className="glow-dot success" /><span className="lbl">Marketaux</span><span className="val mono">42s</span></div>
      </div>
    </div>
  </>
);

// Memo detail rail — agent pipeline
const MemoDetailRail = ({ id }) => {
  const memo = window.MEMOS.find(m => m.id === id) || window.MEMOS[0];
  return (
    <>
      <div className="rail-section">
        <RailHeader icon="check" label="Agent pipeline" />
        <div className="muted" style={{ fontSize: 11.5, marginBottom: 10, fontFamily: 'var(--mono)' }}>
          {memo.agents}/13 · {memo.runtime} · ${memo.cost.toFixed(2)}
        </div>
        <div className="audit-list">
          {window.MEMO_AGENTS.map((a, i) => (
            <div key={i} className="audit-row" title={`${a.model} · ${a.timing}`}>
              <span className={`audit-status ${a.status === 'flag' ? 'flag' : 'done'}`}>
                {a.status === 'flag' ? '!' : '✓'}
              </span>
              <span style={{ flex: 1, fontSize: 12.5 }}>{a.name}</span>
              <span className="muted mono" style={{ fontSize: 10.5 }}>{a.model}</span>
              <span className="timing mono">${a.cost.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────
// /decisions — audit log of approved/rejected memos
// ─────────────────────────────────────────────────────────────────
const Decisions = ({ navigate }) => {
  const decided = window.MEMOS.filter(m => m.status !== 'pending');
  const approved = decided.filter(m => m.status === 'approved').length;
  const rejected = decided.filter(m => m.status === 'rejected').length;

  return (
    <>
      <PageHeader
        title="Decisions"
        meta={`${decided.length} decisions logged · ${approved} approved · ${rejected} rejected · immutable audit`}
        right={<button className="btn btn-secondary"><Icon name="ext" size={13} /> Export JSON</button>}
      />
      <div className="section-divider" />

      <div className="kpi-row mb-32">
        <Kpi label="Approved · 30d" value={approved} deltas={[{ text: `${Math.round((approved/decided.length)*100)}% rate`, tone: 'up' }]} />
        <Kpi label="Rejected · 30d" value={rejected} deltas={[{ text: 'depreciation: 2 · low-conv: 1' }]} />
        <Kpi label="Avg position size" value="3.4%" deltas={[{ text: 'on approval', }, { text: 'cap 5%' }]} />
        <Kpi label="Time to decision" value="14m" deltas={[{ text: 'median', }, { text: '95p 2h 8m' }]} />
      </div>

      <div className="section-title-row">
        <h2 className="section-title">Audit log</h2>
        <span className="sub mono">click any row for full memo</span>
      </div>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Decided at</th>
              <th>Memo</th>
              <th>Ticker</th>
              <th className="ctr">Rec</th>
              <th>Decision</th>
              <th>Rationale</th>
              <th className="ctr">By</th>
            </tr>
          </thead>
          <tbody>
            {decided.map(m => (
              <tr key={m.id} onClick={() => navigate('memo-detail', { id: m.id })}>
                <td className="mono" style={{ color: 'var(--text-2)', fontSize: 12 }}>{m.ts}</td>
                <td className="mono" style={{ color: 'var(--text-1)', fontSize: 12 }}>{m.id}</td>
                <td className="ticker">{m.tk}</td>
                <td className="ctr">
                  <span className={`reco-pill ${m.rec.toLowerCase() === 'buy' ? 'buy' : m.rec.toLowerCase() === 'hold' ? 'hold' : 'sell'}`} style={{ fontSize: 10.5, padding: '3px 8px' }}>
                    {m.rec}
                  </span>
                </td>
                <td>
                  <span className={`tier ${m.status === 'approved' ? 'tier-high' : 'tier-avoid'}`} style={{ background: m.status === 'approved' ? 'var(--success-soft)' : 'var(--danger-soft)', color: m.status === 'approved' ? 'var(--success)' : 'var(--danger)', borderColor: m.status === 'approved' ? 'rgba(91,184,128,0.20)' : 'rgba(224,120,120,0.20)' }}>
                    {m.status}
                  </span>
                </td>
                <td style={{ fontSize: 12.5, color: 'var(--text-2)', maxWidth: 380, whiteSpace: 'normal', lineHeight: 1.5 }}>
                  {m.rationale}
                </td>
                <td className="ctr">
                  <div className="avatar" style={{ width: 22, height: 22, fontSize: 10, margin: '0 auto' }}>{m.decidedBy || 'TT'}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const DecisionsRail = () => (
  <div className="rail-section">
    <RailHeader icon="check" label="Decision policy" />
    <div className="rail-list" style={{ gap: 12 }}>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
        Every memo is logged immutably. Decisions cannot be edited after the fact — only superseded by a new decision on the same ticker.
      </div>
      <div className="rail-row" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }}>
        <span className="lbl">Min conviction (Buy)</span>
        <span className="val mono">≥ 6/10</span>
      </div>
      <div className="rail-row">
        <span className="lbl">Max position</span>
        <span className="val mono">5.0%</span>
      </div>
      <div className="rail-row">
        <span className="lbl">Reserve floor</span>
        <span className="val mono">$20,000</span>
      </div>
    </div>
  </div>
);

Object.assign(window, { Memos, MemoDetail, MemosRail, MemoDetailRail, Decisions, DecisionsRail });

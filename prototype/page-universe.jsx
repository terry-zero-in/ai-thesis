/* /universe */
const Universe = ({ navigate, filters, setFilters }) => {
  const u = window.UNIVERSE;
  const [sort, setSort] = useState({ col: 'comp', dir: 'desc' });

  const filtered = useMemo(() => {
    return u.filter(row => {
      if (filters.layers.length && !filters.layers.includes(row.lay)) return false;
      if (filters.tiers.length && !filters.tiers.includes(row.tier)) return false;
      if (filters.aiqMin > 0 && row.aiq < filters.aiqMin) return false;
      if (filters.deprOnly && row.depr === null) return false;
      if (filters.highOnly && row.tier !== 'high') return false;
      return true;
    });
  }, [u, filters]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const x = a[sort.col], y = b[sort.col];
      if (typeof x === 'string') return sort.dir === 'asc' ? x.localeCompare(y) : y.localeCompare(x);
      return sort.dir === 'asc' ? x - y : y - x;
    });
    return arr;
  }, [filtered, sort]);

  const tableSort = (col) => () => {
    setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' });
  };

  const SortHead = ({ col, num, ctr, children }) => (
    <th className={(num ? 'num ' : '') + (ctr ? 'ctr ' : '')} onClick={tableSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      {children}
      {sort.col === col && (
        <span className="muted mono" style={{ marginLeft: 4 }}>{sort.dir === 'asc' ? '↑' : '↓'}</span>
      )}
    </th>
  );

  const toggleLayer = (l) => setFilters(f => ({ ...f, layers: f.layers.includes(l) ? f.layers.filter(x => x !== l) : [...f.layers, l] }));
  const toggleTier = (t) => setFilters(f => ({ ...f, tiers: f.tiers.includes(t) ? f.tiers.filter(x => x !== t) : [...f.tiers, t] }));

  return (
    <>
      <PageHeader
        title="Universe"
        meta={`${u.length} tickers · scored as of May 15, 2026 23:24 CT · next refresh Sun 22:00`}
        right={
          <>
            <button className="btn btn-secondary">
              <Icon name="refresh" size={13} /> Refresh scores
            </button>
            <button className="btn btn-secondary">
              <Icon name="ext" size={13} /> Export CSV
            </button>
          </>
        }
      />
      <div className="section-divider" />

      <div className="filter-row">
        <button className="btn btn-ghost">
          <Icon name="filter" size={13} /> Layer
          {filters.layers.length > 0 && <span className="chip active" style={{ marginLeft: 4 }}>{filters.layers.length}</span>}
          <Icon name="chevD" size={11} />
        </button>
        <button className="btn btn-ghost">
          Tier
          {filters.tiers.length > 0 && <span className="chip active" style={{ marginLeft: 4 }}>{filters.tiers.length}</span>}
          <Icon name="chevD" size={11} />
        </button>
        <button className="btn btn-ghost">
          AIQ ≥ <span className="mono accent-c">{filters.aiqMin || '—'}</span>
          <Icon name="chevD" size={11} />
        </button>
        <button className={`btn btn-ghost ${filters.deprOnly ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, deprOnly: !f.deprOnly }))}>
          <Icon name="alert" size={12} /> Depreciation flags
        </button>
        <button className={`btn btn-ghost ${filters.highOnly ? 'active' : ''}`} onClick={() => setFilters(f => ({ ...f, highOnly: !f.highOnly }))}>
          Only High tier
        </button>
        <div className="spacer" />
        <span className="muted mono" style={{ fontSize: 12 }}>
          Showing <span className="bright">{sorted.length}</span> of {u.length}
        </span>
      </div>

      {sorted.length === 0 && (
        <EmptyState
          icon="filter"
          headline="No tickers match these filters"
          explainer="Try widening the layer, tier, or AIQ minimum. The universe holds 70 names across L1–L5."
          actionLabel="Reset filters"
          onAction={() => setFilters({ layers: [], tiers: [], aiqMin: 0, deprOnly: false, highOnly: false })}
        />
      )}

      {sorted.length > 0 && (
      <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <SortHead col="tk">Ticker / Name</SortHead>
            <th>Layer</th>
            <SortHead col="q" num>Q</SortHead>
            <SortHead col="g" num>G</SortHead>
            <SortHead col="v" num>V</SortHead>
            <SortHead col="aiq" num>AIQ</SortHead>
            <SortHead col="comp" num>Composite</SortHead>
            <SortHead col="d7" num>Δ 7D</SortHead>
            <th>Trend 12W</th>
            <th>Flags</th>
            <SortHead col="conv" num>Conv</SortHead>
            <SortHead col="tier" ctr>Tier</SortHead>
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr key={row.tk} onClick={() => navigate('detail', { ticker: row.tk })}>
              <td>
                <TickerCell tk={row.tk} nm={row.nm} />
              </td>
              <td><span className="chip">{row.lay}</span></td>
              <td className={`num ${row.q >= 80 ? 'cell-tint' : ''}`}><span>{row.q}</span></td>
              <td className={`num ${row.g >= 80 ? 'cell-tint' : ''}`}><span>{row.g}</span></td>
              <td className={`num ${row.v >= 80 ? 'cell-tint' : ''}`}><span>{row.v}</span></td>
              <td className={`num ${row.aiq >= 80 ? 'cell-tint' : ''}`}><span>{row.aiq}</span></td>
              <td className="num bright">{row.comp.toFixed(1)}</td>
              <td className="num">{formatDelta(row.d7)}</td>
              <td><Sparkline data={row.sparkScore} width={70} height={20} /></td>
              <td>
                {row.depr !== null && (
                  <span className="depr-flag">
                    <Icon name="alert" size={10} />
                    <span className="num">{row.depr}</span>
                  </span>
                )}
              </td>
              <td className="num"><Conviction value={row.conv} /></td>
              <td className="ctr"><TierBadge tier={row.tier} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      )}

      {sorted.length > 0 && (
      <div className="mt-16 muted" style={{ fontSize: 12 }}>
        Click any row to open name detail. Columns Q/G/V/AIQ tint when ≥80. Hover trend for 12-week sparkline.
      </div>
      )}
    </>
  );
};

const UniverseRail = ({ filters, setFilters }) => {
  const layers = Object.values(window.LAYERS);
  const tiers = ['high', 'medium', 'low', 'avoid'];
  const tierLabel = { high: 'High', medium: 'Medium', low: 'Low', avoid: 'Avoid' };
  return (
    <>
      <div className="rail-section">
        <RailHeader icon="filter" label="Filters" />
      </div>

      <div className="rail-section">
        <div className="label-cap mb-12">Layer</div>
        <div className="col-flex" style={{ gap: 6 }}>
          {layers.map(l => (
            <label key={l.code} className="rail-row" style={{ cursor: 'pointer', padding: '4px 0' }}>
              <input
                type="checkbox"
                checked={filters.layers.includes(l.code)}
                onChange={() => setFilters(f => ({ ...f, layers: f.layers.includes(l.code) ? f.layers.filter(x => x !== l.code) : [...f.layers, l.code] }))}
                style={{ accentColor: 'var(--accent)' }}
              />
              <span className="lbl mono" style={{ color: 'var(--text-1)', minWidth: 24 }}>{l.code}</span>
              <span className="lbl">{l.label}</span>
              <span className="val muted">{window.UNIVERSE.filter(u => u.lay === l.code).length}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rail-section">
        <div className="label-cap mb-12">Tier</div>
        <div className="col-flex" style={{ gap: 6 }}>
          {tiers.map(t => (
            <label key={t} className="rail-row" style={{ cursor: 'pointer', padding: '4px 0' }}>
              <input
                type="checkbox"
                checked={filters.tiers.includes(t)}
                onChange={() => setFilters(f => ({ ...f, tiers: f.tiers.includes(t) ? f.tiers.filter(x => x !== t) : [...f.tiers, t] }))}
                style={{ accentColor: 'var(--accent)' }}
              />
              <TierBadge tier={t} />
              <span className="lbl">{tierLabel[t]}</span>
              <span className="val muted">{window.UNIVERSE.filter(u => u.tier === t).length}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="rail-section">
        <div className="label-cap mb-12">AIQ minimum</div>
        <div className="row-flex" style={{ gap: 12 }}>
          <input
            type="range"
            min="0" max="100" step="5"
            value={filters.aiqMin}
            onChange={(e) => setFilters(f => ({ ...f, aiqMin: parseInt(e.target.value) }))}
            style={{ flex: 1, accentColor: 'var(--accent)' }}
          />
          <span className="mono bright" style={{ width: 28, textAlign: 'right' }}>{filters.aiqMin}</span>
        </div>
      </div>

      <div className="rail-section">
        <div className="label-cap mb-12">Flags</div>
        <div className="col-flex" style={{ gap: 8 }}>
          <label className="rail-row" style={{ cursor: 'pointer', padding: '4px 0' }}>
            <input
              type="checkbox"
              checked={filters.deprOnly}
              onChange={() => setFilters(f => ({ ...f, deprOnly: !f.deprOnly }))}
              style={{ accentColor: 'var(--accent)' }}
            />
            <span className="lbl">Depreciation only</span>
          </label>
          <label className="rail-row" style={{ cursor: 'pointer', padding: '4px 0' }}>
            <input
              type="checkbox"
              checked={filters.highOnly}
              onChange={() => setFilters(f => ({ ...f, highOnly: !f.highOnly }))}
              style={{ accentColor: 'var(--accent)' }}
            />
            <span className="lbl">Only High tier</span>
          </label>
        </div>
      </div>

      <div className="rail-section">
        <button
          className="btn btn-ghost"
          style={{ width: '100%' }}
          onClick={() => setFilters({ layers: [], tiers: [], aiqMin: 0, deprOnly: false, highOnly: false })}
        >
          Reset filters
        </button>
      </div>
    </>
  );
};

Object.assign(window, { Universe, UniverseRail });

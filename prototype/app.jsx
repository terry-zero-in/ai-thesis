/* AI Thesis v2 — App Shell */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

// Tweaks defaults
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#4D5BFF",
  "density": "regular",
  "showSparklines": true,
  "rightRail": true,
  "mono": "JetBrains Mono"
}/*EDITMODE-END*/;

// ------------------------------------------------------------------
// Sidebar
// ------------------------------------------------------------------
const Sidebar = ({ route, navigate }) => {
  const u = window.UNIVERSE;
  const items = [
    { key: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { key: 'universe', label: 'Universe', icon: 'grid', badge: u.length },
    { key: 'portfolio', label: 'Portfolio', icon: 'briefcase' },
    { key: 'regime', label: 'Regime', icon: 'gauge' },
    { key: 'memos', label: 'Memos', icon: 'fileText', badge: window.MEMOS.filter(m => m.status === 'pending').length },
    { key: 'decisions', label: 'Decisions', icon: 'check' },
  ];
  const workspace = [
    { key: 'aiq', label: 'AIQ Editor', icon: 'sliders' },
    { key: 'settings', label: 'Settings', icon: 'settings' },
  ];
  return (
    <aside className="sidebar">
      <div className="nav-section">Command center</div>
      {items.map(item => (
        <div
          key={item.key}
          className={`nav-item ${route.page === item.key ? 'active' : ''}`}
          onClick={() => navigate(item.key)}
        >
          <Icon name={item.icon} size={14} className="nav-icon" />
          <span className="nav-label">{item.label}</span>
          {item.badge != null && <span className="nav-badge mono">{item.badge}</span>}
        </div>
      ))}
      <div className="nav-section">Workspace</div>
      {workspace.map(item => (
        <div
          key={item.key}
          className={`nav-item ${route.page === item.key ? 'active' : ''}`}
          onClick={() => navigate(item.key)}
        >
          <Icon name={item.icon} size={14} className="nav-icon" />
          <span className="nav-label">{item.label}</span>
        </div>
      ))}

      <div className="sidebar-bottom">
        <div className="avatar">TT</div>
        <div>
          <div className="name">Terry Turner</div>
          <div className="meta mono">Basis · v2.0.0-rc.4</div>
        </div>
      </div>
    </aside>
  );
};

// ------------------------------------------------------------------
// Topbar
// ------------------------------------------------------------------
const Topbar = ({ route, navigate, onOpenCmd, onToggleRail, railOn }) => {
  const breadcrumb = () => {
    switch (route.page) {
      case 'dashboard':  return null;
      case 'universe':   return ['Universe'];
      case 'detail':     return ['Universe', route.params?.ticker || ''];
      case 'portfolio':  return ['Portfolio'];
      case 'regime':     return ['Regime'];
      case 'aiq':        return ['Universe', route.params?.ticker || 'TSM', 'AIQ'];
      case 'memos':      return ['Memos'];
      case 'memo-detail':return ['Memos', route.params?.id || ''];
      case 'decisions':  return ['Decisions'];
      case 'settings':   return ['Settings'];
      default: return null;
    }
  };
  const crumbs = breadcrumb();
  return (
    <header className="topbar">
      <div className="brand" onClick={() => navigate('dashboard')}>
        <div className="brand-mark">B</div>
        <div className="brand-divider"></div>
        <div className="brand-name">AI Thesis</div>
      </div>
      {crumbs && (
        <div className="breadcrumb">
          <span className="sep">/</span>
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="sep">/</span>}
              <span
                className={i === crumbs.length - 1 ? 'crumb-current' : ''}
                style={{ cursor: i < crumbs.length - 1 ? 'pointer' : 'default' }}
                onClick={() => {
                  if (i === 0 && crumbs[0] === 'Universe') navigate('universe');
                  if (i === 1 && route.page === 'aiq') navigate('detail', { ticker: route.params?.ticker });
                }}
              >
                {c}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div className="topbar-spacer"></div>
      <div className="topbar-status" title="Live data status">
        <span className="live-dot warn"></span>
        <span className="status-label closed">Closed</span>
        <span className="sep"></span>
        <span className="meta">Sync 8s</span>
      </div>
      <div className="search-box" onClick={onOpenCmd}>
        <Icon name="search" size={13} />
        <span className="ph">Search tickers, names, memos…</span>
        <span className="kbd">⌘K</span>
      </div>
      <button className="icon-btn"><Icon name="bell" size={15} /><span className="dot"></span></button>
      <button className="icon-btn"><Icon name="help" size={15} /></button>
      <button className={`icon-btn ${railOn ? '' : 'muted'}`} onClick={onToggleRail}><Icon name="panel" size={15} /></button>
      <div className="brand-divider"></div>
      <div className="avatar">TT</div>
    </header>
  );
};

// ------------------------------------------------------------------
// Command Palette
// ------------------------------------------------------------------
const CommandPalette = ({ navigate, onClose }) => {
  const [q, setQ] = useState('');
  const inputRef = useRef();
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const tickers = window.UNIVERSE.filter(u =>
    !q || u.tk.toLowerCase().includes(q.toLowerCase()) || u.nm.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 6);

  const pages = [
    { key: 'dashboard', label: 'Go to Dashboard', kbd: '⌘1' },
    { key: 'universe',  label: 'Go to Universe',  kbd: '⌘2' },
    { key: 'portfolio', label: 'Go to Portfolio', kbd: '⌘3' },
    { key: 'regime',    label: 'Go to Regime',    kbd: '⌘4' },
  ].filter(p => !q || p.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd-modal" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmd-input"
          placeholder="Search tickers, names, memos, commands…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {tickers.length > 0 && (
          <div className="cmd-section">
            <div className="cmd-section-title">Tickers</div>
            {tickers.map(t => (
              <div key={t.tk} className="cmd-item" onClick={() => { navigate('detail', { ticker: t.tk }); onClose(); }}>
                <span className="ticker-cell">{t.tk}</span>
                <span className="nm">{t.nm}</span>
                <TierBadge tier={t.tier} />
                <span className="mono muted" style={{ marginLeft: 8, fontSize: 11.5 }}>{t.comp.toFixed(1)}</span>
              </div>
            ))}
          </div>
        )}
        {pages.length > 0 && (
          <div className="cmd-section" style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div className="cmd-section-title">Navigation</div>
            {pages.map(p => (
              <div key={p.key} className="cmd-item" onClick={() => { navigate(p.key); onClose(); }}>
                <Icon name="arrowRight" size={13} className="muted" />
                <span className="nm" style={{ color: 'var(--text-1)' }}>{p.label}</span>
                <span className="kbd-hint">{p.kbd}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ------------------------------------------------------------------
// App
// ------------------------------------------------------------------
const App = () => {
  const [route, setRoute] = useState({ page: 'dashboard', params: {} });
  const [filters, setFilters] = useState({
    layers: [], tiers: [], aiqMin: 0, deprOnly: false, highOnly: false,
  });
  const [railOn, setRailOn] = useState(true);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply tweaks
  useEffect(() => {
    document.documentElement.style.setProperty('--accent', tweaks.accent);
    // Recompute soft tones based on accent
    const hex = tweaks.accent.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    document.documentElement.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, 0.10)`);
    document.documentElement.style.setProperty('--accent-glow', `rgba(${r}, ${g}, ${b}, 0.18)`);
    // Brighter hover
    document.documentElement.style.setProperty('--accent-hover', tweaks.accent);
  }, [tweaks.accent]);

  const navigate = useCallback((page, params = {}) => {
    setRoute({ page, params });
    window.scrollTo(0, 0);
  }, []);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && '1234567'.includes(e.key)) {
        e.preventDefault();
        const pages = ['dashboard','universe','portfolio','regime','memos','aiq','settings'];
        navigate(pages[parseInt(e.key) - 1]);
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  // J / K / Enter — table row keyboard nav (§7.2)
  useEffect(() => {
    const onKey = (e) => {
      if (cmdOpen) return;
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!['j', 'k', 'Enter'].includes(e.key)) return;

      const rows = document.querySelectorAll('.main .data-table tbody tr');
      if (!rows.length) return;

      let idx = -1;
      rows.forEach((r, i) => { if (r.classList.contains('row-cursor')) idx = i; });

      const setCursor = (next) => {
        rows.forEach(r => r.classList.remove('row-cursor'));
        rows[next].classList.add('row-cursor');
        // Manual scroll only if row is off-screen (no scrollIntoView)
        const rect = rows[next].getBoundingClientRect();
        if (rect.top < 80 || rect.bottom > window.innerHeight - 24) {
          const offset = rect.top + window.pageYOffset - 200;
          window.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
        }
      };

      if (e.key === 'j') {
        e.preventDefault();
        setCursor(idx < 0 ? 0 : Math.min(rows.length - 1, idx + 1));
      } else if (e.key === 'k') {
        e.preventDefault();
        setCursor(idx <= 0 ? 0 : idx - 1);
      } else if (e.key === 'Enter' && idx >= 0) {
        e.preventDefault();
        rows[idx].click();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cmdOpen, route.page]);

  // pages that don't show rail
  const noRailPages = ['settings'];
  const showRail = railOn && tweaks.rightRail && !noRailPages.includes(route.page);

  // Body density
  const density = tweaks.density;

  const renderRail = () => {
    if (!showRail) return null;
    switch (route.page) {
      case 'dashboard': return <DashboardRail />;
      case 'universe':  return <UniverseRail filters={filters} setFilters={setFilters} />;
      case 'detail':    return <NameDetailRail ticker={route.params?.ticker} />;
      case 'portfolio': return <PortfolioRail />;
      case 'regime':    return <RegimeRail />;
      case 'aiq':       return <AiqEditorRail />;
      case 'memos':     return <MemosRail />;
      case 'memo-detail': return <MemoDetailRail id={route.params?.id} />;
      case 'decisions': return <DecisionsRail />;
      default:          return null;
    }
  };

  const renderPage = () => {
    switch (route.page) {
      case 'dashboard': return <Dashboard navigate={navigate} />;
      case 'universe':  return <Universe navigate={navigate} filters={filters} setFilters={setFilters} />;
      case 'detail':    return <NameDetail ticker={route.params?.ticker || 'TSM'} navigate={navigate} />;
      case 'portfolio': return <Portfolio navigate={navigate} />;
      case 'regime':    return <Regime />;
      case 'aiq':       return <AiqEditor ticker={route.params?.ticker || 'TSM'} navigate={navigate} />;
      case 'memos':     return <Memos navigate={navigate} />;
      case 'memo-detail': return <MemoDetail id={route.params?.id} navigate={navigate} />;
      case 'decisions': return <Decisions navigate={navigate} />;
      case 'settings':  return <SettingsPage />;
      default:          return <Dashboard navigate={navigate} />;
    }
  };

  return (
    <div className="app-shell" data-density={density}>
      <Topbar route={route} navigate={navigate} onOpenCmd={() => setCmdOpen(true)} onToggleRail={() => setRailOn(r => !r)} railOn={showRail} />
      <Sidebar route={route} navigate={navigate} />
      <div className={`main-wrap ${!showRail ? 'no-rail' : ''}`}>
        <main className="main" data-screen-label={route.page}>
          {renderPage()}
        </main>
        {showRail && (
          <aside className="rail">
            {renderRail()}
          </aside>
        )}
      </div>
      {cmdOpen && <CommandPalette navigate={navigate} onClose={() => setCmdOpen(false)} />}
      <AiqTweaks tweaks={tweaks} setTweak={setTweak} />
    </div>
  );
};

// ------------------------------------------------------------------
// Coming Soon / Settings pages
// ------------------------------------------------------------------
const ComingSoon = ({ page, desc }) => (
  <>
    <PageHeader title={page} meta="v1.1" />
    <div className="section-divider" />
    <div className="callout">
      <Icon name="info" size={14} className="muted" />
      <span className="muted">{desc}</span>
    </div>
  </>
);

const SettingsPage = () => (
  <>
    <PageHeader title="Settings" meta="Workspace · scoring engine · data sources" />
    <div className="section-divider" />
    <div className="grid-2 gap-32">
      <div>
        <div className="panel-title">Scoring engine</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>Refresh schedule and weights are managed in <span className="mono accent-c">Linear THS-32</span>.</div>
        <table className="data-table">
          <tbody>
            <tr><td>Refresh cadence</td><td className="num mono bright">Sunday 22:00 ET</td></tr>
            <tr><td>Universe size</td><td className="num mono bright">70 tickers</td></tr>
            <tr><td>Source LLM</td><td className="num mono bright">claude-sonnet-4.5</td></tr>
            <tr><td>Macro refresh</td><td className="num mono bright">30s · market hours</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        <div className="panel-title">Notifications</div>
        <div className="muted" style={{ fontSize: 13, marginBottom: 16 }}>v1: in-app only · v1.1 adds email digest.</div>
        <table className="data-table">
          <tbody>
            <tr><td>Tier downgrade</td><td className="ctr"><span className="chip active">on</span></td></tr>
            <tr><td>Gate state change</td><td className="ctr"><span className="chip active">on</span></td></tr>
            <tr><td>Position −7% from cost</td><td className="ctr"><span className="chip active">on</span></td></tr>
            <tr><td>Insider Form 4</td><td className="ctr"><span className="chip">off</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </>
);

// ------------------------------------------------------------------
// Tweaks panel
// ------------------------------------------------------------------
const AiqTweaks = ({ tweaks, setTweak }) => {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Accent">
        <TweakColor
          label="Color"
          value={tweaks.accent}
          onChange={(v) => setTweak('accent', v)}
          options={['#4D5BFF', '#7C5BFF', '#3E8BFF', '#1FA67A', '#E07878']}
        />
      </TweakSection>
      <TweakSection label="Layout">
        <TweakToggle label="Right rail" value={tweaks.rightRail} onChange={(v) => setTweak('rightRail', v)} />
        <TweakToggle label="Sparklines" value={tweaks.showSparklines} onChange={(v) => setTweak('showSparklines', v)} />
      </TweakSection>
      <TweakSection label="Density">
        <TweakRadio
          label="Rows"
          value={tweaks.density}
          onChange={(v) => setTweak('density', v)}
          options={[
            { value: 'compact', label: 'Compact' },
            { value: 'regular', label: 'Regular' },
          ]}
        />
      </TweakSection>
    </TweaksPanel>
  );
};

// Mount
ReactDOM.createRoot(document.getElementById('app')).render(<App />);

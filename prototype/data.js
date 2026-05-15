/* AI Thesis v2 — Mock Data */

// Layers
window.LAYERS = {
  L1: { code: 'L1', label: 'Compute', tagline: 'Silicon, networking, foundry' },
  L2: { code: 'L2', label: 'Hyperscale', tagline: 'Cloud capex & operators' },
  L3: { code: 'L3', label: 'Application', tagline: 'Vertical SaaS & enablement' },
  L4: { code: 'L4', label: 'Power', tagline: 'Grid, generation, nuclear' },
  L5: { code: 'L5', label: 'Adjacents', tagline: 'Infra-adjacent industrials' },
};

// Random-but-stable sparkline series helper
const seriesFor = (seed, n = 24, base = 50, vol = 8, drift = 0) => {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const out = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v += (rand() - 0.5) * vol + drift;
    out.push(v);
  }
  return out;
};

// Universe — 70 tickers across 5 layers
window.UNIVERSE = [
  // L1 COMPUTE
  { tk: 'TSM',   nm: 'Taiwan Semiconductor',   lay: 'L1', seg: 'Foundry',         q: 92, g: 88, v: 75, aiq: 92, comp: 82.2, d7: +3.1, d30: +6.4, tier: 'high',   depr: null, conv: 9, price: 194.30 },
  { tk: 'NVDA',  nm: 'NVIDIA',                 lay: 'L1', seg: 'GPU / AI Silicon',q: 88, g: 95, v: 60, aiq: 87, comp: 79.7, d7: +1.2, d30: +4.1, tier: 'high',   depr: -3, conv: 8, price: 920.10 },
  { tk: 'ASML',  nm: 'ASML Holding',           lay: 'L1', seg: 'Lithography',     q: 88, g: 75, v: 70, aiq: 88, comp: 79.0, d7: -0.3, d30: +2.2, tier: 'high',   depr: null, conv: 8, price: 940.00 },
  { tk: 'AVGO',  nm: 'Broadcom',               lay: 'L1', seg: 'Networking ASIC', q: 85, g: 92, v: 55, aiq: 84, comp: 74.1, d7: +0.8, d30: +1.4, tier: 'medium', depr: null, conv: 7, price: 1612.50 },
  { tk: 'ANET',  nm: 'Arista Networks',        lay: 'L1', seg: 'Networking',      q: 82, g: 92, v: 50, aiq: 85, comp: 76.6, d7: +2.1, d30: +3.8, tier: 'medium', depr: null, conv: 7, price: 372.10 },
  { tk: 'AMD',   nm: 'Advanced Micro Devices', lay: 'L1', seg: 'GPU / CPU',       q: 72, g: 80, v: 62, aiq: 70, comp: 67.5, d7: -0.4, d30: -2.1, tier: 'medium', depr: -4, conv: 5, price: 162.40 },
  { tk: 'MU',    nm: 'Micron Technology',      lay: 'L1', seg: 'HBM Memory',      q: 70, g: 85, v: 68, aiq: 75, comp: 70.2, d7: +1.0, d30: +5.3, tier: 'medium', depr: null, conv: 6, price: 119.85 },
  { tk: 'KLAC',  nm: 'KLA Corp',               lay: 'L1', seg: 'Semicap',         q: 86, g: 70, v: 68, aiq: 78, comp: 73.3, d7: -0.1, d30: +1.0, tier: 'medium', depr: null, conv: 6, price: 768.20 },
  { tk: 'LRCX',  nm: 'Lam Research',           lay: 'L1', seg: 'Semicap',         q: 84, g: 72, v: 70, aiq: 76, comp: 72.0, d7: -0.6, d30: +0.4, tier: 'medium', depr: null, conv: 6, price: 1020.55 },
  { tk: 'AMAT',  nm: 'Applied Materials',      lay: 'L1', seg: 'Semicap',         q: 82, g: 68, v: 72, aiq: 74, comp: 71.4, d7: +0.2, d30: +2.0, tier: 'medium', depr: null, conv: 6, price: 245.80 },
  { tk: 'MRVL',  nm: 'Marvell Technology',     lay: 'L1', seg: 'Custom Silicon',  q: 65, g: 78, v: 55, aiq: 72, comp: 65.4, d7: -1.1, d30: -0.7, tier: 'medium', depr: null, conv: 5, price: 74.95 },
  { tk: 'CRDO',  nm: 'Credo Technology',       lay: 'L1', seg: 'Interconnect',    q: 60, g: 88, v: 35, aiq: 70, comp: 60.0, d7: +1.4, d30: +4.0, tier: 'medium', depr: null, conv: 4, price: 58.40 },
  { tk: 'INTC',  nm: 'Intel',                  lay: 'L1', seg: 'CPU / Foundry',   q: 42, g: 50, v: 75, aiq: 48, comp: 51.0, d7: -1.8, d30: -3.2, tier: 'low',    depr: -7, conv: 2, price: 31.20 },
  { tk: 'STX',   nm: 'Seagate Technology',     lay: 'L1', seg: 'Storage',         q: 58, g: 62, v: 70, aiq: 55, comp: 58.6, d7: +0.5, d30: +1.1, tier: 'low',    depr: null, conv: 3, price: 92.10 },

  // L2 HYPERSCALE
  { tk: 'GOOGL', nm: 'Alphabet',               lay: 'L2', seg: 'Cloud + Search',  q: 90, g: 78, v: 75, aiq: 74, comp: 77.7, d7: +0.4, d30: +2.6, tier: 'medium', depr: null, conv: 7, price: 178.40 },
  { tk: 'MSFT',  nm: 'Microsoft',              lay: 'L2', seg: 'Cloud / Copilot', q: 92, g: 80, v: 60, aiq: 78, comp: 76.0, d7: +0.6, d30: +1.4, tier: 'medium', depr: null, conv: 7, price: 432.10 },
  { tk: 'AMZN',  nm: 'Amazon',                 lay: 'L2', seg: 'AWS',             q: 78, g: 76, v: 62, aiq: 72, comp: 71.2, d7: -0.2, d30: +1.0, tier: 'medium', depr: null, conv: 6, price: 198.60 },
  { tk: 'META',  nm: 'Meta Platforms',         lay: 'L2', seg: 'Inference Hyper', q: 80, g: 78, v: 64, aiq: 65, comp: 61.4, d7: +0.0, d30: +0.6, tier: 'medium', depr: null, conv: 5, price: 562.30 },
  { tk: 'ORCL',  nm: 'Oracle',                 lay: 'L2', seg: 'Cloud / Capex',   q: 70, g: 72, v: 58, aiq: 60, comp: 64.0, d7: +1.6, d30: +3.4, tier: 'medium', depr: null, conv: 5, price: 168.90 },
  { tk: 'IBM',   nm: 'IBM',                    lay: 'L2', seg: 'Hybrid / WatsonX',q: 64, g: 50, v: 68, aiq: 55, comp: 58.4, d7: -0.3, d30: -1.0, tier: 'low',    depr: null, conv: 3, price: 218.20 },
  { tk: 'BABA',  nm: 'Alibaba',                lay: 'L2', seg: 'Cloud (CN)',      q: 60, g: 58, v: 80, aiq: 55, comp: 57.8, d7: -0.8, d30: +0.4, tier: 'low',    depr: null, conv: 3, price: 84.70 },

  // L3 APPLICATION
  { tk: 'PLTR',  nm: 'Palantir',               lay: 'L3', seg: 'Gov / Foundry AI',q: 75, g: 88, v: 30, aiq: 80, comp: 64.4, d7: -1.8, d30: +1.2, tier: 'medium', depr: null, conv: 5, price: 27.40 },
  { tk: 'CRM',   nm: 'Salesforce',             lay: 'L3', seg: 'Agentforce',      q: 78, g: 65, v: 60, aiq: 60, comp: 64.2, d7: +0.6, d30: +1.5, tier: 'medium', depr: null, conv: 4, price: 312.40 },
  { tk: 'NOW',   nm: 'ServiceNow',             lay: 'L3', seg: 'Workflow AI',     q: 84, g: 78, v: 50, aiq: 70, comp: 70.4, d7: +1.4, d30: +2.6, tier: 'medium', depr: null, conv: 6, price: 890.50 },
  { tk: 'SNOW',  nm: 'Snowflake',              lay: 'L3', seg: 'Data Platform',   q: 65, g: 72, v: 48, aiq: 62, comp: 62.0, d7: -0.4, d30: -0.8, tier: 'medium', depr: null, conv: 4, price: 145.20 },
  { tk: 'DDOG',  nm: 'Datadog',                lay: 'L3', seg: 'AI Observability',q: 72, g: 80, v: 50, aiq: 64, comp: 66.0, d7: +0.8, d30: +1.1, tier: 'medium', depr: null, conv: 5, price: 122.80 },
  { tk: 'CRWD',  nm: 'CrowdStrike',            lay: 'L3', seg: 'AI Security',     q: 78, g: 82, v: 45, aiq: 60, comp: 64.6, d7: -0.2, d30: +2.0, tier: 'medium', depr: null, conv: 5, price: 348.20 },
  { tk: 'ADBE',  nm: 'Adobe',                  lay: 'L3', seg: 'Creative AI',     q: 82, g: 60, v: 62, aiq: 58, comp: 62.8, d7: -0.4, d30: -1.6, tier: 'medium', depr: null, conv: 4, price: 525.10 },
  { tk: 'GTLB',  nm: 'GitLab',                 lay: 'L3', seg: 'DevSec AI',       q: 60, g: 70, v: 52, aiq: 55, comp: 57.8, d7: +0.0, d30: +0.4, tier: 'low',    depr: null, conv: 3, price: 60.40 },
  { tk: 'TWLO',  nm: 'Twilio',                 lay: 'L3', seg: 'AI CPaaS',        q: 52, g: 50, v: 64, aiq: 45, comp: 53.0, d7: -0.6, d30: -1.4, tier: 'low',    depr: -5, conv: 2, price: 68.20 },
  { tk: 'AI',    nm: 'C3.ai',                  lay: 'L3', seg: 'Vertical AI',     q: 30, g: 45, v: 30, aiq: 38, comp: 36.0, d7: -2.4, d30: -8.0, tier: 'avoid',  depr: -10, conv: 1, price: 19.40 },

  // L4 POWER
  { tk: 'VST',   nm: 'Vistra',                 lay: 'L4', seg: 'IPP / Nuclear',   q: 78, g: 88, v: 70, aiq: 78, comp: 77.7, d7: +2.4, d30: +5.5, tier: 'medium', depr: null, conv: 7, price: 121.40 },
  { tk: 'GEV',   nm: 'GE Vernova',             lay: 'L4', seg: 'Grid / Gas Turb', q: 82, g: 90, v: 60, aiq: 78, comp: 77.6, d7: +1.5, d30: +4.0, tier: 'medium', depr: null, conv: 7, price: 530.20 },
  { tk: 'CEG',   nm: 'Constellation Energy',   lay: 'L4', seg: 'Nuclear Fleet',   q: 80, g: 78, v: 65, aiq: 78, comp: 74.6, d7: +0.2, d30: +2.6, tier: 'medium', depr: null, conv: 7, price: 268.40 },
  { tk: 'NRG',   nm: 'NRG Energy',             lay: 'L4', seg: 'Retail Power',    q: 70, g: 68, v: 72, aiq: 65, comp: 68.8, d7: +0.4, d30: +1.2, tier: 'medium', depr: null, conv: 5, price: 102.30 },
  { tk: 'ETR',   nm: 'Entergy',                lay: 'L4', seg: 'Utility (Reg)',   q: 76, g: 60, v: 70, aiq: 60, comp: 66.2, d7: -0.2, d30: +0.6, tier: 'medium', depr: null, conv: 4, price: 132.50 },
  { tk: 'SO',    nm: 'Southern Company',       lay: 'L4', seg: 'Utility / Voglt', q: 74, g: 58, v: 70, aiq: 60, comp: 64.8, d7: +0.0, d30: +0.4, tier: 'medium', depr: null, conv: 4, price: 88.10 },
  { tk: 'D',     nm: 'Dominion Energy',        lay: 'L4', seg: 'Utility',         q: 72, g: 56, v: 72, aiq: 58, comp: 63.4, d7: -0.1, d30: +0.2, tier: 'medium', depr: null, conv: 4, price: 56.80 },
  { tk: 'TLN',   nm: 'Talen Energy',           lay: 'L4', seg: 'Nuclear / PPA',   q: 64, g: 78, v: 55, aiq: 72, comp: 67.2, d7: +1.0, d30: +2.8, tier: 'medium', depr: null, conv: 5, price: 215.40 },
  { tk: 'BE',    nm: 'Bloom Energy',           lay: 'L4', seg: 'Fuel Cell',       q: 48, g: 70, v: 38, aiq: 52, comp: 52.4, d7: -0.6, d30: -2.0, tier: 'low',    depr: -6, conv: 2, price: 18.80 },
  { tk: 'PCG',   nm: 'PG&E',                   lay: 'L4', seg: 'Utility (CA)',    q: 60, g: 60, v: 65, aiq: 50, comp: 58.5, d7: -0.4, d30: -0.6, tier: 'low',    depr: null, conv: 3, price: 18.20 },
  { tk: 'SMR',   nm: 'NuScale Power',          lay: 'L4', seg: 'SMR (Early)',     q: 32, g: 60, v: 22, aiq: 48, comp: 40.6, d7: -1.4, d30: -4.2, tier: 'avoid',  depr: -8, conv: 1, price: 9.40 },

  // L5 ADJACENTS
  { tk: 'EMR',   nm: 'Emerson Electric',       lay: 'L5', seg: 'Automation',      q: 76, g: 64, v: 70, aiq: 64, comp: 67.6, d7: +0.4, d30: +1.4, tier: 'medium', depr: null, conv: 5, price: 122.60 },
  { tk: 'ETN',   nm: 'Eaton',                  lay: 'L5', seg: 'Power Mgmt',      q: 82, g: 72, v: 60, aiq: 70, comp: 71.4, d7: +0.6, d30: +1.8, tier: 'medium', depr: null, conv: 6, price: 358.40 },
  { tk: 'PWR',   nm: 'Quanta Services',        lay: 'L5', seg: 'Grid Build',      q: 78, g: 78, v: 56, aiq: 70, comp: 70.4, d7: +0.8, d30: +2.2, tier: 'medium', depr: null, conv: 6, price: 314.20 },
  { tk: 'PH',    nm: 'Parker Hannifin',        lay: 'L5', seg: 'Industrials',     q: 78, g: 64, v: 65, aiq: 60, comp: 66.6, d7: +0.2, d30: +0.6, tier: 'medium', depr: null, conv: 4, price: 632.40 },
  { tk: 'DOV',   nm: 'Dover',                  lay: 'L5', seg: 'Thermal Mgmt',    q: 72, g: 60, v: 65, aiq: 58, comp: 63.6, d7: +0.0, d30: +0.4, tier: 'medium', depr: null, conv: 4, price: 195.30 },
  { tk: 'VRT',   nm: 'Vertiv',                 lay: 'L5', seg: 'DC Thermal',      q: 70, g: 90, v: 50, aiq: 75, comp: 71.0, d7: +1.8, d30: +5.2, tier: 'medium', depr: null, conv: 6, price: 105.20 },
  { tk: 'JCI',   nm: 'Johnson Controls',       lay: 'L5', seg: 'DC HVAC',         q: 64, g: 60, v: 64, aiq: 55, comp: 61.6, d7: +0.2, d30: +0.8, tier: 'medium', depr: null, conv: 3, price: 78.40 },
  { tk: 'CARR',  nm: 'Carrier Global',         lay: 'L5', seg: 'DC HVAC',         q: 66, g: 62, v: 62, aiq: 55, comp: 61.2, d7: +0.0, d30: +0.4, tier: 'medium', depr: null, conv: 3, price: 76.80 },
  { tk: 'NVT',   nm: 'nVent',                  lay: 'L5', seg: 'Enclosures',      q: 70, g: 72, v: 58, aiq: 62, comp: 65.4, d7: +0.4, d30: +1.2, tier: 'medium', depr: null, conv: 4, price: 88.40 },
  { tk: 'HUBB',  nm: 'Hubbell',                lay: 'L5', seg: 'Electrical',      q: 74, g: 62, v: 60, aiq: 58, comp: 63.4, d7: +0.1, d30: +0.4, tier: 'medium', depr: null, conv: 4, price: 422.40 },

  // additional names to round out ~70
  { tk: 'AAPL',  nm: 'Apple',                  lay: 'L3', seg: 'On-Device AI',    q: 86, g: 50, v: 56, aiq: 52, comp: 60.4, d7: -1.2, d30: -2.4, tier: 'low',    depr: null, conv: 3, price: 218.10 },
  { tk: 'TSLA',  nm: 'Tesla',                  lay: 'L3', seg: 'AV / Robotics',   q: 56, g: 70, v: 30, aiq: 55, comp: 52.8, d7: -0.8, d30: -3.0, tier: 'low',    depr: -7, conv: 2, price: 188.30 },
  { tk: 'SMCI',  nm: 'Super Micro',            lay: 'L1', seg: 'AI Servers',      q: 50, g: 78, v: 48, aiq: 62, comp: 59.6, d7: -2.0, d30: -6.4, tier: 'low',    depr: -9, conv: 2, price: 41.80 },
  { tk: 'DELL',  nm: 'Dell Technologies',      lay: 'L1', seg: 'AI Servers',      q: 64, g: 76, v: 60, aiq: 64, comp: 65.8, d7: +0.4, d30: +1.1, tier: 'medium', depr: null, conv: 4, price: 118.50 },
  { tk: 'HPE',   nm: 'HP Enterprise',          lay: 'L1', seg: 'AI Servers',      q: 56, g: 60, v: 68, aiq: 52, comp: 58.4, d7: -0.2, d30: -0.4, tier: 'low',    depr: null, conv: 3, price: 21.40 },
  { tk: 'CSCO',  nm: 'Cisco',                  lay: 'L1', seg: 'Networking',      q: 76, g: 50, v: 70, aiq: 60, comp: 64.0, d7: +0.0, d30: +0.6, tier: 'medium', depr: null, conv: 4, price: 58.10 },
  { tk: 'JNPR',  nm: 'Juniper Networks',       lay: 'L1', seg: 'Networking',      q: 60, g: 50, v: 68, aiq: 48, comp: 56.4, d7: -0.1, d30: +0.2, tier: 'low',    depr: null, conv: 3, price: 38.20 },
  { tk: 'WDC',   nm: 'Western Digital',        lay: 'L1', seg: 'Storage',         q: 52, g: 60, v: 70, aiq: 50, comp: 56.6, d7: +0.6, d30: +1.4, tier: 'low',    depr: null, conv: 3, price: 64.30 },
  { tk: 'NTAP',  nm: 'NetApp',                 lay: 'L1', seg: 'Storage',         q: 64, g: 50, v: 68, aiq: 52, comp: 58.6, d7: -0.4, d30: -0.6, tier: 'low',    depr: null, conv: 3, price: 105.40 },
  { tk: 'PANW',  nm: 'Palo Alto Networks',     lay: 'L3', seg: 'AI Security',     q: 78, g: 76, v: 50, aiq: 62, comp: 65.6, d7: +0.4, d30: +1.6, tier: 'medium', depr: null, conv: 5, price: 322.10 },
  { tk: 'ZS',    nm: 'Zscaler',                lay: 'L3', seg: 'AI Security',     q: 66, g: 78, v: 48, aiq: 60, comp: 62.2, d7: +0.2, d30: +1.0, tier: 'medium', depr: null, conv: 4, price: 188.40 },
  { tk: 'OKLO',  nm: 'Oklo',                   lay: 'L4', seg: 'SMR (Early)',     q: 22, g: 75, v: 18, aiq: 50, comp: 38.8, d7: -1.8, d30: -5.6, tier: 'avoid',  depr: -10, conv: 1, price: 12.10 },
  { tk: 'IONQ',  nm: 'IonQ',                   lay: 'L3', seg: 'Quantum (Spec)',  q: 18, g: 60, v: 15, aiq: 40, comp: 32.8, d7: -2.0, d30: -7.4, tier: 'avoid',  depr: -10, conv: 1, price: 9.80 },
];

// Add sparkline data to each
window.UNIVERSE.forEach((u, i) => {
  u.sparkScore = seriesFor(u.tk.charCodeAt(0) * 13 + i, 12, u.comp, 4, u.d7 > 0 ? 0.2 : u.d7 < 0 ? -0.2 : 0);
  u.sparkPrice = seriesFor(u.tk.charCodeAt(0) * 17 + i, 24, u.price, u.price * 0.04, u.d30 > 0 ? u.price * 0.001 : -u.price * 0.001);
});

// Portfolio — 12 positions, $80K deployed, $20K reserve
window.PORTFOLIO = {
  value: 87420.50,
  cash: 13420.50,         // includes reserve + cash drift
  reserve: 20000,
  deployed: 80000,
  costBasis: 80000,
  dayPnl: 1240.30,
  dayPct: 1.44,
  ret30d: 4.81,
  spyRet30d: 1.20,
  alphaBps: 449,
  positions: [
    { tk: 'TSM',   sh: 59,  cost: 185, px: 194.30, pct: 11.5 },
    { tk: 'GOOGL', sh: 58,  cost: 172, px: 178.40, pct: 10.4 },
    { tk: 'NVDA',  sh: 10,  cost: 885, px: 920.10, pct: 9.2 },
    { tk: 'VST',   sh: 67,  cost: 112, px: 121.40, pct: 8.1 },
    { tk: 'GEV',   sh: 13,  cost: 510, px: 530.20, pct: 6.9 },
    { tk: 'ASML',  sh: 7,   cost: 920, px: 940.00, pct: 6.5 },
    { tk: 'AVGO',  sh: 4,   cost: 1580, px: 1612.50, pct: 6.5 },
    { tk: 'CEG',   sh: 24,  cost: 256, px: 268.40, pct: 6.4 },
    { tk: 'NOW',   sh: 7,   cost: 855, px: 890.50, pct: 6.2 },
    { tk: 'MSFT',  sh: 13,  cost: 422, px: 432.10, pct: 5.6 },
    { tk: 'ANET',  sh: 14,  cost: 360, px: 372.10, pct: 5.2 },
    { tk: 'VRT',   sh: 30,  cost: 96,  px: 105.20, pct: 3.2 },
  ],
};

// Macro gauges
window.MACRO = {
  naaim:    { value: 96.67, delta: +3.07, deltaLabel: 'wk', threshold: 90, max: 100, min: 0, dir: 'top', hit: true,  hitText: 'GATE HIT  >90 top decile' },
  aaii:     { value: +5.36, delta: -0.92, deltaLabel: 'wk', threshold: 30, max: 50, min: -30, dir: 'bothSpread', hit: false, hitText: 'In range' },
  fearGreed:{ value: 66,    delta: +4,    deltaLabel: 'd', threshold: 80,  max: 100, min: 0, dir: 'top', hit: false, hitText: 'Greed (not gate)' },
  multiplier: 0.95,
  gatesHit: 1,
  gatesTotal: 3,
};

// AIQ Rubric — TSM
window.AIQ_TSM = {
  ticker: 'TSM',
  scoredAt: 'May 15, 2026',
  dims: [
    {
      key: 'disclosure',
      title: 'Disclosure',
      max: 20,
      score: 18,
      notes: 'HPC segment explicit at 61% of revenue per Q1 2026 earnings. Management broke out AI-related revenue in 10-Q footnote for first time.',
      sourceUrl: 'tsmc.com/ir/q1-2026',
    },
    {
      key: 'defensibility',
      title: 'Defensibility',
      max: 20,
      score: 18,
      notes: 'Leading-edge EUV monopoly; 2nm ramp on schedule. ASML high-NA backlog booked through 2028. No credible competitor at sub-3nm.',
      sourceUrl: 'asml.com/q1-26-transcript',
    },
    {
      key: 'concentration',
      title: 'Concentration',
      max: 15,
      score: 12,
      notes: 'NVDA, AAPL together = 38% of revenue. AMD, AVGO, INTC each <10%. Customer concentration material but diversifying.',
      sourceUrl: 'tsmc.com/10k-2025',
    },
    {
      key: 'capex',
      title: 'Capex efficiency',
      max: 15,
      score: 15,
      notes: '2026 capex guided $44B, ROIC 28% on trailing-3yr. Best-in-class capex-to-revenue conversion among foundries.',
      sourceUrl: 'sec.gov/edgar/tsmc-20-F',
    },
    {
      key: 'demand',
      title: 'Independent demand',
      max: 15,
      score: 14,
      notes: 'Tied to NVDA / AAPL but demand is end-customer (hyperscaler capex), not vendor-dependent. Cycle is structurally broader.',
      sourceUrl: 'tsmc.com/q4-25-transcript',
    },
    {
      key: 'accounting',
      title: 'Accounting',
      max: 15,
      score: 15,
      notes: 'No restatements, no aggressive R&D capitalization. Burry depreciation check: useful-life assumptions in-line with peers. No flags.',
      sourceUrl: 'sec.gov/edgar/tsmc-q1-26',
    },
  ],
  history: [
    { date: 'May 15', score: 92, delta: 0, note: 'current' },
    { date: 'Feb 14', score: 91, delta: +1, note: 'HPC mix 58% → 61%' },
    { date: 'Nov 14', score: 88, delta: +3, note: 'N2 ramp on schedule' },
    { date: 'Aug 15', score: 85, delta: +2, note: 'CoWoS capacity 2x guide' },
    { date: 'May 14', score: 83, delta: 0, note: 'baseline' },
  ],
};

// Sub-factor data for tooltips
window.SUBFACTORS = {
  Q: { profitability: 90, growth: 92, safety: 92, payout: 94 },
  G: { revenueAccel: 88, marginExpansion: 86, capitalReturns: 90, capexDiscipline: 88 },
  V: { peNtm: 70, evEbitda: 76, fcfYield: 78, pegRatio: 76 },
  AIQ: { disclosure: 90, defensibility: 90, concentration: 80, capex: 100, demand: 93, accounting: 100 },
};

// Today's score movers (7d)
window.MOVERS = (() => {
  const u = window.UNIVERSE;
  return u
    .slice()
    .sort((a, b) => Math.abs(b.d7) - Math.abs(a.d7))
    .slice(0, 8)
    .map(t => {
      // pick driver
      const factors = [
        { name: 'Q', val: Math.round((Math.random() - 0.4) * 6 + t.d7 * 1.2) },
        { name: 'G', val: Math.round((Math.random() - 0.4) * 6 + t.d7 * 1.5) },
        { name: 'V', val: Math.round((Math.random() - 0.4) * 6 + t.d7 * 0.5) },
        { name: 'AIQ', val: Math.round((Math.random() - 0.4) * 4 + t.d7) },
      ];
      const driver = factors.sort((a, b) => Math.abs(b.val) - Math.abs(a.val))[0];
      return { ...t, driver };
    });
})();

// Regime gate-change history
window.REGIME_HISTORY = [
  { date: 'May 8',  event: 'NAAIM crossed 90',  from: '1.00×', to: '0.95×' },
  { date: 'Apr 2',  event: 'F&G dropped <20',   from: '0.95×', to: '1.00×' },
  { date: 'Mar 15', event: 'F&G crossed 20',    from: '0.90×', to: '0.95×' },
  { date: 'Mar 6',  event: 'AAII spread > 30',  from: '0.95×', to: '0.90×' },
  { date: 'Feb 18', event: 'NAAIM crossed 90',  from: '1.00×', to: '0.95×' },
];

// Daily insider activity
window.INSIDER_TODAY = [
  // empty — "none today"
];

// Recent score history per ticker (12-week)
window.SCORE_HISTORY_12W = (tk) => {
  const t = window.UNIVERSE.find(u => u.tk === tk);
  if (!t) return [];
  return seriesFor(tk.charCodeAt(0) * 7, 12, t.comp - (t.d7 * 1.5), 3, t.d7 > 0 ? 0.4 : -0.3);
};

// Activity log for /n/[ticker]
window.ACTIVITY = {
  TSM: [
    { date: 'May 14', kind: 'score', desc: 'Composite +3.1 (Q +5)' },
    { date: 'May 12', kind: 'rubric', desc: 'AIQ rubric +2 (defensibility 16→18)' },
    { date: 'May 08', kind: 'news', desc: 'Q1 print: +58% YoY profit; +revenue guide' },
    { date: 'Apr 16', kind: 'earnings', desc: 'Q1 2026 earnings released' },
    { date: 'Apr 10', kind: 'news', desc: 'AAPL adds A19 Pro orders for 2026 ramp' },
    { date: 'Mar 22', kind: 'rubric', desc: 'AIQ disclosure 16→18 (HPC % breakout)' },
  ],
};

// Macro trend data for /regime
window.MACRO_TREND = {
  weeks: 52,
  naaim: seriesFor(1, 52, 60, 18, 0.6),
  aaii:  seriesFor(2, 52, 0, 12, 0.05),
  fg:    seriesFor(3, 52, 55, 14, 0.1),
};

// Market indices strip
window.INDICES = [
  { label: 'S&P 500',    value: '5,742.18',  delta: '+0.18%',  tone: 'up' },
  { label: 'NASDAQ',     value: '18,924.50', delta: '+0.31%',  tone: 'up' },
  { label: 'UST 10Y',    value: '4.731',     delta: '−2 bps',  tone: 'down' },
  { label: 'Fed Funds',  value: '4.25–4.50', delta: 'unch.',   tone: 'flat' },
  { label: 'VIX',        value: '14.82',     delta: '−4.2%',   tone: 'down' },
  { label: 'DXY',        value: '102.41',    delta: '+0.18%',  tone: 'up' },
  { label: 'Regime',     value: 'Risk-on',   delta: '7d stable', tone: 'accent' },
];

// AIQ rubric agents (audit trail)
window.AIQ_AGENTS = [
  { name: 'Disclosure scanner',    status: 'done', timing: '12s' },
  { name: 'Defensibility crawler', status: 'done', timing: '24s' },
  { name: 'Concentration parser',  status: 'done', timing: '8s' },
  { name: 'Capex efficiency',      status: 'done', timing: '6s' },
  { name: 'Independent demand',    status: 'done', timing: '18s' },
  { name: 'Accounting (Burry)',    status: 'done', timing: '32s' },
  { name: 'Source verification',   status: 'done', timing: '4s' },
  { name: 'Rubric synthesis',      status: 'done', timing: '11s' },
];

// ─────────────────────────────────────────────────────────────────
// Bear cases per ticker (subset + fallback). Surfaced on hover and
// in memo detail. Drawn from §1.6 of spec.
// ─────────────────────────────────────────────────────────────────
window.BEAR_CASES = {
  TSM: {
    summary: 'Geopolitical tail + HPC digestion mid-cycle.',
    floorPrice: 152, floorPct: -22, invalidationProb: 'medium',
    args: [
      { title: 'Taiwan Strait risk', sev: 'serious', text: 'Singular geographic concentration of leading-edge fab capacity. Even a non-kinetic blockade freezes the global semiconductor supply chain.' },
      { title: 'HPC demand digestion', sev: 'moderate', text: 'Top-4 hyperscaler FY26 capex implies 38% AI infra growth. A pause in MSFT/META/GOOG/AMZN tightens the foundry book directly.' },
      { title: 'N2 yield risk', sev: 'moderate', text: '2nm ramp on schedule, but yield curves at sub-3nm compress. A 6-month slip shifts the customer roadmap and erodes high-end mix.' },
    ],
  },
  NVDA: {
    summary: 'Hyperscaler capex digestion + custom silicon attrition.',
    floorPrice: 720, floorPct: -22, invalidationProb: 'medium',
    args: [
      { title: 'Hyperscaler capex digestion', sev: 'serious', text: 'Top-4 FY26 capex implies 38% AI infra growth. A pause in any one tightens NVDA materially. The 2019 digestion year cost ~30% of peak multiple.' },
      { title: 'Custom silicon attrition', sev: 'serious', text: 'AWS Trainium 3 ships at scale Q3 2026; Google TPU v6 at ~22% internal training share. Each pp of substitution ≈ $1.4B of NVDA TAM.' },
      { title: 'China export controls', sev: 'moderate', text: 'BIS rules tightening expected late Q3 2026. China DC revenue ~9% of total. Full ban (low-prob, high-impact) caps the bull case.' },
    ],
  },
  ASML: {
    summary: 'High-NA adoption curve risk.',
    floorPrice: 720, floorPct: -23, invalidationProb: 'low',
    args: [
      { title: 'High-NA adoption slip', sev: 'serious', text: 'High-NA EUV tools shipping but customer absorption is slower than guided. Intel 18A and Samsung GAA timelines have both moved right.' },
      { title: 'China export', sev: 'moderate', text: 'BIS expanded controls bite ~15% of revenue. EU pushback insufficient to offset.' },
    ],
  },
  PLTR: {
    summary: 'Multiple compression on miss; commercial backlog softness.',
    floorPrice: 17, floorPct: -38, invalidationProb: 'high',
    args: [
      { title: 'Multiple compression', sev: 'serious', text: 'NTM P/S at 28× vs sector median 8×. Even a soft Q would compress to ~18× ≈ 35% drawdown.' },
      { title: 'Commercial AIP slowdown', sev: 'moderate', text: 'Commercial bookings decelerated in Q1. Sales cycle elongating; concentration in US Gov remains > 55%.' },
    ],
  },
  INTC: {
    summary: 'Foundry losses + dividend overhang.',
    floorPrice: 22, floorPct: -29, invalidationProb: 'low',
    args: [
      { title: '18A yield ramp', sev: 'serious', text: 'Foundry losses ~$3B/qtr. 18A ramp on schedule but external customer wins absent. Margin path requires near-perfect execution.' },
      { title: 'Dividend overhang', sev: 'moderate', text: 'Capital return commitment vs capex demand creates persistent dilution risk through 2027.' },
    ],
  },
};
window.bearCaseFor = (tk) => window.BEAR_CASES[tk] || {
  summary: 'Cycle normalization + execution risk for this layer.',
  floorPrice: 0, floorPct: -22, invalidationProb: 'medium',
  args: [
    { title: 'Cycle normalization', sev: 'moderate', text: 'AI capex cycle is structurally late. A 2× normalization toward 1.0× trend compresses earnings 25–35%.' },
    { title: 'Execution risk', sev: 'moderate', text: 'Position is not pricing in flat consensus revision; any miss vs guide compresses the multiple toward sector median.' },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Memos queue — pending approvals + recent decisions
// ─────────────────────────────────────────────────────────────────
window.MEMOS = [
  { id: 'BAS-0247', tk: 'NVDA', status: 'pending', ts: 'May 15, 14:18 CT', age: '2h 14m', trigger: 'Composite +1.2 7D · Δcomp drove Buy', triggerKind: 'score', rec: 'Buy',   conv: 8, targetPx: 1145, upside: +24.4, horizon: '12–18 mo', agents: 13, cost: 1.87, runtime: '4m 12s', llm: 'claude-sonnet-4.6' },
  { id: 'BAS-0246', tk: 'TSM',  status: 'pending', ts: 'May 15, 11:42 CT', age: '4h 51m', trigger: 'AIQ rubric +2 (defensibility 16→18)', triggerKind: 'rubric', rec: 'Buy',   conv: 9, targetPx: 240, upside: +23.5, horizon: '18–24 mo', agents: 13, cost: 1.91, runtime: '3m 48s', llm: 'claude-sonnet-4.6' },
  { id: 'BAS-0245', tk: 'PLTR', status: 'pending', ts: 'May 15, 09:33 CT', age: '8h 03m', trigger: 'Composite −1.8 7D · V −2 drove Hold', triggerKind: 'score', rec: 'Hold',  conv: 5, targetPx: 28,   upside: +2.2,  horizon: '6–12 mo',  agents: 13, cost: 1.62, runtime: '3m 56s', llm: 'claude-sonnet-4.6' },
  { id: 'BAS-0244', tk: 'VST',  status: 'approved', ts: 'May 14, 16:02 CT', age: '1d',   trigger: 'Composite +2.4 7D · power thesis', triggerKind: 'score', rec: 'Buy',   conv: 7, targetPx: 138,  upside: +13.7, horizon: '12 mo',    agents: 13, cost: 1.74, runtime: '4m 02s', rationale: 'Power thesis intact; adding 1.0% on print follow-through. Re-review at Aug print.', decidedBy: 'TT' },
  { id: 'BAS-0243', tk: 'INTC', status: 'rejected', ts: 'May 13, 09:14 CT', age: '2d',   trigger: 'Depreciation flag −7 confirmed',   triggerKind: 'flag',  rec: 'Avoid', conv: 2, targetPx: 28,   upside: -10.3, horizon: '—',         agents: 13, cost: 1.55, runtime: '3m 34s', rationale: 'Already underweight; no add. Hold avoid stance through 18A external customer signal.', decidedBy: 'TT' },
  { id: 'BAS-0242', tk: 'AMD',  status: 'approved', ts: 'May 12, 14:18 CT', age: '3d',   trigger: 'Δ7D −0.4, V +2 mid-cycle',         triggerKind: 'score', rec: 'Hold',  conv: 5, targetPx: 175,  upside: +7.8,  horizon: '12 mo',     agents: 13, cost: 1.68, runtime: '3m 51s', rationale: 'Maintain 1.5% weight; await Q2 print and MI400 traction signal.', decidedBy: 'TT' },
  { id: 'BAS-0241', tk: 'CEG',  status: 'approved', ts: 'May 11, 10:42 CT', age: '4d',   trigger: 'AIQ +1 (independent demand)',      triggerKind: 'rubric',rec: 'Buy',   conv: 7, targetPx: 290,  upside: +8.1,  horizon: '18 mo',     agents: 13, cost: 1.71, runtime: '3m 47s', rationale: 'Nuclear thesis confirmed; +0.5% to 6.5% weight. Reserve held for ETR.', decidedBy: 'TT' },
  { id: 'BAS-0240', tk: 'SMCI', status: 'rejected', ts: 'May 09, 11:21 CT', age: '6d',   trigger: 'Depreciation flag −9 (Burry)',     triggerKind: 'flag',  rec: 'Avoid', conv: 1, targetPx: 38,   upside: -9.1,  horizon: '—',         agents: 13, cost: 1.49, runtime: '3m 28s', rationale: 'Accounting concerns confirmed; no portfolio entry.', decidedBy: 'TT' },
];

// Memo agent pipeline (drawn from v4 mockup)
window.MEMO_AGENTS = [
  { name: 'Company Research',    model: 'Sonar Pro',    cost: 0.14, status: 'done', timing: '18s' },
  { name: 'SEC Filing Analyst',  model: 'Gemini 2.5',   cost: 0.21, status: 'done', timing: '34s' },
  { name: 'Earnings Transcript', model: 'Gemini 2.5',   cost: 0.18, status: 'done', timing: '28s' },
  { name: 'Financial Statement', model: 'GPT-5',        cost: 0.22, status: 'done', timing: '24s' },
  { name: 'Valuation',           model: 'GPT-5',        cost: 0.19, status: 'done', timing: '22s' },
  { name: 'Technical Analysis',  model: 'Sonnet 4.6',   cost: 0.02, status: 'done', timing: '6s'  },
  { name: 'News & Catalyst',     model: 'Sonar Pro',    cost: 0.11, status: 'done', timing: '14s' },
  { name: 'Insider Activity',    model: 'Sonnet 4.6',   cost: 0.04, status: 'flag', timing: '8s'  },
  { name: 'Sector & Macro',      model: 'Sonar Pro',    cost: 0.09, status: 'done', timing: '12s' },
  { name: 'Bear Case',           model: 'Sonnet 4.6',   cost: 0.08, status: 'done', timing: '16s' },
  { name: 'Memo Synthesis',      model: 'Sonnet 4.6',   cost: 0.14, status: 'done', timing: '22s' },
  { name: 'Risk Review',         model: 'Sonnet 4.6',   cost: 0.08, status: 'done', timing: '10s' },
  { name: 'Trigger Evaluator',   model: 'deterministic',cost: 0.00, status: 'done', timing: '1s'  },
];

// ─────────────────────────────────────────────────────────────────
// Backtest — 30 months of strategy vs SPY (Jan 2024 → May 2026)
// ─────────────────────────────────────────────────────────────────
window.BACKTEST = (() => {
  const months = ['Jan 24','Feb 24','Mar 24','Apr 24','May 24','Jun 24','Jul 24','Aug 24','Sep 24','Oct 24','Nov 24','Dec 24','Jan 25','Feb 25','Mar 25','Apr 25','May 25','Jun 25','Jul 25','Aug 25','Sep 25','Oct 25','Nov 25','Dec 25','Jan 26','Feb 26','Mar 26','Apr 26','May 26'];
  // hand-tuned values: strategy +84% (with 2 drawdowns), SPY +37%
  const strat = [100, 103, 108, 112, 115, 120, 124, 113, 119, 128, 135, 142, 138, 132, 128, 134, 140, 148, 156, 152, 145, 138, 152, 160, 167, 172, 178, 181, 184];
  const spy   = [100, 102, 104, 105, 106, 109, 111, 108, 112, 115, 118, 121, 119, 116, 118, 121, 124, 126, 127, 125, 124, 122, 127, 131, 132, 134, 135, 136, 137];
  return {
    months, strategy: strat, spy,
    metrics: {
      totalReturn: 84.0, spyReturn: 37.0, alpha: 4700,
      sharpe: 1.42, spySharpe: 0.81, maxDD: -14.2, spyMaxDD: -10.4,
      hitRate: 62.4, avgTradeR: 1.84, trades: 184, winners: 115,
    },
    drawdowns: [
      { from: 'Jul 24', to: 'Oct 24', dd: -8.4,  recovered: 'Nov 24' },
      { from: 'Jan 25', to: 'Mar 25', dd: -8.6,  recovered: 'Apr 25' },
      { from: 'Aug 25', to: 'Oct 25', dd: -14.2, recovered: 'Dec 25' },
    ],
  };
})();

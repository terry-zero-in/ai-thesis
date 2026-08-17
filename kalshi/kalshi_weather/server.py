"""Local dashboard + scheduler: the paper system running live on this machine.

`python3 -m kalshi_weather dashboard` (or `python3 kalshi/serve.py` from the
repo root) starts one process that
  - runs `cycle` every 30 minutes and `settle` every 6 hours (both once at
    startup) on a background thread, and
  - serves a read-mostly dashboard at http://127.0.0.1:8765 rendering the
    ledger: gate status, open paper quotes, last cycle's pricing sheet,
    the rules-review queue, and settlements.

Bound to 127.0.0.1 ONLY — never exposed beyond this machine. The two POST
endpoints trigger the same paper cycle/settle the CLI runs; there is nothing
else to trigger. Stopping the process stops the loop; the ledger keeps state.
"""
import datetime
import html as html_mod
import json
import os
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from . import gate, kalshi_api, ledger, shadow
from .config import Config


class Runtime:
    """In-memory state shared between the scheduler thread and the handler."""

    def __init__(self):
        self.lock = threading.Lock()
        self.running = None          # None | "cycle" | "settle"
        self.request_cycle = False
        self.request_settle = False
        self.last_cycle_epoch = 0.0
        self.last_settle_epoch = 0.0
        self.last_cycle_ts = None
        self.last_settle_note = None
        self.last_cycle_note = None
        self.regime = None
        self.priced = []
        self.scans = []
        self.skipped = []
        self.errors = []             # last few (ts, msg)

    def note_error(self, msg: str) -> None:
        self.errors = ([(datetime.datetime.now(datetime.timezone.utc)
                         .strftime("%H:%MZ"), str(msg)[:200])] + self.errors)[:5]


def _open_conn(cfg: Config) -> sqlite3.Connection:
    os.makedirs(cfg.data_dir, exist_ok=True)
    conn = sqlite3.connect(cfg.ledger_path, timeout=10)
    ledger.init(conn)
    return conn


def _do_cycle(cfg: Config, rt: Runtime, client_factory) -> None:
    if not rt.lock.acquire(blocking=False):
        return
    rt.running = "cycle"
    try:
        conn = _open_conn(cfg)
        s = shadow.run_cycle(conn, cfg, client_factory())
        conn.close()
        rt.last_cycle_ts = s["ts"]
        rt.regime = s["regime"]
        rt.priced = s["priced"]
        rt.scans = s["scans"]
        rt.skipped = s["skipped"]
        rt.last_cycle_note = (f"priced {len(s['priced'])} · placed {s['placed']} · "
                              f"filled {s['filled']} · cancelled {s['cancelled']} · "
                              f"expired {s['expired']}")
    except Exception as e:
        rt.note_error(f"cycle: {e}")
    finally:
        rt.running = None
        rt.lock.release()


def _do_settle(cfg: Config, rt: Runtime, client_factory) -> None:
    if not rt.lock.acquire(blocking=False):
        return
    rt.running = "settle"
    try:
        conn = _open_conn(cfg)
        s = shadow.settle_cycle(conn, cfg, client_factory())
        conn.close()
        rt.last_settle_note = (f"settlements {s['settlements']} · results {s['results']} · "
                               f"refit pairs {s['refit']['pairs']}")
    except Exception as e:
        rt.note_error(f"settle: {e}")
    finally:
        rt.running = None
        rt.lock.release()


def scheduler_loop(cfg: Config, rt: Runtime, client_factory,
                   cycle_interval_s: float, settle_interval_s: float,
                   stop_event: threading.Event) -> None:
    while not stop_event.wait(2.0):
        now = time.time()
        if rt.request_cycle or now - rt.last_cycle_epoch >= cycle_interval_s:
            rt.request_cycle = False
            _do_cycle(cfg, rt, client_factory)
            rt.last_cycle_epoch = time.time()
        if rt.request_settle or now - rt.last_settle_epoch >= settle_interval_s:
            rt.request_settle = False
            _do_settle(cfg, rt, client_factory)
            rt.last_settle_epoch = time.time()


# ---------------------------------------------------------------- state/view

def build_state(conn: sqlite3.Connection, cfg: Config, rt: Runtime) -> dict:
    report = gate.evaluate(conn, cfg)
    open_quotes = ledger.open_quotes(conn)
    recent = conn.execute(
        """SELECT ts, ticker, side, price_c, size, model_p, mkt_implied_p,
                  edge_net_c, status FROM quotes ORDER BY id DESC LIMIT 20""").fetchall()
    scans = ledger.pending_scans(conn)
    settlements = conn.execute(
        """SELECT station, date, high_f, source FROM settlements
           ORDER BY date DESC LIMIT 10""").fetchall()
    priced = sorted(
        rt.priced,
        key=lambda r: abs(r["p"] - ((r["yes_bid"] + r["yes_ask"]) / 200.0))
        if r["yes_bid"] is not None and r["yes_ask"] is not None else 0.0,
        reverse=True)
    return {
        "gate": report,
        "open_quotes": open_quotes,
        "recent": recent,
        "scans": scans,
        "settlements": settlements,
        "priced": priced,
        "runtime": {
            "running": rt.running,
            "last_cycle_ts": rt.last_cycle_ts,
            "last_cycle_note": rt.last_cycle_note,
            "last_settle_note": rt.last_settle_note,
            "regime": rt.regime,
            "skipped": rt.skipped,
            "errors": rt.errors,
        },
        "config": {"cap_usd": cfg.market_cap_cents / 100,
                   "bankroll_usd": cfg.bankroll_cents / 100,
                   "min_edge_c": cfg.min_edge_cents,
                   "tail_band_c": cfg.max_quote_price_cents,
                   "agreement_max": cfg.agreement_max},
    }


def _esc(v) -> str:
    return html_mod.escape(str(v))


def _pct(p) -> str:
    return "—" if p is None else f"{p * 100:.1f}%"


_CSS = """
:root{--bg:#0A0A0A;--s1:#111113;--card:#1B1D1E;--line:rgba(255,255,255,.08);
--tx:#E7E9EA;--mut:#8B8FA3;--acc:#4F6BD6;--grn:#3FB68B;--amb:#D9A03F;--rose:#E5484D;
--mono:ui-monospace,'SF Mono','JetBrains Mono',Menlo,monospace}
*{box-sizing:border-box;margin:0}
body{background:var(--bg);color:var(--tx);font:14px/1.45 Inter,-apple-system,'Segoe UI',sans-serif;padding:0 0 48px}
header{display:flex;align-items:center;gap:12px;padding:14px 24px;border-bottom:1px solid var(--line);background:var(--s1);position:sticky;top:0}
.brand{font-weight:650;letter-spacing:.02em}
.chip{font-size:11px;letter-spacing:.08em;text-transform:uppercase;padding:3px 9px;border-radius:99px;border:1px solid var(--line);color:var(--mut)}
.chip.paper{color:var(--amb);border-color:rgba(217,160,63,.4)}
.chip.pass{color:var(--grn);border-color:rgba(63,182,139,.4)}
.chip.notyet{color:var(--mut)}
.chip.run{color:var(--acc);border-color:rgba(79,107,214,.45)}
.spacer{flex:1}
form{display:inline}
button{background:var(--card);color:var(--tx);border:1px solid var(--line);border-radius:6px;padding:6px 12px;font:12px Inter,sans-serif;cursor:pointer}
button:hover{border-color:var(--acc);color:var(--acc)}
main{max-width:1180px;margin:24px auto;padding:0 24px;display:grid;gap:20px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px 16px}
.k{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin-bottom:6px}
.v{font-family:var(--mono);font-size:20px}
.v small{font-size:12px;color:var(--mut)}
.bar{height:4px;background:var(--s1);border-radius:2px;margin-top:10px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--acc)}
section h2{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--mut);margin:0 0 10px}
table{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden}
th{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--mut);text-align:left;padding:8px 12px;border-bottom:1px solid var(--line);background:var(--s1)}
td{padding:7px 12px;border-bottom:1px solid var(--line);font-family:var(--mono);font-size:12.5px;font-variant-numeric:tabular-nums}
tr:last-child td{border-bottom:0}
.pos{color:var(--grn)}.neg{color:var(--rose)}.dim{color:var(--mut)}
.reasons li{color:var(--mut);font-size:13px;margin:3px 0 0 18px}
footer{max-width:1180px;margin:28px auto 0;padding:0 24px;color:var(--mut);font-size:12px}
.badge-yes{color:var(--grn)}.badge-no{color:var(--rose)}
"""


def render_page(state: dict) -> str:
    g = state["gate"]
    rt = state["runtime"]
    verdict_cls = "pass" if g["verdict"] == "PASS" else "notyet"
    running = rt["running"]
    parts = [f"""<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="refresh" content="60">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kalshi Weather — Paper Shadow</title><style>{_CSS}</style></head><body>
<header>
  <span class="brand">KALSHI WEATHER</span>
  <span class="chip paper">Paper mode</span>
  <span class="chip {verdict_cls}">Gate: {_esc(g['verdict'])}</span>
  {f'<span class="chip run">{_esc(running)} running…</span>' if running else ''}
  <span class="spacer"></span>
  <span class="chip">{_esc(rt['last_cycle_ts'] or 'no cycle yet')}</span>
  <form method="post" action="/run/cycle"><button>Run cycle now</button></form>
  <form method="post" action="/run/settle"><button>Run settle now</button></form>
</header><main>"""]

    # gate cards
    brier = ("—" if g["brier_ours"] is None
             else f"{g['brier_ours']:.4f} <small>vs {g['brier_market']:.4f} mkt</small>")
    pnl = g["pnl_after_fees_c"] / 100
    pnl_cls = "pos" if pnl > 0 else ("neg" if pnl < 0 else "")
    win_pct = min(100, int(100 * g["window_days"] / 30)) if g["window_days"] else 0
    fill_pct = min(100, int(100 * g["n_settled"] / 20)) if g["n_settled"] else 0
    parts.append(f"""
<section><h2>Calibration gate — 30-day paper record</h2>
<div class="cards">
 <div class="card"><div class="k">Window</div><div class="v">{g['window_days']}<small> / 30 days</small></div><div class="bar"><i style="width:{win_pct}%"></i></div></div>
 <div class="card"><div class="k">Settled fills</div><div class="v">{g['n_settled']}<small> / 20 required</small></div><div class="bar"><i style="width:{fill_pct}%"></i></div></div>
 <div class="card"><div class="k">Brier (ours vs market)</div><div class="v">{brier}</div></div>
 <div class="card"><div class="k">Paper PnL after fees</div><div class="v {pnl_cls}">${pnl:,.2f}</div></div>
</div>
<ul class="reasons">{''.join(f'<li>{_esc(r)}</li>' for r in g['reasons'])}</ul>
</section>""")

    # open quotes
    rows = "".join(
        f"<tr><td>{_esc(q['ticker'])}</td>"
        f"<td class=\"badge-{_esc(q['side'])}\">{_esc(q['side'].upper())}</td>"
        f"<td>{q['price_c']}¢ × {q['size']}</td>"
        f"<td>{_pct(q['model_p'])}</td><td>{_pct(q['mkt_implied_p'])}</td>"
        f"<td>{q['edge_net_c']:.1f}¢</td><td class=\"dim\">{_esc(q['ts'][11:16])}Z</td></tr>"
        for q in state["open_quotes"])
    parts.append(f"""
<section><h2>Open paper quotes ({len(state['open_quotes'])})</h2>
<table><tr><th>Market</th><th>Side</th><th>Resting</th><th>Model P(yes)</th>
<th>Market P(yes)</th><th>Net edge</th><th>Placed</th></tr>
{rows or '<tr><td class="dim" colspan="7">none — next cycle may place some</td></tr>'}</table>
</section>""")

    # priced sheet from last cycle
    prows = []
    for r in state["priced"][:20]:
        mid = ((r["yes_bid"] + r["yes_ask"]) / 200.0
               if r["yes_bid"] is not None and r["yes_ask"] is not None else None)
        div = (r["p"] - mid) * 100 if mid is not None else None
        div_txt = "—" if div is None else f"{div:+.1f}pts"
        div_cls = "dim" if div is None else ("pos" if abs(div) >= 5 else "")
        prows.append(
            f"<tr><td>{_esc(r['ticker'])}</td><td>{_pct(r['p'])}</td>"
            f"<td class=\"dim\">{_pct(r['p_gefs'])} / {_pct(r['p_ecmwf'])}</td>"
            f"<td>{r['agreement'] * 100:.1f}pts</td>"
            f"<td class=\"dim\">{r['yes_bid']}/{r['yes_ask']}¢</td>"
            f"<td class=\"{div_cls}\">{div_txt}</td></tr>")
    parts.append(f"""
<section><h2>Last cycle pricing — top divergences ({len(state['priced'])} markets priced)</h2>
<table><tr><th>Market</th><th>Model</th><th>GFS / ECMWF</th><th>Model gap</th>
<th>Book</th><th>vs market</th></tr>
{''.join(prows) or '<tr><td class="dim" colspan="6">no cycle in this server session yet</td></tr>'}</table>
</section>""")

    # review queue + settlements
    srows = "".join(
        f"<tr><td>{_esc(s['series'])}</td><td>{_esc(s['flag'])}</td>"
        f"<td>{s['divergence_pts']:.1f}pts</td><td>{_esc(s['status'])}</td>"
        f"<td class=\"dim\">{_esc(s['ts'][:16])}Z</td></tr>"
        for s in state["scans"][:8])
    strows = "".join(
        f"<tr><td>{_esc(st)}</td><td>{_esc(d)}</td><td>{h}°F</td>"
        f"<td class=\"dim\">{_esc(src)}</td></tr>"
        for st, d, h, src in state["settlements"])
    parts.append(f"""
<section><h2>Rules review queue ({len(state['scans'])})</h2>
<table><tr><th>Series</th><th>Flag</th><th>Divergence</th><th>Status</th><th>When</th></tr>
{srows or '<tr><td class="dim" colspan="5">queue empty</td></tr>'}</table>
</section>
<section><h2>Settlements (NWS daily-climate highs)</h2>
<table><tr><th>Station</th><th>Date</th><th>High</th><th>Source</th></tr>
{strows or '<tr><td class="dim" colspan="4">none yet — settle runs every 6h</td></tr>'}</table>
</section>""")

    notes = [rt["last_cycle_note"], rt["last_settle_note"], rt["regime"]]
    notes += [f"skipped: {s}" for s in (rt["skipped"] or [])[:4]]
    notes += [f"error {t}: {m}" for t, m in rt["errors"]]
    parts.append(
        "<section><h2>Runtime</h2><ul class=\"reasons\">"
        + "".join(f"<li>{_esc(n)}</li>" for n in notes if n)
        + "</ul></section>")

    parts.append(f"""</main><footer>Paper mode only — no live-trading path exists in this
codebase. Gate doctrine: 30-day Brier vs market after fees. Cap ${state['config']['cap_usd']:.0f}/market ·
min edge {state['config']['min_edge_c']}¢ · tail band ≤{state['config']['tail_band_c']}¢ ·
model-agreement gate {state['config']['agreement_max'] * 100:.0f}pts. Auto-refreshes every 60s.</footer>
</body></html>""")
    return "".join(parts)


# ---------------------------------------------------------------- http layer

def make_handler(cfg: Config, rt: Runtime):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):  # keep stdout for the scheduler
            pass

        def _send(self, code: int, body: bytes, ctype: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            try:
                conn = _open_conn(cfg)
                state = build_state(conn, cfg, rt)
                conn.close()
            except Exception as e:
                self._send(500, f"state error: {e}".encode(), "text/plain")
                return
            if self.path.startswith("/api/state"):
                self._send(200, json.dumps(state, default=str).encode(),
                           "application/json")
            else:
                self._send(200, render_page(state).encode(), "text/html; charset=utf-8")

        def do_POST(self):
            if self.path == "/run/cycle":
                rt.request_cycle = True
            elif self.path == "/run/settle":
                rt.request_settle = True
            self.send_response(303)
            self.send_header("Location", "/")
            self.end_headers()

    return Handler


def serve(cfg: Config, port: int, cycle_interval_s: float, settle_interval_s: float,
          client_factory=kalshi_api.Client) -> None:
    rt = Runtime()
    stop = threading.Event()
    threading.Thread(target=scheduler_loop, daemon=True,
                     args=(cfg, rt, client_factory, cycle_interval_s,
                           settle_interval_s, stop)).start()
    # 127.0.0.1 only — this dashboard must never be reachable off-machine
    httpd = ThreadingHTTPServer(("127.0.0.1", port), make_handler(cfg, rt))
    print(f"kalshi-weather paper dashboard: http://127.0.0.1:{port}")
    print(f"cycle every {cycle_interval_s / 60:.0f}m, settle every "
          f"{settle_interval_s / 3600:.0f}h (both run at startup). Ctrl-C stops.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        stop.set()
        httpd.shutdown()

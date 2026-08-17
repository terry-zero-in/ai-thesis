"""Minimal stdlib HTTP JSON client with retry/backoff. Read-only GETs only."""
import json
import os
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = "kalshi-weather-shadow/0.1 (paper-mode research)"


class HttpError(Exception):
    pass


def _ssl_context() -> ssl.SSLContext:
    """Default context, with a CA-bundle fallback for python.org macOS builds
    whose default verify path is empty (certifi if installed, else the OS
    bundle at /etc/ssl/cert.pem)."""
    ctx = ssl.create_default_context()
    if ctx.cert_store_stats().get("x509_ca", 0) == 0:
        try:
            import certifi
            ctx.load_verify_locations(certifi.where())
        except ImportError:
            for cand in ("/etc/ssl/cert.pem", "/etc/ssl/certs/ca-certificates.crt"):
                if os.path.exists(cand):
                    ctx.load_verify_locations(cand)
                    break
    return ctx


_SSL_CTX = _ssl_context()


def build_url(base: str, params: dict | None = None) -> str:
    if not params:
        return base
    return base + ("&" if "?" in base else "?") + urllib.parse.urlencode(params)


def get_json(url: str, params: dict | None = None, timeout: float = 25.0,
             retries: int = 3, backoff: float = 1.5):
    full = build_url(url, params)
    last = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(full, headers={"User-Agent": USER_AGENT,
                                                        "Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout, context=_SSL_CTX) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(backoff * (2 ** attempt))
                continue
            raise HttpError(f"GET {full} -> HTTP {e.code}") from e
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            last = e
            if attempt < retries - 1:
                time.sleep(backoff * (2 ** attempt))
                continue
            raise HttpError(f"GET {full} failed: {e}") from e
    raise HttpError(f"GET {full} failed: {last}")

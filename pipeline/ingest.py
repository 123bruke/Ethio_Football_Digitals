"""Bronze zone: download raw files immutably, record SHA-256 + timestamps (spec 7.3, 8.1)."""
import hashlib, json, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pipeline import config as C


def _fetch(season: str, league: str) -> dict:
    url = C.SOURCE_URL.format(season=season, league=league)
    dest = C.RAW_DIR / season / f"{league}.json"
    entry = {"season": season, "league": league, "url": url, "path": str(dest.relative_to(C.ROOT))}
    if dest.exists():  # bronze is immutable: never overwrite
        body = dest.read_bytes()
        entry.update(status="cached")
    else:
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:
                body = resp.read()
        except urllib.error.HTTPError as exc:
            return {**entry, "status": f"http_{exc.code}"}
        except Exception as exc:  # network failure is recorded, not hidden
            return {**entry, "status": f"error:{type(exc).__name__}"}
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(body)
        entry.update(status="downloaded", downloaded_at=datetime.now(timezone.utc).isoformat())
    entry.update(sha256=hashlib.sha256(body).hexdigest(), bytes=len(body))
    return entry


def ingest() -> dict:
    jobs = [(s, l) for s in C.SEASONS for l in C.LEAGUES]
    with ThreadPoolExecutor(max_workers=8) as pool:
        entries = list(pool.map(lambda j: _fetch(*j), jobs))
    manifest = {"source": C.SOURCE, "license": C.SOURCE_LICENSE, "run_at": datetime.now(timezone.utc).isoformat(),
                "files": entries, "failed": [e for e in entries if e["status"].startswith(("http_", "error"))]}
    C.LINEAGE_DIR.mkdir(parents=True, exist_ok=True)
    (C.LINEAGE_DIR / "bronze_manifest.json").write_text(json.dumps(manifest, indent=2))
    ok = len(entries) - len(manifest["failed"])
    print(f"bronze: {ok}/{len(entries)} files ok, {len(manifest['failed'])} failed")
    return manifest

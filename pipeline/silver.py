"""Silver zone: normalize raw openfootball JSON into one validated match table (spec 7.7, 8.1).

Invalid rows are quarantined with a reason, never silently dropped."""
import difflib, hashlib, json, re, unicodedata
from datetime import datetime, timezone
import pandas as pd
from pipeline import config as C, SILVER_SCHEMA_VERSION

# Manual aliases are added only after the alias audit in the data-quality report flags a real duplicate.
ALIASES: dict[str, str] = {
    "tsg 1899 hoffenheim": "1899 hoffenheim", "bayer leverkusen": "bayer 04 leverkusen",
    "bor monchengladbach": "borussia monchengladbach", "sv werder bremen": "werder bremen",
    "rcd espanyol de barcelona": "espanyol barcelona", "atalanta bc": "atalanta",
    "uc sampdoria": "sampdoria", "us sassuolo calcio": "sassuolo calcio",
    "olympique marseille": "olympique de marseille", "stade rennais 1901": "stade rennais",
}
_DROP_TOKENS = {"fc", "afc", "cf"}


def team_key(name: str) -> str:
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    tokens = [t for t in re.sub(r"[^a-z0-9 ]", " ", text).split() if t not in _DROP_TOKENS]
    key = " ".join(tokens)
    return ALIASES.get(key, key)


def _score(match: dict):
    score = match.get("score")
    ft = score.get("ft") if isinstance(score, dict) else score if isinstance(score, list) else None
    if isinstance(ft, list) and len(ft) == 2 and all(isinstance(g, int) for g in ft):
        return ft
    return None


def build_silver() -> dict:
    manifest = json.loads((C.LINEAGE_DIR / "bronze_manifest.json").read_text())
    rows, quarantine = [], []
    raw_names: dict[tuple[str, str], set] = {}
    for f in manifest["files"]:
        if f["status"].startswith(("http_", "error")):
            continue
        data = json.loads((C.ROOT / f["path"]).read_text(encoding="utf-8"))
        for m in data["matches"]:
            base = {"league": f["league"], "season": f["season"], "source_sha256": f["sha256"],
                    "raw_home": m.get("team1"), "raw_away": m.get("team2"), "raw_date": m.get("date")}
            status = (m.get("status") or "").lower()
            ft = _score(m)
            try:
                kickoff = pd.Timestamp(m["date"], tz="UTC")
            except Exception:
                quarantine.append({**base, "reason": "bad_date"}); continue
            if status in {"cancelled", "canceled", "postponed", "abandoned", "awarded"}:
                quarantine.append({**base, "reason": f"status_{status}"}); continue
            if ft is None:
                quarantine.append({**base, "reason": "unplayed_or_no_score"}); continue
            if min(ft) < 0:
                quarantine.append({**base, "reason": "negative_goals"}); continue
            home, away = team_key(m["team1"]), team_key(m["team2"])
            if home == away:
                quarantine.append({**base, "reason": "same_team"}); continue
            for raw, key in ((m["team1"], home), (m["team2"], away)):
                raw_names.setdefault((f["league"], key), set()).add(raw)
            mid = hashlib.sha1(f"{f['league']}|{f['season']}|{m['date']}|{home}|{away}".encode()).hexdigest()[:16]
            rows.append({"match_id": mid, "league": f["league"], "season": f["season"], "kickoff_date": kickoff,
                         "kickoff_time_local": m.get("time"), "home_team": home, "away_team": away,
                         "home_goals": ft[0], "away_goals": ft[1],
                         "result": "home" if ft[0] > ft[1] else "away" if ft[0] < ft[1] else "draw",
                         "match_domain": "professional", "source_sha256": f["sha256"]})
    silver = pd.DataFrame(rows)
    dup = silver.duplicated("match_id", keep="first")
    for rec in silver[dup].to_dict("records"):
        quarantine.append({"league": rec["league"], "season": rec["season"], "raw_home": rec["home_team"],
                           "raw_away": rec["away_team"], "raw_date": str(rec["kickoff_date"].date()),
                           "source_sha256": rec["source_sha256"], "reason": "duplicate_match_id"})
    silver = silver[~dup].sort_values(["kickoff_date", "league", "match_id"], kind="stable").reset_index(drop=True)
    quar = pd.DataFrame(quarantine)

    # ---- data-quality report ----
    per_season = silver.groupby(["league", "season"]).size().rename("played").reset_index()
    teams_per = silver.groupby(["league", "season"]).apply(
        lambda g: len(set(g.home_team) | set(g.away_team)), include_groups=False).rename("teams").reset_index()
    per_season = per_season.merge(teams_per)
    per_season["expected_if_complete"] = per_season.teams * (per_season.teams - 1)
    per_season["completeness"] = (per_season.played / per_season.expected_if_complete).round(3)
    alias_audit = []
    for league in C.LEAGUES:
        keys = sorted({k for (l, k) in raw_names if l == league})
        seasons_of = {k: set(silver[(silver.league == league) & ((silver.home_team == k) | (silver.away_team == k))].season) for k in keys}
        for i, a in enumerate(keys):
            for b in keys[i + 1:]:
                if difflib.SequenceMatcher(None, a, b).ratio() > 0.8 and not (seasons_of[a] & seasons_of[b]):
                    alias_audit.append({"league": league, "a": a, "b": b})
    report = {
        "schema_version": SILVER_SCHEMA_VERSION, "built_at": datetime.now(timezone.utc).isoformat(),
        "rows_silver": int(len(silver)), "rows_quarantined": int(len(quar)),
        "quarantine_by_reason": quar.reason.value_counts().to_dict() if len(quar) else {},
        "teams_per_league": {l: int(len(set(silver[silver.league == l].home_team) | set(silver[silver.league == l].away_team))) for l in C.LEAGUES},
        "alias_audit_possible_duplicates": alias_audit,
        "season_completeness": per_season.to_dict("records"),
        "incomplete_seasons": per_season[per_season.completeness < 0.99][["league", "season", "played", "expected_if_complete"]].to_dict("records"),
    }
    C.SILVER_DIR.mkdir(parents=True, exist_ok=True)
    silver.to_parquet(C.SILVER_DIR / "matches.parquet", index=False)
    if len(quar):
        quar.to_parquet(C.SILVER_DIR / "quarantine.parquet", index=False)
    (C.SILVER_DIR / "quality_report.json").write_text(json.dumps(report, indent=2, default=str))
    print(f"silver: {len(silver)} matches, {len(quar)} quarantined {report['quarantine_by_reason']}")
    print("alias audit:", alias_audit)
    return report

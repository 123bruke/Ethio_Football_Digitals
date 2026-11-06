"""Gold zone: leakage-safe, point-in-time pre-match features (spec 8.3, 8.4, 12.5).

Point-in-time rule: a match played on date D may only use matches played on dates STRICTLY BEFORE D.
State is updated only after every match of a date has had its features computed, so same-day matches
(whose kickoff order is unknown at date resolution) never see each other's results."""
import hashlib, json
from collections import defaultdict, deque
from datetime import datetime, timezone
import numpy as np
import pandas as pd
from pipeline import config as C, FEATURE_SET_VERSION

FEATURES = ["home_recent_points", "away_recent_points", "home_goals_for_avg", "away_goals_for_avg",
            "home_goals_against_avg", "away_goals_against_avg", "home_win_rate", "away_win_rate",
            "home_rest_days", "away_rest_days", "home_league_position_norm", "away_league_position_norm"]
EXTRA_FEATURES = ["home_elo", "away_elo", "elo_diff"]


def _norm_positions(table: dict) -> dict:
    ranked = [t for t, r in table.items() if r[3] > 0]
    ranked.sort(key=lambda t: (-table[t][0] / table[t][3], -(table[t][1] - table[t][2]) / table[t][3], t))
    n = len(ranked)
    return {t: (1.0 - i / (n - 1) if n > 1 else 0.5) for i, t in enumerate(ranked)}


def split_for(season: str) -> str:
    return ("train" if season in C.TRAIN_SEASONS else "validation" if season in C.VALIDATION_SEASONS
            else "test" if season in C.TEST_SEASONS else "unassigned")


class FormState:
    """Rolling team state shared by training (compute_features) and serving (snapshot), spec 8.3:
    one definition of every feature, verified for parity by tests."""

    def __init__(self):
        self.recent = defaultdict(lambda: deque(maxlen=C.FORM_WINDOW))  # (league, team) -> (pts, gf, ga)
        self.last_date, self.elo, self.elo_season = {}, {}, {}
        self.tables = defaultdict(dict)       # (league, season) -> team -> [pts, gf, ga, played]
        self.prior_norm = defaultdict(dict)   # league -> team -> final position norm of the last finished season
        self.as_of = None

    def _elo_now(self, lk, season):
        base = self.elo.get(lk, C.ELO_START)
        if lk in self.elo_season and self.elo_season[lk] != season:
            base = C.ELO_START + C.ELO_SEASON_CARRY * (base - C.ELO_START)
        return base

    def knows(self, league, team) -> bool:
        return (league, team) in self.elo

    def features_for(self, league, season, home, away, date, persist_carry=False) -> dict:
        row, hist_ok = {}, True
        pos = _norm_positions(self.tables[(league, season)]); prev = self.prior_norm[league]
        for side, team in (("home", home), ("away", away)):
            lk = (league, team); h = list(self.recent[lk])
            hist_ok &= len(h) >= C.MIN_HISTORY
            if h:
                row[f"{side}_recent_points"] = float(np.mean([x[0] for x in h]))
                row[f"{side}_goals_for_avg"] = float(np.mean([x[1] for x in h]))
                row[f"{side}_goals_against_avg"] = float(np.mean([x[2] for x in h]))
                row[f"{side}_win_rate"] = float(np.mean([x[0] == 3 for x in h]))
            else:
                for k in ("recent_points", "goals_for_avg", "goals_against_avg", "win_rate"):
                    row[f"{side}_{k}"] = np.nan
            row[f"{side}_rest_days"] = min((date - self.last_date[lk]).days, C.REST_CAP_DAYS) if lk in self.last_date else np.nan
            row[f"{side}_league_position_norm"] = pos.get(team, prev.get(team, 0.5))
            row[f"{side}_elo"] = self._elo_now(lk, season)
            if persist_carry:
                self.elo[lk] = row[f"{side}_elo"]; self.elo_season[lk] = season
        row["elo_diff"] = row["home_elo"] - row["away_elo"]
        row["history_ok"] = hist_ok
        return row

    def update_day(self, date, matches, season_end):
        """Apply a day's results AFTER all of that date's features were computed."""
        for m in matches:
            lk_h, lk_a = (m.league, m.home_team), (m.league, m.away_team)
            hp, ap = (3, 0) if m.home_goals > m.away_goals else (0, 3) if m.home_goals < m.away_goals else (1, 1)
            self.recent[lk_h].append((hp, m.home_goals, m.away_goals)); self.recent[lk_a].append((ap, m.away_goals, m.home_goals))
            self.last_date[lk_h] = self.last_date[lk_a] = date
            eh, ea = self.elo.get(lk_h, C.ELO_START), self.elo.get(lk_a, C.ELO_START)
            self.elo_season.setdefault(lk_h, m.season); self.elo_season.setdefault(lk_a, m.season)
            exp_h = 1 / (1 + 10 ** (-(eh + C.ELO_HOME_ADV - ea) / 400)); s_h = hp / 3 if hp != 1 else 0.5
            self.elo[lk_h] = eh + C.ELO_K * (s_h - exp_h); self.elo[lk_a] = ea - C.ELO_K * (s_h - exp_h)
            table = self.tables[(m.league, m.season)]
            for team, pts, gf, ga in ((m.home_team, hp, m.home_goals, m.away_goals), (m.away_team, ap, m.away_goals, m.home_goals)):
                r = table.setdefault(team, [0, 0, 0, 0]); r[0] += pts; r[1] += gf; r[2] += ga; r[3] += 1
        for league, season in {(m.league, m.season) for m in matches}:
            if date == season_end[(league, season)]:
                self.prior_norm[league] = _norm_positions(self.tables[(league, season)])
        self.as_of = date

    # ---- JSON snapshot for the serving layer ----
    def to_json(self) -> dict:
        return {"as_of": str(self.as_of.date()) if self.as_of is not None else None, "feature_set_version": FEATURE_SET_VERSION,
                "recent": {f"{l}|{t}": list(v) for (l, t), v in self.recent.items()},
                "last_date": {f"{l}|{t}": str(d.date()) for (l, t), d in self.last_date.items()},
                "elo": {f"{l}|{t}": v for (l, t), v in self.elo.items()},
                "elo_season": {f"{l}|{t}": v for (l, t), v in self.elo_season.items()},
                "tables": {f"{l}|{s}": v for (l, s), v in self.tables.items()},
                "prior_norm": dict(self.prior_norm)}

    @classmethod
    def from_json(cls, data: dict) -> "FormState":
        st = cls(); sp = lambda k: tuple(k.split("|", 1))
        for k, v in data["recent"].items(): st.recent[sp(k)].extend(tuple(x) for x in v)
        st.last_date = {sp(k): pd.Timestamp(v, tz="UTC") for k, v in data["last_date"].items()}
        st.elo = {sp(k): v for k, v in data["elo"].items()}; st.elo_season = {sp(k): v for k, v in data["elo_season"].items()}
        for k, v in data["tables"].items(): st.tables[sp(k)] = v
        for l, v in data["prior_norm"].items(): st.prior_norm[l] = v
        st.as_of = pd.Timestamp(data["as_of"], tz="UTC") if data["as_of"] else None
        return st


def compute_features(silver: pd.DataFrame, return_state: bool = False):
    silver = silver.sort_values(["kickoff_date", "league", "match_id"], kind="stable").reset_index(drop=True)
    season_end = silver.groupby(["league", "season"]).kickoff_date.max().to_dict()
    state, out = FormState(), []
    for date, day in silver.groupby("kickoff_date", sort=True):
        matches = list(day.itertuples(index=False))
        for m in matches:
            row = {"match_id": m.match_id, "league": m.league, "season": m.season, "kickoff_date": m.kickoff_date,
                   "prediction_cutoff_at": m.kickoff_date, "match_domain": m.match_domain, "home_team": m.home_team, "away_team": m.away_team}
            row.update(state.features_for(m.league, m.season, m.home_team, m.away_team, date, persist_carry=True))
            hist_ok = row.pop("history_ok")
            row["target"] = m.result  # label only; never used above this line
            row["included"] = bool(hist_ok); row["exclusion_reason"] = "" if hist_ok else "cold_start_insufficient_history"
            row["split"] = split_for(m.season)
            out.append(row)
        state.update_day(date, matches, season_end)
    frame = pd.DataFrame(out)
    return (frame, state) if return_state else frame


def build_gold() -> dict:
    silver = pd.read_parquet(C.SILVER_DIR / "matches.parquet")
    gold, state = compute_features(silver, return_state=True)
    (C.GOLD_DIR).mkdir(parents=True, exist_ok=True)
    (C.GOLD_DIR / "team_state_snapshot.json").write_text(json.dumps(state.to_json()))
    C.GOLD_DIR.mkdir(parents=True, exist_ok=True)
    gold.to_parquet(C.GOLD_DIR / "features.parquet", index=False)
    inc = gold[gold.included]
    inc[["kickoff_date"] + FEATURES + ["target"]].assign(
        kickoff_date=lambda d: d.kickoff_date.dt.strftime("%Y-%m-%d")).to_csv(C.PROCESSED_CSV, index=False)
    report = {
        "feature_set_version": FEATURE_SET_VERSION, "built_at": datetime.now(timezone.utc).isoformat(),
        "rows_total": int(len(gold)), "rows_included": int(len(inc)),
        "exclusions": gold[~gold.included].exclusion_reason.value_counts().to_dict(),
        "rows_by_split": inc.split.value_counts().to_dict(),
        "target_distribution_by_split": {s: g.target.value_counts(normalize=True).round(4).to_dict() for s, g in inc.groupby("split")},
        "split_boundaries": {"train": C.TRAIN_SEASONS, "validation": C.VALIDATION_SEASONS, "test": C.TEST_SEASONS},
        "date_range_by_split": {s: [str(g.kickoff_date.min().date()), str(g.kickoff_date.max().date())] for s, g in inc.groupby("split")},
        "null_counts_included": {c: int(inc[c].isna().sum()) for c in FEATURES + EXTRA_FEATURES if inc[c].isna().any()},
        "features_sha256": hashlib.sha256((C.GOLD_DIR / "features.parquet").read_bytes()).hexdigest(),
    }
    (C.GOLD_DIR / "feature_report.json").write_text(json.dumps(report, indent=2, default=str))
    print(json.dumps({k: report[k] for k in ("rows_total", "rows_included", "exclusions", "rows_by_split", "target_distribution_by_split", "date_range_by_split", "null_counts_included")}, indent=1))
    return report

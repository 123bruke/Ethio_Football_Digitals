"""Poisson / Dixon-Coles baseline with rolling-origin refits (spec 12.2 step 3, 12.8).

Per league, attack/defence ratings and a home advantage are fitted by time-weighted Poisson maximum likelihood
on matches strictly before each month; the low-score dependence parameter rho is chosen by grid search."""
import numpy as np, pandas as pd
from scipy.optimize import minimize
from scipy.special import gammaln
from pipeline import config as C

XI = 0.0019          # time decay per day (half-life about one year)
WINDOW_DAYS = 1095   # fit window: three years before the forecast month
MAX_GOALS = 10
RHO_GRID = np.linspace(-0.2, 0.1, 31)
RIDGE = 0.05


def _fit(df: pd.DataFrame, cutoff: pd.Timestamp):
    teams = sorted(set(df.home_team) | set(df.away_team)); idx = {t: i for i, t in enumerate(teams)}; n = len(teams)
    hi = df.home_team.map(idx).to_numpy(); ai = df.away_team.map(idx).to_numpy()
    hg, ag = df.home_goals.to_numpy(float), df.away_goals.to_numpy(float)
    w = np.exp(-XI * (cutoff - df.kickoff_date).dt.days.to_numpy(float))

    def nll(theta):
        att, dfn, home = theta[:n], theta[n:2 * n], theta[2 * n]
        lh = np.exp(att[hi] + dfn[ai] + home); la = np.exp(att[ai] + dfn[hi])
        ll = w * (hg * np.log(lh) - lh + ag * np.log(la) - la)
        value = -ll.sum() + RIDGE * (att @ att + dfn @ dfn)
        rh, ra = w * (hg - lh), w * (ag - la)
        g = np.zeros_like(theta)
        np.add.at(g, hi, -rh); np.add.at(g, ai, -ra)            # d/d att
        np.add.at(g, n + ai, -rh); np.add.at(g, n + hi, -ra)    # d/d def
        g[2 * n] = -rh.sum()
        g[:n] += 2 * RIDGE * att; g[n:2 * n] += 2 * RIDGE * dfn
        return value, g

    theta0 = np.zeros(2 * n + 1); theta0[2 * n] = 0.25
    theta = minimize(nll, theta0, jac=True, method="L-BFGS-B").x
    att, dfn, home = theta[:n], theta[n:2 * n], theta[2 * n]
    lh = np.exp(att[hi] + dfn[ai] + home); la = np.exp(att[ai] + dfn[hi])

    def tau(rho):
        t = np.ones(len(df))
        t = np.where((hg == 0) & (ag == 0), 1 - lh * la * rho, t); t = np.where((hg == 0) & (ag == 1), 1 + lh * rho, t)
        t = np.where((hg == 1) & (ag == 0), 1 + la * rho, t); t = np.where((hg == 1) & (ag == 1), 1 - rho, t)
        return t
    scores = [(w * np.log(np.clip(tau(r), 1e-9, None))).sum() for r in RHO_GRID]
    return {"idx": idx, "att": att, "def": dfn, "home": home, "rho": float(RHO_GRID[int(np.argmax(scores))])}


def score_matrix(model, home: str, away: str) -> np.ndarray:
    ih, ia = model["idx"].get(home), model["idx"].get(away)
    a_h = model["att"][ih] if ih is not None else 0.0; d_h = model["def"][ih] if ih is not None else 0.0
    a_a = model["att"][ia] if ia is not None else 0.0; d_a = model["def"][ia] if ia is not None else 0.0
    lh, la = np.exp(a_h + d_a + model["home"]), np.exp(a_a + d_h)
    g = np.arange(MAX_GOALS + 1)
    ph = np.exp(g * np.log(lh) - lh - gammaln(g + 1)); pa = np.exp(g * np.log(la) - la - gammaln(g + 1))
    m = np.outer(ph, pa); r = model["rho"]
    m[0, 0] *= max(1 - lh * la * r, 1e-9); m[0, 1] *= max(1 + lh * r, 1e-9); m[1, 0] *= max(1 + la * r, 1e-9); m[1, 1] *= max(1 - r, 1e-9)
    return m / m.sum()


def one_x_two(m: np.ndarray):
    return [float(np.tril(m, -1).sum()), float(np.trace(m)), float(np.triu(m, 1).sum())]  # home, draw, away


def dixon_coles_predictions(silver: pd.DataFrame, rows: pd.DataFrame) -> np.ndarray:
    """1X2 probabilities (home, draw, away) for each row, refitting monthly on strictly earlier matches."""
    out = np.zeros((len(rows), 3)); rows = rows.reset_index(drop=True)
    month = rows.kickoff_date.dt.strftime("%Y-%m")
    for (league, mon), grp in rows.groupby([rows.league, month]):
        start = grp.kickoff_date.min().normalize()
        hist = silver[(silver.league == league) & (silver.kickoff_date < start) & (silver.kickoff_date >= start - pd.Timedelta(days=WINDOW_DAYS))]
        model = _fit(hist, start)
        for i, r in zip(grp.index, grp.itertuples()):
            out[i] = one_x_two(score_matrix(model, r.home_team, r.away_team))
    return out

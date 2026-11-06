# Football data source and preparation

PitchSide does not ship with fabricated match rows. The predictor must be trained on a real, legally obtained historical football dataset. Keep raw downloads here and do not commit restricted or personally identifiable data.

## Required training CSV

The training command currently expects these columns:

| Column | Meaning | Timing |
|---|---|---|
| `kickoff_date` | Match date/time; recommended for chronological sorting | Before match |
| `home_recent_points` | Home team's average points per match over a fixed previous-match window | Before match |
| `away_recent_points` | Away team's average points per match over the same window | Before match |
| `home_goals_for_avg` | Home team's average goals scored in that window | Before match |
| `away_goals_for_avg` | Away team's average goals scored in that window | Before match |
| `home_goals_against_avg` | Home team's average goals conceded in that window | Before match |
| `away_goals_against_avg` | Away team's average goals conceded in that window | Before match |
| `home_win_rate` | Home team's historical win proportion in that window | Before match |
| `away_win_rate` | Away team's historical win proportion in that window | Before match |
| `home_rest_days` | Days since home team's previous match | Before match |
| `away_rest_days` | Days since away team's previous match | Before match |
| `home_league_position_norm` | Normalized home team strength/position on a 0–1 scale; 1 means stronger/better position | Before match |
| `away_league_position_norm` | Normalized away team strength/position on the same 0–1 scale; 1 means stronger/better position | Before match |
| `target` | Actual outcome: `home`, `draw`, or `away` | After match; label only |

Only use information that would have been known at prediction time. Do not include final scores, post-match statistics, future fixtures, or any feature calculated using the target match itself. Such leakage can make test scores look good while real predictions fail.

## Suggested preparation process

1. Select a dataset whose license permits your intended use and deployment.
2. Normalize team names, competition identifiers and kickoff dates.
3. Sort all matches by kickoff date.
4. For every fixture, calculate rolling team statistics using only earlier matches. Shift rolling statistics by one match so the current match is excluded.
5. Remove rows without enough pre-match history, or use a documented cold-start strategy.
6. Save the prepared data to `data/processed/matches.csv`.
7. Keep the final test period later in time than the training period.

Do not publish source data unless its license permits redistribution.

# API reference (MVP)

Base URL: `http://localhost:8000/api/v1` in local development. The Docker Nginx frontends reverse-proxy `/api/` to the FastAPI service.

## Authentication

`POST /auth/register`

```json
{
  "username": "football_fan",
  "display_name": "Football Fan",
  "email": "fan@example.com",
  "password": "a-long-unique-password"
}
```

`POST /auth/login`

```json
{"email":"fan@example.com","password":"a-long-unique-password"}
```

Both return `access_token`, `token_type`, and the public user profile. Send `Authorization: Bearer <access_token>` for protected routes. `GET /auth/me` returns the current profile.

## Social

- `GET /social/people?q=search-term` — search active user accounts.
- `POST /social/follow/{target_user_id}` — create a directed `FOLLOWS` relationship in Neo4j.
- `GET /social/following` — list followed users.
- `GET /social/friends` — list mutual-follow connections.
- `GET /social/feed` — latest posts.
- `POST /social/posts` — JSON body `{"body":"Your post text"}`.
- `GET /social/messages?peer_id=<user-id>` — read a mutual-friend conversation.
- `POST /social/messages` — JSON body `{"receiver_id":"<user-id>","content":"Hello"}`.

Direct messaging is intentionally restricted to mutual follows. The web app polls an open conversation every five seconds. Add WebSockets or a managed realtime service for production realtime delivery.

## Predictions

`POST /predictions`

```json
{
  "home_team": "Home team",
  "away_team": "Away team",
  "features": {
    "home_recent_points": 1.8,
    "away_recent_points": 1.2,
    "home_goals_for_avg": 1.6,
    "away_goals_for_avg": 1.1,
    "home_goals_against_avg": 0.9,
    "away_goals_against_avg": 1.2,
    "home_win_rate": 0.5,
    "away_win_rate": 0.4,
    "home_rest_days": 5,
    "away_rest_days": 5,
    "home_league_position_norm": 0.5,
    "away_league_position_norm": 0.55
  }
}
```

Returns three probabilities, selected class, maximum probability as confidence, model version and a caveat-rich explanation. It returns HTTP `503` if the model artifact is missing. It returns `422` if features do not match the training schema.

## Assistant

`POST /assistant/chat` with `{"message":"Explain recent form"}`. Calls Ollama if reachable; otherwise reports that the local language model is offline and returns a static explanation.

## Administrator

`GET /admin/metrics`, `GET /admin/users`, and `PATCH /admin/users/{id}/status` — require a user whose database `role` is `admin`. The status endpoint enables/disables player accounts only; it cannot disable administrator accounts or the current admin. The response includes total accounts, recently active accounts, community posts/messages, saved predictions/matches, CPU/RAM/disk snapshots, model artifact size, and the most recent saved training epochs/loss/holdout metrics when available. Counts of model outputs are activity counts, not prediction accuracy.

## Health

`GET /health` — reports backend/database status and whether the local model artifact exists. It does not verify that the neural network is accurate or that every optional service is available.


## Match history

- `POST /api/v1/matches` — authenticated players save a completed game score, duration, teams and game statistics.
- `GET /api/v1/matches/me` — returns up to 50 most recent match records belonging to the signed-in player.

The 3D game sends the result when the match reaches full time. The admin metrics endpoint counts these persisted rows; it does not infer matches from browser activity.

## Fixture predictions and model registry (v0.3.0)

`POST /api/v1/predictions/fixture` (authenticated) takes `{league, home_team, away_team, kickoff_date?}` and computes features server-side from the team-state snapshot (`data/gold/team_state_snapshot.json`), using the same `FormState` code as training. It returns the probability distribution, `horizon`, `predicted_at`, `data_as_of`, `data_age_days`, `freshness` (fresh ≤ 14 days, stale ≤ 120, degraded beyond), `model_version`, `feature_set_version`, `uncertainty_note` and the `evidence` behind the forecast. Unknown teams return suggestions; kickoffs on or before the snapshot date are refused.

Admin only: `GET /admin/models`, `POST /admin/models/register`, `POST /admin/models/{version}/transition`, `POST /admin/models/rollback`, `GET /admin/audit`. Lifecycle: candidate → offline_validated → shadow → canary → production → retired. Production needs an approval note, a matching feature contract, and (in `ENVIRONMENT=production`) a second reviewer. Rollback restores the previous production version only if its feature contract matches. Every change is written to `audit_events`. Apply migration `0002_registry_audit` before deploying.

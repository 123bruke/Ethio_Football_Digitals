# Delivery status and next development stages

## Added in this repository update

- Preserved the existing Three.js 5v5 football game and tactical rule-based opponent.
- Added a player-facing React app shell with registration/login, Home, Discover, Messages, AI Assistant, Game, Profile, and Settings sections.
- Added JWT authentication and Argon2 password hashing backed by PostgreSQL.
- Added database-backed posts/feed and direct messages; mutual-follow relationships are stored in Neo4j and gate direct messaging.
- Added a separate administrator frontend and role-protected metrics endpoint.
- Added a CPU-friendly scikit-learn MLP training/inference pipeline for home/draw/away prediction, default ten epochs.
- Added a Jupyter notebook using pandas, NumPy, Matplotlib, seaborn and SymPy.
- Added optional Ollama chat integration and a safe fallback response.
- Added an optional Hyperon/MeTTa explanation rule file and Python fallback.
- Added Docker Compose, local resource limits, reverse proxy configuration, migration scaffold, and setup/security/deployment documentation.

## Not complete yet — do not label these as shipped

1. **Real match-data ingestion.** No licensed football dataset is included. Add a provider/import job and feature-engineering pipeline for the leagues/seasons you are allowed to use.
2. **Prediction quality validation.** The neural network has not been trained or evaluated in this delivery because no real match CSV was supplied. Do not publish a claimed accuracy score.
3. **Learned gameplay opponent.** The in-game opponent remains the existing rule-based tactical AI. The MLP predicts match results; it does not steer the football players. A learned game policy requires a Gymnasium environment, observations/actions/rewards, simulation rollouts and separate RL evaluation.
4. **Realtime chat.** Current direct-message screen refreshes every five seconds. Add WebSockets, presence, delivery/read receipts and moderation controls for production.
5. **Full social publishing.** Add likes, comments, report/block tools, moderation queues, media storage, feed ranking and notifications.
6. **Production identity.** Add email verification, password reset, MFA for admins, token rotation/revocation, rate limits and audit events.
7. **Graph operations.** Add unfollow, block, privacy settings and idempotent graph reconciliation/repair jobs.
8. **Admin operations.** Add secure model-training job orchestration, model version approval/rollback, audit logs and model drift/calibration dashboards. Current admin metrics are read-only system/user/activity summaries.
9. **MeTTa integration.** Add tests that confirm the current Hyperon runtime actually executes the project's rules and returns a parsed result. Until then, displayed explanations use the Python fallback.
10. **Test automation.** Add end-to-end browser tests, API integration tests with ephemeral PostgreSQL/Neo4j, load tests and security tests.

## Update: data + ML pipeline
Items 1 and 2 are now implemented in `pipeline/` (see `docs/DATA_PIPELINE.md`): real open data ingestion, leakage-safe features, chronological evaluation. Result: no model is promoted because the 12-feature contract does not beat an Elo-only baseline. Next step: serve Elo ratings and add `elo_diff` to the prediction contract.

## Suggested order

1. Complete environment setup and run the two frontends/backend.
2. Create the initial admin and validate role separation.
3. Add a licensed football dataset; prepare leakage-safe chronological features.
4. Train/evaluate the MLP and only then enable public predictions.
5. Test the social relationship and message flows using two registered accounts.
6. Add realtime chat and production authentication hardening.
7. Deploy behind HTTPS with the admin app behind VPN/identity-aware access.
8. Build a separate RL training environment if a learned in-game opponent is still required.

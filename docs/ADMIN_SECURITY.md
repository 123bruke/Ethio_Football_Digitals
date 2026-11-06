# Admin dashboard and security model

## Separation

- The player frontend is served on port `3000`.
- The administrator frontend is a separate build/service on port `3001`.
- Docker Compose binds the admin port to `127.0.0.1`, not to all network interfaces.
- The admin API requires a signed JWT whose database user has `role = 'admin'`.
- Ordinary registrations always create `role = 'player'` accounts.

The admin account directory exposes email and activity details only to administrators. Storage metrics report the mounted data volume plus the size of the project data/artifact folders; in Docker, the path is the container mount path, not necessarily a Windows drive letter. Player enable/disable controls cannot edit admin accounts, grant roles or delete users. The `noindex` metadata in the admin HTML is only a crawler hint. It is not access control. Server-side role checks and network isolation are the real controls.

## Account protection

- Passwords are hashed with Argon2 via `pwdlib`; plaintext passwords are not stored.
- Login returns a signed, expiring JWT.
- API routes validate the token and check that the user exists and remains active.
- Admin metrics, account listing and player status changes are protected by `get_admin_user`. The current admin and all admin-role accounts are protected from the player enable/disable control.
- The admin bootstrap command requires an explicit environment-provided email and a password of at least 12 characters.

Before public production use, add email verification, password-reset flows, multi-factor authentication for admins, login throttling, account lockout/risk detection, refresh-token rotation/revocation, audit logging, secure cookie/token storage, and a tested account recovery procedure.

## AI does not own accounts

The assistant may explain information and make suggestions. It must not independently create/delete accounts, change emails/passwords, disable accounts, send direct messages, grant roles, or change privacy/security settings. Those actions require a deliberate, authenticated user or administrator request and a normal authorization check. Never grant the LLM direct database credentials or a general-purpose shell/tool executor.

## Data boundaries

PostgreSQL holds identity and private account data. Neo4j stores only public relationship metadata such as user IDs, usernames, display names and follow edges. Do not copy passwords, JWTs, private messages, or secrets into the graph. Direct message text is stored in PostgreSQL and is only accessible to the sender/recipient pair through the mutual-follow check.

## Production checklist

- Replace every development secret and rotate them on a regular schedule.
- Use HTTPS everywhere.
- Keep PostgreSQL, Neo4j, Ollama and backend management ports private.
- Keep port `3001` behind VPN, SSH tunnel, or an identity-aware access gateway.
- Run schema migrations instead of relying on development `create_all` behavior.
- Back up PostgreSQL and Neo4j volumes and test restoring them.
- Add rate limits, security headers, audit logging, admin MFA, dependency scanning and vulnerability updates.
- Avoid recording raw passwords, authentication headers, or message content in logs.

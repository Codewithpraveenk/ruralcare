# RuralCare Connect production-readiness gate

The current repository is a functional SIH prototype. It is suitable for a controlled demonstration and private staging environment, but it is not approved for clinical or public production use.

## Ready now

- Role-based patient, ASHA, doctor, staff, and facility-admin sessions.
- Deterministic urgency rules with auditable rule IDs and non-diagnostic explanations.
- Tamil, English, and mixed-language typed intake with optional speech transcription.
- Service-aware public-facility comparison, simulated-capacity rerouting, referral continuity, and offline queuing.
- Automated unit, API, authorization, facility-data, and Chrome journey tests.
- A same-origin production web build served by the Express application.

## Required before public staging

- Deploy only behind HTTPS and set `NODE_ENV=production`, a unique high-entropy `AUTH_SECRET`, `COOKIE_SECURE=true`, and the exact `FRONTEND_ORIGIN`.
- Store secrets in the hosting provider's secret manager. Never upload `.env` or place API keys in the frontend.
- Replace all prototype privileged accounts and passwords. Provision ASHA, doctor, and staff identities through an administrator-controlled process.
- Use managed PostgreSQL with encrypted backups, tested restore procedures, migrations, connection pooling, and separate staging/production databases. SQLite remains the supported zero-setup demo database until this migration is completed.
- Add structured server logs, uptime/error monitoring, alerting, request tracing, and an audit-retention policy without logging raw clinical text or session cookies.
- Add CSRF protection for state-changing cookie-authenticated requests, account recovery, login throttling review, session revocation, and security testing.
- Run dependency vulnerability review and resolve findings without blind major-version upgrades.

## Required before any real clinical pilot

- Independent review and approval of every triage rule by qualified clinicians, including Tamil-language review and independently authored validation cases.
- A documented escalation policy, emergency-number handling, human override, adverse-event process, and clear ownership by a healthcare organization.
- Privacy/legal review covering consent, data minimization, retention/deletion, access logs, breach response, applicable Indian health-data obligations, and hosting location.
- Authorized facility-data and availability integrations with freshness, provenance, outage behavior, and manual verification. Current wait time, beds, and capacity are simulated.
- Accessibility, low-connectivity field testing, threat modelling, penetration testing, load testing, disaster recovery, and operational runbooks.

## Release checklist

1. All unit/API and browser tests pass in CI.
2. Facility-data audit passes and every operational field shows its source or simulation label.
3. Staging smoke test covers registration, Tamil intake, each urgency class, rerouting, QR hand-off, doctor outcome, follow-up, offline reload, and synchronization.
4. No demo accounts, synthetic claims, development secrets, or debug logs are enabled in the public environment.
5. A named release owner signs off security, clinical review, privacy review, backups, rollback, and monitoring.


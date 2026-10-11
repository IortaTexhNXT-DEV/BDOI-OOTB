# Security controls register

Master > System Configuration > Security Controls lists the non-functional requirements of the TISPH BRD as controls:
the ones the platform enforces (sign-in and sessions, data protection and retention, audit and change control, the
business time zone) read from the configuration and the database as they are, and the ones met outside the application
(backups and restore drills, availability, scalability, performance tests, monitoring, support, deployment, scans,
incident response, secure development, certifications) recorded as dated evidence. Every control names the requirement
ids it answers, so the register is the evidence of the NFR items of the test pack.

## Tables

- `control_evidence`: one row per piece of evidence: control key, evidence date, result (`met`, `not-met`, `review`),
  reference (report, ticket, certificate), remarks, who recorded it and when. Never updated; the latest row by evidence
  date is the state of an evidence control, current for `controls.evidence_valid_days` (365).

## Statuses

- `met`: the configuration meets the target, or the latest evidence says met and is still current.
- `review`: the delivered value differs from the TISPH target (a go-live configuration item, for example the idle
  timeout of 3 minutes, single session, MFA for every user), or the evidence is older than its validity.
- `not-met`: the control is off or the latest evidence says not met.
- `pending`: an evidence control without evidence.

## Routes

`GET /system-controls` (read:settings), `GET /system-controls/:key/evidence`, `POST /system-controls/:key/evidence`
(write:settings, audited as `system_control` / `record-evidence`).

## Related controls built with the register (migration 0591)

- Lockout released after `limits.lockout_minutes` (a lock set by an administrator stays).
- Idle timeout enforced by the API on every request (`refresh_tokens.last_seen_at`; `limits.session_idle_minutes`).
- Single session (`security.single_session`): a fresh sign-in ends the earlier sessions (audit `session-superseded`).
- MFA for every user (`security.require_2fa_all`) and the one-time code by e-mail (`security.email_otp_*`) for users
  without an authenticator app.
- The audit trail is append-only at the database (trigger `audit_log_append_only`, migrations 0591 and 0596). It is
  never truncated. The one way past it is `audit_bypass_begin(tool, reason, actor)` inside a transaction: it first
  writes an `audit_bypass / begin` entry, the token it sets is bound to that transaction, and `audit_bypass_end()`
  writes the row count; the bypass entries themselves can never be changed or deleted. Under the bypass a row may be
  deleted, or only its personal data (before_data, after_data, ip, username) rewritten. Setting `app.audit_purge` by
  hand does nothing, and the API refuses any statement naming the bypass while a request is served (`db/pool.js`).
  Users: the housekeeping job (retention past the statutory minimum), `reset:transactions --purge-audit`,
  `purge:sample --purge-audit`, `mask:data` (personal data of a copy) and `rotate-pii-key` (re-encryption of
  before_data and after_data). Test: `test/audit-bypass.test.js`.
- Data retention job (`data-retention`, monthly): flags closed contracts past `retention.closed_contract_years` /
  `retention.claim_contract_years`; `retention.action = anonymise` replaces the personal data of clients whose every
  contract is flagged.
- `general.timezone` is validated (an unknown zone is refused), the audit trail date filters refuse impossible dates,
  and a reactivated user is not deactivated again by the dormant-accounts job (`users.reactivated_at`).

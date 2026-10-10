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
- The audit trail is append-only at the database (trigger `audit_log_append_only`); only the housekeeping purge past
  the statutory minimum and the transaction reset with `--purge-audit` delete from it (`SET LOCAL app.audit_purge`).
- Data retention job (`data-retention`, monthly): flags closed contracts past `retention.closed_contract_years` /
  `retention.claim_contract_years`; `retention.action = anonymise` replaces the personal data of clients whose every
  contract is flagged.
- `general.timezone` is validated (an unknown zone is refused), the audit trail date filters refuse impossible dates,
  and a reactivated user is not deactivated again by the dormant-accounts job (`users.reactivated_at`).

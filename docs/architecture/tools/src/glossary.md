# Glossary (master list)

Each document prints only the terms that appear in its own text. A term with alternatives ("A / B") or an expansion
in brackets is matched on each part.

| Term | Meaning |
|---|---|
| ACM | AWS Certificate Manager: issues and renews the TLS certificates used by the load balancer and CloudFront. |
| Advisory lock | PostgreSQL application-level lock (pg_try_advisory_lock) used by the scheduler so a job runs on one API instance at a time. |
| ALB | Application Load Balancer (AWS): distributes HTTPS requests over the API containers and checks their health. |
| API | Application programming interface; here the BrokerVerse REST API under /api served by the Node.js backend. |
| Audit log / audit trail | Table audit_log: who changed which record, when, from which IP, with the before and after values. |
| AZ | Availability Zone: an isolated data-centre group inside an AWS region. |
| bcrypt | Adaptive password-hashing function (bcryptjs library) used for user passwords. |
| BIR | Bureau of Internal Revenue (Philippines): tax authority whose rules drive record keeping and withholding tax certificates. |
| Bordereau | Periodic list of ceded premiums or claims sent to a reinsurer. |
| Cession | The share of a policy's risk and premium passed to a reinsurer under a treaty or facultatively. |
| CloudFront | AWS content delivery network that serves the single-page application and can route /api to the backend. |
| CloudWatch | AWS monitoring service: logs, metrics, dashboards and alarms. |
| CORS | Cross-Origin Resource Sharing: browser rule set that the API restricts to the configured web origins (CORS_ORIGINS). |
| CRA / craco | Create React App (react-scripts) build tool chain, customised with craco (Create React App Configuration Override). |
| Cron | Time-based schedule expression (minute hour day month weekday) used by the scheduled jobs. |
| CSP | Content Security Policy: HTTP header restricting what a page may load or run. |
| CTPL | Compulsory Third Party Liability motor insurance (Philippines). |
| Debit note (DN) | Commission debit note raised by the broker to an insurer for direct-billed policies. |
| Direct bill | Billing mode in which the insurer collects the premium and the broker bills the insurer for its commission. |
| DR | Disaster recovery: restoring service after the loss of a site, region or data. |
| DST | Documentary Stamp Tax (Philippines), part of the gross premium. |
| ECR | Elastic Container Registry (AWS): stores the backend container images. |
| ECS / Fargate | Elastic Container Service (AWS) and its serverless compute mode for running the API containers. |
| EFS | Elastic File System (AWS): shared, multi-AZ network file system proposed for the upload directory. |
| Endorsement | Change to an issued policy (details, cover, premium or cancellation). |
| EWT | Expanded Withholding Tax (Philippines), e.g. withheld by an insurer on commission (BIR Form 2307). |
| FK | Foreign key: column that references the primary key of another table. |
| GIN | Generalised inverted index (PostgreSQL), used for JSONB searches. |
| HA | High availability: design that keeps the service running through the failure of a component. |
| HMAC | Keyed-hash message authentication code; signs file links and hashes one-time codes. |
| HS256 | HMAC-SHA256 JSON Web Token signature algorithm, the only one the API accepts. |
| IC | Insurance Commission (Philippines): regulator of insurers and brokers. |
| JSONB | PostgreSQL binary JSON column type, used for flexible document parts of records. |
| JV | Journal voucher: balanced set of debit and credit ledger lines. |
| JWT | JSON Web Token: signed token carrying the user id, roles, permissions and token version. |
| KYC | Know your customer: identification data required before a policy is issued. |
| LGT | Local Government Tax (Philippines), part of the gross premium. |
| Maker-checker | Control in which a record created or submitted by one user must be approved by a different user. |
| Migration | Numbered SQL file in backend/src/db/migrations applied once, in order, on API start. |
| Multi-AZ | Deployment with a synchronous standby in a second Availability Zone and automatic failover (RDS). |
| nginx | Web server used in the web container to serve the SPA and forward /api to the API container. |
| OR | Official receipt issued for premium received. |
| p50 / p95 / p99 | Latency percentiles: the time within which 50 %, 95 % or 99 % of requests completed. |
| PITR | Point-in-time recovery: restoring a database to any second inside the backup retention window. |
| PK | Primary key: column(s) that uniquely identify a row. |
| PV | Payment voucher (disbursement) to an insurer, agent, client or supplier. |
| RDS | Amazon Relational Database Service, the managed PostgreSQL target. |
| Receivable / bill | Premium bill (INV-) raised when a policy, endorsement or renewal is issued. |
| Record scope | Rule that users holding only scoped roles (default: agent) see only their own records (lib/scope.js). |
| Refresh token | Long-lived token (30 days) exchanged for a new access token; rotated on every use. |
| Remittance | Payment of collected premium, net of commission, from the broker to the insurer. |
| RPO | Recovery point objective: the maximum acceptable data loss, measured in time. |
| RTO | Recovery time objective: the maximum acceptable time to restore service. |
| S3 | Amazon Simple Storage Service: object storage hosting the SPA build (and proposed archive store). |
| Seed | Idempotent data load run on every API start: reference data always, sample data only when SEED_SAMPLE_DATA is on. |
| SES | Amazon Simple Email Service, a possible SMTP relay. |
| SLA | Service level agreement / target time, e.g. for remittance approvals. |
| SMTP | Simple Mail Transfer Protocol; the API sends e-mail through the server in SMTP_URL. |
| SNS | Amazon Simple Notification Service: delivers alarm notifications. |
| SPA | Single-page application: the React front end served as static files. |
| SPOF | Single point of failure. |
| TLS | Transport Layer Security (HTTPS). |
| Token version | users.token_version, carried in every access token; raising it ends all sessions of the user. |
| TOTP / 2FA | Time-based one-time password (RFC 6238) used for two-factor authentication. |
| Treaty | Reinsurance contract under which risks are ceded automatically within agreed limits. |
| UAT | User acceptance testing environment. |
| VAT | Value-added tax (12 % in the Philippines). |
| VPC | Virtual Private Cloud: the isolated AWS network holding the load balancer, containers, database and file system. |
| WAF | Web Application Firewall. |
| WAL | Write-ahead log: PostgreSQL change log used for replication and point-in-time recovery. |
| WHT | Withholding tax deducted from payments such as agent commission. |
| zod | TypeScript-first schema validation library used to validate request bodies and parameters. |

---
title: Hosting Agreement
subtitle: Hosting and infrastructure services
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT Corp.
reviewed: Legal counsel (to be completed)
approved: To be completed
change: Template for discussion; subject to review by the parties' legal counsel
open_item: Review and completion by the parties' legal counsel before signature
acronyms: AWS=Amazon Web Services; DPA=Data Privacy Act of 2012 (RA 10173); DR=Disaster recovery; MSA=Master Services Agreement; NPC=National Privacy Commission; OOTB=Out of the box; PHP=Philippine peso; PHT=Philippine time; PITR=Point-in-time recovery; RPO=Recovery point objective; RTO=Recovery time objective; TLS=Transport Layer Security; UAT=User acceptance testing; USD=United States dollar; VAT=Value-added tax; WAF=Web application firewall
---

# About this template

> Template for discussion; subject to review by the parties' legal counsel.

This Hosting and Infrastructure Services Agreement (the **Hosting Agreement**) sets the terms on which iorta TechNXT Corp. (**iorta TechNXT**) hosts iNXT BrokerVerse OOTB for [Client legal name] (the **Client**). It forms part of the Master Services Agreement (the **MSA**) when an Order Form names it. Capitalised terms have the meaning given in the MSA. Text in [square brackets] is a placeholder or an option.

# Agreement and options

## Parties and documents

This Hosting Agreement is made on [date] under the MSA dated [date] and Order Form no. [number]. **Support Agreement** means the Annual Maintenance and Support Agreement and Service Level Agreement that forms part of the same Order Form. The technical basis is the iorta TechNXT Architecture, Infrastructure, Security and Privacy document for iNXT BrokerVerse.

## Hosting options

The Client chooses one option in the Order Form:

| Option | Provider and region | Data location | Main services |
|---|---|---|---|
| A: AWS | Amazon Web Services, region ap-southeast-1 (Singapore) | Singapore | CloudFront and S3 for the web front end; ECS Fargate API behind an Application Load Balancer; RDS for PostgreSQL 16 Multi-AZ; EFS file store; AWS Backup; Secrets Manager; CloudWatch; AWS WAF |
| B: Azure | Microsoft Azure, region Southeast Asia (Singapore) | Singapore | Storage static website with Front Door and WAF; Container Apps; Azure Database for PostgreSQL Flexible Server 16 zone-redundant; Azure Files; Key Vault; Azure Monitor |
| C: Local partner | [Partner name], data centre in [city], Philippines | Philippines | Virtual machines: two API nodes, PostgreSQL 16 primary and standby, NFS file store, reverse proxy and WAF, backup server, off-site copy in a second Philippine site |

The cloud or data centre provider is a sub-processor of iorta TechNXT under the Data Processing Agreement.

## Environments

| Environment | Purpose | Form |
|---|---|---|
| Production | Live operations | Highly available: at least two API instances, managed PostgreSQL with standby, shared file store |
| UAT | Testing, acceptance and training | Same topology as production at a smaller size |
| Additional environment (optional) | Training or second UAT | Small single-zone environment, priced as an optional service |
| DR (Enterprise size, or optional) | Recovery after a regional or site outage | Restored from cross-region or off-site backups |

Production personal data is not copied into UAT or another non-production environment without masking. Each environment has its own secrets.

# Services

## Included services

iorta TechNXT provides, for each environment in the Order Form:

1. provisioning and configuration of the infrastructure, sized for the Client's size and confirmed by the UAT performance test;
2. deployment of iNXT BrokerVerse releases under the release process of the Support Agreement;
3. operating system, database and middleware patching (monthly, and within [7] days for critical security patches);
4. TLS certificates for the iorta TechNXT-provided domain [or the Client's domain, with the Client's DNS cooperation];
5. monitoring and alarms (health checks, errors, response time, capacity, scheduled jobs, failed sign-ins, backups and certificate expiry);
6. daily backups and restore testing as in the Backup and recovery chapter;
7. security controls as in the Security chapter;
8. capacity reviews each quarter.

## Sizing

| Item | Small (up to 25 users) | Medium (26 to 100) | Large (101 to 300) |
|---|---|---|---|
| API instances | 2 x 1 vCPU, 2 GB | 2 x 1 vCPU, 2 GB | 3 to 4 x 2 vCPU, 4 GB |
| Database | 2 vCPU, 4 GB, standby | 2 vCPU, 8 GB, standby | 4 vCPU, 16 GB, standby |
| Database storage | 50 GB | 100 GB | 250 GB |
| File store (year 1) | 25 GB | 60 GB | 150 GB |
| Backup storage | 100 GB | 250 GB | 600 GB |
| Concurrent users at peak | 10 | 40 | 120 |

Enterprise sizing is agreed in the Order Form. Sizing is indicative and assumes the volumes in the architecture document; growth beyond them is handled under the Fees chapter.

# Backup and recovery

## Backups

| Backup | Retention |
|---|---|
| Automated database backups with point-in-time recovery, window 02:00 to 03:00 PHT | 35 days |
| Daily snapshots; monthly copy to a second region or site | Daily 35 days; monthly 12 months; yearly copies of year-end records [10 years, if the Client instructs] |
| Snapshot before each release with database changes, before go-live imports and before each year-end close | At least 30 days |
| Monthly logical dump to write-once storage | 12 months |
| File store daily; weekly copy to the second region or site | Daily 35 days; monthly 12 months |
| Encryption keys and application secrets | Versioned in the secret store, with a sealed escrow copy under dual control |

## Recovery objectives

| Scenario | RPO | RTO |
|---|---|---|
| API instance failure | 0 | Under 5 minutes |
| Availability zone failure | 0 | Under 15 minutes |
| Database instance failure (with standby) | 0 | Under 15 minutes |
| Logical corruption or wrong mass change | 15 minutes or less | 4 hours or less |
| Loss of uploaded files | 24 hours or less | 4 hours or less |
| Regional or site outage | 24 hours or less | 24 hours or less (warm standby option: 8 hours) |

The regional objectives apply only when the Order Form includes a DR environment or cross-region backups (included for the Enterprise size). The objectives become binding when the Client accepts them in the Order Form and the environment is provisioned to meet them.

## Restore tests and drills

| Test | Frequency |
|---|---|
| Check that backup jobs succeeded and the latest restorable time is within 15 minutes | Daily |
| Point-in-time restore to a new instance, application started against it, smoke test | Quarterly and before go-live |
| Logical dump restore into a clean PostgreSQL 16 with row counts compared | Twice a year |
| Secret escrow check under dual control | Yearly |
| Tabletop DR exercise with the Client | Yearly |
| Full recovery in the recovery region or site | Every two years |

Results are recorded and reported in the monthly service report.

# Availability

1. Availability target of production: 99.5% in each calendar month, measured in service hours (08:00 to 18:00 PHT, Monday to Friday, except Philippine regular holidays), excluding planned maintenance and the exclusions below. [Option with 24x7 monitoring: measured over all hours.]
2. Availability is measured by an external synthetic health check every 5 minutes. Production is unavailable when two consecutive checks fail.
3. Planned maintenance takes place in the window Saturday 20:00 to Sunday 06:00 PHT, or at another time agreed with the Client, with at least 5 Business Days' notice.
4. Exclusions: force majeure; failures of the public internet or of the Client's network or devices; suspension under the MSA; acts or omissions of the Client; emergency maintenance to fix a critical security vulnerability, notified as soon as possible.

## Availability credits

| Monthly availability | Credit on the monthly hosting fee |
|---|---|
| 99.0% to below 99.5% | [5%] |
| 98.0% to below 99.0% | [7.5%] |
| Below 98.0% | [10%] |

Credits are capped at [10%] of the monthly hosting fee, are claimed and applied as in the Support Agreement, and are the Client's sole financial remedy for missed availability, except that availability below 98.0% in 3 consecutive months gives the Client a right to terminate this Hosting Agreement for cause.

# Security

iorta TechNXT applies at least the following controls:

1. network zones: public edge (CDN, WAF, load balancer), private application zone, private data zone and an administration zone with multi-factor sign-in and logged access;
2. WAF with managed rule sets and rate limits;
3. encryption in transit (HTTPS; TLS to the database) and at rest (database, file store, backups) with keys held in the provider's key service under the hosting account;
4. secrets in a secret store; separate secrets per environment; sealed escrow copy of the data encryption key;
5. least-privilege administrator access, named accounts, multi-factor authentication and quarterly access reviews;
6. vulnerability scanning of images and dependencies, monthly patching and critical patches within [7] days;
7. a yearly penetration test of production by an independent tester, with a summary shared with the Client and findings fixed on a risk basis;
8. logs of administrator access and security events kept for at least [2] years;
9. incident response under the Support Agreement and breach notification under the Data Processing Agreement.

The Client may ask for the provider's certifications (for example ISO/IEC 27001 and SOC 2 reports for AWS and Azure, or the local partner's equivalent evidence) once a year.

# Data residency and cross-border transfer

1. Under options A and B, the Client Data, including Personal Data, is stored and processed in Singapore. This is a transfer outside the Philippines. The Data Privacy Act of 2012 allows it, but the Client as personal information controller remains responsible for the data transferred (section 21 of the DPA) and must use contractual or other reasonable means to give comparable protection.
2. The Client decides the hosting option, records the transfer in its privacy notice, records of processing and privacy impact assessment, and confirms the decision in the Order Form.
3. iorta TechNXT binds the provider by the provider's data processing terms, keeps the data in the region stated in the Order Form, and does not move it to another country without the Client's prior written consent.
4. Under option C, the Client Data is stored and processed in the Philippines, including backups and the off-site copy.
5. Support staff of iorta TechNXT may access the Client Data remotely from [the Philippines / list of countries] only to perform the Services, under the Data Processing Agreement.

# Fees and pass-through of cloud costs

## Monthly hosting fee

The monthly hosting fee (production plus one UAT environment) is stated in the Order Form. List prices of the price book dated 03 October 2026, excluding VAT:

| Size | AWS (PHP a month) | Azure (PHP a month) | Local partner (PHP a month) |
|---|---|---|---|
| Small | 30,000.00 | 31,000.00 | 28,000.00 |
| Medium | 62,000.00 | 65,000.00 | 59,000.00 |
| Large | 112,000.00 | 118,000.00 | 107,000.00 |
| Enterprise | 244,000.00 | 256,000.00 | 232,000.00 |

The fee includes the provider's charges for the sized resources and a margin for exchange rate movement, monitoring, patching and backup checks. Additional environments are PHP 11,000.00 a month each, with a one-time set-up fee of PHP 100,000.00. The hosting fee and the fee for additional environments do not increase at each anniversary; they change only under the Pass-through and adjustments clause.

## Billing

The hosting fee is invoiced monthly in advance from the date the environment is handed over to the Client, and is payable within 30 days. VAT is added and withholding tax is handled under the MSA.

## Pass-through and adjustments

1. **Provider price or exchange rate change.** Cloud providers bill in USD. If the provider's list prices for the resources in use, or the PHP per USD reference rate of the Bangko Sentral ng Pilipinas, change by more than [5%] compared with the basis in the Order Form (PHP [62.75] per USD on [25 September 2026]), either Party may ask for the fee to be adjusted in proportion, with 30 days' written notice, not more than once in each 6 months.
2. **Usage above the sizing.** Resources needed beyond the sizing of the Order Form because of the Client's volumes (storage, data transfer, larger database or more instances) are charged at the provider's cost plus the margin in the Order Form, after iorta TechNXT notifies the Client and the Client approves, except where needed urgently to keep the service running, in which case iorta TechNXT notifies the Client within 1 Business Day.
3. **Third-party usage charges.** E-mail sending above normal volumes, SMS, payment gateway fees and domain names are not included and are passed through at cost or paid by the Client directly.
4. **Reserved capacity.** [Option: if the Client commits to a 1-year or 3-year term, iorta TechNXT may buy reserved capacity or a savings plan and pass [50%] of the saving to the Client. The commitment is then non-cancellable for its term.]

# Client responsibilities

1. Choose the hosting option and approve the data location and transfer.
2. Provide and keep its domain names and DNS records where its own domain is used.
3. Provide and keep its SMTP mailbox and payment gateway merchant accounts and credentials.
4. Approve planned maintenance windows and releases in time.
5. Keep its own network, devices and browsers secure.
6. Tell iorta TechNXT in advance of large data loads, new branches or volume growth.

# Exit and transition

The Exit and Transition Plan sets out the steps, formats, timelines and forms of this clause.

1. On expiry or termination, or earlier at the Client's request for a planned move, iorta TechNXT provides: (a) a full export of the Client Data (PostgreSQL dump, document archive and CSV extracts with the data dictionary) within 30 days of the request; (b) the configuration export of the Platform; (c) reasonable cooperation with the Client's new hosting provider, including a handover meeting and answers to questions for up to [5] man-days at no charge, then at day rates.
2. Where the Client holds a perpetual licence and will host the Platform itself, iorta TechNXT supplies the deployment guide and the container images or build artefacts of the current release, and supports the move at day rates.
3. iorta TechNXT keeps the environment running, at the monthly hosting fee prorated, for up to [90] days after termination if the Client asks, to allow parallel running and cutover.
4. After the Client confirms the export, iorta TechNXT deletes the Client Data and the environments within 30 days, lets backups expire under the retention above, and gives a certificate of deletion, as stated in the Data Processing Agreement.
5. The Client remains responsible for keeping its own records for the periods required by law (including the Insurance Code and the tax laws) after it receives the export.

# Term and termination

1. This Hosting Agreement starts when the first environment is handed over and lasts for the hosting term in the Order Form (at least 12 months), renewing automatically for 12-month periods unless either Party gives 90 days' written notice.
2. Either Party may terminate for cause under the MSA.
3. iorta TechNXT may suspend the hosting services for non-payment under the MSA.

# Signatures

| For iorta TechNXT Corp. | For [Client legal name] |
|---|---|
| Signature: ____________________ | Signature: ____________________ |
| Name: [name] | Name: [name] |
| Title: [title] | Title: [title] |
| Date: [date] | Date: [date] |

# Schedule 1: hosting details

| Item | Value |
|---|---|
| Option | [A: AWS Singapore / B: Azure Southeast Asia / C: local partner, name and city] |
| Size | [Small / Medium / Large / Enterprise] |
| Environments | [Production, UAT, additional environments] |
| DR | [Included (Enterprise) / optional / none] |
| Monthly hosting fee (excluding VAT) | PHP [amount] |
| Discount, if any ([lever]) | PHP [amount] |
| Exchange rate basis | PHP [62.75] per USD on [25 September 2026] |
| Hosting term | [12 / 36 / 60] months from handover |
| Data location approved by the Client | [Singapore / Philippines] |
| Client's privacy impact assessment reference | [reference] |
| Recovery objectives accepted | [Yes, as in the Recovery objectives chapter / as amended: details] |

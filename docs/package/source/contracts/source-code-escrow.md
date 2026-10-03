---
title: Escrow Agreement
subtitle: Source code escrow (optional)
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT Corp.
reviewed: Legal counsel (to be completed)
approved: To be completed
change: Template for discussion; subject to review by the parties' legal counsel and the escrow agent
open_item: Choice of escrow agent; review of this template against the escrow agent's standard terms by the parties' legal counsel
acronyms: AMC=Annual Maintenance Contract; MSA=Master Services Agreement; OOTB=Out of the box; PDRC=Philippine Dispute Resolution Center, Inc.; PHP=Philippine peso; RA=Republic Act; SEC=Securities and Exchange Commission; VAT=Value-added tax
---

# About this template

> Template for discussion; subject to review by the parties' legal counsel and the escrow agent.

This Source Code Escrow Agreement (the **Escrow Agreement**) is an optional annex to the Perpetual Software Licence Agreement for iNXT BrokerVerse OOTB. It is used only when the Order Form states "Source code escrow: Yes". It is not available with a subscription.

It is a three-party agreement between iorta TechNXT Corp. as depositor, the Client as beneficiary, and an independent escrow agent. It puts into effect the Source code escrow clause of the Perpetual Software Licence Agreement: the deposit, the updates, the release events and the use of released code are the same in both documents. If the escrow agent requires its own standard form, that form is used only if it is adapted to state the same terms, and the parties' legal counsel confirm this before signature.

Text in [square brackets] is a placeholder or an option. Capitalised terms not defined here have the meaning given in the Master Services Agreement (the **MSA**) and the Perpetual Software Licence Agreement (the **Licence Agreement**) between iorta TechNXT and the Client.

# Agreement and definitions

## Parties and background

This Escrow Agreement is made on [date] at [Makati City / Taguig City], Philippines, between:

1. **iorta TechNXT Corp.**, a corporation organised under the laws of the Philippines, SEC registration no. [number], with principal office at [address], represented by [name, title] (the **Depositor** or **iorta TechNXT**);
2. **[Client legal name]**, a corporation organised under the laws of the Philippines, SEC registration no. [number], with principal office at [address], represented by [name, title] (the **Beneficiary** or the **Client**); and
3. **[Escrow agent legal name]**, [a corporation organised under the laws of the Philippines / of country], [registration details], with principal office at [address], represented by [name, title] (the **Escrow Agent**).

Each is a **Party** and together they are the **Parties**.

Background:

- iorta TechNXT has granted the Client a perpetual licence of iNXT BrokerVerse OOTB in object code under the Licence Agreement dated [date] and Order Form no. [number].
- The Licence Agreement provides that iorta TechNXT deposits the source code of the Licensed Software with an escrow agent, to be released to the Client only on a Release Event.
- The Escrow Agent is independent of iorta TechNXT and the Client and agrees to hold the deposit on the terms below.

## Definitions

| Term | Meaning |
|---|---|
| Deposit Materials | The materials listed in Schedule 1, for the release of the Licensed Software in production at the Client, as updated under this Escrow Agreement |
| Deposit | One delivery of Deposit Materials to the Escrow Agent |
| Major Release | A release of the Licensed Software that iorta TechNXT identifies in its release notes as a major release |
| Release Event | An event listed in the Release events clause |
| Release Notice | A written notice from the Client to the Escrow Agent claiming that a Release Event has occurred |
| Counter-notice | A written notice from iorta TechNXT to the Escrow Agent disputing a Release Notice |
| Verification | A check of a Deposit by the Escrow Agent, at the level stated in Schedule 2 |
| Business Day | A day other than a Saturday, Sunday or a regular or special non-working holiday declared in Metro Manila |

## Appointment

The Client and iorta TechNXT appoint the Escrow Agent to receive, hold and release the Deposit Materials under this Escrow Agreement. The Escrow Agent accepts the appointment. The Escrow Agent has only the duties written in this Escrow Agreement.

# Deposit and verification

## Deposit

### First deposit

iorta TechNXT delivers the first Deposit within 60 days of Go-Live. The Deposit covers the release of the Licensed Software installed in the Client's production environment at that date.

### Updates

1. iorta TechNXT delivers an updated Deposit after each Major Release, within [30] days of the release, and in any case at least once a year, while the AMC is in force. Each updated Deposit covers the latest release available to the Client under the AMC.
2. Each updated Deposit replaces the earlier one. The Escrow Agent keeps the [two] latest Deposits and returns or destroys earlier ones to iorta TechNXT, with a written confirmation.
3. When the AMC is no longer in force, iorta TechNXT has no further duty to update the Deposit. The latest Deposit remains in escrow while this Escrow Agreement is in force.

### Form of a Deposit

1. Each Deposit is delivered on encrypted electronic media or by a secure electronic transfer that the Escrow Agent provides. The decryption key is delivered separately to the Escrow Agent.
2. Each Deposit comes with a deposit form signed by iorta TechNXT (Schedule 3) that lists the release, the contents, the build tool versions and a checksum of each archive.
3. Deposit Materials do not contain Client Data, production secrets, encryption keys or passwords of any environment.

### Receipt

The Escrow Agent confirms receipt of each Deposit to iorta TechNXT and the Client within 5 Business Days, stating the date, the release named on the deposit form and whether the media could be read and the checksums matched. The Escrow Agent does not otherwise open or examine a Deposit, except for a Verification.

### Warranties of iorta TechNXT

iorta TechNXT warrants that each Deposit:

1. is the source code of the release named on its deposit form, in the form used by iorta TechNXT to build that release;
2. with the build instructions, allows a reasonably skilled developer familiar with the technologies in Schedule 1 to build the Licensed Software without further help from iorta TechNXT;
3. lists the third-party and open-source components that are not included in source form and where they can be obtained.

## Verification

1. The Client may ask the Escrow Agent for a Verification of the latest Deposit, at the level stated in Schedule 2, not more than once a year and after each Major Release.
2. The Client pays the Escrow Agent's verification fee. iorta TechNXT provides reasonable assistance by remote session for up to [1] man-day per Verification at no charge; further assistance is charged at the day rates of the Order Form.
3. The Escrow Agent performs the Verification in a secure environment, does not keep copies beyond what the Verification needs, and reports the result to iorta TechNXT and the Client.
4. If a Verification finds that a Deposit does not meet the warranties above, iorta TechNXT delivers a corrected Deposit within [30] days at its own cost and pays the cost of a second Verification of the corrected Deposit.

# Release

## Release events

The Escrow Agent releases the Deposit Materials to the Client only on one of these Release Events, which are the release events of the Licence Agreement:

1. iorta TechNXT ceases to carry on business, is dissolved, or is declared insolvent or placed under rehabilitation or liquidation under RA 10142 (Financial Rehabilitation and Insolvency Act), and no successor assumes its obligations under the AMC within 60 days; or
2. iorta TechNXT, while the AMC is in force and paid, fails to correct a P1 or P2 defect within 60 days of a written notice from the Client, and does not cure the failure within a further 30 days of a second notice.

An assignment of the Licence Agreement and the AMC to an Affiliate or a successor of iorta TechNXT under the MSA is not a Release Event, provided the assignee assumes all of iorta TechNXT's obligations.

## Release procedure

1. **Release Notice.** The Client sends a Release Notice to the Escrow Agent, with a copy to iorta TechNXT. The Release Notice names the Release Event and attaches the evidence: for the first Release Event, a copy of the court order, the SEC record or other public record; for the second, copies of both written notices on the defect and the ticket history.
2. **Counter-notice.** iorta TechNXT may send a Counter-notice to the Escrow Agent, with a copy to the Client, within [15] Business Days of receiving the Release Notice, stating why no Release Event has occurred.
3. **Release without dispute.** If the Escrow Agent receives no Counter-notice within that period, it releases the latest Deposit to the Client within 5 Business Days after the period ends.
4. **Release by agreement.** The Escrow Agent also releases the Deposit on a joint written instruction of iorta TechNXT and the Client.
5. **Dispute.** If a Counter-notice is received, the Escrow Agent keeps the Deposit until it receives a joint written instruction or a final arbitral award or court decision. The dispute is resolved by expedited arbitration administered by the Philippine Dispute Resolution Center, Inc. under its rules, by one arbitrator, seated in [Makati City], in English, under RA 9285. The Escrow Agent follows the award.
6. **No other release.** The Escrow Agent does not release the Deposit Materials to anyone except as stated in this clause, or as a court or a regulator with authority orders, after notice to iorta TechNXT and the Client where lawful.

## Use of released code

1. On release, the Client may use the Deposit Materials only to maintain and correct the Licensed Software for its own internal business under the Licence Agreement, by its own staff or by a contractor bound by confidentiality duties no less protective than this Escrow Agreement.
2. The Client may not sell, license or disclose the Deposit Materials to anyone else, use them to provide services to other brokers or agents, or use them to build a competing product.
3. The Deposit Materials remain Confidential Information and the property of iorta TechNXT. Release grants no other right and does not change the Licensed Users, the environments or the purpose in the Licence Agreement.
4. The Client tells iorta TechNXT, or its successor or liquidator, in writing the names of the contractors given access to the Deposit Materials.

# Fees, duties and term

## Fees

1. The Client pays the Escrow Agent's fees in Schedule 4: the set-up fee, the yearly fee, the fee for each updated Deposit beyond [one] a year, the verification fee and the release fee.
2. iorta TechNXT bears its own cost of preparing and delivering each Deposit.
3. The Escrow Agent invoices the Client yearly in advance. Fees exclude VAT. If an invoice remains unpaid 30 days after a written reminder, the Escrow Agent notifies iorta TechNXT and the Client, and either of them may pay it to keep this Escrow Agreement in force. If no payment is received within a further 30 days, the Escrow Agent may terminate this Escrow Agreement under the Term and termination clause.

## Duties and liability of the Escrow Agent

1. The Escrow Agent keeps the Deposit Materials in a secure, access-controlled storage with environmental protection, with at least the care it uses for its own most valuable records, and keeps a log of every access.
2. The Escrow Agent may rely on any notice or document it reasonably believes to be genuine and signed by an authorised person of the Party concerned.
3. The Escrow Agent is not responsible for the content, completeness or quality of a Deposit, except for the checks it reports on receipt and in a Verification.
4. The Escrow Agent's total liability under this Escrow Agreement is limited to [the fees paid to it in the 12 months before the claim / PHP amount], except for fraud, gross negligence or wilful misconduct.

## Confidentiality

Each Party keeps the Deposit Materials and the terms of this Escrow Agreement confidential, under the Confidentiality clause of the MSA as between iorta TechNXT and the Client, and with at least the same standard on the part of the Escrow Agent. The Escrow Agent's staff with access to the Deposit Materials are bound by written confidentiality duties.

## Term and termination

1. This Escrow Agreement starts on the date it is signed by all Parties and continues while the Licence Agreement is in force, unless terminated under this clause.
2. It ends: (a) on release of the Deposit Materials to the Client and payment of the Escrow Agent's fees; (b) on termination of the Licence Agreement; (c) on written notice from the Client to the other Parties at any time; or (d) on a joint written instruction of iorta TechNXT and the Client.
3. The Escrow Agent may resign on [90] days' written notice, or terminate for unpaid fees as stated in the Fees clause. iorta TechNXT and the Client then appoint a replacement escrow agent on the same terms, and the Escrow Agent transfers the Deposit Materials to it.
4. On termination other than by release or transfer, the Escrow Agent returns the Deposit Materials to iorta TechNXT, or destroys them on its instruction, and confirms this in writing to iorta TechNXT and the Client.
5. The Use of released code, Confidentiality and Fees clauses survive termination.

## General

1. **Governing law.** This Escrow Agreement is governed by the laws of the Republic of the Philippines.
2. **Disputes between iorta TechNXT and the Client** on matters other than a release are resolved under the Dispute resolution clause of the MSA.
3. **Notices** are in writing in English and are delivered by hand, by courier, or by e-mail confirmed by courier, to the addresses in the signature blocks.
4. **Order of precedence.** Between iorta TechNXT and the Client, the Licence Agreement prevails over this Escrow Agreement on the scope of the licence; this Escrow Agreement prevails on the deposit, verification and release procedure.
5. **Amendment** is valid only in writing signed by all three Parties.
6. **Electronic signatures and counterparts** are accepted under RA 8792 (Electronic Commerce Act of 2000).

# Signatures

| For iorta TechNXT Corp. (Depositor) | For [Client legal name] (Beneficiary) | For [Escrow agent] (Escrow Agent) |
|---|---|---|
| Signature: ____________ | Signature: ____________ | Signature: ____________ |
| Name: [name] | Name: [name] | Name: [name] |
| Title: [title] | Title: [title] | Title: [title] |
| Date: [date] | Date: [date] | Date: [date] |
| Notice address and e-mail: [entry] | Notice address and e-mail: [entry] | Notice address and e-mail: [entry] |

# Schedules

## Schedule 1: Deposit Materials

| Item | Content |
|---|---|
| Back-end source code | Source of the API (Node.js 22), including the database migrations and the seed data |
| Front-end source code | Source of the web application (React 18), with its build configuration |
| Database | Schema of the PostgreSQL 16 database as created by the migrations; the data dictionary |
| Build and deployment | Package manifests and lock files, container build files, deployment scripts and the deployment guide, with the versions of the build tools |
| Build instructions | Step-by-step instructions to build the back end and the front end from the Deposit and to install them in a clean environment, with a smoke test |
| Upload templates and document templates | The delivered upload templates and printed document templates of the release |
| Third-party components | List of the third-party and open-source components with their versions, licences and sources |
| Release notes | Release notes of the deposited release |
| Excluded | Client Data; secrets, encryption keys and passwords of any environment; iorta TechNXT internal tools that are not needed to build or run the Licensed Software |

## Schedule 2: verification levels

| Level | What the Escrow Agent checks |
|---|---|
| Level 1: inventory | Media readable; checksums match the deposit form; contents match Schedule 1 by file inventory; no Client Data or secrets present |
| Level 2: build | Level 1, plus a build of the back end and the front end from the Deposit by following the build instructions in a clean environment, and a start of the API against an empty PostgreSQL 16 database with the migrations applied |

The level chosen by the Client: [Level 1 / Level 2].

## Schedule 3: deposit form

| Field | Entry |
|---|---|
| Deposit no. | [number] |
| Licence Agreement and Order Form | [dates and numbers] |
| Release deposited | [release tag and date] |
| Archives and checksums | [file name: checksum] |
| Build tool versions | [Node.js, package manager, container tool and others] |
| Delivered by (iorta TechNXT) | [name, title, signature, date] |
| Received by (Escrow Agent) | [name, title, signature, date] |

## Schedule 4: fees of the Escrow Agent

The fees are those of the Escrow Agent's quotation ref. [reference], payable by the Client and excluding VAT.

| Fee | Amount (PHP) | When |
|---|---|---|
| Set-up | [amount] | On signature |
| Yearly fee, including [one] updated Deposit | [amount] | Yearly in advance |
| Each additional updated Deposit | [amount] | On deposit |
| Verification, Level 1 | [amount] | On request |
| Verification, Level 2 | [amount] | On request |
| Release | [amount] | On release |

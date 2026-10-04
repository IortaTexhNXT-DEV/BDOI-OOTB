---
title: Competitive Battlecard
subtitle: INTERNAL: not for clients
version: 1.1.1
date: 04 October 2026
prepared: iorta TechNXT Corp.
reviewed: To be completed
approved: To be completed
change: Version 1.1.1: release figures aligned with the release verification of 04 October 2026 (proof points). Version 1.1: position, proof points and limits updated for AML/CFT, the IC and NPC registers, BIR forms and EOPT, integrations, dealer programmes, branding, My Work and the Report Builder
open_item: Win and loss evidence, client references and any named competitor positioning to be verified before use
acronyms: AE=Account executive; AML=Anti-money laundering; AMLC=Anti-Money Laundering Council; EIS=Electronic Invoicing System; EOPT=Ease of Paying Taxes Act; KYC=Know your customer; AMC=Annual Maintenance Contract; BIR=Bureau of Internal Revenue; CR=Change request; CTPL=Compulsory Third Party Liability; DPA=Data Privacy Act of 2012; DPO=Data protection officer; EWT=Expanded withholding tax; IC=Insurance Commission; LOB=Line of business; OOTB=Out of the box; OR=Official receipt; PHP=Philippine peso; SAWT=Summary Alphalist of Withholding Taxes; QAP=Quarterly Alphalist of Payees; SLSP=Summary List of Sales and Purchases; SoD=Segregation of duties; TCO=Total cost of ownership; UAT=User acceptance test
---

# Purpose and handling

This battlecard helps the iorta TechNXT sales team win against the alternatives a Philippine non-life broker already uses or is considering instead of iNXT BrokerVerse OOTB. It is organised by **category of alternative**, not by competitor: what the broker gets from it, where it hurts, what to ask, what to show and what to avoid saying.

> INTERNAL. Do not send, forward or show this document to a prospect, a client or a partner. Prospect-facing answers are in the FAQ and Objection Handling document and the Demo Script.

Rules for using it:

- **No claims about named competitors.** Do not describe a named product's features, prices, clients or weaknesses. If a prospect names a product, ask what they like about it and compare against the category, using facts about iNXT BrokerVerse only.
- If a named competitor must be discussed internally, keep to its own published positioning and mark the statement **[to verify]** until checked against the competitor's current public material. None is named in this version.
- Every proof point must be something the prospect can see: a screen in the demo, a document in the package, or a figure from the Rate Card or the pricing workbook.
- Say plainly what the OOTB version does not do (FAQ, chapter on known limits). Losing a deal on a disclosed limit costs less than losing a reference after go-live.

# Where we win and where we do not

## Our position in one paragraph

iNXT BrokerVerse OOTB keeps the broker's policy, money and books in one record, built for Philippine non-life broking: premium taxes by LGU, CTPL tariff and authentication, client onboarding with risk-based AML/CFT due diligence, screening and AMLC report files, co-insurance, remittance to insurers by share, direct bill, commission with withholding and the licence check on agents, bank and insurer reconciliation, bank payment files, month-end close, the BIR forms and DAT files (2307, 0619-E, 1601-EQ, 1604-E, 2551Q, SAWT, QAP, SLSP), EOPT sales invoices and the CAS books pack, the IC registers and working papers, and the Data Privacy Act functions with a breach register. Connectors to SMS gateways, the CTPL provider, insurers and banks run through one monitored outbox, and each broker's brand prints on every screen, document and e-mail. It is delivered as a configured product, not a project, with a published price list, an 8-week plan for a small broker and hosting in Singapore or the Philippines.

## Strong fit

- Brokers with 10 to 300 users who run placement, collections, remittance and accounting themselves.
- Brokers with several insurers, co-insurance or direct bill business, where the remittance and reconciliation work is heavy.
- Brokers preparing for an IC examination, a BIR audit or a Data Privacy Act review who need records, controls and an audit trail.
- Brokers whose key staff hold the process in spreadsheets and who worry about a person leaving.
- Brokers who must stand up an AML/CFT programme, IC complaints handling or EOPT invoicing and have no tool for it.
- Captive agencies and brokers of motor dealers and banks: dealer programmes, fleets and bank endorsement letters.

## Weak fit (qualify out or set expectations early)

- A broker that wants every screen to match its current process exactly: OOTB means configuration, and changes are priced change requests.
- A broker whose main need is a live API to many insurers on day one: the insurer connector is in the product, but each insurer goes live separately with its own endpoint and acceptance during onboarding.
- Life, pre-need or HMO business: the product is built for non-life broking.
- A buyer who needs a native mobile application or Filipino screens now.
- A broker that only needs a contact list and quote tracking: a CRM or spreadsheet may be enough for them.

# Alternative 1: spreadsheets and an accounting package

## What the broker has

Excel workbooks for the policy register, renewals, collections and remittance; an off-the-shelf accounting package for the books; e-mail and paper for approvals. Often run well by long-serving staff.

## Why they stay

- No licence cost visible; the team knows the files.
- The accounting package is trusted by the external auditor.
- Fear of a long project and of disruption at month-end.

## Where it hurts (to uncover, not to assert)

- Premium collected but not yet remitted, per insurer, is worked out by hand.
- Commission, EWT and Form 2307 are prepared outside the books and reconciled late.
- Renewals depend on one person's calendar.
- No audit trail of who changed a premium or a rate; no maker-checker.
- Personal data in files on laptops and e-mail, with no record of consent or of data subject requests.

## Discovery questions

- "When a client pays, how many places is the payment typed before it reaches the insurer's remittance?"
- "How do you know today which premium is collected but not yet remitted, per insurer?"
- "Who prepares Form 2307 and the QAP, and how long does it take each quarter?"
- "If the person who keeps the renewal file is on leave, who sends the notices?"
- "If a client asked for all personal data you hold on them, how would you find it?"

## Proof points

| Point | Show | Demo Script reference |
|---|---|---|
| One record from quotation to remittance | Follow one policy from the Placement Slip to the official receipt and the remittance | 0:15 Placement; 0:33 Money in; 0:39 Money out |
| The books follow the business | Bank reconciliation, month-end close approval, posting rules readable and approved by a second user | 0:45 Close and tax |
| BIR working papers from the same ledger | BIR Form 2307, VAT Summary, SAWT, QAP | 0:45 Close and tax |
| Renewals do not depend on one person | Renewal Queue with notices at 60, 30 and 15 days | 0:29 Renewals |
| Controls | Authority Matrix, Segregation of Duties, Audit Trail | 0:51 Controls and data privacy |
| Compliance without a second tool | AML dashboard, client risk rating and EDD, transaction alerts; licence register with the commission hold; complaints register | Optional segments: AML/CFT; IC compliance |
| Everyone knows what to do today | Operations > My Work: items by category, team view, tasks and calendar | Optional segment: My Work |

## Landmines to set

- "Ask any system you look at to show the remittance to one insurer built from what was actually collected, split by co-insurance share."
- "Ask to see Form 2307 and the SAWT come out of the same ledger as the commission."
- "Ask who approves a change to a commission rate, and where that approval is recorded."

## Watch out

- Do not criticise the finance team's accounting package. If they keep it, BrokerVerse can be the broking ledger and send the trial balance or journal register to it as Excel or CSV.
- Do not promise a direct interface to their package; it is a change request.

# Alternative 2: insurer portals

## What the broker has

Each insurer's own portal or agent system to quote and issue motor, CTPL and simple personal lines, plus the insurer's statements of account. The broker keeps its own records in spreadsheets around these portals.

## Why they stay

- Issuance is fast for simple lines and the insurer bears the system cost.
- The CTPL certificate and authentication are completed in the insurer's or the government's system anyway.

## Where it hurts

- One login per insurer; no comparison across insurers for the client.
- The broker's view of its own book is spread across portals; the client belongs to the portal, not the broker.
- Collections, remittance, commission, co-insurance and the broker's books are not covered by any one insurer's portal.
- Commercial lines (fire, IAR, marine, casualty, engineering) need slips to several insurers that portals do not handle.

## Discovery questions

- "How many insurer portals do your staff sign into each day?"
- "Where do you see one client's policies across all insurers?"
- "How do you compare insurers' offers for a client today?"
- "How do you reconcile each insurer's statement of account against what you collected and remitted?"

## Proof points

| Point | Show | Demo Script reference |
|---|---|---|
| The broker owns the client view | Operations > Clients: one client with its policies, claims, renewals and endorsements across insurers | 0:23 Servicing and claims |
| Compare insurers for the client | Broker Slip with market responses from several insurers; Compare offers | 0:15 Placement |
| Commercial lines with co-insurance | Placement Slip with lead and co-insurers, shares to 100% | 0:15 Placement |
| Insurer statements matched | Accounts > Insurer Reconciliation with an imported statement | Not in the standard script: add on request after 0:39 Money out |

## Landmines to set

- "Ask whether the system gives you one view of a client across every insurer."
- "Ask how a co-insured fire risk is placed, billed and remitted by share."

## Watch out

- Do not position BrokerVerse as a replacement for the CTPL authentication provider. The IC-accredited provider authenticates; BrokerVerse sends the request through its connector, keeps the COC series and records the authentication code.
- The insurer connector is delivered in test mode. Each insurer goes live with its own endpoint, credentials and acceptance during onboarding, priced per connector; do not promise a date for an insurer before it has agreed.

# Alternative 3: regional or global broking systems

## What the broker sees

Broker management systems sold across several countries, often with a large feature list, a regional reference base and a partner-led implementation. A broker with a foreign parent may be asked to use the group system.

## Why they are chosen

- A group mandate or a familiar brand.
- Broad functions, including some the broker may not use.
- Perceived lower risk of a vendor with many countries.

## Where we compete

Compare against Philippine work the broker does every day, not against feature counts. Ask the prospect to verify each point with the other vendor, not to take our word for it.

| Question for the prospect to put to any vendor | What iNXT BrokerVerse shows |
|---|---|
| Are DST, VAT, LGT by city or municipality and FST computed on the quotation and the bill? | Premium Taxes & LGU Rates applied on every quotation, policy, endorsement and renewal |
| Is the CTPL tariff per vehicle class held in the system and protected from discount? | Motor template with 1-year and 3-year CTPL, read-only and never discounted |
| Are Form 2307, 0619-E, 1601-EQ, 1604-E and 2551Q, with the DAT files of the alphalists, produced from the ledger and reconciled? | Accounts > Tax > Withholding Returns, BIR DAT Files |
| Are sales invoices issued under the EOPT Act, and is the CAS books pack produced? | Accounts > Tax > Sales Invoices, CAS Books and Documents |
| Is there an AML/CFT programme with screening, transaction monitoring and AMLC report files? | Compliance menu |
| Are IC licences, insurer certificates of authority and complaints tracked with deadlines? | Compliance > Insurance Commission (compliance registers) |
| Are Philippine bank statement formats delivered for reconciliation? | BDO, BPI, Metrobank and generic formats |
| Is the implementation priced and planned before signature? | Rate Card; 8, 12 or 16 to 20 weeks by size |
| Can the data stay in the Philippines? | Local partner or broker-hosted options |
| Is consent and data subject request handling in the product, with a breach register on the 72-hour clock? | Master > Data Privacy; Breach Register |

## Discovery questions

- "Which functions of that system would your team use every day?"
- "Who would configure the Philippine taxes and BIR forms, and is that in the quoted price?"
- "Where would your data be hosted, and who signs the data processing agreement?"
- "What is the total cost over five years, including implementation, localisation and support?"

## Proof points

| Point | Show | Reference |
|---|---|---|
| Philippine premium taxes on a quotation | Order Summary of a quotation with VAT 12%, DST of PHP 0.50 per PHP 4.00 or fraction, LGT 0.75% and CTPL | Demo Script 0:09 Prospect and quotation |
| BIR outputs | Form 2307, 1601-EQ with its reconciliation, DAT files, a sales invoice | Demo Script 0:45 Close and tax; optional segment BIR and EOPT |
| Price certainty | Package totals over 5 years | Rate Card; Price Book workbook |
| Regulatory mapping | Philippine Regulatory Compliance Matrix | Package document |

## Landmines to set

- "Ask for the five-year cost with the Philippine localisation and BIR outputs included and priced."
- "Ask to see the LGT of a client in a named city computed on the quotation."
- "Ask where support is provided from and in which time zone."

## Watch out

- Do not quote other vendors' prices or published estimates in front of a prospect unless the source is verified and current **[to verify]**. The FAQ's comparison with global system pricing is for internal context only until verified.
- With a group mandate, sell to the local finance and operations pain (remittance, BIR, reconciliation) and offer BrokerVerse as the local system feeding the group with exports.

# Alternative 4: a custom build

## What the broker considers

An in-house development team, a local software house, or a low-code platform, building a system "exactly to our process".

## Why they choose it

- Exact fit to current processes; ownership of the code.
- A trusted developer relationship.
- A belief that the broker's process is too unusual for a product.

## Where it hurts

- Time: a broking and accounting system takes a long time to build and test; the broker pays during the build.
- Scope: policy, remittance, commission, co-insurance, reconciliation, close, BIR forms, privacy, security controls are each a project.
- Keeping up: BIR, IC and NPC changes must be built and paid for by the broker each time.
- Key person risk moves from the spreadsheet owner to the developer.

## Discovery questions

- "What is the build estimate, and does it include accounting, BIR forms, reconciliation and the security controls?"
- "Who maintains it when a BIR form changes, and who pays?"
- "How will it be tested before go-live? How many test cases?"
- "What happens if the developer leaves?"

## Proof points

| Point | Show | Reference |
|---|---|---|
| Already built and tested | 629 test cases, 1,113 automated backend tests and 175 front-end tests, 433-step end-to-end cycle and 52-check go-live rehearsal on the final code | Test Summary Report |
| Configure, not code | Master > Configuration by business area; Product Configurator; Document Numbering | Demo Script 0:51 Controls and data privacy; Implementation Approach |
| Security controls already in place | Two-step verification, lockout, maker-checker, audit trail, OWASP mapping | Architecture, Infrastructure, Security and Privacy; Security Due Diligence Questionnaire |
| Continuity | Mainstream technology (React, Node.js, PostgreSQL); optional source code escrow with the perpetual licence; broker can host | FAQ; Escrow Agreement |

## Landmines to set

- "Ask the builder for the test evidence they will hand over at go-live."
- "Ask how the month-end close and sub-ledger tie-out will be built and proven."
- "Ask who will update the system when the BIR changes a form."

## Watch out

- Do not dismiss the developer relationship. Offer the change request route for genuine gaps, priced at the published day rates, and the API for the developer to build around the product.

# Alternative 5: do nothing now

| Signal | Response | Proof |
|---|---|---|
| "Next year" | Offer the workshop now: a sized plan and a price valid 90 days | Rate Card validity |
| An audit or IC examination is coming | Show the audit trail, the IC registers, the AML programme and the controls | Demo Script 0:51 Controls and data privacy; optional segments |
| A new rule takes effect (EOPT invoicing, AMLC reporting, complaints handling) | Show the screen that meets it and who confirms the settings | Optional segments; FAQ |
| A key person is leaving or retiring | Show renewals, remittance and close running without one person's files | Demo Script 0:29 Renewals; 0:45 Close and tax |
| A system contract is ending | Plan back from the end date; small broker 8 weeks | Implementation Approach |

# Objections specific to competition

| Objection | Answer with a fact | Proof |
|---|---|---|
| "The other system has more features." | "Which of them would your team use every day? Let us look at those against your own example." | Demo with the prospect's example |
| "The other vendor is bigger." | "Size matters less than who supports you in Manila time and how quickly. Here are our support targets and the agreement that fixes them." | Production Support Approach; SLA |
| "The other quote is cheaper." | "Let us compare five-year totals with implementation, localisation, hosting and support included." | Rate Card five-year totals |
| "Our developer can build this." | "Here is what is already built and tested; your developer can extend around it through the API." | Test Summary Report; API catalogue |
| "Our insurer gives us a free portal." | "Keep it for issuance; BrokerVerse gives you the client view across insurers and does the money and the books." | Demo Script 0:23 Servicing and claims; 0:39 Money out |

# Disclose early: known limits that competitors may raise

| Limit | Honest position |
|---|---|
| Partner interfaces in test mode | SMS, CTPL, LTO, insurer, bank file and EIS connectors are delivered in test mode; each partner certifies its interface during onboarding |
| IC reports are working papers | The accountant confirms the IC annual statement figures and transcribes them onto the IC form set; the broker files |
| No native mobile app | Web application for desktop and laptop browsers |
| AML lists not supplied | The broker loads the lists it is entitled to use or contracts a screening provider; the AMLC file layout is confirmed by the compliance officer |
| Tax treatment | The tax adviser confirms ATCs, rates, invoice wording and VAT treatment; the system does not e-file |
| No external penetration test yet | Recommended before go-live; committed yearly once hosted |
| No ISO/IEC 27001 or SOC 2 certificate of iorta TechNXT | Cloud providers hold theirs; iorta TechNXT plan [to confirm] |
| Client references | [to confirm which clients iorta TechNXT may name] |

# Win and loss log

After every decision, the account executive records in the sales pipeline record: the alternative chosen, the reason given, the reason believed, the price gap if any, and the limit that mattered. The sales head reviews the log each quarter and updates this battlecard. Win and loss figures: [to confirm once the first decisions are logged].

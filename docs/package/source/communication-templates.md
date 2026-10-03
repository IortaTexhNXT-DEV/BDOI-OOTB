---
title: BrokerVerse Communication Templates and Touchpoints
subtitle: E-mails, notifications and printed documents
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT
reviewed:
approved:
acronyms: OOTB=Out of the box; SMTP=Simple Mail Transfer Protocol; PLA=Preliminary Loss Advice; OR=Official receipt; AR=Acknowledgement receipt; SOA=Statement of account; DN=Debit note; BIR=Bureau of Internal Revenue; IAR=Industrial All Risks; HTML=Hypertext Markup Language; API=Application programming interface
---

# About this document

This document lists every message BrokerVerse OOTB sends or prepares: e-mails to clients, insurers, agents and staff, the in-app notifications in the header bell, and the printed documents that accompany the client and insurer journey. For each e-mail it gives the trigger, the recipient, the template and where it is configured, the subject and body exactly as seeded, the merge fields, attachments and the setting that switches it on or off.

The facts come from the application code (every call that queues an e-mail or creates a notification) and from the seeded settings of the loaded test system on 03 October 2026. The companion workbook **BrokerVerse_Communication_Touchpoints.xlsx** holds the same inventory in one sheet per channel.

# How messages are sent

## E-mail

Every e-mail is first written to the outbox (`email_outbox`): recipient, cc, subject, HTML body, template code, and the record it concerns. The **E-mail outbox** job (every 5 minutes) sends up to 50 queued messages per run through the SMTP server and marks them sent, or retries up to 5 times and then marks them failed. Master > E-mail Outbox lists every message with its status and last error, and has Retry.

| Control | Setting / location | OOTB |
|---|---|---|
| Master switch: e-mail leaves the system | `notification.email_enabled` (Master > Configuration > Notifications & E-mail > Notifications) | Off |
| SMTP server | Environment variable `SMTP_URL` | Not set in the OOTB package |
| Sender | `notification.from_address` | BrokerVerse <connect@iortatechnxt.com> |
| Outbox retention | `housekeeping.email_outbox_sent_days`, `housekeeping.email_outbox_failed_days` | 180, 730 days |

While sending is off, e-mails still queue (the test system holds 260 queued e-mails), and the send and share dialogs tell the user that the message was only queued. When sending is switched on, the queue is delivered by the next run, so review the outbox before switching on in a system that held test data.

Four e-mails carry their document as a PDF attachment: the official receipt (E20), the premium invoice (E21), the policy issued e-mail (E07, with the policy schedule) and the commission debit note (E14). The PDF is generated when the e-mail is sent, so it shows the record as it is then, and Master > E-mail Outbox names the attachment on each message. One message may carry at most `email.max_attachment_mb` (10 MB) of attachments; a larger message fails at once with the reason in the outbox. Scheduled reports and remittance statements still travel as download links.

## Templates and merge fields

Templates are settings. Most are edited on Master > Configuration (the area is given with each template). A template is HTML with placeholders in double braces, for example `{{policyNumber}}`. Values are HTML-escaped in the body and inserted as plain text in the subject. A placeholder with no value is left empty. A template whose subject is missing stops the action with "E-mail template email.template.<key> is not configured". `{{companyName}}` is the name of the letterhead company (Company master).

## In-app notifications

Notifications appear under the bell in the top bar (Top bar > Notifications). A notification goes to one user, or to every user holding a permission (an "audience"), with a type (info, task, approval, reminder, alert, warning, action), a title, a message and a link to the record. Read notifications are deleted after `housekeeping.notifications_read_days` (180).

## Other channels

There is no SMS, Viber or WhatsApp sending. Where a screen offers SMS, Phone or Letter (renewal reminders, collection follow-ups, remittance notifications), the action is only logged. Staff share the quotation approval link and online payment links by copying them (Copy approval link; payment link pay address).

Two-factor authentication uses an authenticator app (time-based codes); the system sends no code by e-mail or SMS for it.

# Journey overview

| Stage | Client | Insurer | Internal |
|---|---|---|---|
| Quotation | Quotation approval request (E01), share quotation (E02, E03) | Quotation submitted to insurer (E04) | Quotation sent for approval, customer accepted, quotation approved |
| Placement | | Request for quotation (E05), placement slip firm order (E06) | |
| Policy issue and servicing | Policy issued with schedule attached (E07), endorsement / cancellation (E08) | | Policy issued, endorsement completed |
| Billing and collection | Payment reminder (E11), collection follow-up (E12), official receipt (E20), premium invoice (E21) | | Payment to verify, online payments, credit limit, warranty, collection reminders |
| Claims | PLA copy (cc of E13) | Preliminary Loss Advice (E13) | New claim, status changes, settlement approval |
| Renewal | Renewal notices (E09), renewal reminder (E10) | | Renewal reminders and approvals, renewed, lapsed |
| Remittance and commission | | Commission debit note (E14), remittance bill / statement (E15, E16), composed notifications (E17) | Remittance, debit note, incentive approvals |
| Finance and period end | | | JV and petty cash approvals, month-end reminders |
| Reporting and security | | | Scheduled reports (E18), password reset (E19) |

# E-mails to clients

| No. | E-mail | Stage | Recipient |
|---|---|---|---|
| E01 | Quotation approval request | Quotation | Lead e-mail, else client e-mail (required when sending is enabled) |
| E02 | Share quotation | Quotation | The address typed in the Share dialog; lead e-mail from the coverage view |
| E03 | Custom e-mail from the Share dialog | Quotation | Any address typed (with optional cc) |
| E07 | Policy issued | Policy issue | Client e-mail on the policy, else the lead e-mail |
| E08 | Endorsement or cancellation to customer | Policy servicing | Client e-mail (skipped silently when the client has none) |
| E09 | Renewal notice (First, Second, Final) | Renewal | Client e-mail (required; a notice by e-mail is refused when the client has none) |
| E10 | Renewal reminder | Renewal | Client e-mail |
| E11 | Premium payment reminder | Billing and collection | Client e-mail (clients without one are skipped and listed) |
| E12 | Collection follow-up e-mail | Billing and collection | Client e-mail, or the address typed |
| E20 | Official receipt | Billing and collection | Client e-mail, or the address typed (with optional cc) |
| E21 | Premium invoice / statement of account | Billing and collection | Client e-mail, or the address typed (with optional cc) |

## E01 Quotation approval request

| Item | Detail |
|---|---|
| Trigger | Staff click Send for customer approval on a Draft quotation (quotation must have a premium). |
| Screen | Operations > Sales & Marketing > Quotations > Quote detail > Send for customer approval |
| Recipient | Lead e-mail, else client e-mail (required when sending is enabled) |
| Channel | E-mail through the outbox |
| Template code (outbox) | `quote_approval` |
| Configured in | email.template.quote_approval; Master > Configuration > Notifications & E-mail > E-mail templates |
| Merge fields | customerName, productType, quotationNumber, currency, grossPremium, approvalUrl, validHours, companyName |
| Attachments | None; the e-mail carries a signed approval link valid for quotations.approval_link_ttl_hours (168 hours) |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |
| Notes | Status becomes PendingCustomer even when the e-mail cannot leave; staff can copy the link (Copy approval link) to share by Viber or WhatsApp. Also notifies the Processing Team (in-app). |

Subject:

```
{{companyName}}: please review quotation {{quotationNumber}}
```
Body:

```
<p>Dear {{customerName}},</p>
<p>Your {{productType}} quotation <b>{{quotationNumber}}</b> is ready. Gross premium: {{currency}} {{grossPremium}}.</p>
<p><a href="{{approvalUrl}}">Review and accept the quotation</a> (link valid for {{validHours}} hours).</p>
<p>Thank you,<br/>{{companyName}}</p>
```

## E02 Share quotation

| Item | Detail |
|---|---|
| Trigger | Staff share a quotation from the Share dialog, or e-mail it from the coverage detailed view before a policy exists. |
| Screen | Operations > Sales & Marketing > Quotations > Quote detail > Share; Operations > Sales & Marketing > Quotations > Coverage detailed view |
| Recipient | The address typed in the Share dialog; lead e-mail from the coverage view |
| Channel | E-mail through the outbox |
| Template code (outbox) | `share_quote` |
| Configured in | email.template.share_quote; Master > Configuration > Notifications & E-mail > E-mail templates |
| Merge fields | customerName, message, quotationNumber, productType, currency, grossPremium, validUntil, companyName, insurerName, netPremium, sumInsured |
| Attachments | None (the quotation PDF is downloaded separately: Share > Download) |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |

Subject:

```
Your {{productType}} quotation {{quotationNumber}}
```
Body:

```
<p>Dear {{customerName}},</p>
<p>{{message}}</p>
<p>Quotation <b>{{quotationNumber}}</b> ({{productType}}): gross premium {{currency}} {{grossPremium}}, valid until {{validUntil}}.</p>
<p>{{companyName}}</p>
```

## E03 Custom e-mail from the Share dialog

| Item | Detail |
|---|---|
| Trigger | Staff edit the generated text in the Share dialog and send it. |
| Screen | Operations > Sales & Marketing > Quotations > Quote detail > Share |
| Recipient | Any address typed (with optional cc) |
| Channel | E-mail through the outbox |
| Template code (outbox) | `custom` |
| Configured in | None: the text is composed on screen (Generate starts from email.template.share_quote) |
| Merge fields | - |
| Attachments | None |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |

Subject:

```
(typed by the user)
```
Body:

```
(typed by the user)
```

## E07 Policy issued

| Item | Detail |
|---|---|
| Trigger | Staff click the e-mail action on the coverage detailed view of a quotation that has a policy. Not sent automatically at issue. |
| Screen | Operations > Sales & Marketing > Quotations > Coverage detailed view |
| Recipient | Client e-mail on the policy, else the lead e-mail |
| Channel | E-mail through the outbox |
| Template code (outbox) | `policy_issued` |
| Configured in | email.template.policy_issued; Master > Configuration > Notifications & E-mail > E-mail templates |
| Merge fields | customerName, policyNumber, productType, quotationNumber, currency, grossPremium |
| Attachments | Policy schedule PDF (`policy-schedule-<policy number>.pdf`) when the quotation has a policy |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |

Subject:

```
Your policy {{policyNumber}} has been issued
```
Body:

```
<p>Dear {{customerName}},</p>
<p>Policy <b>{{policyNumber}}</b> ({{productType}}) was issued from quotation {{quotationNumber}}. Gross premium: {{currency}} {{grossPremium}}.</p>
```

## E08 Endorsement or cancellation to customer

| Item | Detail |
|---|---|
| Trigger | Staff send a draft endorsement to the customer, or initiate a policy cancellation. |
| Screen | Operations > Policy > Endorsement > Summary (Send to customer / Initiate cancellation) |
| Recipient | Client e-mail (skipped silently when the client has none) |
| Channel | E-mail through the outbox |
| Template code (outbox) | `endorsement_customer` |
| Configured in | email.template.endorsement_customer; Master > Configuration > Notifications & E-mail > E-mail templates |
| Merge fields | customerName, action (endorsement or cancellation), endorsementNumber, policyNumber, currency, premiumDelta, companyName |
| Attachments | None |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |

Subject:

```
{{companyName}}: {{action}} {{endorsementNumber}} on policy {{policyNumber}}
```
Body:

```
<p>Dear {{customerName}},</p>
<p>We have prepared {{action}} <b>{{endorsementNumber}}</b> on policy {{policyNumber}}. Premium adjustment: {{currency}} {{premiumDelta}}.</p>
<p>{{companyName}}</p>
```

## E09 Renewal notice (First, Second, Final)

| Item | Detail |
|---|---|
| Trigger | Staff send the next notice from the Renewal Queue, or a Renewal Batch sends notices for the selected policies. |
| Screen | Operations > Renewals > Renewal Queue (Send notice); Operations > Renewals > Renewal Batch > Send Renewal Notices |
| Recipient | Client e-mail (required; a notice by e-mail is refused when the client has none) |
| Channel | E-mail through the outbox |
| Template code (outbox) | `renewal-notice-first / -second / -final` |
| Configured in | renewals.notice_subject, renewals.notice_template, renewals.notice_stages; Master > Configuration > Policies, Endorsements & Renewals > Renewals |
| Merge fields | noticeLabel (First Notice, Second Notice, Final Notice), clientName, policyNumber, insurerName, expiryDate, currency, premium, companyName |
| Attachments | None |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail); order enforced by renewals.enforce_notice_order |
| Notes | The policy owner also gets an in-app reminder. The same subject and body serve all three stages; only noticeLabel changes. |

Subject:

```
{{noticeLabel}}: renewal of policy {{policyNumber}} (expires {{expiryDate}})
```
Body:

```
<p>Dear {{clientName}},</p>
<p>Your policy <b>{{policyNumber}}</b> with {{insurerName}} expires on {{expiryDate}}.</p>
<p>Renewal premium: {{currency}} {{premium}}.</p>
<p>Please contact us to renew and keep your cover in force.</p>
<p>{{companyName}}</p>
```

## E10 Renewal reminder

| Item | Detail |
|---|---|
| Trigger | Staff log a reminder with method Email. |
| Screen | Operations > Renewals > Renewal Queue > Send Reminder |
| Recipient | Client e-mail |
| Channel | E-mail through the outbox |
| Template code (outbox) | `renewal-reminder` |
| Configured in | renewals.notice_subject, renewals.notice_template; Master > Configuration > Policies, Endorsements & Renewals > Renewals |
| Merge fields | as the renewal notice, with noticeLabel = Renewal Reminder |
| Attachments | None |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |
| Notes | Methods SMS, Phone and Letter are only logged; nothing is sent. |

Subject:

```
{{noticeLabel}}: renewal of policy {{policyNumber}} (expires {{expiryDate}})
```
Body:

```
<p>Dear {{clientName}},</p>
<p>Your policy <b>{{policyNumber}}</b> with {{insurerName}} expires on {{expiryDate}}.</p>
<p>Renewal premium: {{currency}} {{premium}}.</p>
<p>Please contact us to renew and keep your cover in force.</p>
<p>{{companyName}}</p>
```

## E11 Premium payment reminder

| Item | Detail |
|---|---|
| Trigger | The Collection reminders job (daily 08:00) or the Send Payment Reminders Now button: bills due within collections.reminder_days_before (7) days or overdue, not reminded in collections.reminder_repeat_days (7) days. |
| Screen | Master > Schedules (collection-reminders); Accounts > Collections > Send Payment Reminders Now |
| Recipient | Client e-mail (clients without one are skipped and listed) |
| Channel | E-mail through the outbox |
| Template code (outbox) | `collection-reminder` |
| Configured in | collections.email_subject, collections.email_template; Master > Configuration > Billing, Collections & Credit > Collections |
| Merge fields | clientName, policyNumber, billNumber, amount (with peso sign), dueDate, daysPastDue, companyName |
| Attachments | None |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail); the job can be switched off on Master > Schedules |
| Notes | The body says "is due on" also for overdue bills. The policy owner and holders of write:collections get an in-app reminder. |

Subject:

```
Premium payment reminder – Policy {{policyNumber}}
```
Body:

```
<p>Dear {{clientName}},</p>
<p>This is a friendly reminder that the premium of <b>{{amount}}</b> for policy <b>{{policyNumber}}</b> (bill {{billNumber}}) is due on {{dueDate}}.</p>
<p>Please disregard this notice if payment has been made.</p>
<p>{{companyName}}</p>
```

## E12 Collection follow-up e-mail

| Item | Detail |
|---|---|
| Trigger | Staff send an e-mail from a collection item, or a premium reminder from the Premium Warranty Monitor. |
| Screen | Accounts > Collections > Detail > Send e-mail; Accounts > Credit Control > Premium Warranty Monitor > Remind |
| Recipient | Client e-mail, or the address typed |
| Channel | E-mail through the outbox |
| Template code (outbox) | `collection-follow-up` |
| Configured in | collections.email_subject (when no subject is typed), collections.email_template (when no notes are typed); Master > Configuration > Billing, Collections & Credit > Collections |
| Merge fields | as the payment reminder |
| Attachments | None |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |
| Notes | Logged as an Email action on the collection item (and as a reminder on the warranty monitor). |

Subject:

```
Premium payment reminder – Policy {{policyNumber}} (or the subject typed)
```
Body:

```
The notes typed on screen, or the collection template above
```

## E20 Official receipt

| Item | Detail |
|---|---|
| Trigger | Staff click E-mail receipt on a receipt, or automatically when a receipt is recorded and `receipts.email_on_record` is on. |
| Screen | Accounts > Receipts > View > E-mail receipt |
| Recipient | The address typed, else the client e-mail; refused with "The client has no e-mail address; enter one" when there is none |
| Channel | E-mail through the outbox |
| Template code (outbox) | `official-receipt` (`official-receipt-auto` when sent automatically) |
| Configured in | receipts.email_subject, receipts.email_template, receipts.email_on_record; Master > Configuration > Billing, Collections & Credit > Receipts |
| Merge fields | clientName, receiptNumber, policyNumber, amount, receiptDate, paymentMode, referenceNo, balance, customerCode, note, companyName |
| Attachments | Official receipt PDF (`receipt-<OR number>.pdf`) |
| On / off | `receipts.email_on_record` (false) for the automatic e-mail; `notification.email_enabled` on and SMTP configured |

Subject:

```
Official receipt {{receiptNumber}} for policy {{policyNumber}}
```
Body (summary): thanks the client for the payment, names the attached receipt, then a table of amount received, date received, mode of payment, reference and balance remaining, the note typed on screen, and the company name.

## E21 Premium invoice / statement of account

| Item | Detail |
|---|---|
| Trigger | Staff click E-mail invoice on a collection item, or automatically when a bill is issued from a policy, endorsement or renewal and `billing.email_on_issue` is on. |
| Screen | Accounts > Collections > Detail > E-mail invoice |
| Recipient | The address typed, else the client e-mail |
| Channel | E-mail through the outbox |
| Template code (outbox) | `premium-invoice` (`premium-invoice-auto` when sent automatically) |
| Configured in | billing.email_subject, billing.email_template, billing.payment_instructions, billing.email_on_issue; Master > Configuration > Other settings > Billing |
| Merge fields | clientName, billNumber, policyNumber, productName, insurerName, netPremium, taxes, grossPremium, amountDue, billDate, dueDate, paymentInstructions, note, companyName |
| Attachments | Premium invoice PDF (`invoice-<bill number>.pdf`) |
| On / off | `billing.email_on_issue` (false) for the automatic e-mail; `notification.email_enabled` on and SMTP configured |

Subject:

```
Premium invoice {{billNumber}} for policy {{policyNumber}}
```
Body (summary): names the attached invoice, then a table of net premium, taxes and charges, gross premium, amount due and due date, the payment instructions, the note, and the company name.

# E-mails to insurers and agents

| No. | E-mail | Stage | Recipient |
|---|---|---|---|
| E04 | Quotation submitted to insurer | Quotation | Insurer contact e-mail (Insurance Company master); insurers without one are listed as failed |
| E05 | Request for quotation (broker slip) | Placement | Each pending insurer on the slip (contact e-mail from the Insurance Company master) |
| E06 | Placement slip (firm order) | Placement | Each participant not yet confirmed; one e-mail per insurer showing its own share |
| E13 | Preliminary Loss Advice | Claims | Insurer e-mail, else claims.pla_default_recipient (OOTB claims@brokerverse.local); cc the insured client |
| E14 | Commission debit note | Remittance and commission | The address entered, else the insurer e-mail |
| E15 | Agency bill or insurer remittance statement | Remittance and commission | The address entered, else the agent user e-mail, else the insurer e-mail |
| E16 | Remittance statement (advice) | Remittance and commission | Each address entered |
| E17 | Remittance notification (composed) | Remittance and commission | Each recipient containing @ |

## E04 Quotation submitted to insurer

| Item | Detail |
|---|---|
| Trigger | Staff submit a customer-accepted quotation to the insurer, or send a quotation to selected insurers. |
| Screen | Operations > Sales & Marketing > Quotations > Quote detail > Submit to insurer; Quote detail > Share > Send to insurer |
| Recipient | Insurer contact e-mail (Insurance Company master); insurers without one are listed as failed |
| Channel | E-mail through the outbox |
| Template code (outbox) | `insurer_submission` |
| Configured in | email.template.insurer_submission; Master > Configuration > Notifications & E-mail > E-mail templates |
| Merge fields | insurerName, quotationNumber, customerName, productType, currency, sumInsured, grossPremium, companyName |
| Attachments | None |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |

Subject:

```
Placement request {{quotationNumber}} - {{productType}}
```
Body:

```
<p>Dear {{insurerName}} underwriting team,</p>
<p>Please review quotation <b>{{quotationNumber}}</b> for {{customerName}} ({{productType}}), sum insured {{currency}} {{sumInsured}}, indicated gross premium {{currency}} {{grossPremium}}.</p>
<p>{{companyName}}</p>
```

## E05 Request for quotation (broker slip)

| Item | Detail |
|---|---|
| Trigger | Staff submit a broker slip to the market, or add an insurer to a submitted slip. |
| Screen | Operations > Sales & Marketing > Request for Quotation (Broker Slip) > Submit; Detail > Add insurer |
| Recipient | Each pending insurer on the slip (contact e-mail from the Insurance Company master) |
| Channel | E-mail through the outbox |
| Template code (outbox) | `broker_slip_request` |
| Configured in | email.template.broker_slip_request; Master > Configuration > Notifications & E-mail > E-mail templates |
| Merge fields | insurerName, slipNumber, insuredName, productType, currency, sumInsured, period, covers, responseDueDate, companyName, offerNumber |
| Attachments | None (Broker Slip PDF available on the detail screen) |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |

Subject:

```
Request for quotation {{slipNumber}} - {{productType}} - {{insuredName}}
```
Body:

```
<p>Dear {{insurerName}} underwriting team,</p>
<p>We invite your quotation for the risk below.</p>
<p>Broker slip <b>{{slipNumber}}</b><br/>Insured: {{insuredName}}<br/>Class: {{productType}}<br/>Sum insured: {{currency}} {{sumInsured}}<br/>Period: {{period}}<br/>Requested covers: {{covers}}</p>
<p>Please send your terms (premium, rate, deductibles, conditions, the line you can write and the validity of the offer) by <b>{{responseDueDate}}</b>.</p>
<p>{{companyName}}</p>
```

## E06 Placement slip (firm order)

| Item | Detail |
|---|---|
| Trigger | Staff send the placement slip to the participating insurers (all, or selected ones). |
| Screen | Operations > Sales & Marketing > Placement Slips > Detail > Send to insurer(s) |
| Recipient | Each participant not yet confirmed; one e-mail per insurer showing its own share |
| Channel | E-mail through the outbox |
| Template code (outbox) | `placement_order` |
| Configured in | email.template.placement_order; Master > Configuration > Notifications & E-mail > E-mail templates |
| Merge fields | insurerName, placementNumber, insuredName, productType, period, currency, sumInsured, sharePercent, role, shareSumInsured, sharePremium, sharePremiumTotal, companyName |
| Attachments | None (Placement Slip PDF per participant on the detail screen) |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |

Subject:

```
Placement slip {{placementNumber}} - firm order - {{insuredName}}
```
Body:

```
<p>Dear {{insurerName}} underwriting team,</p>
<p>On behalf of our client we place the risk below with you and request your confirmation of cover and your policy / certificate number.</p>
<p>Placement slip <b>{{placementNumber}}</b><br/>Insured: {{insuredName}}<br/>Class: {{productType}}<br/>Period: {{period}}<br/>Sum insured (100%): {{currency}} {{sumInsured}}<br/>Your share: <b>{{sharePercent}}%</b> ({{role}})<br/>Your share of sum insured: {{currency}} {{shareSumInsured}}<br/>Your share of premium: {{currency}} {{sharePremium}} (gross {{currency}} {{sharePremiumTotal}})</p>
<p>{{companyName}}</p>
```

## E13 Preliminary Loss Advice

| Item | Detail |
|---|---|
| Trigger | A claim is registered (the registration form includes the Send mail step). |
| Screen | Operations > Claims > Register claim > Send mail |
| Recipient | Insurer e-mail, else claims.pla_default_recipient (OOTB claims@brokerverse.local); cc the insured client |
| Channel | E-mail through the outbox |
| Template code (outbox) | `claim-pla` |
| Configured in | claims.pla_subject, claims.pla_template; Master > Configuration > Claims |
| Merge fields | insurerName, policyNumber, insuredName, claimNumber, lossDate, lossTime, lossPlace, lossType, currency, estimate, message (typed text), companyName |
| Attachments | None |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail); claims.pla_enabled |
| Notes | When the user types a subject other than "New Claim Notification", the subject becomes "<typed subject> - <claim number>" (the test data shows "Claim notification POL-... - CLM-..."). |

Subject:

```
Preliminary Loss Advice - {{claimNumber}} / {{policyNumber}}
```
Body:

```
<p>Dear {{insurerName}},</p>
<p>We advise a loss under policy <b>{{policyNumber}}</b> of {{insuredName}}.</p>
<p>Claim reference: {{claimNumber}}<br/>Date of loss: {{lossDate}} {{lossTime}}<br/>Place of loss: {{lossPlace}}<br/>Nature of loss: {{lossType}}<br/>Estimated amount: {{currency}} {{estimate}}</p>
<p>{{message}}</p>
<p>{{companyName}} Claims</p>
```

## E14 Commission debit note

| Item | Detail |
|---|---|
| Trigger | Staff send an approved commission debit note (direct bill). |
| Screen | Accounts > Remittance > Direct Bill Processing > Debit Notes > Send |
| Recipient | The address entered, else the insurer e-mail |
| Channel | E-mail through the outbox |
| Template code (outbox) | `commission-debit-note` |
| Configured in | direct_bill.email_subject, direct_bill.email_body; Master > Configuration > Remittance & Reconciliation > Direct bill |
| Merge fields | dnNumber, insurerName, amount (currency and amount), dueDate, companyName |
| Attachments | Commission debit note PDF (`debit-note-<DN number>.pdf`) |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |

Subject:

```
Commission debit note {{dnNumber}} – {{companyName}}
```
Body:

```
<p>Dear {{insurerName}},</p>
<p>Please find our commission debit note <b>{{dnNumber}}</b> for {{amount}}, due on {{dueDate}}.</p>
<p>Kindly settle the amount net of the expanded withholding tax on the commission and send BIR Form 2307 for the tax withheld.</p>
<p>{{companyName}}</p>
```

## E15 Agency bill or insurer remittance statement

| Item | Detail |
|---|---|
| Trigger | Staff send a generated agency bill (or an insurer remittance bill). |
| Screen | Accounts > Remittance > Agency Bill Processing > Send |
| Recipient | The address entered, else the agent user e-mail, else the insurer e-mail |
| Channel | E-mail through the outbox |
| Template code (outbox) | `remittance-bill` |
| Configured in | remittance.bill_email_subject, remittance.bill_email_body; Master > Configuration > Remittance & Reconciliation > Remittance to insurers |
| Merge fields | billNumber, billDate, currency, amount (net due plus previous balance), dueDate, companyName |
| Attachments | None |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |

Subject:

```
Statement of account {{billNumber}}
```
Body:

```
<p>Bill {{billNumber}} dated {{billDate}}: {{currency}} {{amount}}, due {{dueDate}}.</p>
```

## E16 Remittance statement (advice)

| Item | Detail |
|---|---|
| Trigger | Staff generate a remittance statement and enter e-mail recipients. |
| Screen | Accounts > Remittance > Statements > Generate |
| Recipient | Each address entered |
| Channel | E-mail through the outbox |
| Template code (outbox) | `remittance-statement` |
| Configured in | remittance.statement_email_subject, remittance.statement_email_body; Master > Configuration > Remittance & Reconciliation > Remittance to insurers |
| Merge fields | period, downloadUrl, fileName, companyName |
| Attachments | None; a link to the CSV statement |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |

Subject:

```
Remittance statement {{period}}
```
Body:

```
<p>Your remittance statement for {{period}} is available: <a href="{{downloadUrl}}">{{fileName}}</a></p>
```

## E17 Remittance notification (composed)

| Item | Detail |
|---|---|
| Trigger | Staff compose a notification with channel Email. |
| Screen | Accounts > Remittance > Notifications > Compose |
| Recipient | Each recipient containing @ |
| Channel | E-mail through the outbox |
| Template code (outbox) | `remittance-notification or the template code chosen` |
| Configured in | Remittance notification templates NTF-001 and NTF-002 (Master > Finance > Remittance Master) prefill the screen; Master > Finance > Remittance Master |
| Merge fields | Template NTF-001 variables {BillNo}, {Amount}, {DueDate}, {InsuredName} |
| Attachments | None |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |
| Notes | Channel SMS is recorded but nothing is sent. The template triggers ("Due Date - 5 days", "Payment Received") are not automated. |

Subject:

```
(typed or from the template)
```
Body:

```
The typed content wrapped in a paragraph
```

# E-mails to staff

| No. | E-mail | Stage | Recipient |
|---|---|---|---|
| E18 | Scheduled report | Reporting | The schedule recipients (up to 50 addresses) |
| E19 | Password reset code | Security | The user e-mail on the account (inactive users and users without e-mail get nothing; the screen answers the same in every case) |

## E18 Scheduled report

| Item | Detail |
|---|---|
| Trigger | A report schedule runs (its job report-<id>), or Run now. |
| Screen | Master > Schedules (report-<id>); report schedules via API |
| Recipient | The schedule recipients (up to 50 addresses) |
| Channel | E-mail through the outbox |
| Template code (outbox) | `scheduled-report` |
| Configured in | reports.email_subject, reports.email_body; Master > Configuration > Reports & Dashboards |
| Merge fields | companyName, reportName, from, to, rows, format, fileName, downloadUrl, generatedAt |
| Attachments | None; a signed link valid reports.download_link_ttl_hours (72) |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |

Subject:

```
{{companyName}}: {{reportName}} ({{from}} to {{to}})
```
Body:

```
<p>Good day,</p>
<p>The scheduled report <b>{{reportName}}</b> for {{from}} to {{to}} is ready ({{rows}} rows, {{format}}).</p>
<p><a href="{{downloadUrl}}">Download {{fileName}}</a></p>
<p>{{companyName}}</p>
```

## E19 Password reset code

| Item | Detail |
|---|---|
| Trigger | A user asks for a reset code on the sign-in page (Forgot password). |
| Screen | Sign-in > Forgot password |
| Recipient | The user e-mail on the account (inactive users and users without e-mail get nothing; the screen answers the same in every case) |
| Channel | E-mail through the outbox |
| Template code (outbox) | `password-reset` |
| Configured in | security.reset_email_subject, security.reset_email_body; Master > Configuration > Security & Access > Security |
| Merge fields | code (6 digits), minutes (security.reset_code_minutes, 15), companyName |
| Attachments | None |
| On / off | `notification.email_enabled` on and SMTP configured (applies to every e-mail) |
| Notes | Earlier codes are withdrawn; a code is withdrawn after security.reset_code_max_attempts (5) wrong tries. Requests are rate limited. |

Subject:

```
Your {{companyName}} password reset code
```
Body:

```
<p>Your verification code is <b>{{code}}</b>. It expires in {{minutes}} minutes. If you did not ask for it, ignore this e-mail.</p>
```

# In-app notifications

Messages are quoted as in the code; text in angle brackets is filled from the record. "Holders of <permission>" means every user whose roles grant that permission.

## Quotation

| Event | Recipient | Type | Title | Message | On / off |
|---|---|---|---|---|---|
| Quotation sent to customer for approval | Users with roles in quotations.approval_notify_roles (Processing Team) | approval | Quotation sent for approval | Quotation <number> (<customer>, <premium>) was sent to the customer for approval | notification.approval_requests |
| Customer accepts by the approval link, or staff record an acceptance | Quotation creator | task | Customer accepted quotation | The customer accepted quotation <number>; you can proceed to policy (recorded: "... (<channel>); ...") | None |
| Quotation approved | Quotation owner (not when they approved it) | info | Quotation <number> approved | Quotation <number> was approved by <user> and can be converted to a policy | notification.approval_requests |

## Policy issue

| Event | Recipient | Type | Title | Message | On / off |
|---|---|---|---|---|---|
| Policy issued from a quotation | Policy owner | info | Policy issued | Policy <number> was issued from quotation <number> (bill <bill number> | direct bill: the client pays the insurer) | None |
| Policy issued from a placement slip | Placement owner | info | Policy issued | Policy <number> was issued from placement slip <number> | None |

## Billing and collection

| Event | Recipient | Type | Title | Message | On / off |
|---|---|---|---|---|---|
| Premium payment captured on a policy, not yet verified | Accounting role users except the user who recorded it | approval | Premium payment to verify | <user> recorded <mode> <amount> (ref <reference>) on policy <number> | notification.approval_requests |
| Captured payment confirmed or rejected | User who recorded it | info / alert | Premium payment <reference> confirmed / rejected | Confirmed by <user> on policy <number>, receipt <OR> / Rejected by <user>: <reason> | notification.approval_requests |
| Online payment received, failed to apply or amount differs | Link creator and roles in payments.notify_roles_on_error (Accounting) | task | Online payment received / Online payment not applied / Online payment to review | <link number>: ... (amount, target and reason) | None |
| Collection reminder sent | Policy owner and holders of write:collections | reminder | Premium due <date> – <policy> / Premium overdue <n> day(s) – <policy> | <client>: <amount> outstanding on <bill> | None |
| Policy issued over the client credit limit | Holders of write:collections | warning | Client credit limit exceeded | <client>: open premium <exposure> is over the credit limit <limit> by <excess> after <policy> | None |
| Premium warranty extension requested | Holders of approve:credit-control | approval | Warranty extension <policy> awaiting approval | <user> submitted <policy> (<client>, deadline <date> to <date>: <reason>) | notification.approval_requests |
| Premium warranty extension decided | Requester | info / alert | Warranty extension <policy> approved / rejected | Deadline moved to <date>; approved by <user> / Rejected by <user>: <remarks> | notification.approval_requests |
| Cancellation for non-payment requested | Holders of write:endorsements | action | Cancellation for non-payment requested | <policy> (<client>): <endorsement number> | None |

## Policy servicing

| Event | Recipient | Type | Title | Message | On / off |
|---|---|---|---|---|---|
| Endorsement completed | Policy owner | info | Endorsement completed / Policy cancelled by endorsement | Endorsement <number> on policy <number> was completed (premium change <amount>) | None |

## Claims

| Event | Recipient | Type | Title | Message | On / off |
|---|---|---|---|---|---|
| Claim registered | Claim handler and policy owner | task | New claim <number> | Claim <number> registered on policy <number> | notification.claim_status |
| Claim status changes | Claim handler and policy owner | info | Claim <number>: <status> | <note> or "Claim <number> is now <status>" | notification.claim_status |
| Settlement submitted (maker-checker) | Claims role users except the submitter | approval | Claim settlement <claim> awaiting approval | <user> submitted <claim> (<amount>, <settlement type>) | claims.settlement_maker_checker, notification.approval_requests |
| Settlement approved or returned | Submitter | info / alert | Claim settlement <claim> approved / returned | Approved by <user> / Returned by <user>: <note> | notification.approval_requests |

## Renewal

| Event | Recipient | Type | Title | Message | On / off |
|---|---|---|---|---|---|
| Renewal notice sent | Policy owner | reminder | <notice label>: <policy> | <notice label> sent for policy <policy> expiring <date> | None |
| Renewal notices job (60, 30, 15 days) | Policy owner | reminder | Renewal due in <n> days | Policy <number> expires on <date> | notification.renewal_reminder |
| Renewal terms submitted | Users with roles in renewals.approver_roles (Processing Team) except the submitter | approval | Renewal <number> awaiting approval | <user> submitted <number> (policy <policy>, <premium>) | notification.approval_requests |
| Renewal approved or returned | Submitter (else the policy owner) | info / alert | Renewal <number> approved / returned | Approved / Returned by <user>: <note> | notification.approval_requests |
| Renewal completed | Policy owner | info | Policy renewed: <policy> | New term <new policy> from <inception> to <expiry> | None |
| Renewal lapsed (manual or pipeline job) | Policy owner | alert | Policy lapsed: <policy> | <reason> | None |

## Remittance and commission

| Event | Recipient | Type | Title | Message | On / off |
|---|---|---|---|---|---|
| Remittances submitted for approval | Holders of write:remittance | approval | Remittance batch <batch> awaiting approval | <user> submitted <n> remittance(s) in batch <batch> (<total>) | notification.approval_requests |
| Settlement submitted, adjustment needing approval, electronic transfer | Holders of write:remittance | approval | Settlement / Adjustment / Electronic transfer <reference> awaiting approval | <user> submitted <reference> (<description>, <amount>) | notification.approval_requests |
| Remittance, settlement, adjustment or transfer approved or rejected | Initiator | info / alert | <transaction type> <reference> approved / rejected | Approved by <user> / Rejected by <user>: <reason> | notification.approval_requests |
| Commission debit note submitted | Holders of write:remittance | approval | Commission debit note <DN number> awaiting approval | <user> submitted <DN number> (<insurer>, <amount>) | notification.approval_requests |
| Commission debit note decided | Creator | info / alert | Commission debit note <DN number> approved / rejected | Approved by <user> / Rejected by <user>: <reason> | notification.approval_requests |
| Incentive calculation submitted | Holders of write:incentive | approval | Incentive calculation <batch> awaiting approval | <user> submitted <batch> (period <period>) | notification.approval_requests |
| Incentive batch decided | Submitter | info / alert | Incentive calculation <batch> approved / rejected | Approved by <user> / Rejected by <user>: <reason> | notification.approval_requests |
| Commission lines eligible (marked by a user, or premium fully collected) | Holders of write:commission | approval | Commission payout <referrer> awaiting approval | <user> marked lines eligible / Premium of <policy> fully collected: <n> line(s) of <referrer> awaiting approval (<amount>) | notification.approval_requests |
| Commission lines approved | User who marked them eligible | info | Commission payout <referrer> approved | Approved by <user> | notification.approval_requests |

## Reinsurance

| Event | Recipient | Type | Title | Message | On / off |
|---|---|---|---|---|---|
| Treaty created or changed (reinsurance.treaty_requires_approval) | Holders of write:reinsurance | approval | Treaty <number> awaiting approval | <user> submitted <number> (<name>) | notification.approval_requests |
| Treaty decided | Submitter | info / alert | Treaty <number> approved / rejected | Approved by <user> / Rejected by <user>: <reason> | notification.approval_requests |

## Finance and period end

| Event | Recipient | Type | Title | Message | On / off |
|---|---|---|---|---|---|
| Journal voucher submitted for approval (manual, reversal, correction) | Holders of write:journal-vouchers | approval | Journal voucher <number> awaiting approval | <user> submitted <number> (<amount>) | notification.approval_requests |
| Bank adjustment journal awaiting approval; year-end adjustment journal (period 13) | Holders of write:journal-vouchers | approval | Journal voucher <number> awaiting approval | <user> submitted <number> (bank adjustment: <type>, <amount> / year-end adjustment, period <period>) | notification.approval_requests |
| Journal voucher approved (Journal Voucher, accounting queue, bank adjustment) | Creator | info | Journal voucher <number> approved | Approved and posted by <user> | notification.approval_requests |
| Journal voucher rejected | Creator | alert | Journal voucher <number> rejected | Rejected by <user>: <reason> | notification.approval_requests |
| Payment voucher submitted for approval (status For approval, agent payout vouchers) | Holders of write:disbursements | approval | Payment voucher <number> awaiting approval | <user> submitted <number> (<payee>, <amount>) | notification.approval_requests |
| Payment voucher approved (cheque approved, agent payout approved), or sent back to draft / cancelled while awaiting approval | Creator | info / alert | Payment voucher <number> approved / rejected / cancelled | Approved by <user> / Rejected by <user>: <reason> | notification.approval_requests |
| Cheque issued (Pending) | Holders of write:disbursements | approval | Cheque <number> awaiting approval | <user> submitted <number> (<payee>, <amount>) | notification.approval_requests |
| Cheque approved or cancelled while Pending | Creator | info / alert | Cheque <number> approved / cancelled | Approved / Cancelled by <user> | notification.approval_requests |
| Petty cash request submitted | Holders of write:disbursements | approval | Petty cash request <number> awaiting approval | <user> submitted <number> (<requester>, <amount>) | notification.approval_requests |
| Petty cash request decided | Creator | info / alert | Petty cash request <number> approved / rejected | Approved by <user> / Rejected by <user>: <reason> | notification.approval_requests |
| Posting rule or account determination change requested (accounting.configuration_maker_checker) | Holders of approve:posting-rules | approval | Configuration change <id> awaiting approval | <user> requested <kind>: <target> (<note>) | notification.approval_requests |
| Configuration change decided | Requester | info / alert | Configuration change <id> approved / rejected | <kind>: <target> approved by <user> and in effect / Rejected by <user>: <reason> | notification.approval_requests |
| Insurer reconciliation submitted | Holders of approve:insurer-reconciliation | approval | Insurer reconciliation <number> awaiting approval | <user> submitted <number> (<insurer>, <period>, paid <amount>) | notification.approval_requests |
| Insurer reconciliation decided | Submitter | info / alert | Insurer reconciliation <number> approved / rejected | Approved by <user> / Rejected by <user>: <reason> | notification.approval_requests |
| Bank reconciliation prepared | Holders of approve:bank-reconciliation | approval | Bank reconciliation <number> awaiting approval | <user> submitted <number> (<bank account>, period <period>, bank balance <amount>) | notification.approval_requests |
| Bank reconciliation approved, or reopened (rejected when it was prepared) | Preparer | info / alert | Bank reconciliation <number> approved / rejected / reopened | Approved by <user> / Rejected by <user>: <remarks> | notification.approval_requests |
| Month-end close submitted (accounting.period_close_requires_approval) | Holders of approve:period-end | approval | Month-end close <number> awaiting approval | <user> submitted <number>: close / soft close of period <period> | notification.approval_requests |
| Month-end close approved or rejected | Submitter | info / alert | Month-end close <number> approved / rejected | Period <period> closed; approved by <user> / Rejected by <user>: <reason> | notification.approval_requests |
| Petty cash fund below minimum | Custodian, holders of write:disbursements | alert | Petty cash <code> below minimum | Available <amount>; minimum cashbox <amount>. Replenish the fund. | None |
| Month-end reminder job | Holders of write:period-end (high priority) | reminder | Month-end close: <period> ends in <n> day(s) / Month-end close: <period> is still open | Accounting period <period> ends on <date>. Post pending journals and prepare the month-end close run. / ... ended on <date> and is not closed yet. | Job month-end-reminder (off by default) |

## Access control

| Event | Recipient | Type | Title | Message | On / off |
|---|---|---|---|---|---|
| Authority limit proposed | Holders of approve:access-control | approval | Authority limit #<id> awaiting approval | <user> proposed <transaction type> for <role or user>: <limit> (<remarks>) | notification.approval_requests |
| Authority limit decided | Proposer | info / alert | Authority limit #<id> approved / rejected | <transaction type> for <role or user>: <limit>, approved by <user> and in effect / Rejected by <user>: <note> | notification.approval_requests |
| Access review started | Holders of write:access-control | approval | Access review <name> awaiting decisions | <user> started <name>: <n> user(s) to keep or revoke by <due date> | notification.approval_requests |

Segregation-of-duties rules and delegations take effect when saved (no approval step). Instalment plans have no approval; a credit limit exception is reported to holders of write:collections, who acknowledge it. Endorsements are approved by the customer, not by a second user.

# Printed documents

These documents are produced as PDF on the screens and handed or sent to the client or insurer outside the e-mail templates. They use the letterhead of the Company master (the company marked as letterhead), the signatories master, and the settings of Master > Configuration > Company & Branding > Printed documents.

| Document | Where | For | Format | Configured by |
|---|---|---|---|---|
| Quotation (motor; fire / IAR) | Operations > Sales & Marketing > Quotations > Quote detail > Share > Download | Client | PDF | Company master letterhead, documents.* settings |
| Package quotation; insurer comparison | Master > Finance > Package Bundles > Print; Compare Insurers | Client | PDF | Letterhead; commission never printed |
| Broker slip (to the market or one insurer) | Request for Quotation > Detail > Broker Slip PDF | Insurer | PDF | Letterhead |
| Placement slip (lead, whole security, co-insurer share) | Placement Slips > Detail > Placement Slip PDF | Insurer | PDF | Letterhead |
| Insurance placing slip | Operations > Policy > Policy detail > Documents | Insurer | PDF | Letterhead |
| Policy schedule (motor; fire / non-motor) | Operations > Policy > Policy detail > Policy schedule | Client | PDF | Letterhead, signatories |
| Billing statement (policy, endorsement, renewal) | Policy detail > Generate invoice | Client | PDF | documents.payment_instructions |
| Acknowledgement receipt | Operations > Policy > Payment > Payments recorded > Print acknowledgement receipt | Client | PDF | documents.acknowledgement_receipt_note |
| Official receipt (single, bulk) | Accounts > Receipts > Print / Bulk print | Client | PDF | receipts.print_title, documents.receipt_footer |
| Payment voucher (bulk) | Accounts > Disbursement > Bulk print | Payee | PDF | Letterhead |
| Commission debit note | Accounts > Remittance > Direct Bill Processing > Debit Notes > Print | Insurer | PDF | Letterhead |
| Claims Acknowledgement Letter, Claims Data Sheet, Claims Discharge Voucher | Operations > Claims > Claim detail > Documents | Client / insurer | PDF | claims.documents (text lines with placeholders) |
| BIR Form 2307 | Accounts > Tax > BIR Form 2307 > Print | Payee | Print | bir.* settings |
| Bank reconciliation statement | Accounts > Bank Reconciliation > Reconciliations | Internal | PDF | Letterhead |
| Digital policy after online payment | Public pay page (/pay/<token>) > Policy | Client | PDF | Package or policy schedule |

Seeded wording used on documents:

| Setting | Text |
|---|---|
| documents.payment_instructions | Please settle the total amount due on or before the due date. Make cheques payable to {{companyName}} and quote the bill number as the payment reference. For bank transfers or e-wallet payments, send the proof of payment to your account officer. |
| documents.acknowledgement_receipt_note | This acknowledgement receipt is not an official receipt. The official receipt is issued once the payment is verified by Accounting. |
| claims.documents: Claims Acknowledgement Letter | We acknowledge receipt of your claim {{claimNumber}} under policy {{policyNumber}}. / Insured: {{insuredName}} / Date of loss: {{lossDate}} / Reported on: {{reportedDate}} / Our claims team will contact you within {{slaDays}} days. |

# Settings that switch messages on or off

| Setting | OOTB | Effect |
|---|---|---|
| `notification.email_enabled` | false | No e-mail leaves the system while off (all e-mails stay queued). |
| `notification.from_address` | BrokerVerse <connect@iortatechnxt.com> | Sender of every e-mail. |
| `notification.approval_requests` | true | Every approval notification: the requests to the approvers (type approval) and the decisions sent to the makers, in every maker-checker flow listed above. |
| `notification.claim_status` | true | Claim registration and status notifications to the handler and owner. |
| `notification.renewal_reminder` | true | The Renewal notices job (in-app reminders 60, 30, 15 days before expiry). |
| `receipts.email_on_record` | false | E-mail the official receipt (PDF attached) automatically when a receipt is recorded. |
| `billing.email_on_issue` | false | E-mail the premium invoice (PDF attached) automatically when a bill is issued. |
| `email.max_attachment_mb` | 10 | Largest total size of the attachments of one e-mail. |
| `claims.pla_enabled` | true | Preliminary Loss Advice e-mail on claim registration. |
| `claims.pla_default_recipient` | claims@brokerverse.local | PLA recipient when the insurer has no e-mail. Replace before go-live. |
| `renewals.enforce_notice_order` | true | First, second and final notice must go in order. |
| `collections.reminder_days_before` / `collections.reminder_repeat_days` | 7 / 7 | Payment reminder window and repeat interval. |
| `quotations.approval_notify_roles` | processing | Who is told a quotation went to the customer. |
| `quotations.approval_link_ttl_hours` | 168 | Validity of the customer approval link. |
| `renewals.approver_roles` | processing | Who approves renewal terms. |
| `payments.notify_roles_on_error` | accounting | Who is told about online payments. |
| Master > Schedules: collection-reminders, renewal-notices, month-end-reminder | on, on, off | Switch the scheduled messages on or off. |

# Gaps and observations

| No. | Observation | Effect | Suggested action |
|---|---|---|---|
| 2 | No e-mail is sent to the client for the claim acknowledgement, and the "Policy issued" e-mail (with the schedule attached) is sent only from the coverage detailed view, not at issue. The official receipt and the premium invoice are e-mailed with the PDF (E20, E21). | Claim acknowledgement letters are printed and sent by hand. | Add a claim acknowledgement e-mail if the broker wants it. |
| 3 | No commission statement e-mail to agents or referrers; the Broker Commission Statement and the incentive statement are on screen only. | Agents receive statements outside the system. | Add a commission statement template, or schedule the report per agent. |
| 4 | Remittance notification templates NTF-001 (trigger "Due Date - 5 days") and NTF-002 (SMS, trigger "Payment Received") are not automated, and SMS is not sent. | Templates suggest automation that does not exist. | Remove the triggers from the templates or implement them. |
| 5 | No welcome or credentials e-mail when a user is created or provisioned; initial passwords are handed over outside the system. | Manual step at user creation. | Keep the handover procedure in the security policy. |
| 6 | The payment reminder body says the premium "is due on" also when the bill is overdue. | Wording. | Add an overdue variant using `{{daysPastDue}}`. |
| 7 | `claims.pla_default_recipient` is seeded with a placeholder address (claims@brokerverse.local). | PLAs for insurers without e-mail go nowhere. | Set the broker's claims mailbox before go-live. |
| 8 | Remittance bill subject reads "Statement of account {{billNumber}}" and the body has no greeting or company name. | Plain message to agents and insurers. | Review the wording with the broker. |
| 9 | No e-mail or notification when a scheduled job fails (see the Schedules and Batch Jobs document). | Failures can go unnoticed. | Add an alert. |

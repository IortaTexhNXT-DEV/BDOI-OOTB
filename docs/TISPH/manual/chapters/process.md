<!--
Owner: see WRITER_GUIDE.md. One section per step of the TISPH business process, in order. Each names who does the
step ({{roles:...}} placeholders, never typed role names) and links to the screen sections.
-->
# The TISPH process end to end {#the-business-process-end-to-end}

The work of Toyota Insurance Services Philippines follows one chain: a lead becomes a quotation, the quotation is
placed with a panel insurer, the insurer's policy is booked and billed, Cash Control collects the premium, the premium
is remitted to the insurer, the commission is earned and paid, claims are followed up with the insurer, the policy is
renewed, and Finance closes the month and files the BIR returns. Each section below names the roles that do the
step, as delivered, and the screens where it is done.

## Leads from TFS, dealers and walk-in clients {#process-leads}

Prospects are entered by {{roles:write:leads}}, on [Prospects](#prospects). Leads are assigned to the sales team on
[Lead Assignment](#lead-assignment) by {{roles:write:lead-assignment}}.

::: draft
The sources of TISPH leads (Toyota Financial Services referrals, dealers, walk-in clients, renewals), the lead source
and product tagging, and the follow-up of a lead.
:::

## Quotation and request for quotation {#process-quotation}

Quotations and requests for quotation to the panel insurers are prepared by {{roles:write:quotations}}. A quotation is
approved by another user: {{roles:approve:quotations}}.

::: draft
Quick Quote for package products, the request for quotation to the insurers for the other risks, the comparison of
offers, the client's acceptance.
:::

## Placement with the insurer {#process-placement}

The placement slip goes to the insurer, which returns the e-policy. The check of the e-policy against the slip is
decided by {{roles:approve:policies}}, never by the user who recorded the e-policy. See
[Placement Slips](#placement-slips).

::: draft
Sending the placement slip, the insurer's acknowledgement, recording the e-policy, differences and returns.
:::

## Policy, billing and endorsements {#process-policy}

Policies, cover notes and CTPL certificates are recorded by {{roles:write:policies}}; endorsements and cancellations by
{{roles:write:endorsements}}. See [Policies](#policies).

::: draft
Booking the policy, the billing statement to the client, endorsements and cancellations with return premium.
:::

## Collection by Cash Control {#process-collection}

Receipts are issued and collections posted by {{roles:write:receipts}}. Post-dated cheques are handled on
[Post-Dated Cheques](#post-dated-cheques). See [Receipts](#verify-payments-and-post-official-receipts).

::: draft
Over-the-counter payments, bills payment and QRPh, post-dated cheques and auto-debit arrangements, the daily payment
reconciliation, reversals.
:::

## Remittance to the insurers {#process-remittance}

Remittances to the insurers are prepared by {{roles:write:remittance}}. See
[Remittance to insurers](#remittance-to-insurers).

::: draft
Remittance runs, approval within the Authority Matrix limits, payment to the insurer, insurer statements and their
reconciliation.
:::

## Commission and incentives {#process-commission}

Commission is processed by {{roles:write:commission}}; incentive calculations by {{roles:write:incentive}} and approved by
{{roles:approve:incentive}}. See [Commission to agents and referrers](#commission-to-agents-and-referrers) and
[Incentives](#incentives).

::: draft
Commission earned from the insurers, commission to referrers, the telesales incentive.
:::

## Claims {#process-claims}

Claims are registered and followed up by {{roles:write:claims}}. Claim decisions and settlement approvals are made by
{{roles:approve:claims}}. See [Claims](#the-claims-list).

::: draft
Registering a claim, claim documents, motor claim repairs and letters of authority, settlement through the insurer.
:::

## Renewals {#process-renewals}

Renewals are prepared by {{roles:write:renewals}}; renewal terms are approved by {{roles:approve:renewals}}. See
[Renewal Queue](#renewal-queue-and-at-risk-policies).

::: draft
The renewal queue, renewal terms, negotiations, lapsed policies.
:::

## Month-end and tax {#process-month-end}

The month-end and year-end steps and the BIR returns are run by {{roles:write:period-end}}; the close is approved by
{{roles:approve:period-end}}. See [Period end](#period-end) and [Tax: BIR forms and returns](#tax-bir-forms-and-returns).

::: draft
The month-end checklist, bank reconciliation, the SAP GL export, the close and its approval, the BIR returns.
:::

<!--
Owner: see WRITER_GUIDE.md. Screen reference: one section per screen of the Operations menu, in menu order.
Screens to refresh (redesign in another stream, described as on this build): placement-slips (Check against slip
dialog), policies and raise-an-endorsement-request (endorsement dialog), cover-notes-binders (pop-up).
-->
# Screen reference: Operations {#screens-operations}

The screens of the Operations menu, in menu order: prospects, quotations and placement, clients, policies, claims, renewals and the policy services.

Each section names the menu of the screen and the roles that open it, with their access. Your own menu shows only the screens of your role. The step-by-step business procedures are in [The TISPH process end to end](#the-business-process-end-to-end); this chapter describes each screen: what it shows, its fields, its buttons and its statuses.

## Prospects {#prospects}

A prospect is a person or company that TISPH quotes before it becomes a client: a buyer referred by Toyota Financial Services (TFS), a dealer sale, a walk-in client or a referral.

{{screen:/agent/leadlisting}}

The cards at the top count **Total Prospects**, **Last 7 Days**, **Last 30 Days**, **Converted Prospects** (with the conversion rate), **With Quotations** (with the quotation rate) and **Active Prospects**. The chips below them (**Motor**, **Personal Accident**, **Credit Life**, **Marine**, **Product not yet tagged**) filter the list by product line; **All Categories** filters by **Retail** or **Corporate**. **Show Filters** adds the country, province and city.

The list shows **Prospect ID** (LD-YYYY-NNNNN), **Name**, **Category**, **Product line**, **Mobile**, **E-mail**, **Quotations**, **Created on**, **Status** and **Actions**.

| Status | Meaning |
|---|---|
| **New** | Created, not yet contacted |
| **Contacted** | A sales activity has been logged on the prospect |
| **Quote Generated** | At least one quotation exists |
| **Converted** | A policy has been booked; the prospect is now a client |
| **Lost** | The prospect did not buy |

The buttons above the list are **Bulk Upload** (prospects from an Excel file, validated before they are created), **Generate Report** (the list as an Excel file) and **Create Prospect**.

![Operations > Sales & Marketing > Prospects, with the prospects by product line and status](images/screens-operations/prospects-list.png)

### Create a prospect {#create-a-prospect}

1. Choose {{menu:/agent/leadlisting}} and select **Create Prospect**.
2. Choose **New customer**, or **Existing client** to find a client by name, mobile number or e-mail (the prospect is then linked to that client). Select **Continue**.
3. Choose the **Line of Business** and the **Product** the prospect is for, and select **Continue**. If the product is not known yet, select **Skip - tag product later**: the first quotation asks for it.
4. Fill in the prospect form and select **Save & Continue**.

| Field | Required | What to enter | Rule |
|---|---|---|---|
| **Category** | Yes | **Retail** (a person) or **Corporate** (a company) | A corporate prospect asks for the company name instead of the personal details |
| **First name**, **Last name**, **Preferred name** | Yes | As on the client's ID | |
| **Date of birth**, **Gender** | Yes | | |
| **E-mail** | Yes | The e-mail address | Used for the quotation approval link |
| **Mobile number** | Yes | For example 0917 123 4567 or +63 917 123 4567 | |
| **Country**, **Province**, **City / Municipality**, **Barangay**, **ZIP Code**, **House / Unit No.** | Yes | The address | The city list follows the province; **Region** and **Street / Subdivision** are optional |
| **Source** | No | Where the lead came from, for example **Walk-In**, **Referral**, **Bundling** | From [Lead sources and reason codes](#lead-sources-and-reason-codes) |
| **Product** | No | The product chosen in step 3 | **Product not yet tagged** when skipped |

The prospect is created with the status **New** and the next number of the prospect series. The assignment rules of [Lead Assignment](#lead-assignment) give it an account executive.

![Create prospect: the choice between a new customer and an existing client](images/screens-operations/prospect-create.png)

![The prospect form](images/screens-operations/prospect-form.png)

### View, edit or delete a prospect {#view-edit-or-delete-a-prospect}

Select a row (or the eye in **Actions**) to open the prospect. The prospect page shows the prospect's quotations with the same counters as the quotations list, **Add Quote** to quote the prospect, and **Convert** on an approved quotation. The pencil opens the prospect form for a change.

A prospect is not deleted once it has a quotation or a sales activity: set it to **Lost** instead. Every change is kept in the history of the prospect.

## Lead Assignment {#lead-assignment}

Lead Assignment decides who works each prospect.

{{screen:/sales/lead-assignment}}

The screen has three tabs:

- **Team View**: for each team member (filter **My team** or the whole team), the prospects **Open**, **New**, **Converted**, **Lost**, **In queue** and of the **Last 30 days**, and below the prospects of the team with their **Status**, **Line**, **Territory**, **Channel**, **Account executive** and **Assignment**.
- **Reassignment Queue**: the prospects no rule could assign, or released by their account executive. Select a prospect and assign it to an account executive.
- **Assignment Rules**: the rules that give a new prospect its account executive. The first active rule by **Priority** whose **Conditions** match the prospect applies; empty conditions match any prospect. **Method** is **Round robin** between the rule's **Account executives**, or a fixed account executive. **Add rule** creates a rule; the switch in **Active** turns it off.

At TISPH the rules send the TFS referrals of each TFS office to the account executives of that territory.

![Lead Assignment, Assignment Rules: TFS referrals by office, shared round robin](images/screens-operations/assignment-rules.png)

## Sales activities {#sales-activities}

Account executives log every call, meeting, e-mail and visit with a prospect, a client or on a quotation. Each prospect, client and quotation shows its activities as a timeline, newest first: a prospect and a client also show the activities logged on their quotations (with the quotation number), and a client those of the prospect it came from. The open next step is shown above the timeline.

{{screen:/sales/activities}}

{{screen:/master/organization/sales-activity-types}}

{{screen:/master/organization/sales-activity-outcomes}}

The cards count **Activities**, **Account executives**, **Positive outcomes**, **Follow-ups open** and **Follow-ups overdue**. The **Activities** tab lists **Date and time**, **Activity type**, **Subject**, **Record**, **Account executive**, **Outcome**, **Next step** and **Follow-up**, filtered by account executive, activity type and outcome. The **Activity Report** tab totals the activities per account executive (calls, meetings, e-mails, visits; on prospects, clients and quotations; positive outcomes; next steps done, open and overdue), by activity type and by outcome. **Export to Excel** downloads the list.

To log an activity, open the prospect, client or quotation, select the activity log and enter the **Activity type**, **Subject**, date and time, **Outcome** and, if there is one, the **Next step** with its follow-up date. The next step appears in [My Work](#my-work) on its date.

The activity types (phone call, meeting, e-mail, visit, proposal presentation) and outcomes are kept on {{menu:/master/organization/sales-activity-types}} and {{menu:/master/organization/sales-activity-outcomes}}, by {{roles:write:masters}}.

![Operations > Sales & Marketing > Sales Activities](images/screens-operations/sales-activities.png)

## Quotations {#quotations}

The quotation (quotation slip) is the offer given to the client: the insurer, the covers and the premium with its taxes.

{{screen:/agent/Quotation}}

The cards count **Total Quotations**, **Active Quotations**, **Pending Review**, **Approved Quotations** (with the approval rate), **Converted to Policy** and the **Average Premium**. The list shows **Quote ID** (QT-YYYY-NNNNN), **Prospect Name**, **Policy Type**, **Gross premium**, **Date**, **Status** and **Actions** (**View Details**; **Edit Quotation** while the quotation can still be changed).

| Status | Meaning |
|---|---|
| **Draft** | Saved, not yet sent to the client |
| **Pending Customer** | Sent to the client for approval |
| **Customer Accepted** | The client accepted; the placement slip is raised |
| **Submitted to Insurer** | The placement slip has gone to the insurer |
| **Approved** | Approved by {{roles:approve:quotations}}, a user other than the one who created it |
| **Rejected** | Turned down, with a reason |
| **Expired** | Not accepted or converted within its validity; it cannot be reopened |
| **Converted to Policy** | The insurer's policy has been booked |

![Operations > Sales & Marketing > Quotations](images/screens-operations/quotations-list.png)

The quotation page has the tabs **Details**, **Activities** and **Audit Trail**. **Details** shows the placement journey, the policy details (insurer, co-insurance, policy type, referrer), the assured, the vehicle (for motor), the coverage details and the payment details: **NET Premium**, **DST (12.5%)**, **VAT (12%)**, **LGT (0.75%)**, **Others**, **Discount** and **Gross premium**. The actions depend on the status: **Approve and send to client** on a draft (a user other than the raiser), **Copy approval link** and **Record customer response** while it waits for the client, **Proceed to Policy** once accepted. See [Quotation and request for quotation](#process-quotation).

![A motor quotation waiting for the client, with Copy approval link and Record customer response](images/screens-operations/quotation-pending-customer.png)

### Validity, extension and versions {#quotation-validity-and-versions}

A quotation is valid for the days set on its product (**Quotation validity (days)** on the Product Master), else for 30 days, counted from the day it is issued; it stays valid through its last day. The section **Validity and versions** of the quotation page shows the **Version**, **Issued on**, **Valid until**, the days left (or **Expired**) and the **Longest validity**.

- Five days before the end of the validity the owner of the quotation is reminded under **My Work**; a client who has the quotation for approval is reminded by e-mail.
- **Extend validity** (for {{roles:extend:quotations}}) adds 30 days once, never beyond 60 days from the day the quotation was issued. Enter the remarks and select **Extend validity**; **Extended on** and **Extended by** are then shown.
- The day after the last valid day the quotation becomes **Expired**. A quotation whose placement slip is already with the insurer is followed on the placement slip instead.
- Changing a quotation the client has already received keeps the terms the client saw as a read-only version and makes the change the next version (version 2, version 3) of the same quotation number, back in **Draft**: send it to the client again. The earlier link sent to the client stops working. The versions are listed with their status and gross premium; **View** shows a superseded version as it was. A quotation with an open placement slip cannot be changed: cancel the placement slip first.

### Credit Life quotation {#credit-life-quotation}

Credit Life new business (the complimentary cover of a TFS motor loan) takes no quotation: choosing it under **Create Quote** opens the direct placement. A Credit Life quotation is raised at renewal, on the voluntary product.

1. Choose {{menu:/agent/Quotation}}, select **Create Quote** and choose Credit Life, then the voluntary product (or **Add Quote** on the prospect).
2. Choose the borrower (client or prospect) and the **Insurer**, and enter the **TFS loan account no.**, the **Borrower's date of birth**, the **TFS accounts**, the **Pending balance**, the **Term (years)** of the loan (1 to 5) and the **Sum insured** (empty: PHP 1,000,000.00).
3. Select **Create quotation**. The premium is 3.68 per 1,000 of sum insured; the rate cannot be changed.

The quotation is refused for a corporate account, a borrower aged 65 or over, more than 6 TFS accounts, a pending balance, an agent or referrer, or a loan account that already has an open quotation. A sum insured below PHP 1,000,000.00 is referred: it is sent to the client only once {{roles:approve:quotations}} other than the raiser approves it in **Underwriting referral**. The quotation page shows the Credit Life terms in **Credit Life**.

### Promotion of a motor quotation {#quotation-promotion}

A promotion gives a brand-new vehicle the reduced rates agreed with the insurers (see [Promotions](#promotions)). The quotation must be **Comprehensive**, the **Vehicle condition** **Brand New**, the model year not older than the year before the policy year, and the vehicle, insurer and channel (dealer, financing bank, affinity partner, agent or referrer, direct) must be those of the promotion.

1. Open the motor quotation and select **Find promotion** in **Promotion**. The promotions open to the vehicle are listed with their rates; when none is open the reason is shown.
2. Select **Apply**. The quotation is priced again at the promotion rates. **Promotion** shows the **Gross premium at the standard rates**, the **Promotion discount** in PHP and percent, the **Total discount**, the **Discount cap** and the **Promo excess**.
3. To use the standard rates again select **Remove promotion**.

The discount (promotion and order summary discount together) must stay within the [discount cap](#discount-caps) of the product and channel; an order summary discount is refused when the promotion is not combinable with one. A discount above the maker's **Quotation discount** limit (Authority Matrix) is referred: a user whose limit covers it approves it in **Underwriting referral**. {{roles:write:promotion-rates}} may lower the **Own Damage rate** to the minimum of the promotion with **Change promo rate** and a reason.

A quotation keeps its promotion until its validity ends, even when the promotion is suspended or ends; when the promotion has a new version the quotation is priced at the new rates the next time it is changed. On conversion to a policy one unit of the promotion's quota is counted; a chassis number already on an earlier policy is refused. The policy shows the promotion it was issued with; a cancellation from inception gives the unit back.

### Create a motor quotation {#create-a-motor-quotation}

A motor quotation is made for a prospect and has four steps: **Policy details**, **Coverage**, **Accessories** and **Summary**. Nothing is saved until the last step, so you can move with **Back** and **Next**.

1. Choose {{menu:/agent/leadlisting}} and open the prospect (or select **Create Quote** on {{menu:/agent/Quotation}}, choose the motor product and then the prospect).
2. Select **Add Quote**. In **Line of Business**, choose **Motor**; in **Product**, choose the motor product. Select **Continue**.
3. **Policy details**: choose the insurer (**Select Insurance Company**, or **Co-Insurance** for several insurers), the **Insurance Policy Type**, the **Referrer (agent / account code)** if any, and the **Payment Type** (required). Under **Insurance Vehicle Details**, choose **Vehicle Type** (the tariff class), **Vehicle Brand**, **Vehicle use**, **Model Year**, **Vehicle Model**, **Model Variant**, **Vehicle Color** and **Seating Capacity** from the vehicle master. Under **Risk details for the product rules**, enter the **Fair market value of the vehicle**, the **Claims in the last 3 years** and the **Driver's date of birth** (required: the acceptance rules of the product check them), and if they apply **The vehicle has modifications**, **Claim-free years (NCB)** and **Vehicles in the fleet**. Select **Next**.
4. **Coverage**: the mandatory covers of the product are always included; tick the optional covers to quote. Enter the own damage sum insured (the invoice price for a new car) and rates, acts of nature, the bodily injury and property damage limits, auto passenger personal accident per seat, and CTPL for 1 or 3 years at the Insurance Commission tariff. Select **Calculate**; **Override** lets an authorised user change a computed premium.
5. **Accessories**: add the accessories with their value, if any.
6. **Summary**: check the premium (net premium, DST, VAT, LGT, gross premium) and complete the quotation.

The quotation is created in **Draft**. Another user holding the quotation approval opens it and selects **Approve and send to client**.

![Create Quote, step 1 Policy details: insurer, vehicle and the risk details of the product rules](images/screens-operations/motor-quotation-policy-details.png)

## Requests for quotation (broker slips) {#requests-for-quotation-broker-slips}

A request for quotation asks several panel insurers for their terms on one risk, for example a fleet or a group personal accident cover. It is optional: most motor quotations are priced on the motor tariff.

Choose Operations > Sales & Marketing > Request for Quotation (Broker Slip). The cards count the requests by status (**Submitted**, **Responses in**, **Placement raised**, **Closed**); select a card to filter. Each row shows **Slip No.**, **Insured**, **Product**, **Sum insured**, **Offers / approached** (with the number declined), **Best offer (gross)**, **Response due**, **Age**, **Status** and the **Quotation Slip** made from it. Select a row to open it.

{{screen:/placement/broker-slips}}

![Operations > Sales & Marketing > Requests for Quotation, with the offers received per request](images/screens-operations/requests-for-quotation.png)

To create a request, select **New Request for Quotation**:

| Field | Required | What to enter | Rule |
|---|---|---|---|
| **Customer** | Yes | **Client**, **Prospect** or **New prospect**, then the name | |
| **Line of Business**, **Product** | Yes | The line and the product of the risk | The product decides the risk details and the covers offered |
| **Insured** | No | The insured named on the policy, if not the customer | |
| **Inception**, **Expiry** | No | The period of cover asked for | |
| **Response due** | No | The date by which the insurers must answer | Shown as overdue afterwards |
| **Risk details** | Depends on the product | For example the vehicles or the number of employees | |
| **Requested covers** | No | Each cover with its **Sum insured** and **Deductible**; **Add cover** adds a row | |
| **Insurers to approach** | Yes | One or more panel insurers | Each receives the request by e-mail |
| **Remarks** | No | What the client asked for | Printed on the slip |

**Save draft** keeps the request as **Draft**. **Save and submit to market** sends it to the insurers: the status becomes **Submitted**.

![New Request for Quotation (Broker Slip)](images/screens-operations/rfq-new.png)

On the request, the tabs are **Market responses**, **Compare offers**, **Risk and covers** and **History**. Record each insurer's answer (premium, rate, deductibles, special terms, the line it writes) or its decline; with the answers in, the status becomes **Responses in**. On **Compare offers**, the best offer is marked **Best** and the others show their difference (**vs best**). Select the offer or offers to place and the lead insurer: the shares must total exactly 100%. Then select **Prepare Quotation Slip**.

The buttons of the request are **Print slip**, **Client comparison report** (see [Comparison Reports](#comparison-reports)), **Add insurer**, **Close (not taken up)** and **Cancel slip**. The stepper at the top shows the journey: **Request for Quotation**, **Quotation Slip**, **Placement raised**, **Insurer issued (Booked)**.

## Comparison Reports {#comparison-reports}

Choose Operations > Sales & Marketing > Comparison Reports. The comparison report is the printed, branded document given to the client comparing the insurers' offers, with the option the broker recommends and why. It never shows commission.

{{screen:/sales/comparison-reports}}

The list shows **Report**, **Prepared for**, **Compared**, **Options**, **Recommended**, **Sent** and **Status**.

1. Select **New report**.
2. In **Compared**, choose **Request for quotation** (its insurers' offers become the options) or **Quotations** (quotations of the same client).
3. Choose the request for quotation. A request with fewer than two offers cannot be compared yet.
4. Select **Prepare**. Mark the recommended option and write the reasons.
5. Print the report on the letterhead or e-mail it to the client. The report is marked sent.

![New report: the request for quotation whose offers are compared](images/screens-operations/comparison-report-new.png)

## Placement Slips {#placement-slips}

The broker never issues cover. A placement slip goes to the insurer, the insurer acknowledges it and returns the e-policy, the e-policy is checked against the slip and only then is the policy booked. No screen lets a user complete cover without the insurer.

{{screen:/placement/placement-slips}}

The cards count the placements at each step: **Placement raised**, **Sent to insurer**, **Acknowledged**, **e-Policy received**, **Checked against slip** and **Insurer issued (Booked)**. The list shows **Placement No.** (PS-YYYY-NNNNN), **Insured**, **Product**, **Lead insurer**, **Gross premium**, **Period**, **Source** (**From quotation slip** or **Direct placement**), **Status** and the booked **Policy**. Filter by status and by source.

![Operations > Sales & Marketing > Placement Slips, with the count of placements at each step](images/screens-operations/placement-slips.png)

A placement slip is raised by the client's acceptance of a quotation, or directly with **New direct placement** for a risk that needs no quotation (for example a CTPL cover):

| Field | Required | What to enter | Rule |
|---|---|---|---|
| **Customer** | Yes | **Client**, **Prospect** or **New insured** | |
| **Line of Business**, **Product** | Yes | The line and product | |
| **Risk details** | Depends on the product | For motor: the vehicle and its identifiers | |
| **Inception** | Yes | The start of cover | |
| **Expiry** | No | The end of cover | One year after inception if left empty |
| **Sum insured** | No | The sum insured | |
| **Net premium** | Yes | The premium before taxes | Taxes are computed |
| **Commission rate** | No | The broker's commission rate | Defaults from the commission rate matrix |
| **Billing mode** | No | **System default**, or broker bill or direct bill | |
| **Security (participating insurers)** | Yes | Each insurer with its **Share**; mark the **Lead** | One lead insurer; the shares must total exactly 100% |

Select **Create Placement Slip**. The status is **Placement raised**.

On the placement slip the buttons follow the status: **Edit participants** and **Send to insurer(s)** (placement raised), **Record acknowledgement**, **Upload e-policy** or **Record decline** (sent), **Check against slip** (e-policy received), **Book (Insurer issued)** (checked), and at every step **Print slip** and **Cancel slip**. **Record acknowledgement** takes the insurer's reference or a remark, **Record decline** and **Cancel slip** a reason. Once sent to the insurer, a placement slip is cancelled only by {{roles:approve:policies}}, never by the user who raised it, and each insurer holding it is e-mailed the cancellation. The page shows the stepper, the **e-Policy** panel with the result of the comparison, the **Security (participating insurers)** with each insurer's share, premium, taxes, commission and policy number, the **Premium** breakdown, the **Summary**, the **Risk** and the **History**.

The check against the slip compares the net and gross premium, the sum insured, the commission, the effective and expiry dates, the insured and, for motor, the chassis, engine and plate numbers. Amounts within PHP 1.00 of the slip match. The check is decided by {{roles:approve:policies}}, never by the user who recorded the e-policy: **Confirm check**, **Accept differences** (with a reason) or **Return to insurer** (with a reason). See [Placement with the insurer](#process-placement) and [Book the policy](#process-booking).

### Record e-Policy {#record-e-policy}

Use **Record e-Policy** to key the e-policies the insurers send back without searching for each placement slip. Choose Placement Slips and select **Record e-Policy**: the list shows the placement slips sent to the insurer or acknowledged, with **Placement No.**, **Insured**, **Product**, **Lead insurer**, **Gross premium**, **Sent** and **Status**. Select a row, then fill in the e-policy:

| Field | Required | What to enter |
|---|---|---|
| e-Policy file | Yes | The PDF the insurer sent |
| Insurer policy number | Yes | As printed on the e-policy |
| Participant name | Yes | The insured named on the e-policy |
| Sum insured, net premium, gross premium, commission | Yes | As on the e-policy |
| Issue date, issuance date, effective date, production date | Yes | As on the e-policy |
| Chassis number, engine / motor number, plate number (motor) | Yes | As on the e-policy; the plate number or the MV file number is required |

The placement slip becomes **e-Policy received** and opens afterwards for the check against the slip by another user.

![Record e-Policy: the placement slips waiting for the insurer's e-policy](images/screens-operations/record-epolicy.png)

## Dealer & Bank Programmes {#dealer-programmes}

Choose Operations > Sales & Marketing > Dealer & Bank Programmes. A programme holds the terms agreed with a dealer, and optionally its financing bank, for brand-new vehicles.

{{screen:/sales/dealer-programmes}}

The **Programmes** tab lists **Code**, **Name**, **Dealer**, **Financing bank**, **Insurer**, **Rates**, **Who pays**, **Upload creates**, **Sales** and **Status**. **Add programme** opens the programme form:

| Field | Required | What to enter | Rule |
|---|---|---|---|
| **Code**, **Name** | Yes | For example TMK-TFS-2026, "Toyota Makati x TFS financed cars 2026" | The code is unique |
| **Dealer** | Yes | The dealer of [Distribution Channels](#distribution-channels) | |
| **Financing bank**, **Mortgagee of the financed cars** | No | The bank, for financed cars | The bank is the mortgagee on the policy |
| **Insurer** | Yes | The panel insurer of the programme | |
| **Default vehicle class** | Yes | The tariff class of the cars sold | |
| **Own damage rate %**, **Acts of nature rate %** | Yes | The rates agreed | |
| **Excess bodily injury**, **Property damage** | No | The limits included | |
| **CTPL**, **Include CTPL** | No | Whether CTPL is included and for **1** or **3 year(s)** | |
| **Upload creates** | Yes | **Quotation to follow up** or **Policy issued** | What a row of the dealer's sales file creates |
| **Free first year** | No | The dealer (or bank) pays the whole first-year premium | |
| **Subsidy paid by**, **Subsidy**, **Subsidy value** | No | Who pays part of the premium (**Nobody (buyer pays)**, the dealer or the bank), as a percent of premium or an amount | |
| **Effective from**, **Effective to** | Yes | The period of the programme | Sales outside the period are refused |
| **Mortgagee clause** | No | The clause printed on the policy | Used when the bank has no clause of its own |
| **Status**, **Notes** | | **Active** or inactive | Only an active programme accepts uploads |

The **Dealer Sales Upload** tab takes the dealer's sales file: choose the programme, download the **Template** if needed and select **Upload sales**. Each upload is a batch (DSB-YYYY-NNNNN) with its **Created** and **Failed** rows and its status (**Completed** or **Partial**). See [Dealer programme policies](#process-dealer-programme).

![Add programme: the terms of a dealer programme](images/screens-operations/dealer-programme-add.png)

## Promotions {#promotions}

Choose Operations > Sales & Marketing > Promotions. A promotion offers reduced rates, or a gross premium discount, on brand-new vehicles of selected variants for a period.

{{screen:/sales/promotions}}

The list shows **Code**, **Name**, **Products**, **Insurers**, **Channel types**, **Period**, **Variants**, **Version**, **Units / quota** and **Status** (**Draft**, **Pending approval**, **Scheduled**, **Active**, **Suspended**, **Expired**, **Withdrawn**). Filter it by status, or search by code or name; **View** opens a promotion.

**Add promotion** ({{roles:write:promotions}}) opens the form:

| Tab | Field | What to enter | Rule |
|---|---|---|---|
| General | **Code**, **Name** | For example PRM-FORTUNER26 | Capital letters, digits and hyphens, 3 to 20 characters, unique; the code cannot change after the first save |
| General | **Period from**, **Period to** | The days the promotion is offered | At most 12 months; it cannot start before today when submitted |
| General | **Promo benefit** | **Promo rate** (reduced Own Damage and Acts of Nature rates) or **Gross premium discount %** | Cannot change on a new version |
| General | **Unit quota**, **Lock-in (years)** | The vehicles that may be insured with it; the years its rate is kept on renewal | Quota a whole number of 1 or more; lock-in 1 to 3 years |
| General | **Promo excess** | The Own Damage and Theft deductible per product while the promotion applies | |
| Applicability | **Products**, **Insurers**, **Channel types** | Where the promotion is offered | Motor products only; each product and channel type needs an approved [discount cap](#discount-caps) |
| Applicability | **Can be combined with a Dealer Programme**, **with an Order Summary discount** | | Both off by default |
| Vehicle variants & rates | **Vehicle**, **Year model from / to**, **Insurer** (empty: every insurer of the promotion), **Promo OD %**, **Min OD %**, **Promo AON %**, **Remit OD %**, **Remit AON %** (or **Discount %**) | One line per variant | Rates above 0 and at most 100 with up to 4 decimals; a remitting rate not above the promo rate; Min OD % not above Promo OD %; no two lines for the same variant, year models and insurer |

**Save draft** keeps the promotion as **Draft**, version 1. The promotion page shows each line with its **Rate discount** (against the standard rates of 2% Own Damage and 0.5% Acts of Nature) and its **Cap check** for each product and channel type: **Within cap**, **Above max**, **Below min**, **Below lowest OD rate** or **No cap**.

- **Submit for approval** checks every field, line and cap; a line outside its cap blocks it. **Recall** brings a submitted promotion back to draft.
- {{roles:approve:promotions}} other than the maker selects **Approve** (the promotion becomes **Scheduled**, or **Active** from its first day) or **Return** with a reason. The approvals are listed in **My Work**.
- **Suspend**, **Resume** and **Withdraw** (with a reason) stop or restart the offer; quotations already priced keep the promotion until their validity ends.
- **Amend** creates the next version in draft; the version in force stays offered until the new one is approved, then it is **Superseded**.
- Every night the job **Promotion status** activates the promotions whose period starts and expires those whose period has ended; a promotion whose quota is used up expires.

## Clients {#clients}

A client is created when a prospect's first policy is booked, or before it by onboarding.

{{screen:/agent/clientlisting}}

The list shows **Client ID** (CL-YYYY-NNNNN), **Assured Name**, **Category**, **E-mail**, **Mobile**, **Client Since**, **Policies**, **Latest Policy Status** and **Actions**; the tabs **All**, **Individual** and **Corporate** filter it. The buttons are **Onboard client** and **Create Prospect** (for a client who asks for a new quotation).

Select a client to open the client view: the cards **Active policies**, **Premium in force**, **Open claims**, **Renewals due** and **Outstanding balance**, and the tabs **Policies**, **Quotations**, **Claims**, **Renewals**, **Endorsements**, **Receipts**, **Documents**, **Activity** and **History**. The header shows whether the identification is **Complete** or **Incomplete**; **Identification and due diligence** opens it.

![The client view, with the client's policies, claims, renewals and receipts](images/screens-operations/client-view.png)

### Onboard a client before the first policy {#onboard-a-client-before-the-first-policy}

A client can be created, identified and checked before any quotation or policy, as customer due diligence requires. A client created by the first policy (a prospect converted, a direct placement) is completed the same way, from **Identification and due diligence** on the client view.

1. Choose {{menu:/agent/clientlisting}} and select **Onboard client**.
2. Choose the **Client type**: **Individual** or **Juridical (company, cooperative, partnership)**.
3. Fill in the form and select **Onboard client**.
4. Upload the ID, the registration and the board resolution once the client is saved.

| Group | Fields | Rule |
|---|---|---|
| **Identity** (individual) | **First name**, **Middle name**, **Last name**, **Suffix**, **Date of birth**, **Place of birth**, **Gender**, **Civil status**, **Nationality**, **Occupation or nature of work**, **Employer or business name**, **Source of funds**, **TIN** | |
| **Government ID presented** | **ID type**, **ID number**, **ID expiry date** | An expired ID is refused |
| **Contact and address** | **Mobile number**, **E-mail**, **Country**, **Region**, **Province**, **City / Municipality** (required), **Barangay**, **ZIP Code**, **House / Unit No.**, **Street / Subdivision** | The city list follows the province |
| **Expected business and PEP** | **Lines of business expected**, **Usual payment mode**, **Expected annual premium (PHP)**, **Politically exposed person (or family member or close associate)** | A politically exposed person needs enhanced due diligence |

![Onboard client: identity, ID, address and expected business](images/screens-operations/client-onboarding.png)

## Policies {#policies}

Choose Operations > Policy. The list shows **Policy Number**, **Client Id**, **Client Name**, **Gross Premium**, **Policy Issued**, **Policy Expiry**, **Product Description** and **Payment** status. The search box finds a policy by number or client. **Show Filters** offers **Payment Status**, **Product Type**, **Insurance Company**, **Client Name**, issue and expiry date ranges and minimum and maximum premium.

{{screen:/agent/policy}}

Policies are booked from the placement slip (see [Placement Slips](#placement-slips)); **Bulk Upload** loads the policies in force at go-live from a file, validated first, without bill, journal or commission. The **Payment** status is **Pending** (billed, not paid), **Reviewing** (a payment waits for Cash Control), **Partial** or **Completed**.

In **Actions**, the eye (**View policy**) opens the policy and **More actions** offers **Claim** (register a claim on the policy, see [Register a claim](#register-a-claim)) and **Endorsement**.

![Operations > Policy, with More actions: Claim and Endorsement](images/screens-operations/policy-more-actions.png)

The policy page shows the cards **Gross Premium**, **Expiry Date** and **Client ID**, and the panels **Policy Details**, **Insured Details**, **Vehicle Details** (motor: motor, chassis and plate numbers, mortgagee), **Coverage Details**, **Premium Breakdown**, **Endorsements**, **History** and **Documents & Billing** (**Generate Policy Invoice**, **Premium Accounting Entries**, the policy document to **Preview**, **Open** or **Print**). **View Policy** opens the policy schedule.

![The policy page, with Documents & Billing](images/screens-operations/policy-details.png)

### Correct the policy details {#correct-the-policy-details}

The policy number, insured name, inception and expiry dates and insurer of a policy are not edited: they are corrected with the approval of a second user, and the status of a policy only follows its endorsements, cancellation, renewal and expiry.

1. On the policy page, in **Corrections**, select **Request correction**.
2. Change the values to correct. For the policy number, the period or the insurer, enter the **Insurer reference** of the corrected policy.
3. Choose the **Reason** and select **Request correction**. The correction is listed as **Pending approval** and {{roles:approve:policies}} are notified.
4. A user other than the requester selects **Approve correction** (the policy is updated) or **Reject correction** with a reason. The requester may **Withdraw** it before.

One correction at a time waits for approval on a policy.

### Raise an endorsement request {#raise-an-endorsement-request}

An endorsement goes through the broker: it is raised, approved by a second user, sent to the insurer and booked once the insurer confirms it with its own endorsement number.

1. Choose {{menu:/agent/policy}}.
2. In the row of the policy, select **More actions**, then **Endorsement** (or **Endorsement** on the policy page).
3. Choose the kind of change (insured details, vehicle, cover, extension, cancellation), enter the new values and the effective date, and check the summary. A change of cover is priced from the effective date to the expiry: the **Unexpired days** and the **Annual net premium change** are shown with the premium change.
4. Select **Continue to approval**. In **Approval and insurer**, choose the **Endorsement types** (the types that apply to the line of the policy; a Credit Life policy takes no financial type) and select **Submit for approval**. {{roles:approve:policies}} are notified.
5. A user other than the one who raised it selects **Approve endorsement**, or **Reject endorsement** with a reason.
6. Select **Send to insurer**: the client and the insurer receive the endorsement.
7. When the insurer confirms, select **Book endorsement**, upload the insurer's endorsement, enter the **Endorsement Number** of the insurer and complete it. A user other than the one who raised it books it; the client is e-mailed the endorsement.

The endorsement is not available while the payment is **Pending** or **Reviewing**, or once the policy has expired, lapsed, was cancelled or renewed. An additional premium is billed to the client. A cancellation needs a note; the premium is returned pro-rata on the days left and no commission is taken back. See [Endorsements and cancellations](#process-endorsement).

## Fleet Schedules {#fleet-schedules}

Choose Operations > Fleet Schedules. A fleet schedule is one motor policy covering many vehicles of a client.

{{screen:/operations/fleet-schedules}}

Each vehicle has its own premium and CTPL; vehicles added or deleted during the period are endorsed at the pro-rata premium. The list shows **Fleet schedule**, **Client**, **Insurer**, **Policy**, **Period**, **Vehicles on cover**, **Sum insured**, **Annual premium** and **Status**.

1. Select **New fleet schedule**.
2. Enter **Client** (required), **Insurer** (can be chosen later, before the policy is issued), **Period from** (required), **Period to** (one year after the start unless changed) and **Description**.
3. Select **Start**. Add the vehicles one by one or from a file; each line is rated on the motor tariff.
4. Place the schedule with the insurer; the policy is booked like any other.

![New fleet schedule](images/screens-operations/fleet-schedule-new.png)

## Marine Open Covers {#marine-open-covers}

Choose Operations > Marine Open Covers. An open cover insures a client's cargo shipments for a period: each shipment is certified or declared and the premium is billed per declaration period.

{{screen:/operations/open-covers}}

The list shows **Open cover** (MOC-YYYY-NNNNN), **Client**, **Insurer**, **Policy**, **Period**, **Conveyances**, **Certificates**, **Billed premium** and **Status**. **New open cover** asks for **Client**, **Insurer**, **Period from**, **Period to**, **Goods insured**, **Voyages**, **Clauses**, the rate % and limit per conveyance (**Sea**, **Air**, **Land**), **Mark-up on invoice %**, **Minimum premium per certificate**, **Declarations** (**Monthly**) and **Insurer's reference**.

The open cover page has the tabs **Contract**, **Certificates** (one per shipment, rated at the conveyance rate with the minimum premium), **Declarations** (the shipments of each period, billed on the open policy) and **History**. **Cancel cover** ends it. At TISPH the parcel cover of TFS (registration papers, plates, keys and loan documents couriered to its customers) is kept this way.

![A marine open cover with its rates per conveyance](images/screens-operations/open-cover.png)

## The claims list {#the-claims-list}

TISPH registers the client's claim, advises the insurer, collects the documents and follows the claim to its settlement. The insurer decides and pays.

{{screen:/agent/claim}}

The cards count **Open claims**, **Settlement to approve**, **Approved, to be paid** and **Settled**. The list shows **Claim / insured**, **Policy / product**, **Date / cause of loss**, **Reported**, **Estimate**, **Status** and **Actions**; filter by status.

| Status | Meaning |
|---|---|
| **Pending** | Registered, documents being collected |
| **Processing** | Advised to the insurer, under review or with the adjuster |
| **Pending Approval** | The settlement waits for the checker |
| **Approved** | The settlement is approved and not yet released (only when the release on approval is switched off) |
| **Partially Settled** | A partial settlement is approved; the claim stays open for the final settlement |
| **Settled** | The settlement is approved and released |
| **Rejected** | Declined by the insurer, with a reason |
| **Cancelled** | Registered in error or a duplicate notification, with a reason |

A claim follows nine steps, shown at the top of the claim: **Notification**, **Insurer advice**, **Documents**, **Review**, **Adjuster**, **Assessment**, **Settlement**, **Approval** and **Payment**. The **Next step** bar at the bottom names what is to be done and leads to it.

![Operations > Claims](images/screens-operations/claims-list.png)

### Register a claim {#register-a-claim}

1. Choose {{menu:/agent/policy}}, select **More actions** in the row of the policy, then **Claim**. (Or select **Register claim** in [My Work](#my-work).)
2. On **Claim notification**, check the policy and insured, and the insured's address.
3. Enter the incident: **Date of loss** (required), **Time of loss**, **Cause of loss** (required), **Place of loss** (required, with city and province), **Estimated Claim Amount**, **Reported through** (TFS, call centre, insurer, dealer, walk-in or e-mail), for a motor claim the **Loss extent** (**Partial loss** or **Total loss**) and, if known, the **Insurance Company Claim Number**.
4. Enter the **Driver at the time of loss** (**Same as Policy Holder**, or the **Driver's name** and address) and the **Third party** if any (name, contact number, plate number, unit, shop, insurer).
5. Select **Next**, then on **Insurer advice** select **Register claim and send**.
6. When the policy has premium outstanding, the claim is reported late or a claim of the same date of loss is already registered on the policy, **Check before registering** shows the **Outstanding premium**, the **Claims ratio of the client**, the days between the loss and the report and the claims of the same date. Select **Register claim and send** to register the claim anyway, or **Cancel**.
7. The claim is created (CLM-YYYY-NNNNN) as **Pending**, assigned to the claims handler with the fewest open claims, and the Preliminary Loss Advice is e-mailed to the insurer.

The date of loss must fall within the period of cover of the policy and cannot be in the future. A claim reported more than the late intimation days after the loss (30 as delivered) is marked **Late** and the claims handlers are alerted. The follow-up date of the claim depends on the line and the loss extent (for example 30 days for a partial motor loss, 60 for a total loss, 90 for fire, marine and engineering). For Credit Life the claim is a death benefit claim on the TFS loan.

![New claim, step 1: Claim notification](images/screens-operations/claim-new.png)

On **Documents**, the claim lists the documents its cause of loss needs (from [Claim documents](#claim-documents)) with their status **Missing**, **Received** or **Waived**. Upload each document as it arrives, or waive it. **Remind the claimant** e-mails the list of missing documents; **Continue to review** moves on once the documents are in.

![Claim, step 3: the documents the claim needs](images/screens-operations/claim-documents-step.png)

### Adjuster report {#adjuster-report}

On **Adjuster**, record the adjuster the insurer appointed (**Adjuster name**), the **Adjuster status** (assigned, report received) and upload the adjuster's report with the amount the adjuster recommends. For a motor repair, the estimates and the letter of authority are kept on [Motor claim repairs](#motor-claim-repairs-and-letters-of-authority).

### Assessment and settlement (maker) {#assessment-and-settlement-maker}

The claim is moved to review and its settlement submitted by {{roles:process:claims}}. Rejection, cancellation and closing are decisions of {{roles:approve:claims}}.

On **Assessment**, check the key facts of the claim and the **Assessment basis** (date reported, adjuster and adjuster status) and choose **Proceed to settlement**, or **Reject claim** with the **Reason for rejection**.

On **Settlement**, choose **Final** or **Partial**, enter the **Settlement type** (for example **Repair Shop**, or payment to the insured), the **Settlement amount** the insurer agreed, the deductible or participation and the payee, and select **Submit settlement**. The claim becomes **Pending Approval**: a second claims user must approve it before the claim is settled. A partly settled claim shows **Settled so far** and is settled further, or finally, from the same step.

### Approve a settlement (checker) {#approve-a-settlement-checker}

The settlement is approved by {{roles:approve:claims}}, never by the user who submitted it.

1. Open the claim from [My Work](#my-work) or from the list (**Settlement to approve**).
2. On **Approval**, check the settlement against the adjuster's report and the documents: the **Settlement** (partial or final), **Requested by** and what was **Settled before**.
3. Enter the **Approved amount** (the amount requested, or less), then approve it, or return it with a reason.

The approved amount must be within the approver's claim settlement limit on the [Authority Matrix](#authority-matrix) when the limit is enforced. **Requested by** and **Approved by** show the users' names.

As delivered, the approval also releases the settlement: the claim is **Settled** at once, without the status **Approved** in between. When the insurer pays through TISPH, the settlement is received from the insurer and paid out to the claimant on [Claims settlements paid through the broker](#claims-settlements-paid-through-the-broker), and the **Payment** step shows that payment.

### Claim details, documents and audit trail {#claim-details-documents-and-audit-trail}

Open a claim from the list (the eye in **Actions**). The claim page shows the key facts (**Policy number**, **Insured**, **Insurer**, **Insurer claim number**, **Date of loss**, **Cause of loss**, **Estimated amount**, **Settlement amount**, **Reported through**, **Loss extent**, **Follow-up due**) and the panels **Claim details** (loss, policy and insured, driver, third party), **Adjuster report**, **Settlement details** and **Documents**. **History** shows every change: who made it, when and what changed. **Close** returns to the list.

### Insurer advice and communications {#insurer-advice-and-communications}

The **Insurer** panel shows the insurer claim number, the **Insurer claims handler**, the **Insurer advice** (**Under evaluation**, **Incomplete requirements**, **LOA issued**, **Cheque available**, **Approved by the insurer**, **Denied by the insurer**), the **Authorisation code** and the **Amount offered**. **Record insurer advice** updates them.

The **Communications** panel logs each exchange with the insurer, the client, the adjuster or the repair shop: date, party, sent or received, method, message, **Follow-up date** and who logged it. An overdue follow-up shows **Overdue** until **Mark follow-up done**. **Log communication** records one; **Follow up insurer** e-mails the insurer and logs it. The claims handlers are alerted of overdue follow-ups and of claims past their follow-up date.

The **Settlements** panel lists each settlement of the claim, partial and final, with the amount requested and approved, its status, **Requested by** and **Decided by**.

### Cancel a claim or verify a death {#cancel-a-claim-or-verify-a-death}

**Cancel claim** cancels a claim registered in error or notified twice: choose the reason (**Registered in error**, **Duplicate notification of the same loss**) and add a note. A settlement waiting for approval is returned.

On a death benefit claim (Credit Life), **Verify death** records the date the death was verified; the follow-up date counts from it.

### Reverse a settlement movement {#reverse-a-settlement-movement}

Funds received from the insurer and payments to the claimant are recorded on [Claims settlements paid through the broker](#claims-settlements-paid-through-the-broker) by {{roles:write:claim-funds}}. A movement recorded in error is reversed with **Reverse movement**, a reason and a note, by {{roles:reverse:claim-cash}}, never by the user who recorded it. The journal is reversed and the movement shows **Reversed**.

## Renewal Policy {#renewal-policy}

Renewal Policy lists the policies coming up for renewal and those already in progress.

{{screen:/agent/expired-policies}}

The cards count **Due for renewal**, **In grace period**, **Lapsed, renewable**, **Renewal in progress** and **Renewed**. The list shows **Policy / client**, **Product / insurer**, **Account executive**, **Expiry** (with the days before or since), **Premium**, **Payment**, **Renewal state** and **Actions**. Search by policy number, client or client code, and choose the expiry date range.

### Renew a policy {#renew-a-policy}

1. Choose {{menu:/agent/expired-policies}}.
2. In the row of the policy, select the renew action (the arrow). The renewal quotation opens on **Renewal Details** with the client and the covers of the expiring policy.
3. Check the covers (mandatory covers are always included; tick the optional ones), the sums insured and the rates, and select **Calculate**. Then **Next** to the following steps, as for a new quotation.
4. Save the renewal quotation and send it to the client.

From the client's acceptance the renewal follows the same steps as a new policy: placement slip, e-policy, check and booking. Renewal terms submitted for approval on [Negotiations](#negotiations) are approved by {{roles:approve:renewals}}. A lapsed policy (**Lapsed, renewable**) can still be renewed.

## Renewal Batch, Lapse Management and the analytics {#renewal-batch-lapse-management-and-the-analytics}

{{screen:/agent/renewal-batch}}

{{screen:/renewal/analytics}}

{{screen:/renewal/lapse-management}}

{{screen:/renewal/performance}}

**Renewal Batch** prepares the renewal quotations of many policies at once. Select **Create Batch**, choose the **Selection Criteria** (**Expiry Date From**, **Expiry Date To**, **Insurance Company**, **Product Type**, **Min premium**, **Max premium**, **Client Name**, **Payment Status**) and select **Generate policy list**. Check the list and process the batch. The list of batches shows **Batch ID** (RB-YYYY-NNNNN), **Status** (**Draft**, **Partially completed**, **Completed**), **Total policies**, **Processed** and **Created on**.

![Create Batch Renewal: the selection criteria](images/screens-operations/renewal-batch-create.png)

**Lapse Management** shows the policies **Lapsed**, **In grace period** and that **Can be reinstated**, with the **Premium lost or at risk**. The tab **Lapsed and grace period** lists each policy with its days lapsed or left in the grace period, the **Lapse reason** and the win-back offers made. The tab **Win-back campaigns** holds the campaigns offering lapsed clients a discount to come back, with the clients contacted and converted and the premium recovered; **New campaign** creates one.

![Operations > Renewals > Lapse Management](images/screens-operations/lapse-management.png)

**Retention Analytics** shows, for the period, line of business and account executive chosen, the **Renewal rate**, the **Premium retention**, the **Average cycle time** (from renewal opened to renewed) and the **Open renewals now**, with the tabs **Monthly trend**, **By line of business**, **By account executive** and **Open renewals profile**.

**Performance** compares the renewal results with the targets: the **KPI scorecard** shows each KPI (renewal rate, premium retention, average cycle time) with **Target**, **Achieved**, **Variance** and the status **Met** or **Below target**, also **By account executive**, **By line of business** and as a **Monthly trend**. **Export** downloads each view.

![Operations > Renewals > Performance, the KPI scorecard](images/screens-operations/renewal-performance.png)

## Renewal Queue and At-Risk Policies {#renewal-queue-and-at-risk-policies}

{{screen:/renewal/queue}}

{{screen:/renewal/at-risk}}

The **Renewal Queue** is the work list of open renewals. The cards count **Open renewals**, **Expiring within 30 days**, **High risk**, **In grace period** and the **Premium due for renewal**. Each row shows the policy and insured, product and insurer, **Expiry**, **Premium**, **Stage**, **Risk** and **Account executive**; filter by stage, risk level and account executive. **Refresh pipeline** adds the policies newly due; **Export** downloads the queue.

The stages follow the renewal: **Pending**, **First Notice Sent**, **Second Notice Sent**, **Final Notice Sent**, **Quote Sent**, **Pending Approval**, **Approved**, **In Grace Period**, then **Renewed**, lapsed or **Not for renewal**. The renewal notices are e-mailed to the client 90, 60 and 30 days before expiry (30 and 15 days for Credit Life), on working days; a notice missed on a holiday goes out on the next working day.

The notices of a policy in a lock-in or under Scheme 2 are not sent, and those of a policy whose TFS loan is past due, terminated, in legal dispute or under fraud review are held: the stage shows **Lock-in: not sent** or **Held**, and **Notices withheld** replaces the send action.

Under **More actions**, {{roles:assign:renewals}} can:

- **Reassign**: move the renewal to another owner, with a reason.
- **Not for renewal**: close the renewal with a reason; no more notices are sent and the policy shows **Not for renewal** on Lapse Management, where it can still be reinstated within the reinstatement period.

A renewal opened from [My Work](#my-work) or a notification opens on the selected renewal.

## Lock-in Accounts {#lock-in-accounts}

{{screen:/renewal/lock-in-accounts}}

Lock-in Accounts lists the lock-in (promotion, Scheme 1 ARA) and Scheme 2 accounts expiring within the review window (60 days as delivered) or the days chosen. The cards count the **Accounts**, those whose **Review due** date is reached, **Notices suppressed** and **Notices held**. Each row shows the policy and insured, the lock-in and its year, **Expiry**, **Review date**, **TFS loan status** with the loan account, the notice treatment and the owner. Filter by lock-in, loan status and notice treatment, or search by policy, client or loan account.

**Download Excel** downloads the list. **Open renewal** opens the renewal of the account. **Set loan status** records the TFS loan status (**Current**, **Past due**, **Fraud**, **Terminated**, **Legal dispute**, **Closed**); a status that holds the notices needs a note, and the notices already queued for the policy are skipped. A review task is created in [My Work](#my-work) for the owner when the review date is reached.

**At-Risk Policies** is the risk register: open renewals with a **Medium** or higher retention risk. The cards count the **Policies at risk**, **High**, **Medium**, the **Premium at risk** and those **Without a next action**. Each row shows the risk score and its **Main drivers** (for example claims in the current term, first renewal with the broker, premium up on the renewal quote, expiry close), and the **Next action** with its due date. Open the policy to plan the next action.

## Negotiations {#negotiations}

{{screen:/renewal/negotiations}}

Negotiations lists the renewals being discussed with the client. The cards count **In negotiation**, **Quote sent**, **Pending approval**, **Approved** and **Expiring within 15 days**. Each row shows the policy and client, **Stage**, **Expiry**, **Current premium**, **Proposed premium** (with the change against the current premium), **Last activity** and **Account executive**.

Select a renewal to see its **Renewal terms** (RN-YYYY-NNNNN), and the **Timeline** of notices, quotes, meetings and counter-offers, with the outcome and next step of each. The buttons are:

- **Add update**: a change of terms or stage.
- **Log communication**: a call, e-mail or meeting with the client, its outcome and the next step.
- **Submit for approval**: the renewal terms go to {{roles:approve:renewals}}, a user other than the one who submitted them.

While the terms wait for approval they cannot be changed. The approved premium is the premium booked on the renewed policy, and an expired renewal quote cannot be submitted or completed. When the renewal terms limit is enforced, the premium must be within the approver's limit on the [Authority Matrix](#authority-matrix). The new term starts the day after the expiring term ends.

## Payments {#payments}

Operations > Payments shows **Gross Premium**, **Collected Premium**, **Receivables** and **Earned Commission**, and the bills in the tabs **Paid**, **Pending** and **Reviewing**. The **Type** column says whether the bill is for a **Policy**, a **Renewal Policy** or an **Endorsement**. Receipts are posted by Accounting; this screen shows the result.

{{screen:/agent/payments}}

Each row shows **Type**, **Assured Name**, **Client ID**, **Policy Number**, **Gross Premium**, **Bill date**, **Due date**, **Status** and **Actions**. When a client pays you directly, record the payment from the bill: the bill moves to **Reviewing** and Cash Control receives it to verify and receipt on [Verify payments and post official receipts](#verify-payments-and-post-official-receipts). Once receipted, the bill is **Paid**.

## CTPL authentication {#ctpl-authentication}

Every CTPL certificate of cover (COC) must be authenticated with the IC-accredited authentication provider before it is released. Operations > CTPL Authentication does it for every CTPL cover issued.

{{screen:/operations/ctpl-authentication}}

The cards count the covers **Pending**, **Requested**, **Authenticated** and **Failed**. The tab **CTPL covers** lists **Policy**, **Insurer**, **COC number**, **Vehicle**, **Status**, **Authentication code**, **LTO**, **Last error** and **Registered**; **Not yet authenticated only** narrows the list. The tab **COC series** holds the COC numbers issued to TISPH by each insurer.

A CTPL cover is registered when its policy is booked: the COC number is taken from the insurer's series and the vehicle identifiers from the policy. To add a cover by hand:

1. Select **Register a policy**.
2. Enter the **Policy number** (required) and the **COC number** (taken from the insurer's series if left empty).
3. Select **Save**. The cover is **Pending**.

The authentication is requested from the provider (**Requested**). The provider's **Authentication code** is stored on the cover and on the policy, where it is printed on the schedule, and the cover becomes **Authenticated**; or **Failed** with the error in **Last error**. When the provider's portal was used instead, the code is keyed in by hand.

**Unauthenticated CTPL report** lists the covers not yet authenticated, for the daily follow-up.

![Operations > CTPL Authentication](images/screens-operations/ctpl-authentication.png)

## Cover notes (binders) {#cover-notes-binders}

{{screen:/operations/cover-notes}}

A cover note gives the client temporary cover while the insurer's policy is pending. It is issued from a placement slip once the insurer has acknowledged it (acknowledged, e-policy received or checked), never from a quotation: the insurer then holds the order. It is superseded when the policy is booked and expires after its end date.

The cards count the cover notes **Active** and **Expiring within 7 days**, and show those where you must **Follow up the insurer's policy**. The list shows **Cover note / insured**, **Insurer**, **Quotation / placement**, **Cover period**, **Premium**, **Status** and **Policy**.

1. Select **Issue cover note**.
2. Search and select the placement slip.
3. Enter **Cover from**, **Cover period (days)** (the default applies if left empty), the **Insurer binder reference** and any **Special conditions**.
4. Select **Issue cover note**. Print it or e-mail it to the client.

![Issue cover note from an accepted quotation or a placement slip](images/screens-operations/cover-note-issue.png)

## Cancel a policy: computed return premium {#cancel-a-policy-computed-return-premium}

{{screen:/operations/policy-cancellation}}

{{screen:/master/insurance/short-period-rates}}

{{screen:/master/insurance/cancellation-reasons}}

Policy Cancellation computes the return premium of a policy from the days left: pro-rata when the insurer cancels, at the short-period rates when the insured cancels, and in full (flat) when the policy is cancelled from inception.

1. Choose {{menu:/operations/policy-cancellation}}.
2. Enter the **Policy number** (required) and the **Cancellation date**.
3. Choose the **Reason** (from {{menu:/master/insurance/cancellation-reasons}}). The reason gives the **Return premium method**; you may choose another method.
4. Choose **Cancellation**: **Whole policy**, or one risk of the policy.
5. Select **Compute return premium**. The screen shows the method, the days in force and left, the return net premium with its taxes, the gross return, the commission taken back and the amount returned by the insurer.

Nothing is saved by this screen. The cancellation itself is made as an endorsement of the policy (**More actions** > **Endorsement**, cancellation), which computes the same figures on the server; see [Raise an endorsement request](#raise-an-endorsement-request). It is completed by {{roles:approve:policies}}, a user other than the one who entered it. The return premium is credited to the client and commission already paid on it is clawed back. The short-period rates (the percentage of the annual premium earned for each period in force) are kept on {{menu:/master/insurance/short-period-rates}}.

![Operations > Policy Cancellation](images/screens-operations/policy-cancellation.png)

## Claims awaiting documents {#claims-awaiting-documents}

{{screen:/operations/claim-documents}}

This screen lists the open claims that still miss documents. The cards count the **Claims missing documents**, those **Ready to submit**, the **Documents outstanding** and the claims **Not reminded yet**. Each row shows the claim, policy, line and cause of loss, **Reported**, **Documents** (received of required), **Missing**, **Last reminder** and **Actions**.

Select a claim to open its **Documents** step: upload or waive each document, or select **Remind the claimant** to e-mail the list of what is missing. The reminder date is recorded.

![Operations > Claims Awaiting Documents](images/screens-operations/claims-awaiting-documents.png)

## Motor claim repairs and letters of authority {#motor-claim-repairs-and-letters-of-authority}

Operations > Motor Claim Repairs lists the motor claims with the stage of their repair: no estimate yet, awaiting approval, approved, in repair, released. Select a claim to open its repair file.

{{screen:/operations/motor-claim-repairs}}

{{screen:/master/insurance/repair-shops}}

The repair file shows the plate number, insured, insurer, sum insured and the participation of the insured (the deductible the insured pays the shop), and the buttons:

- **Record estimate**: the estimate of an accredited repair shop (from {{menu:/master/insurance/repair-shops}}), its total and the adjuster's decision.
- **Issue letter of authority**: the insurer's authority to the shop to repair, with the **Approved repair**, the **Participation** and the amount **Payable by insurer**.
- **Release vehicle**: the date the repaired vehicle was released to the insured.

![The repair file of a motor claim: estimates and letters of authority](images/screens-operations/motor-claim-repair.png)

<!--
Owner: see WRITER_GUIDE.md. Screen reference: the Product Configurator menu, one section per screen, in menu order.
-->
# Screen reference: Product Configurator {#screens-product-configurator}

The screens of the Product Configurator: products, covers, rating, acceptance rules, documents and the mapping to insurers.

Each section names the menu of the screen and the roles that open it, with their access. Your own menu shows only the screens of your role. The products are configured by TIS IT AppSupport / Admin on the request of the business; the other roles that open these screens can view them.

A product is configured as a **product template**. Only the template marked **In use** for a product is applied by the business screens: its covers, rating factors, acceptance rules, insurer market and document templates take effect on quotations, requests for quotation, placements and printed documents. The other templates are kept as drafts, inactive or retired versions. Each screen below filters by **Template**, **Line of business** and **Status**, and shows for each row its template and product and whether the template is in use.

## Product Configurator dashboard {#product-configurator-dashboard}

{{screen:/product-configurator/dashboard}}

The dashboard shows the **Active Products**, the **Acceptance rules in force**, the **Total Premium** and the **Avg Loss Ratio** (weighted by premium), and three tabs: **Product Templates** (the list of templates, as on [Product Templates](#product-templates)), **Performance Analytics** and **Quick Actions** (shortcuts to the other screens). **Create New Product** starts a new template.

## Product Templates {#product-templates}

{{screen:/product-configurator/templates}}

The list shows **Template Code**, **Product Name**, **Product**, **Line of Business**, **Version**, **Status** (**Draft**, **Active**, **Inactive**, **Retired**) and **In use**. At TISPH the templates in use are those of the products sold: for example the motor template that prices the motor quotations (Motor Insurance Basic Plan) and the personal accident and travel templates. Templates of lines TISPH does not write stay inactive.

To create a template, select **Create Template**: enter the code, the product name, the product of [Masters that work the same way](#masters-that-work-the-same-way) it configures, the line of business and the version, then add its covers, rating factors, acceptance rules, insurers and documents on the other screens. The pencil changes a template; the **In use** mark decides which template the business screens apply to the product. A change to a template in use applies to the quotations priced afterwards.

## Coverage Builder {#coverage-builder}

{{screen:/product-configurator/coverages}}

The Coverage Builder holds the covers of each template: **Code**, **Coverage Name**, **Template / product**, **Type** (**Mandatory** or optional), **Deductible**, **Priced on quotation as** and **Status**. A mandatory cover is always included in a quotation of the product; an optional cover is ticked on the quotation (see [Create a motor quotation](#create-a-motor-quotation)).

For the covers quoted, the deductible and main exclusions are printed as cover terms on the quotation slip and the policy schedule. The premiums of the motor covers are priced on the quotation screens with the motor tariff of the template. **Add Coverage** adds a cover: code, name, template, type, deductible, the cover it is priced as and its exclusions.

## Rating Engine {#rating-engine}

{{screen:/product-configurator/rating}}

Rating factors adjust the net premium of a quotation of the template in use. Each factor has a **Factor Code** and **Factor Name** (for example Vehicle Age, Driver Age, NCB (No Claim Bonus)), what it **Rates on** (vehicle age in years, driver age, claim-free years), a **Type** and its **Bands**:

| Type | Effect |
|---|---|
| **Multiplicative** | The factor of the band the risk falls in multiplies the premium |
| **Discount** | The factor reduces the premium |
| **Additive** | A percentage is added to the premium |

**Add Factor** adds a factor with its bands (from, to, factor). **Test a risk** enters a sample risk and shows the factors that apply and the premium they give, before the template is used.

## Acceptance Rules {#acceptance-rules}

{{screen:/product-configurator/underwriting}}

Acceptance rules are the insurers' underwriting guidelines. They are checked when a quotation is priced or saved, when a request for quotation approaches an insurer and when a placement is created. Each rule has a **Rule** code and name, the **Template / product**, the **Insurer** (one insurer, or all), a **Condition** on the risk details, an **Outcome** and the **Authority Level**:

| Outcome | What happens |
|---|---|
| **Auto-accept** | The risk passes when the condition holds; otherwise it is referred (or declined) |
| **Refer** | The quotation is held until a user of the authority role approves it within his or her limit of the [Authority Matrix](#authority-matrix) (underwriting referral approval) |
| **Decline** | The risk is refused with the rule's message |
| **Apply loading** | The loading (for example 15%) is added to the net premium |

The risk details the rules check are asked on the quotation (for example the fair market value of the vehicle, the claims in the last 3 years, the driver's date of birth). **Add Rule** adds a rule; **Test a risk** shows which rules a sample risk triggers.

## Document Manager {#document-manager}

{{screen:/product-configurator/documents}}

The Document Manager holds the document templates of each product template, printed from the policy and quotation screens and attached to e-mails: **Document**, **Template / product**, **Printed as** (policy schedule, quotation slip, CTPL certificate, member enrolment form), **Stage** (quotation, policy issuance), **Layout** and **Status**.

Without an upload the standard layout is printed. To use TISPH's own layout, select **Add document template** (or edit a row) and upload the layout: a text file with merge fields. **Merge fields** lists the fields that can be placed in a layout (client, policy, vehicle, covers, premium, signature slots of [Document Signatures](#document-signatures)).

## Market Mapping {#market-mapping}

{{screen:/product-configurator/market-mapping}}

Market Mapping lists the insurers that offer each product: **Template / product**, **Insurer**, **Insurer Code** (the product's code at the insurer), **Agreed comm. % (ref.)**, **Target**, **YTD Performance** (premium of the policies issued this year, against the target) and **Status**. Only the insurers on a product's market can be approached on a request for quotation. The agreed commission here is a reference; the commission applied comes from the [Commission Rate Matrix](#commission-rate-matrix). **Map Product** adds an insurer to a product.

![Product Configurator > Market Mapping: the panel insurers of the motor product](images/screens-product-configurator/market-mapping.png)

## Risk Mapping {#risk-mapping}

{{screen:/product-configurator/risk-mapping}}

Risk Mapping lists the risk definitions of the products: **Product**, **Definition** (for example vehicle details for motor, liability cover fields for CTPL), **Risk Sections**, **Used by** and **Status**. The definitions are kept for reference; the risk details of a motor quotation are those of the quotation screens.

## Product Analytics {#product-analytics}

{{screen:/product-configurator/analytics}}

Product Analytics is computed from the policies issued and the claims recorded, leaving out cancelled policies and rejected claims. The cards show the **Premium written**, the **Policies** and the **Products with policies**; the charts show the **Premium Trend** and the **Category Distribution**. **Top Products Performance** lists each product with its **Policies**, **Premium**, **Avg Premium**, **Loss Ratio**, **Profit Margin** and **Growth (12 months)**.

![Product Configurator > Product Analytics](images/screens-product-configurator/product-analytics.png)

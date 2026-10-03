---
title: Perpetual Licence Agreement
subtitle: iNXT BrokerVerse OOTB
version: 1.0
date: 03 October 2026
prepared: iorta TechNXT Corp.
reviewed: Legal counsel (to be completed)
approved: To be completed
change: Template for discussion; subject to review by the parties' legal counsel
open_item: Review and completion by the parties' legal counsel before signature
acronyms: AMC=Annual Maintenance Contract; DR=Disaster recovery; MSA=Master Services Agreement; OOTB=Out of the box; PHP=Philippine peso; RA=Republic Act; UAT=User acceptance testing; VAT=Value-added tax
---

# About this template

> Template for discussion; subject to review by the parties' legal counsel.

This Perpetual Software Licence Agreement (the **Licence Agreement**) sets the terms of a perpetual licence of iNXT BrokerVerse OOTB. It forms part of the Master Services Agreement (the **MSA**) between iorta TechNXT Corp. and the Client when an Order Form names it. Capitalised terms not defined here have the meaning given in the MSA. Text in [square brackets] is a placeholder or an option.

# Agreement and definitions

## Parties

This Licence Agreement is made on [date] between **iorta TechNXT Corp.**, SEC registration no. [number], with principal office at [address] (**iorta TechNXT**), and **[Client legal name]**, SEC registration no. [number], with principal office at [address] (the **Client**), under the MSA dated [date] and Order Form no. [number].

## Definitions

| Term | Meaning |
|---|---|
| Licensed Software | iNXT BrokerVerse OOTB in object code (the compiled back-end and front-end builds and container images), the database schema and migrations, the upload templates and the Documentation, in the version delivered at Go-Live and in the updates delivered under the AMC |
| Licence Fee | The one-time fee for the licence stated in the Order Form |
| Named User | An individual identified by a personal sign-in who is authorised to use the Licensed Software; an inactive (deactivated) user is not counted |
| Licensed Users | The number of Named Users stated in the Order Form, as increased by later Order Forms |
| Production Environment | The single installation of the Licensed Software used for the Client's live business transactions |
| Non-Production Environment | An installation used only for testing, UAT, training or disaster recovery, and never for live transactions |
| Warranty Period | 12 months from Go-Live |

# Licence

## Grant

1. Subject to payment of the Licence Fee and to this Licence Agreement, iorta TechNXT grants the Client a perpetual, non-exclusive, non-transferable, non-sublicensable licence to install and use the Licensed Software in the Philippines for the internal business of the Client as a licensed insurance broker, by up to the Licensed Users.
2. "Internal business" includes processing the business of the Client's clients, insurers, reinsurers and referrers in the Client's own name. It does not include providing the Licensed Software as a service, a bureau or an outsourcing service to any other person.
3. The licence is perpetual: it continues after the end of the AMC, but updates, releases and support after the Warranty Period are provided only while the AMC is in force.

## Users and slabs

1. The licence is for Named Users. The Licence Fee is calculated on graduated slabs: users 1 to 25 at the Small slab rate, users 26 to 100 at the Medium slab rate, users 101 to 300 at the Large slab rate and users above 300 at the Enterprise slab rate, as stated in Schedule 1 and the Order Form.
2. The Client may reassign a Named User licence from one individual to another when the first individual leaves or changes role permanently, but not to share a licence among several people or rotate it.
3. [Option: concurrent users. The Client may instead license a number of concurrent users, meaning the maximum number of Users signed in at the same time, at the concurrent user price stated in the Order Form.]
4. Accounts used only by iorta TechNXT support staff, and service accounts used for integrations, are not counted.

## Additional users

The Client may license additional Named Users at any time through an Order Form. Additional users are priced at the slab rates of the current price list for the slabs they fall into, counting from the existing Licensed Users, less any discount that the original Order Form states applies to additional users. AMC on additional users starts on the later of their licence date and the AMC start, prorated to the next AMC anniversary.

## Environments

1. The licence covers one Production Environment and up to [two] Non-Production Environments (for example UAT and training), and one passive DR copy of the Production Environment that is used only when the Production Environment is unavailable or during a DR test.
2. Additional Non-Production Environments may be licensed through an Order Form. Their set-up and hosting are priced as optional services.
3. Production personal data is not copied into a Non-Production Environment without masking, as stated in the Data Processing Agreement.

## Delivery and installation

1. iorta TechNXT delivers the Licensed Software by installing it in the environments named in the Order Form, either in the Client's own cloud account or data centre or in the hosting environment provided under the Hosting and Infrastructure Services Agreement.
2. Where the Client hosts, iorta TechNXT supplies the deployment guide and the container images or build artefacts, and set-up support is charged at the day rates of the Order Form unless it is in the Implementation SOW.

## Restrictions

The Client shall not, and shall not allow any person to:

1. use the Licensed Software beyond the Licensed Users, the environments or the purpose in this Licence Agreement;
2. copy the Licensed Software, except for the installations allowed and for reasonable back-up and archive copies;
3. modify, translate, adapt or create derivative works of the Licensed Software, except through configuration in the delivered screens and settings or through Change Requests performed by iorta TechNXT;
4. reverse engineer, decompile or disassemble the Licensed Software, except to the extent that RA 8293 allows it despite this restriction;
5. sell, rent, lease, lend, sublicense or otherwise make the Licensed Software available to any third party, or use it to provide services to other brokers or agents;
6. remove or alter any proprietary notice, or circumvent any licence control;
7. use the Licensed Software to build a competing product.

## Third-party and open-source components

The Licensed Software includes open-source components under their own licences, listed in the Documentation. Those licences govern the components. iorta TechNXT warrants that their use as part of the Licensed Software, as delivered, does not require the Client to disclose its own source code or data.

## Licence compliance

Once a year, on 30 days' written notice, iorta TechNXT may ask the Client to confirm in writing the number of active Named Users and the environments in use. The User Management screens of the Licensed Software provide the count. If the count exceeds the Licensed Users, the Client licenses the excess at the current price list through an Order Form, with AMC from the date the excess began.

# Fees, warranty and AMC

## Licence Fee

1. The Licence Fee is stated in the Order Form and is payable 100% on Go-Live, under the payment terms of the MSA.
2. If Go-Live is delayed for more than [60] days for reasons attributable to the Client, the Licence Fee becomes payable on the date Go-Live was planned in the SOW, as adjusted by approved Change Requests.
3. The Licence Fee excludes VAT. The withholding treatment of the Licence Fee is stated in the Order Form after review by both Parties' tax advisers.

## Warranty Period

During the Warranty Period iorta TechNXT corrects defects in the Licensed Software and provides standard support under the service levels of the Annual Maintenance and Support Agreement, at no additional charge.

## AMC linkage

1. After the Warranty Period, maintenance and support are provided under the Annual Maintenance and Support Agreement. The AMC fee is 22% of the Licence Fee a year, payable yearly in advance from the start of Year 2 and increasing 5% at each anniversary.
2. The AMC covers all Licensed Users. The Client may not keep AMC on only part of its Licensed Users.
3. If the Client does not renew the AMC, the licence continues, but the Client is not entitled to updates, releases, regulatory form updates, corrections or support.
4. To reinstate a lapsed AMC, the Client pays the AMC fees that would have been payable for the lapsed period plus a reinstatement fee of [10%] of those fees, and iorta TechNXT upgrades the Client to the current release at the day rates of the Order Form.

## Supported versions

iorta TechNXT supports the current release and the two previous planned releases. The Client applies releases in line with the release process of the Annual Maintenance and Support Agreement.

# Source code escrow (optional)

## Escrow deposit

[Option, if selected in the Order Form.] Within 60 days of Go-Live, iorta TechNXT deposits the source code of the Licensed Software, with build instructions, with [name of escrow agent] (the **Escrow Agent**) under the iNXT BrokerVerse Source Code Escrow Agreement signed by iorta TechNXT, the Client and the Escrow Agent (or the Escrow Agent's standard form, adapted so that it states the same deposit, release and use terms as this clause), and updates the deposit after each major release and at least once a year while the AMC is in force.

## Release events

The Escrow Agent releases the deposit to the Client if:

1. iorta TechNXT ceases to carry on business, is dissolved, or is declared insolvent or placed under rehabilitation or liquidation, and no successor assumes its obligations under the AMC within 60 days; or
2. iorta TechNXT, while the AMC is in force and paid, fails to correct a P1 or P2 defect within 60 days of a written notice from the Client, and does not cure the failure within a further 30 days of a second notice.

## Use of released code

On release, the Client may use the source code only to maintain and correct the Licensed Software for its own internal business under this Licence Agreement, by its own staff or a contractor bound by confidentiality. The source code remains Confidential Information and the property of iorta TechNXT. No other rights are granted.

## Escrow costs

The Client pays the fees of the Escrow Agent [and of any verification test it requests]. iorta TechNXT bears its own costs of preparing deposits.

# Term and termination

## Term

This Licence Agreement starts on the date of the Order Form and continues in perpetuity unless terminated under this clause.

## Termination

1. iorta TechNXT may terminate the licence by written notice if the Client: (a) fails to pay the Licence Fee within 10 Business Days of a written notice of non-payment, as in the Termination for cause clause of the MSA; or (b) materially breaches the Restrictions and does not cure the breach within 30 days of a written notice.
2. The Client may terminate the licence at any time by written notice. No Licence Fee is refunded, except as stated in the MSA for infringement claims or warranty failure.

## Effect of termination

On termination of the licence, the Client stops using the Licensed Software, uninstalls it from all environments and certifies this in writing within 30 days. The Client keeps its Client Data. iorta TechNXT assists with an export of the Client Data under the MSA and, where iorta TechNXT hosts, under the Exit and Transition Plan. Termination of the AMC alone does not terminate the licence.

# Signatures

| For iorta TechNXT Corp. | For [Client legal name] |
|---|---|
| Signature: ____________________ | Signature: ____________________ |
| Name: [name] | Name: [name] |
| Title: [title] | Title: [title] |
| Date: [date] | Date: [date] |

# Schedule 1: licence details

## Licensed Users and Licence Fee

| Slab | Users in slab | Rate per user (PHP) | Amount (PHP) |
|---|---|---|---|
| 1 to 25 | [number] | 90,000.00 | [amount] |
| 26 to 100 | [number] | 78,000.00 | [amount] |
| 101 to 300 | [number] | 66,000.00 | [amount] |
| Above 300 | [number] | 54,000.00 | [amount] |
| Total Licensed Users | [number] | | [amount] |
| Discount, if any ([lever]) | | | ([amount]) |
| Licence Fee, excluding VAT | | | [amount] |

The rates are the list rates of the price book dated 03 October 2026 and are replaced by the rates of the signed Order Form.

## Environments

| Environment | Purpose | Location |
|---|---|---|
| Production | Live transactions | [AWS Singapore / Azure Southeast Asia / local partner / Client data centre] |
| UAT | Testing and acceptance | [location] |
| [Training] | [Training] | [location] |
| DR copy | Recovery only | [location] |

## AMC

| Item | Value |
|---|---|
| Warranty Period | 12 months from Go-Live |
| AMC start | First day of Year 2 after Go-Live |
| AMC fee, first AMC year | 22% of the Licence Fee: PHP [amount] |
| Yearly increase | 5% at each anniversary |
| Source code escrow | [Yes, with Escrow Agent name / No] |

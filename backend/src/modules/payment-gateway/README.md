# Payment gateways and payment links

Instant premium routing and micro-payments: a payment link asks a client to pay a package quotation, a quotation or a
policy's open premium online. The gateway confirms the payment on a webhook, the platform creates the official
receipt and, for package products, can issue the digital policy at once.

| Screen | Routes | Permission |
|---|---|---|
| Master > Packaged Products > Payment Gateways | `GET /payment-gateways`, `PUT /payment-gateways/:code` | read: `read:settings`, `read:receipts`, `write:quotations`, `write:policies`; change: `write:settings` (System Administrator) |
| Payment Gateways > Payments log | `GET /payment-gateways/events` | `read:settings` or `read:receipts` |
| Sales & Marketing > Payment Links | `/payment-links` | read: `read:quotations` / `read:policies` / `read:receipts`; create, cancel: `write:quotations` / `write:policies` / `write:receipts`; apply: `write:receipts` or `write:policies` |
| Client checkout page `/pay/:token` (front end, no sign-in) | `GET /public/payments/:token`, `POST /:token/sandbox`, `GET /:token/policy.pdf` | the link's random token |
| Gateway to server | `POST` / `GET /public/payments/webhooks/:gateway` | provider signature |

## Files

| File | What it does |
|---|---|
| `providers.js` | SANDBOX, PayMongo and Dragonpay: open a checkout, verify and read a notification, report which credentials are present. |
| `service.js` | Gateways master, payment targets and amounts, links (`PL-` numbers, series `payment_link`), the payments log. |
| `confirm.js` | Notification handling (signature, idempotency, amount check) and applying a paid link (policy issuance when allowed, official receipt). |
| `router.js` | The three routers: `/payment-gateways`, `/payment-links`, `/public/payments`. |

## Providers

| Provider | Checkout | Notification | Environment (prefix = the gateway's credentials prefix) |
|---|---|---|---|
| `sandbox` | the platform's `/pay/:token` page with "Pay" and "Fail" buttons | JSON signed with HMAC-SHA256 in `x-sandbox-signature` | optional `<prefix>_WEBHOOK_SECRET` (default: derived from `DATA_ENCRYPTION_KEY`) |
| `paymongo` | Checkout Session (`POST https://api.paymongo.com/v1/checkout_sessions`, amount in centavos, reference = link number) | webhook `checkout_session.payment.paid` / `payment.failed`; header `Paymongo-Signature: t=..,te=..,li=..`, HMAC-SHA256 of `t.rawBody` (te in sandbox mode, li in live mode) | `<prefix>_SECRET_KEY`, `<prefix>_WEBHOOK_SECRET` |
| `dragonpay` | Payment Switch `Pay.aspx` (test / live host by mode) with SHA1 digest | postback (GET or form POST) `txnid, refno, status, message, digest`; answered `result=OK` | `<prefix>_MERCHANT_ID`, `<prefix>_PASSWORD` |

Secrets are read only from the environment (secret store); the database keeps the prefix, and the API only says
whether each variable is present. A gateway cannot be enabled live until its credentials are present, and the sandbox
provider can never be live. The raw request body is kept by `src/app.js` (`req.rawBody`) for the signatures.

Webhook addresses to register with the gateways: `<PUBLIC_BASE_URL>/api/public/payments/webhooks/PAYMONGO` and
`.../webhooks/DRAGONPAY` (Dragonpay postback URL). The return address is `<general.frontend_url>/pay/<token>`.

## Flow

1. Staff create a link (`POST /payment-links`): the amount is the package total, the quotation gross premium or the
   policy's open bills; a gateway with `fee_handling = pass_on` adds its fee (percent + fixed) to the total charged.
   Only one pending link per target. The provider checkout is opened and the client address (`payUrl`) returned.
2. The client pays; the gateway notifies the webhook. Every notification is logged in `payment_events` (the payments
   log) with whether its signature was valid; an invalid one is answered 401.
3. A paid notification marks the link paid (a total that differs goes to `review` instead) and applies it:
   - the policy: the target policy, the policy already issued, or (when `payments.auto_issue_package_policies`, the
     gateway's `auto_issue` and the bundle's `auto_issue` allow it) a policy issued now from the package quotation or
     the package-product quotation;
   - the official receipt for the premium (`payments.auto_receipt`), payment mode from `payments.payment_modes`,
     deposited to the gateway's bank account when set, source `payment-gateway`.
   Without a policy the link stays `awaiting_issue`; on an error `error`. The creator and `payments.notify_roles_on_error` are
   notified and `POST /payment-links/:id/apply` finishes it.
4. The client page shows the result and, once issued, offers the policy PDF (`/public/payments/:token/policy.pdf`).

Notifications are idempotent (the paid update is conditional), so a gateway's retries never create a second receipt.

## Open points for go-live

- Merchant accounts and credentials (PayMongo secret and webhook keys, Dragonpay merchant id and password) are needed
  to test against the gateways' own sandboxes; the automated tests use the sandbox provider and signed test payloads
  only, never the gateways' APIs.
- The gateway fee is recorded on the link but not journalised (settlement net of fees is reconciled through bank
  reconciliation).

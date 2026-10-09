-- Parked system journals (TIS-BRD-GL-03, FGA.09 "Saved > Parked, Approved > Posted"): the journal of a business event
-- listed in accounting.parked_events is saved "for approval" instead of posted, and posted when a user other than the one
-- whose action created it approves it (Accounts > Journal Voucher, My Work > Approvals; Authority Matrix limit of the
-- journal voucher). It cannot be rejected on its own: cancelling its source document cancels it.
--
-- Not every event can be parked: premium bookings, collections applied to bills, direct-bill commission, insurer
-- refunds and write-offs keep their journal in step with a sub-ledger that later steps read, so they always post
-- (accounting/lib/posting.js, ALWAYS_POSTED). Events posted on the approval of their own document (remittances,
-- payment vouchers, supplier invoices, billing statements) post on that approval unless they are listed too.
--
-- TISPH default: the FGA.09 documents that have no approval of their own in the platform are parked: collection of
-- commission from the insurer (debit note / billing statement collection), the service invoice and its payment, and
-- the payment of supplier invoices. accounting.auto_post_system_entries (every unlisted event saved pending) is kept.
-- Idempotent.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.parked_events', '["directbill.collection", "sales_invoice.issue", "sales_invoice.payment", "ap.payment"]', 'accounting',
  'Business events whose journals are parked on save and posted when a different user approves them (event codes of Master > Finance > Accounting Flow; premium bookings, collections, direct-bill commission, insurer refunds and write-offs always post)', 'json')
ON CONFLICT (key) DO NOTHING;

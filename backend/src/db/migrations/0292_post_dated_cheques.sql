-- Post-dated cheque register (Accounts > Post-Dated Cheques): cheques received from clients against their bills and
-- kept in the vault until their date. Nothing is posted while a cheque is on hand; depositing it on its date creates
-- the official receipt (posting rule receipt.apply through the receipts module). A bounced cheque cancels that receipt
-- (the bill is open again) and can be replaced by a new cheque; a cheque can be returned to the client unused.
--   status: on-hand -> deposited -> cleared | bounced -> replaced ; on-hand -> returned | cancelled
CREATE TABLE IF NOT EXISTS post_dated_cheques (
  id text PRIMARY KEY DEFAULT ('pdc_' || encode(gen_random_bytes(8), 'hex')),
  pdc_number text NOT NULL UNIQUE,
  client_id text REFERENCES clients(id),
  policy_id text REFERENCES policies(id),
  receivable_id text REFERENCES receivables(id),
  bank_id int REFERENCES banks(id),                    -- drawee bank (Bank master)
  drawee_bank text,                                    -- drawee bank as written when it is not in the master
  branch text,
  cheque_number text NOT NULL,
  cheque_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  received_date date NOT NULL,
  storage_location text,                               -- vault / safe where the cheque is kept (warehousing)
  status text NOT NULL DEFAULT 'on-hand' CHECK (status IN ('on-hand', 'deposited', 'cleared', 'bounced', 'replaced', 'returned', 'cancelled')),
  deposit_account text,                                -- bank account (Bank Account master) the cheque was deposited to
  deposited_on date, deposited_by text,
  receipt_id text REFERENCES receipts(id),             -- the official receipt created at deposit
  cleared_on date,
  bounced_on date, bounce_reason text, bounce_charge numeric(14,2) NOT NULL DEFAULT 0,
  replaces_id text REFERENCES post_dated_cheques(id),
  replaced_by_id text REFERENCES post_dated_cheques(id),
  returned_on date, return_reason text,
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_by text, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS post_dated_cheques_due ON post_dated_cheques(status, cheque_date);
CREATE INDEX IF NOT EXISTS post_dated_cheques_client ON post_dated_cheques(client_id);
CREATE INDEX IF NOT EXISTS post_dated_cheques_policy ON post_dated_cheques(policy_id);
CREATE INDEX IF NOT EXISTS post_dated_cheques_receivable ON post_dated_cheques(receivable_id);
CREATE INDEX IF NOT EXISTS post_dated_cheques_receipt ON post_dated_cheques(receipt_id);
-- the same cheque cannot be registered twice (unless the first registration was cancelled)
CREATE UNIQUE INDEX IF NOT EXISTS post_dated_cheques_cheque_uq ON post_dated_cheques(COALESCE(bank_id, 0), lower(COALESCE(drawee_bank, '')), cheque_number)
  WHERE status <> 'cancelled';

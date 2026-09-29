-- Period-end processing: fiscal calendar, period statuses (open | soft_closed | closed | locked), month-end close runs
-- with a configurable checklist, recurring / accrual journals with auto-reversal, year-end close with opening balances.
--
--   fiscal_years                 FYyyyy (yyyy = calendar year in which the fiscal year ends), start / end, open | closing | closed
--   accounting_periods           + fiscal_year, period_no (1-12, 13 = adjustment period 'yyyy-13' dated the fiscal year end)
--   period_status_history        every status change of a period (who, when, why)
--   period_close_checklist       month-end checklist items (auto checks and manual sign-offs)
--   period_close_runs            one Month-End Close run per period (MEC number), steps + maker-checker approval
--   period_close_run_checks      checklist results of a run
--   period_close_entries         journals a close run (or a recurring template) generated, with their auto-reversal
--   recurring_journals           recurring / accrual journal templates (RJV number); recurring_journal_runs = occurrences
--   year_end_runs                Year-End Close runs (YEC number): closing entries, opening balances, lock
--   opening_balances             balance-sheet balances carried into a fiscal year by the year-end close (the trial
--                                balance, GL detail and opening columns read them; see pe_balance_before)
-- Idempotent.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('accounting.fiscal_year_start_month', '1', 'accounting', 'First month of the fiscal year (1 = January ... 12 = December); applies when the first fiscal year is generated', 'number'),
 ('accounting.adjustment_period_enabled', 'true', 'accounting', 'Allow year-end adjustment journals in adjustment period 13 (closing entries always use it)', 'boolean'),
 ('accounting.period_close_requires_approval', 'true', 'accounting', 'Month-end close: closing a period needs approval by a second user (maker-checker)', 'boolean'),
 ('accounting.defer_commission', 'false', 'accounting', 'Month-end close: defer commission income for cover beyond the period end (pro rata by days) to unearned commission, reversed next period', 'boolean'),
 ('accounting.fx_revaluation_account_types', '["asset","liability"]', 'accounting', 'Month-end close: account types whose foreign-currency balances are revalued at the month-end rate', 'json'),
 ('accounting.account.retained_earnings', '"5101001"', 'accounting', 'GL: Retained earnings (year-end close)', 'string'),
 ('accounting.account.current_year_pl', '"5102001"', 'accounting', 'GL: Current year profit / (loss) (income summary at year-end close)', 'string'),
 ('accounting.account.unearned_commission', '"2209001"', 'accounting', 'GL: Unearned commission income (month-end commission deferral)', 'string'),
 ('accounting.account.fx_unrealised_gain', '"3301003"', 'accounting', 'GL: Unrealised foreign exchange gain (month-end revaluation)', 'string'),
 ('accounting.account.fx_unrealised_loss', '"4501003"', 'accounting', 'GL: Unrealised foreign exchange loss (month-end revaluation)', 'string'),
 ('accounting.account.suspense', '"1901001"', 'accounting', 'GL: Suspense account (must be zero before a period is closed)', 'string'),
 ('accounting.account.accrued_expenses', '"2208001"', 'accounting', 'GL: Accrued expenses payable (accrual templates)', 'string'),
 ('numbering.period_close.prefix', '"MEC"', 'numbering', 'Month-end close run number prefix', 'string'),
 ('numbering.year_end_close.prefix', '"YEC"', 'numbering', 'Year-end close run number prefix', 'string'),
 ('numbering.recurring_journal.prefix', '"RJV"', 'numbering', 'Recurring journal template number prefix', 'string')
ON CONFLICT (key) DO NOTHING;

-- GL accounts the period-end steps post to (the chart itself is seeded by seeds/40_finance.sql)
INSERT INTO gl_accounts(code, name, account_type, category, is_open_item, allow_manual, fs_group, normal_balance, description) VALUES
 ('3301003', 'Unrealised Foreign Exchange Gain', 'income', 'Other Income', false, false, 'Other Income', 'credit', 'Month-end revaluation of foreign-currency balances (reversed next period)'),
 ('4501003', 'Unrealised Foreign Exchange Loss', 'expense', 'Finance Costs', false, false, 'Other Expenses', 'debit', 'Month-end revaluation of foreign-currency balances (reversed next period)'),
 ('1901001', 'Suspense Account', 'asset', 'Suspense', false, true, 'Current Assets', 'debit', 'Unidentified items pending classification; must be cleared before a period is closed')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions(code, module, description) VALUES
 ('approve:period-end', 'period-end', 'Approve month-end / year-end close, post into soft-closed periods, reopen periods, reverse a year-end close')
ON CONFLICT (code) DO NOTHING;

-- ---------- fiscal calendar ----------
CREATE TABLE IF NOT EXISTS fiscal_years (
  code text PRIMARY KEY,                               -- FY2026
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closing', 'closed')),
  closed_by text, closed_at timestamptz, remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date > start_date));
CREATE UNIQUE INDEX IF NOT EXISTS fiscal_years_start_uq ON fiscal_years(start_date);

ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS fiscal_year text REFERENCES fiscal_years(code);
ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS period_no int;
ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS is_adjustment boolean NOT NULL DEFAULT false;
ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS soft_closed_by text;
ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS soft_closed_at timestamptz;
ALTER TABLE accounting_periods ADD COLUMN IF NOT EXISTS locked_at timestamptz;
DO $$
DECLARE c text;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint WHERE conrelid = 'accounting_periods'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%status%' LOOP
    EXECUTE format('ALTER TABLE accounting_periods DROP CONSTRAINT %I', c);
  END LOOP;
  ALTER TABLE accounting_periods ADD CONSTRAINT accounting_periods_status_check CHECK (status IN ('open', 'soft_closed', 'closed', 'locked'));
END $$;
CREATE INDEX IF NOT EXISTS accounting_periods_fy_idx ON accounting_periods(fiscal_year, period_no);

-- Posting guard: a journal becomes 'posted' only when balanced and its period (adjustment period 'yyyy-13' when the
-- journal carries it, else the calendar month of its date) is not closed or locked. Soft-closed periods are enforced by
-- the application (finance managers may still post into them).
CREATE OR REPLACE FUNCTION jv_check_posting() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d numeric; c numeric; n int; st text; eff text;
BEGIN
  IF NEW.status = 'posted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'posted') THEN
    SELECT COALESCE(sum(debit),0), COALESCE(sum(credit),0), count(*) INTO d, c, n FROM journal_lines WHERE jv_id = NEW.id;
    IF n < 2 OR d <> c OR d = 0 THEN
      RAISE EXCEPTION 'journal % is not balanced (debit %, credit %, lines %)', NEW.id, d, c, n USING ERRCODE = 'check_violation';
    END IF;
    eff := CASE WHEN NEW.period ~ '^[0-9]{4}-13$' THEN NEW.period ELSE to_char(NEW.jv_date, 'YYYY-MM') END;
    SELECT status INTO st FROM accounting_periods WHERE period = eff;
    IF st IN ('closed', 'locked') THEN
      RAISE EXCEPTION 'accounting period % is %', eff, st USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- A locked period (fiscal year closed) can only be unlocked by the year-end reversal, which sets
-- brokerverse.period_unlock for its transaction.
CREATE OR REPLACE FUNCTION accounting_period_lock_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'locked' AND NEW.status IS DISTINCT FROM 'locked' AND COALESCE(current_setting('brokerverse.period_unlock', true), '') <> 'on' THEN
    RAISE EXCEPTION 'accounting period % is locked (fiscal year closed); reverse the year-end close to reopen it', OLD.period USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS accounting_period_lock_guard_trg ON accounting_periods;
CREATE TRIGGER accounting_period_lock_guard_trg BEFORE UPDATE OF status ON accounting_periods FOR EACH ROW EXECUTE FUNCTION accounting_period_lock_guard();

CREATE TABLE IF NOT EXISTS period_status_history (
  id bigserial PRIMARY KEY,
  period text NOT NULL,
  fiscal_year text,
  from_status text, to_status text NOT NULL,
  remarks text,
  source text NOT NULL DEFAULT 'manual',               -- manual | close-run | year-end | year-end-reversal | job
  reference_id text,
  changed_by text, changed_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS period_status_history_period_idx ON period_status_history(period, changed_at DESC);

-- ---------- month-end close ----------
CREATE TABLE IF NOT EXISTS period_close_checklist (
  code text PRIMARY KEY,
  label text NOT NULL,
  description text,
  item_type text NOT NULL DEFAULT 'manual' CHECK (item_type IN ('auto', 'manual')),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('blocking', 'warning')),
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  is_system boolean NOT NULL DEFAULT false,            -- auto checks shipped with the system (cannot be deleted)
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO period_close_checklist(code, label, description, item_type, severity, sort_order, is_system) VALUES
 ('unposted_journals', 'No unposted or pending journals in the period', 'Journals dated in the period still pending, for approval or approved but not posted', 'auto', 'blocking', 10, true),
 ('trial_balance', 'Trial balance balances', 'Total debits equal total credits as of the period end', 'auto', 'blocking', 20, true),
 ('suspense_balance', 'Suspense account is cleared', 'Balance of the suspense account (accounting.account.suspense) as of the period end is zero', 'auto', 'blocking', 30, true),
 ('unapplied_receipts', 'No unapplied receipts', 'Receipt lines paid but not applied to a bill up to the period end', 'auto', 'warning', 40, true),
 ('unreconciled_bank', 'Bank transactions reconciled', 'Unreconciled bank statement lines up to the period end (when bank reconciliation is in use)', 'auto', 'warning', 50, true),
 ('policies_without_accounting', 'Issued policies are billed', 'Broker-billed policies incepted in or before the period with neither a receivable nor a journal', 'auto', 'warning', 60, true),
 ('remittances_due', 'Remittances to insurers paid', 'Approved remittances for the period or earlier not yet settled, and open insurer payables', 'auto', 'warning', 70, true),
 ('direct_bill_unbilled', 'Direct-bill commission billed', 'Direct-bill commission booked up to the period end not yet on a commission debit note', 'auto', 'warning', 80, true),
 ('bank_reconciliation_signoff', 'Bank reconciliations reviewed and signed off', 'Finance manager confirms every bank account is reconciled to the statement', 'manual', 'blocking', 100, false),
 ('prepayments_depreciation', 'Prepayments and depreciation reviewed', 'Amortisation of prepayments and depreciation booked for the month', 'manual', 'warning', 110, false),
 ('payroll_statutory', 'Payroll and statutory contributions booked', 'Salaries, SSS, PhilHealth and Pag-IBIG for the month recorded', 'manual', 'warning', 120, false)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS period_close_runs (
  id text PRIMARY KEY DEFAULT ('pcr_' || encode(gen_random_bytes(8), 'hex')),
  run_number text UNIQUE NOT NULL,
  period text NOT NULL REFERENCES accounting_periods(period),
  fiscal_year text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in-progress', 'blocked', 'ready', 'pending-approval', 'soft-closed', 'closed', 'cancelled')),
  target_status text CHECK (target_status IN ('soft_closed', 'closed')),
  steps jsonb NOT NULL DEFAULT '{}',
  execution_count int NOT NULL DEFAULT 0,
  prepared_by text, prepared_at timestamptz,
  submitted_by text, submitted_at timestamptz,
  approved_by text, approved_at timestamptz,
  rejected_by text, rejected_at timestamptz, rejection_reason text,
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS period_close_runs_active_uq ON period_close_runs(period)
  WHERE status IN ('draft', 'in-progress', 'blocked', 'ready', 'pending-approval', 'soft-closed');

CREATE TABLE IF NOT EXISTS period_close_run_checks (
  id bigserial PRIMARY KEY,
  run_id text NOT NULL REFERENCES period_close_runs(id) ON DELETE CASCADE,
  code text NOT NULL, label text NOT NULL, item_type text NOT NULL, severity text NOT NULL, sort_order int NOT NULL DEFAULT 100,
  status text NOT NULL DEFAULT 'pending',              -- pending | passed | failed | warning | not-applicable | signed-off
  item_count int, amount numeric(16,2), message text, detail jsonb,
  checked_at timestamptz, signed_by text, signed_at timestamptz, remarks text,
  UNIQUE (run_id, code));

CREATE TABLE IF NOT EXISTS period_close_entries (
  id bigserial PRIMARY KEY,
  run_id text REFERENCES period_close_runs(id),
  period text NOT NULL,
  step text NOT NULL,                                  -- accrual | recurring | deferral | fx
  jv_id text NOT NULL REFERENCES journal_vouchers(id),
  auto_reverse_on date,
  reversal_jv_id text REFERENCES journal_vouchers(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'undone')),
  undo_jv_ids text[] NOT NULL DEFAULT '{}',
  recurring_run_id bigint,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS period_close_entries_run_idx ON period_close_entries(run_id, step);
CREATE INDEX IF NOT EXISTS period_close_entries_due_idx ON period_close_entries(auto_reverse_on) WHERE status = 'active' AND reversal_jv_id IS NULL;

-- ---------- recurring and accrual journals ----------
CREATE TABLE IF NOT EXISTS recurring_journals (
  id text PRIMARY KEY DEFAULT ('rj_' || encode(gen_random_bytes(8), 'hex')),
  code text UNIQUE NOT NULL,                           -- RJV number
  name text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'recurring' CHECK (kind IN ('recurring', 'accrual')),
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'quarterly', 'yearly')),
  start_date date NOT NULL,
  next_run_date date,
  end_date date,
  auto_post boolean NOT NULL DEFAULT true,
  auto_reverse boolean NOT NULL DEFAULT false,         -- reverse on day 1 of the next period (accruals)
  currency text NOT NULL DEFAULT 'PHP',
  lines jsonb NOT NULL DEFAULT '[]',                   -- [{accountCode, debit, credit, memo}]
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
  last_run_date date, last_jv_id text,
  created_by text, updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS recurring_journals_due_idx ON recurring_journals(kind, next_run_date) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS recurring_journal_runs (
  id bigserial PRIMARY KEY,
  recurring_id text NOT NULL REFERENCES recurring_journals(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  period text,
  jv_id text REFERENCES journal_vouchers(id),
  close_run_id text,
  status text NOT NULL DEFAULT 'posted' CHECK (status IN ('posted', 'pending', 'failed', 'undone')),
  error text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS recurring_journal_runs_uq ON recurring_journal_runs(recurring_id, occurrence_date) WHERE status IN ('posted', 'pending');

-- ---------- year-end close ----------
CREATE TABLE IF NOT EXISTS year_end_runs (
  id text PRIMARY KEY DEFAULT ('yec_' || encode(gen_random_bytes(8), 'hex')),
  run_number text UNIQUE NOT NULL,
  fiscal_year text NOT NULL REFERENCES fiscal_years(code),
  next_fiscal_year text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'checked', 'closed', 'reversed', 'cancelled')),
  checks jsonb NOT NULL DEFAULT '[]',
  closing_jv_id text REFERENCES journal_vouchers(id),
  transfer_jv_id text REFERENCES journal_vouchers(id),
  reversal_jv_ids text[] NOT NULL DEFAULT '{}',
  net_income numeric(16,2),
  opening_accounts int,
  prepared_by text, prepared_at timestamptz,
  closed_by text, closed_at timestamptz,
  reversed_by text, reversed_at timestamptz, reverse_reason text,
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX IF NOT EXISTS year_end_runs_active_uq ON year_end_runs(fiscal_year) WHERE status IN ('draft', 'checked', 'closed');

CREATE TABLE IF NOT EXISTS opening_balances (
  fiscal_year text NOT NULL REFERENCES fiscal_years(code),
  account_code text NOT NULL REFERENCES gl_accounts(code),
  balance numeric(16,2) NOT NULL,                      -- debit-positive
  source_run text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (fiscal_year, account_code));

/*
 * Balance of every account before a date (debit-positive). When the fiscal year containing the date has opening
 * balances (its predecessor was closed by the year-end close), the balance is the opening balance plus the movements
 * from the fiscal year start; otherwise it is the sum of all posted movements before the date. Both are the same
 * figure while closed years stay locked; the opening snapshot keeps reports of a new year independent of old history.
 */
CREATE OR REPLACE FUNCTION pe_balance_before(p_date date) RETURNS TABLE(account_code text, balance numeric) LANGUAGE sql STABLE AS $$
  WITH fy AS (SELECT f.code, f.start_date FROM fiscal_years f
               WHERE p_date BETWEEN f.start_date AND f.end_date AND EXISTS (SELECT 1 FROM opening_balances o WHERE o.fiscal_year = f.code))
  SELECT x.account_code, sum(x.b)::numeric FROM (
    SELECT o.account_code, o.balance AS b FROM opening_balances o JOIN fy ON fy.code = o.fiscal_year
    UNION ALL
    SELECT l.account_code, l.debit - l.credit FROM journal_lines l JOIN journal_vouchers j ON j.id = l.jv_id
     WHERE j.status IN ('posted', 'reversed') AND j.jv_date < p_date
       AND (NOT EXISTS (SELECT 1 FROM fy) OR j.jv_date >= (SELECT fy.start_date FROM fy))
  ) x GROUP BY x.account_code HAVING sum(x.b) <> 0
$$;

-- ---------- scheduled jobs (disabled until finance switches them on under Master > Configuration > Schedules) ----------
INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('month-end-reminder', 'Month-end close reminder', 'Notify finance a configurable number of days before the accounting period ends, and about ended periods still open', '0 8 * * *', 'monthEndReminder', '{"daysBefore":3}', false),
 ('recurring-journals', 'Recurring journals', 'Post recurring journal templates whose next run date has arrived', '15 1 * * *', 'recurringJournals', '{}', false),
 ('accrual-reversal', 'Accrual auto-reversal', 'Reverse accruals, commission deferrals and FX revaluations on day 1 of the next period', '30 0 1 * *', 'accrualReversal', '{}', false),
 ('period-auto-soft-close', 'Period auto soft-close', 'Soft-close ended periods after a grace period when no blocking month-end check fails', '0 2 * * *', 'periodAutoSoftClose', '{"graceDays":5}', false)
ON CONFLICT (code) DO NOTHING;

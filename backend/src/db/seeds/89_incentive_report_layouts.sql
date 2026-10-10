-- Layout of the incentive report templates (Master > Incentive Report Templates, seed 51_masters.sql): "summary"
-- totals the incentives paid by incentive period, program and branch; any other template lists the agent lines. The
-- Monthly Payout Summary is a summary. Idempotent: a template that already has a layout keeps it.

UPDATE master_records SET data = data || '{"layout": "summary", "description": "Incentives paid by period, program and branch"}'::jsonb, updated_at = now()
 WHERE type_code = 'incentive-report-template' AND code = 'IRT-001' AND NOT data ? 'layout';

-- Renewals > At-Risk Policies: the recommended actions of each retention risk factor read as tasks a user can create
-- (Call the client, Prepare an alternative quote, Escalate to the unit head), and the grace-period factors get their own.
-- Only a value nobody has changed in Master > Configuration is replaced.
UPDATE app_settings SET value = $j${
  "Claims History": ["Review the claims record with the insurer", "Prepare an alternative quote"],
  "Unpaid Premium": ["Call the client about the unpaid premium", "Offer an instalment plan"],
  "First Renewal": ["Call the client"],
  "No Contact": ["Send the first renewal notice", "Call the client"],
  "Premium Increase": ["Prepare an alternative quote", "Explain the premium change to the client"],
  "Due Soon": ["Call the client", "Escalate to the unit head"],
  "In Grace Period": ["Call the client", "Escalate to the unit head"],
  "Past Grace Period": ["Escalate to the unit head"]}$j$::jsonb,
       label = 'Recommended actions per retention risk factor (offered as tasks on Renewals > At-Risk Policies)',
       updated_at = now()
 WHERE key = 'renewals.risk_actions' AND updated_by IS NULL;

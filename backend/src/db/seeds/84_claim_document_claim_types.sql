-- Claim document checklist (TISPH, Pre-BSM M14): the documents that only some claims need get the claim type they
-- belong to, so a claim lists only the documents of its line of business and its cause of loss (claim-documents
-- service: a claim type of the master applies when it names the claim type or words of the cause of loss). Rows an
-- administrator has edited are kept.
UPDATE master_records m SET data = m.data || jsonb_build_object('claimType', v.ctype), updated_at = now()
FROM (VALUES ('M14-035', 'Third Party'),       -- Third-party driver's license
             ('M14-036', 'Third Party'),       -- Third-party OR/CR
             ('M14-037', 'Collision'),         -- Photos of all vehicles involved
             ('M14-038', 'Theft'),             -- Affidavit of Theft
             ('M14-047', 'Death'),             -- Death Certificate
             ('M14-049', 'Death'),             -- Autopsy/Post-Mortem Report
             ('M14-050', 'Death'),             -- Proof of relationship
             ('M14-051', 'Death')) AS v(code, ctype) -- Beneficiary documents
WHERE m.type_code = 'claim-document-requirement' AND m.code = v.code AND m.created_by = 'seed' AND m.updated_by IS NULL
  AND COALESCE(m.data->>'claimType', '*') = '*';

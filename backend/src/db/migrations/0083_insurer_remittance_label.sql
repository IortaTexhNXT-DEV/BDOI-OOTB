-- Premium remittances to insurers were labelled "Direct Bill" in the approval queue; direct bill now means the client
-- pays the insurer (commission debit notes), so the premium remittance is labelled "Insurer Remittance".
UPDATE remittance_approvals SET transaction_type = 'Insurer Remittance' WHERE entity = 'remittance' AND transaction_type = 'Direct Bill';

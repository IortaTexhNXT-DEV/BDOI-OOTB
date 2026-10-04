-- Fixed asset disposal (migration 0321): the number series of disposal vouchers. Reference data; idempotent.
INSERT INTO document_numbering(code, name, module, prefix, description, created_by)
SELECT s.code, s.name, s.module, s.prefix, s.description, 'seed'
FROM (VALUES ('asset_disposal', 'Fixed Asset Disposal', 'accounting', 'FAD', 'Sale or write-off of a fixed asset')) AS s(code, name, module, prefix, description)
ON CONFLICT (code) DO NOTHING;

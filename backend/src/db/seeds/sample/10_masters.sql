-- SAMPLE / DEMO DATA: runs only when SEED_SAMPLE_DATA is true (never in a production go-live). See ../README.md.
-- Fictional authorised signatories and demo branches (Cebu, Davao). Idempotent by natural key.
INSERT INTO signatories(name, designation)
SELECT * FROM (VALUES ('Maria Regina Cruz','President & CEO'),('Jose Antonio Reyes','VP - Underwriting'),('Ana Patricia Lim','Finance Director')) AS v(n,d)
WHERE NOT EXISTS (SELECT 1 FROM signatories s WHERE s.name = v.n);
INSERT INTO branches(code, name, address)
SELECT * FROM (VALUES ('CEB','Cebu Branch','Cebu City'),('DAV','Davao Branch','Davao City')) AS v(c,n,a)
WHERE NOT EXISTS (SELECT 1 FROM branches b WHERE b.code = v.c);

-- Non-packaged (bespoke) placements, part 1: the clause library and slip templates (Master > Clause Library, Master >
-- Slip Templates). A clause is a clause, warranty, exclusion, endorsement, condition, deductible or subjectivity with
-- the lines of business it applies to (empty: every line). Its wording is versioned: each version has its own
-- effective dates and the placeholders ({sum_insured}, {deductible_amount} ...) found in the text, which the slip
-- composer fills from the slip. A slip template is a set of sections and library clauses a new slip starts from.

CREATE TABLE IF NOT EXISTS clause_library (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  title text NOT NULL,
  clause_type text NOT NULL CHECK (clause_type IN ('clause', 'warranty', 'exclusion', 'endorsement', 'condition', 'deductible', 'subjectivity')),
  lines_of_business text[] NOT NULL DEFAULT '{}',   -- LOB codes (FIRE, IAR, MARINE, ENGINEERING, CASUALTY ...); empty = all
  category text,
  current_version int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  remarks text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS clause_library_type ON clause_library(clause_type, status);

CREATE TABLE IF NOT EXISTS clause_versions (
  id serial PRIMARY KEY,
  clause_id int NOT NULL REFERENCES clause_library(id) ON DELETE CASCADE,
  version int NOT NULL,
  wording text NOT NULL,
  placeholders text[] NOT NULL DEFAULT '{}',
  effective_from date NOT NULL DEFAULT DATE '2000-01-01',
  effective_to date,
  change_note text,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (clause_id, version),
  CHECK (effective_to IS NULL OR effective_to >= effective_from));

CREATE TABLE IF NOT EXISTS slip_templates (
  id serial PRIMARY KEY,
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9_-]*$'),
  name text NOT NULL,
  lines_of_business text[] NOT NULL DEFAULT '{}',
  description text,
  sections jsonb NOT NULL DEFAULT '[]',              -- [{ key, heading, text }] in print order
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS slip_template_clauses (
  template_id int NOT NULL REFERENCES slip_templates(id) ON DELETE CASCADE,
  clause_id int NOT NULL REFERENCES clause_library(id),
  position int NOT NULL DEFAULT 0,
  PRIMARY KEY (template_id, clause_id));
CREATE INDEX IF NOT EXISTS slip_template_clauses_clause ON slip_template_clauses(clause_id);

-- ---------- permissions (granted to the roles again by seeds/80_bespoke_permissions.sql on a new database) ----------
INSERT INTO permissions(code, module, description) VALUES
 ('read:bespoke', 'bespoke', 'View bespoke placements: slip composer, underwriter rooms, layering, facultative binders'),
 ('write:bespoke', 'bespoke', 'Compose slips, run underwriter rooms, arrange layers and facultative binders'),
 ('write:clause-library', 'bespoke', 'Maintain the clause library and slip templates'),
 ('write:bespoke-finance', 'bespoke', 'Reconcile participant remittances and record facultative settlements')
ON CONFLICT (code) DO NOTHING;
INSERT INTO role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM roles r JOIN permissions p ON (r.code, p.code) IN (
  ('processing', 'read:bespoke'), ('processing', 'write:bespoke'), ('processing', 'write:clause-library'),
  ('operations', 'read:bespoke'), ('operations', 'write:bespoke'),
  ('accounting', 'read:bespoke'), ('accounting', 'write:bespoke-finance'),
  ('system-admin', 'read:bespoke'), ('system-admin', 'write:bespoke'), ('system-admin', 'write:clause-library'), ('system-admin', 'write:bespoke-finance'))
ON CONFLICT DO NOTHING;

-- ---------- configuration ----------
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('bespoke.clause_types', '["clause","warranty","exclusion","endorsement","condition","deductible","subjectivity"]', 'bespoke', 'Clause types offered in the clause library (print order of the composed slip)', 'json'),
 ('bespoke.slip_sections', $j$[{"key":"insured","heading":"Insured"},{"key":"period","heading":"Period of insurance"},{"key":"situation","heading":"Situation / location of risk"},{"key":"interest","heading":"Interest insured"},{"key":"sum_insured","heading":"Sum insured"},{"key":"limits","heading":"Limits of liability"},{"key":"deductibles","heading":"Deductibles"},{"key":"premium","heading":"Premium"},{"key":"conditions","heading":"Conditions"},{"key":"subjectivities","heading":"Subjectivities"}]$j$, 'bespoke', 'Standard sections of a composed slip (key and printed heading, in print order)', 'json'),
 ('bespoke.placeholders', $j$[{"key":"insured_name","label":"Insured name"},{"key":"sum_insured","label":"Sum insured"},{"key":"currency","label":"Currency"},{"key":"period_from","label":"Inception date"},{"key":"period_to","label":"Expiry date"},{"key":"situation","label":"Situation / location"},{"key":"premium","label":"Premium"},{"key":"rate","label":"Rate"},{"key":"deductible_amount","label":"Deductible amount"},{"key":"deductible_percent","label":"Deductible percent"},{"key":"maintenance_months","label":"Maintenance period (months)"},{"key":"survey_days","label":"Days to complete the survey"},{"key":"mortgagee","label":"Mortgagee / loss payee"},{"key":"voyage","label":"Voyage / transit"}]$j$, 'bespoke', 'Placeholders offered by the clause editor; values come from the slip (insured, sum insured, period ...) or are entered on the slip', 'json')
ON CONFLICT (key) DO NOTHING;

-- ---------- Philippine market clauses (fictional broker wordings; review before use) ----------
INSERT INTO clause_library(code, title, clause_type, lines_of_business, category, created_by, updated_by) VALUES
 ('PH-TYF-DED', 'Typhoon and flood deductible', 'deductible', '{FIRE,IAR}', 'Natural catastrophe', 'migration:0200', 'migration:0200'),
 ('PH-EQV-DED', 'Earthquake, volcanic eruption and fire following deductible', 'deductible', '{FIRE,IAR,ENGINEERING}', 'Natural catastrophe', 'migration:0200', 'migration:0200'),
 ('PH-SRCC', 'Strike, riot and civil commotion', 'clause', '{FIRE,IAR,MARINE}', 'Extensions', 'migration:0200', 'migration:0200'),
 ('PH-72HR', '72-hour clause', 'clause', '{FIRE,IAR,ENGINEERING}', 'Natural catastrophe', 'migration:0200', 'migration:0200'),
 ('PH-SPRINKLER', 'Sprinkler leakage', 'endorsement', '{FIRE,IAR}', 'Extensions', 'migration:0200', 'migration:0200'),
 ('PH-FEXT-WTY', 'Warranty on fire extinguishing appliances', 'warranty', '{FIRE,IAR}', 'Warranties', 'migration:0200', 'migration:0200'),
 ('MAR-ICC-A', 'Institute Cargo Clauses (A) basis', 'clause', '{MARINE}', 'Marine cargo', 'migration:0200', 'migration:0200'),
 ('MAR-ICC-B', 'Institute Cargo Clauses (B) basis', 'clause', '{MARINE}', 'Marine cargo', 'migration:0200', 'migration:0200'),
 ('MAR-ICC-C', 'Institute Cargo Clauses (C) basis', 'clause', '{MARINE}', 'Marine cargo', 'migration:0200', 'migration:0200'),
 ('ENG-CAR-MAINT', 'Contractors all risks: maintenance visits period', 'clause', '{ENGINEERING}', 'Engineering', 'migration:0200', 'migration:0200'),
 ('GEN-CYBER-EXCL', 'Cyber loss exclusion', 'exclusion', '{}', 'Exclusions', 'migration:0200', 'migration:0200'),
 ('GEN-PREM-WTY', 'Premium payment warranty', 'condition', '{}', 'Conditions', 'migration:0200', 'migration:0200'),
 ('GEN-SURVEY-SUBJ', 'Subject to satisfactory risk survey', 'subjectivity', '{}', 'Subjectivities', 'migration:0200', 'migration:0200'),
 ('GEN-MORTGAGEE', 'Mortgagee / loss payee clause', 'endorsement', '{}', 'Endorsements', 'migration:0200', 'migration:0200')
ON CONFLICT (code) DO NOTHING;

INSERT INTO clause_versions(clause_id, version, wording, placeholders, effective_from, change_note, created_by)
SELECT c.id, 1, v.wording, v.placeholders, DATE '2026-01-01', 'Initial wording', 'migration:0200'
FROM clause_library c JOIN (VALUES
 ('PH-TYF-DED', 'Loss or damage caused by typhoon, windstorm, flood or overflow of the sea: the insured bears {deductible_percent}% of the sum insured of each location affected, subject to a minimum of {currency} {deductible_amount} each and every loss.', '{deductible_percent,currency,deductible_amount}'::text[]),
 ('PH-EQV-DED', 'Loss or damage caused by earthquake shock, volcanic eruption or fire following either: the insured bears {deductible_percent}% of the sum insured of each location affected, subject to a minimum of {currency} {deductible_amount} each and every loss.', '{deductible_percent,currency,deductible_amount}'::text[]),
 ('PH-SRCC', 'The cover is extended to loss or damage directly caused by persons taking part in strikes, riots or civil commotion, or by the action of any lawfully constituted authority in suppressing them, excluding loss arising from cessation of work.', '{}'::text[]),
 ('PH-72HR', 'Loss or damage from typhoon, flood, earthquake or volcanic eruption occurring within any period of seventy-two (72) consecutive hours is treated as a single event; the insured may choose the moment the period starts, and no two periods overlap.', '{}'::text[]),
 ('PH-SPRINKLER', 'The cover is extended to loss or damage caused by the accidental escape of water from the automatic sprinkler installation of the premises at {situation}, subject to a deductible of {currency} {deductible_amount} each and every loss.', '{situation,currency,deductible_amount}'::text[]),
 ('PH-FEXT-WTY', 'Warranted that the premises are provided with portable fire extinguishers of approved type in the number required by the Bureau of Fire Protection, kept in efficient working order and inspected at least once a year.', '{}'::text[]),
 ('MAR-ICC-A', 'Cover on the basis of the Institute Cargo Clauses (A) (all risks of loss of or damage to the subject-matter insured, subject to the exclusions of those clauses) for the voyage {voyage}.', '{voyage}'::text[]),
 ('MAR-ICC-B', 'Cover on the basis of the Institute Cargo Clauses (B) (named perils, including earthquake, volcanic eruption, lightning and washing overboard) for the voyage {voyage}.', '{voyage}'::text[]),
 ('MAR-ICC-C', 'Cover on the basis of the Institute Cargo Clauses (C) (major casualties only: fire, explosion, stranding, sinking, overturning, collision and jettison) for the voyage {voyage}.', '{voyage}'::text[]),
 ('ENG-CAR-MAINT', 'The cover is extended for a maintenance visits period of {maintenance_months} months after completion or taking over, for loss or damage caused by the contractor while carrying out maintenance obligations under the contract.', '{maintenance_months}'::text[]),
 ('GEN-CYBER-EXCL', 'This insurance does not cover loss, damage, liability, cost or expense caused by the use or operation of any computer, computer system, software, network or electronic data as a means of inflicting harm, nor the loss of or damage to electronic data itself, unless expressly insured by endorsement.', '{}'::text[]),
 ('GEN-PREM-WTY', 'Notwithstanding any other terms of this insurance, no cover attaches unless the premium is paid in full on or before the inception date, in line with the premium payment rules of the Insurance Code.', '{}'::text[]),
 ('GEN-SURVEY-SUBJ', 'Subject to a satisfactory risk survey of the premises by a surveyor acceptable to the insurers within {survey_days} days of inception; recommendations to be implemented within the time the survey gives.', '{survey_days}'::text[]),
 ('GEN-MORTGAGEE', 'Loss, if any, is payable to {mortgagee} as mortgagee or loss payee to the extent of its interest; the insurers give that party thirty (30) days notice before any cancellation.', '{mortgagee}'::text[])
) AS v(code, wording, placeholders) ON v.code = c.code
ON CONFLICT (clause_id, version) DO NOTHING;

INSERT INTO slip_templates(code, name, lines_of_business, description, sections, created_by, updated_by) VALUES
 ('PROPERTY-STD', 'Property (Fire / IAR) placement slip', '{FIRE,IAR}', 'Commercial property risk with natural catastrophe deductibles',
  $j$[{"key":"insured","heading":"Insured","text":"{insured_name}"},{"key":"period","heading":"Period of insurance","text":"From {period_from} to {period_to}, both days at 12:00 noon local time at the situation of the risk"},{"key":"situation","heading":"Situation / location of risk","text":"{situation}"},{"key":"interest","heading":"Interest insured","text":"Buildings, machinery and equipment, stocks and other contents of every description, the property of the insured or held in trust or on commission"},{"key":"sum_insured","heading":"Sum insured","text":"{currency} {sum_insured} as per the statement of values"},{"key":"deductibles","heading":"Deductibles","text":"As per the clauses below"},{"key":"premium","heading":"Premium","text":"{currency} {premium}"}]$j$, 'migration:0200', 'migration:0200'),
 ('MARINE-CARGO-STD', 'Marine cargo placement slip', '{MARINE}', 'Single transit or open cover for goods in transit',
  $j$[{"key":"insured","heading":"Insured","text":"{insured_name}"},{"key":"period","heading":"Period of insurance","text":"Transits commencing from {period_from} to {period_to}"},{"key":"interest","heading":"Interest insured","text":"Goods and merchandise as declared"},{"key":"sum_insured","heading":"Sum insured","text":"{currency} {sum_insured}"},{"key":"premium","heading":"Premium","text":"{currency} {premium}"}]$j$, 'migration:0200', 'migration:0200'),
 ('CAR-STD', 'Contractors all risks placement slip', '{ENGINEERING}', 'Construction project with maintenance period',
  $j$[{"key":"insured","heading":"Insured","text":"{insured_name} and contractors and sub-contractors for their respective rights and interests"},{"key":"period","heading":"Period of insurance","text":"Construction period from {period_from} to {period_to}, plus the maintenance period below"},{"key":"situation","heading":"Situation / location of risk","text":"{situation}"},{"key":"sum_insured","heading":"Sum insured","text":"{currency} {sum_insured} (contract value)"},{"key":"premium","heading":"Premium","text":"{currency} {premium}"}]$j$, 'migration:0200', 'migration:0200')
ON CONFLICT (code) DO NOTHING;

INSERT INTO slip_template_clauses(template_id, clause_id, position)
SELECT t.id, c.id, v.pos FROM (VALUES
 ('PROPERTY-STD', 'PH-TYF-DED', 1), ('PROPERTY-STD', 'PH-EQV-DED', 2), ('PROPERTY-STD', 'PH-72HR', 3), ('PROPERTY-STD', 'PH-SRCC', 4),
 ('PROPERTY-STD', 'PH-FEXT-WTY', 5), ('PROPERTY-STD', 'GEN-CYBER-EXCL', 6), ('PROPERTY-STD', 'GEN-PREM-WTY', 7), ('PROPERTY-STD', 'GEN-SURVEY-SUBJ', 8),
 ('MARINE-CARGO-STD', 'MAR-ICC-A', 1), ('MARINE-CARGO-STD', 'PH-SRCC', 2), ('MARINE-CARGO-STD', 'GEN-CYBER-EXCL', 3), ('MARINE-CARGO-STD', 'GEN-PREM-WTY', 4),
 ('CAR-STD', 'ENG-CAR-MAINT', 1), ('CAR-STD', 'PH-EQV-DED', 2), ('CAR-STD', 'PH-72HR', 3), ('CAR-STD', 'GEN-CYBER-EXCL', 4), ('CAR-STD', 'GEN-PREM-WTY', 5)
) AS v(tpl, clause, pos) JOIN slip_templates t ON t.code = v.tpl JOIN clause_library c ON c.code = v.clause
ON CONFLICT DO NOTHING;

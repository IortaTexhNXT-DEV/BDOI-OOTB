-- Claim journey masters: settlement types, causes of loss and the claim fields that apply to each line of business.
-- The claim screens read them from GET /claims/config instead of lists written into the screens.
INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('claims.settlement_types',
  '[{"value": "Cheque", "label": "Cheque to claimant (insurer direct)"}, {"value": "Bank Transfer", "label": "Bank transfer to claimant (insurer direct)"}, {"value": "Cash", "label": "Cash"}, {"value": "Through Broker", "label": "Paid through the broker", "paidThroughBroker": true}]',
  'claims', 'Settlement types offered on a claim settlement (paidThroughBroker: the insurer pays the broker, who pays the claimant)', 'json'),
 ('claims.loss_causes',
  '{"MOTOR": ["Collision", "Theft / carnapping", "Fire", "Flood / typhoon", "Third-party liability", "Glass / windshield damage", "Other"], "FIRE": ["Fire", "Flood", "Typhoon", "Earthquake", "Lightning", "Other"], "MARINE": ["Loss in transit", "Water damage", "Theft / pilferage", "General average", "Other"], "ACCIDENT": ["Accidental injury", "Accidental death", "Medical reimbursement", "Other"], "default": ["Accident", "Fire", "Natural catastrophe", "Theft", "Other"]}',
  'claims', 'Causes of loss offered when a claim is reported, per line of business ("default" for the other lines)', 'json'),
 ('claims.lob_fields',
  '{"MOTOR": ["driver", "vehicle"], "default": []}',
  'claims', 'Claim sections that apply per line of business: driver (driver name and address), vehicle (third-party plate number, unit, shop)', 'json')
ON CONFLICT (key) DO NOTHING;

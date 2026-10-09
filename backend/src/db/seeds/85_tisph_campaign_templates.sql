-- TISPH campaign e-mail templates (Operations > Sales & Marketing > Campaigns > Templates): the products TISPH offers,
-- Motor (renewal, new Toyota owners), Personal Accident and Credit Life. Runs on a new database and on every start of
-- one in use. Idempotent: a template is added only when its code is missing, so administrator changes are kept.
-- Placeholders: {{firstName}}, {{fullName}}, {{companyName}}, {{optOutLink}}.

INSERT INTO campaign_templates(code, name, subject, body_html, created_by, updated_by) VALUES
 ('MOTOR-RENEW', 'Motor renewal reminder', 'Your car insurance renews soon, {{firstName}}',
  '<p>Dear {{firstName}},</p><p>Your car insurance is due for renewal. Reply to this e-mail or call your account executive and we will prepare your renewal with the offers of our partner insurers, so your Toyota stays protected without a gap in cover.</p><p>Thank you for insuring with us.</p><p>{{companyName}}</p><p style="font-size:12px">To stop receiving offers by e-mail, <a href="{{optOutLink}}">unsubscribe here</a>.</p>',
  'system', 'system'),
 ('MOTOR-NEW-TOYOTA', 'Motor insurance for new Toyota owners', 'Insure your new Toyota from day one, {{firstName}}',
  '<p>Dear {{firstName}},</p><p>Congratulations on your new Toyota. Our comprehensive car insurance covers own damage and theft, acts of nature, and third party bodily injury and property damage, with CTPL for the LTO registration.</p><p>Reply to this e-mail or visit your Toyota dealer and our account executive will send you a quotation.</p><p>{{companyName}}</p><p style="font-size:12px">To stop receiving offers by e-mail, <a href="{{optOutLink}}">unsubscribe here</a>.</p>',
  'system', 'system'),
 ('PA-OFFER', 'Personal Accident offer', 'Personal accident protection for you and your family, {{firstName}}',
  '<p>Dear {{firstName}},</p><p>An accident can happen on the road or at home. Our Personal Accident cover pays a benefit for accidental death and disablement and reimburses medical expenses after an accident, for a small annual premium.</p><p>Reply to this e-mail and our account executive will explain the plans available to you.</p><p>{{companyName}}</p><p style="font-size:12px">To stop receiving offers by e-mail, <a href="{{optOutLink}}">unsubscribe here</a>.</p>',
  'system', 'system'),
 ('CREDIT-LIFE-INFO', 'Credit Life information', 'About the credit life cover of your car loan, {{firstName}}',
  '<p>Dear {{firstName}},</p><p>Credit Life insurance pays the outstanding balance of your car loan if the borrower dies or becomes totally and permanently disabled during the loan term, so your family keeps the car without the debt.</p><p>Reply to this e-mail if you would like to know how your loan is covered or how to add voluntary credit life cover.</p><p>{{companyName}}</p><p style="font-size:12px">To stop receiving offers by e-mail, <a href="{{optOutLink}}">unsubscribe here</a>.</p>',
  'system', 'system')
ON CONFLICT DO NOTHING;

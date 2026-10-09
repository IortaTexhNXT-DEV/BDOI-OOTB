-- Theme and Branding is withdrawn from the screens: the look of the application comes from the brand pack of the
-- deployment (BRAND_PACK), and the e-mail and document sections of the theme are edited on their own screens of
-- Master > System Configuration (E-mail Layout, Documents and Reports Layout; Document Signatures for the signature
-- mapping). The label of the theme setting says so. Idempotent.

UPDATE app_settings
   SET label = 'Theme of the screens, the sign-in page, the documents and the report files (the brand pack of the deployment; e-mail and documents sections edited in Master > System Configuration > E-mail Layout and Documents and Reports Layout; empty = iorta TechNXT default)',
       updated_at = now()
 WHERE key = 'branding.theme' AND label LIKE '%Theme and Branding%';

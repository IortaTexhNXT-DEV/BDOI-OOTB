-- Acknowledgement receipt of the post-dated cheques of a set (TIS-BRD-RPT-CCD-07): the note printed under it.
-- Idempotent.

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('documents.pdc_acknowledgement_note', '"Received the post-dated cheques below, subject to clearing. This is not an official receipt; a receipt is issued for each cheque once it is paid."',
  'documents', 'Acknowledgement receipt of post-dated cheques: note printed under it', 'string')
ON CONFLICT (key) DO NOTHING;

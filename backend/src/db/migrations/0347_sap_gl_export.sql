-- SAP GL text files (TIS-BRD-INTG-04 item 1, CR-12; FGA workbook sheet "Text File - SAP"): every day at the 11:59 PM
-- cut-off the GL entries posted since the previous cut-off are written as a header file and a line file for the SAP GL
-- upload, in the folder SAP picks them up from (Accounts > SAP GL Export; job sap-gl-export on Master > Schedules).
--
--   sap_gl_exports       one row per run of a day (run_no counts the runs of the same day: a re-generation is a new run
--                        and writes the day's files again); journals, lines, totals, warnings
--   sap_gl_export_files  the files of a run (header and line file) with their content, kept for audit and download
--
-- The record layout is a setting (sap_gl.layout: field list, sources or constants, widths, delimiter, file names), so
-- the open points of the sheet can be corrected without a release. The default follows the sheet's sample rows:
--   - the line file is named ARLITISPH<date> (the sheet gives the header name ARHDTISPH for both; the BRD names
--     ARHD / ARLI files)
--   - the sheet's "Requirements" list is one field out against its sample from WRBTR on; the sample is followed: WRBTR
--     amount, MWSKZ blank, SGTXT line text, KOSTL and PRCTR the cost centre (900901), XREF1 the cost centre
--   - XREF2 the journal number, XREF3 the source document number (the sample shows the APV / PV numbers there)
--   - SAKNR and HKONT both the GL account (the sample's vendor numbers in SAKNR on payable lines have no source here);
--     ZUONR the client code (customer) or insurer code (vendor) of the line
--   - one SAP document (DOCNO) per posting date in the file, BKTXT "<posting date> TISPH GL Bal #<document no>",
--     posting key 40 debit / 50 credit, amounts positive with 2 decimals, dates YYYY-MM-DD, tab separated with the field
--     names in the first row
-- Idempotent.

CREATE TABLE IF NOT EXISTS sap_gl_exports (
  id bigserial PRIMARY KEY,
  export_date date NOT NULL,                         -- the day whose cut-off closes the window
  run_no int NOT NULL,
  window_from timestamptz NOT NULL,                  -- posted after (previous day's cut-off)
  window_to timestamptz NOT NULL,                    -- posted at or before (this day's cut-off)
  trigger text NOT NULL DEFAULT 'schedule' CHECK (trigger IN ('schedule', 'manual')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'done', 'empty', 'failed')),
  folder text,
  journal_count int NOT NULL DEFAULT 0,
  line_count int NOT NULL DEFAULT 0,
  document_count int NOT NULL DEFAULT 0,
  total_debit numeric(16,2) NOT NULL DEFAULT 0,
  total_credit numeric(16,2) NOT NULL DEFAULT 0,
  warnings jsonb NOT NULL DEFAULT '[]',
  error text,
  created_by text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  UNIQUE (export_date, run_no));

CREATE TABLE IF NOT EXISTS sap_gl_export_files (
  id bigserial PRIMARY KEY,
  export_id bigint NOT NULL REFERENCES sap_gl_exports(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('header', 'line')),
  file_name text NOT NULL,
  records int NOT NULL DEFAULT 0,
  bytes int NOT NULL DEFAULT 0,
  sha256 text,
  content text NOT NULL,
  UNIQUE (export_id, kind));

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('sap_gl.folder', '"sap-outbound"', 'integrations', 'Folder of the SAP GL text files in the storage area (UPLOAD_DIR); the SAP_GL_EXPORT_DIR environment variable puts them in a folder outside it (deploy/AZURE.md)', 'string'),
 ('sap_gl.cut_off', '"23:59"', 'integrations', 'Daily cut-off (HH:MM, business time zone) of the SAP GL file: a day''s file has the entries posted after the previous day''s cut-off up to this one (the job sap-gl-export runs at it)', 'string'),
 ('sap_gl.account_pattern', '"^[0-9]{6}$"', 'integrations', 'GL account codes SAP accepts (regular expression); lines on other accounts are written and listed as warnings', 'string'),
 ('sap_gl.layout', $j${
  "format": "delimited", "delimiter": "\t", "lineEnding": "CRLF", "fieldNames": true, "encoding": "utf8",
  "dateFormat": "YYYY-MM-DD", "amountDecimals": 2, "debitKey": "40", "creditKey": "50",
  "header": {
    "fileName": "ARHDTISPH{date:YYYYMMDD}.txt",
    "text": "{postingDate:MMM DD YYYY} TISPH GL Bal #{docNo:00}",
    "fields": [
      {"name": "DOCNO", "source": "docNo"}, {"name": "BLART", "value": "ZI"}, {"name": "BELNR", "value": ""}, {"name": "BUKRS", "value": "4F29"},
      {"name": "BLDAT", "source": "documentDate"}, {"name": "BUDAT", "source": "postingDate"}, {"name": "XBLNR", "value": "UPLOAD_GL"},
      {"name": "BKTXT", "source": "headerText"}, {"name": "WAERS", "source": "currency"}
    ]
  },
  "line": {
    "fileName": "ARLITISPH{date:YYYYMMDD}.txt",
    "fields": [
      {"name": "DOCNO", "source": "docNo"}, {"name": "BSCHL", "source": "postingKey"}, {"name": "SAKNR", "source": "glCode"}, {"name": "HKONT", "source": "glCode"},
      {"name": "UMSKZ", "value": ""}, {"name": "WRBTR", "source": "amount"}, {"name": "MWSKZ", "value": ""}, {"name": "SGTXT", "source": "text"},
      {"name": "KOSTL", "source": "costCentre"}, {"name": "PRCTR", "source": "costCentre"}, {"name": "POSID", "value": ""}, {"name": "NPLNR", "value": ""},
      {"name": "VORNR", "value": ""}, {"name": "ZTERM", "value": ""}, {"name": "VALUT", "source": "valueDate"}, {"name": "ZFBDT", "value": ""},
      {"name": "ZUONR", "source": "assignment"}, {"name": "EBLN", "value": ""}, {"name": "VBELN", "value": ""}, {"name": "POSN2", "value": ""},
      {"name": "XREF1", "source": "costCentre"}, {"name": "XREF2", "source": "journalNumber"}, {"name": "XREF3", "source": "sourceDocument"}
    ]
  }
}$j$::jsonb, 'integrations', 'Record layout of the SAP GL header and line files: format (delimited or fixed), delimiter, field names row, date format, posting keys, file names and the fields of each record (source or constant value, optional width / align / maxLength); see modules/sap-gl/README.md', 'json')
ON CONFLICT (key) DO NOTHING;

INSERT INTO scheduled_jobs(code, name, description, cron, handler, params, enabled) VALUES
 ('sap-gl-export', 'SAP GL text files', 'Write the SAP GL header and line files of the entries posted since the previous cut-off to the folder sap_gl.folder (TIS-BRD-INTG-04); runs at the sap_gl.cut_off time', '59 23 * * *', 'sapGlExport', '{}', true)
ON CONFLICT (code) DO NOTHING;

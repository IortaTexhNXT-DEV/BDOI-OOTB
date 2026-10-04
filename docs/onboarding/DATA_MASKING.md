# Client data masking for non-production copies

A copy of a broker's production database holds the personal data of every client, prospect, driver, claimant, referrer
and staff member. Whenever such a copy is used **outside production** (an SIT or UAT refresh, the Pre-Prod environment
of a large broker, a training environment, the reproduction of a support case), its personal data must be masked first.
This page explains why, when and how, using the masking command `npm run mask:data`
(`backend/scripts/mask-data.js`).

## 1. Purpose and legal basis

- **Data Privacy Act of 2012 (Republic Act No. 10173) and its Implementing Rules and Regulations.** Personal
  information may be processed only for the declared and legitimate purpose it was collected for (principles of
  transparency, legitimate purpose and proportionality, section 11 of the Act). Testing, training and troubleshooting
  are not the purpose for which a client gave the broker their data, and they do not need real identities.
- **Security of personal information (section 20 of the Act; rules on organisational, physical and technical security
  measures).** The broker, as personal information controller, and iorta TechNXT, as its personal information processor,
  must protect personal data against unauthorised access. Non-production environments have wider access (testers,
  developers, trainers, support staff) and weaker controls than production; real personal data must not be there.
- **NPC guidance on the security of personal data** (NPC Circular No. 2023-06, which replaced Circular No. 16-01) asks
  controllers and processors to limit access to personal data to what each purpose needs and to apply technical measures
  such as pseudonymisation and anonymisation. Test, training and support environments have no need for real identities,
  so production data is pseudonymised before it is used there. The broker's DPO confirms the circulars and advisories
  in force when approving the refresh procedure.
- **Pseudonymisation.** The tool replaces identifying values with consistent pseudonyms derived with a secret key that is
  never stored. Without the key the masked copy cannot be linked back to the real persons; with masking, the copy keeps
  the structure, volumes and figures that testing needs.

## 2. When to use it (environment refresh rules)

| Broker size | Environments |
|---|---|
| Small and medium brokers | Dev and UAT |
| Large brokers | Dev, SIT and UAT, plus Pre-Prod when needed |

Rules:

1. **Production data goes to a non-production environment only after masking.** This applies to every refresh of SIT,
   UAT or training from production, and to any copy taken for support or performance analysis.
2. **Pre-Prod** is a temporary environment restored from a production backup for the go-live rehearsal and for major
   releases. Unmasked, it is **treated as production for access**: only the people allowed in production, production
   security settings, no test accounts, destroyed after use. If it is opened to testers or vendors, mask it first like
   any other copy.
3. **Dev** never receives production data, masked or not, unless a support case needs it; then it is masked and deleted
   after the case is closed.
4. **Training** uses masked data (or the sample data of the seed), never production data.
5. A masked copy is never copied back to production, and production backups are never restored over a masked copy
   without masking it again.

## 3. Who may run it

- The **DevOps engineer or DBA** of the environment owner runs the command, on the copy only.
- The broker's **Data Protection Officer (DPO)**, or the person the DPO designates, **approves each refresh** and signs
  off the evidence (section 6).
- The person who runs it must have access to production backups (they already handle the unmasked data) and must not
  keep any unmasked copy after the refresh.

## 4. Refresh procedure

1. **Backup.** Take a production backup (`pg_dump -Fc`) with the normal backup procedure. Note its time.
2. **Restore to the copy.** Restore it into the target database (a new, empty database on the non-production server;
   never into production). Keep the API of the target **stopped**. A restored database carries the production marker
   and the tool refuses to run until the copy is re-marked. There are two ways:
   - **Automatic (recommended): `--remark-copy`** in steps 3 and 4. The tool re-marks the copy and masks it in the same
     transaction, so a dry run, a refusal or a failed masking leaves the copy marked production. It needs the name of
     the copy typed again (`--confirm-database=<name>`, checked against `current_database()`) and the backup it was
     restored from (`--restore-source=<file or snapshot>`). It refuses on production itself: production is registered
     once after go-live (below), the copy carries that record, and the tool refuses when the server, port, database and
     cluster of the connection are the registered ones. The re-mark is kept in `system.restored_from` (from, to,
     copy, restore source, production server, who and when) and in the audit trail (entity `database`, action
     `remark`).
   - **By hand (the DBA):**
     ```sql
     -- connected to the COPY (check: SELECT current_database();)
     UPDATE app_settings SET value = '"uat"' WHERE key = 'system.environment';
     ```
   Restore the client file storage of the copy only if the testers need files; otherwise start it empty.

   **Register production once** (System Administrator or DBA, in Production, after the marker is set to `production`
   at go-live): `npm run mask:data -- --register-production`. It records server, port, database and cluster identifier
   in `system.production_identity` (audit action `register-production`). Without it `--remark-copy` refuses
   (`NO_PRODUCTION_IDENTITY`) and the copy is re-marked by hand.
3. **Dry run.** Check what will change:
   ```bash
   cd backend
   export DATABASE_URL=postgres://...copy...
   export MASK_SALT="$(openssl rand -base64 32)"        # a new secret per refresh; never stored, never reused
   CONFIRM_MASK=yes npm run mask:data -- --environment=uat \
       --remark-copy --confirm-database=bv_uat --restore-source=prod-2026-10-01.dump   # only for a copy still marked production
   ```
   It prints, per table and column, the number of values that would change, the tables that would be emptied and what
   happens to the users.
4. **Mask.**
   ```bash
   export MASK_ADMIN_PASSWORD='...'                      # the administrator who keeps sign-in
   export MASK_STAFF_PASSWORD='...'                      # optional: shared password for the other users
   CONFIRM_MASK=yes npm run mask:data -- --environment=uat --execute \
       --admin=BrokerVerse --storage=/srv/brokerverse-uat/uploads [--purge-files] [--mask-staff] [--mask-locality] \
       [--remark-copy --confirm-database=bv_uat --restore-source=prod-2026-10-01.dump]
   unset MASK_SALT MASK_ADMIN_PASSWORD MASK_STAFF_PASSWORD
   ```
   Everything in the database is done in one transaction: on any error nothing is changed.
5. **Verify.** The run ends with a verification of the whole database (exit code 4 if anything is left). It can be run
   again at any time:
   ```bash
   npm run mask:data -- --verify-only
   ```
   It must print `Verification: no e-mail address, mobile number or TIN left unmasked.` Staff e-mail addresses kept on
   purpose (no `--mask-staff`) are listed as `kept`. Also spot-check a few clients, policies and claims on screen.
6. **Hand over.** Start the API of the copy and give the testers the URL and their sign-in (section 5, users). Delete the
   restored backup file from the non-production server.

Options:

| Option | Effect |
|---|---|
| `--environment=dev\|sit\|uat\|preprod\|training` | Required: the target. Stored in `system.environment`; `production` is refused |
| `--execute` | Mask (default: dry run) |
| `--admin=<username>` | The administrator who keeps sign-in, with `MASK_ADMIN_PASSWORD` (default `BrokerVerse`) |
| `MASK_STAFF_PASSWORD` (environment) | The other users keep their status and get this password, to change at first sign-in. Without it their sign-in is disabled (status inactive) |
| `--mask-staff` | Also mask the names and e-mail addresses of staff (users, employee and signatory records, report recipients). Without it they are kept, since testers need to recognise the approvers and owners of records |
| `--mask-locality` | Also replace city, province and postal code (kept by default: needed for LGU taxes, branches and statistics) |
| `--storage=<folder>` | The upload folder **of the copy**: the client files there are replaced by a placeholder (a one-page PDF or a blank image) saved under the masked storage key |
| `--purge-files` | With `--storage`: delete the client files instead |
| `--verify-only` | Only scan for personal data left |
| `--remark-copy` | Re-mark a copy still marked production as the `--environment` target, in the masking transaction. Needs `--confirm-database` and `--restore-source`; refuses on the registered production |
| `--confirm-database=<name>` | The name of the copy, typed again; must equal `current_database()` |
| `--restore-source=<backup>` | The backup file or snapshot the copy was restored from (recorded) |
| `--register-production` | Run once in Production: records where production lives, so a copy can be told from it |

Safety guards:

- refuses unless `CONFIRM_MASK=yes`;
- refuses without `MASK_SALT` (16 characters or more), and on `--execute` without `MASK_ADMIN_PASSWORD` (which must meet
  the password policy of the database) or with an unknown `--admin`;
- refuses on a database marked production: `system.environment = production`, an unknown value, or no marker while the
  go-live lock (`golive.locked`) is on, unless `--remark-copy` re-marks it after its own checks (typed database name,
  restore source, connection not the registered production);
- dry run by default; one transaction; the run is recorded in the audit trail (entity `database`, action `mask`: target,
  previous environment, options, counts per column; never the salt).

The marker `system.environment` (migration 0249) is `production` on a database whose go-live lock is already on and
`dev` otherwise. **At go-live the System Administrator sets it to `production` in Production** (Master > Configuration,
group System), so that a restored copy always arrives marked production and must be re-marked consciously (step 2).

## 5. What is masked

The personal data catalogue is `backend/scripts/lib/pii-catalogue.js`. It starts from the personal data classification
of the data dictionary (`docs/package/07_Technical/BrokerVerse_Data_Dictionary.xlsx`, column "Personal data (RA
10173)", generated from `docs/package/tools/data-dictionary/pii.py`) and the migrations. A test
(`backend/test/mask-data.test.js`) fails when a column that the data dictionary classifies as personal, or whose name
looks personal (names, e-mail, phone, mobile, address, TIN, birth date, ID, passport and licence numbers, bank
accounts, plate, chassis and engine numbers, remarks, notes, credentials), is neither catalogued nor kept on purpose
with a reason (`ALLOW_LIST`). A new migration with such a column must classify it.

Every masked value is derived from the original with HMAC-SHA256 keyed by `MASK_SALT`: **the same original always
gives the same masked value**, in every table, column and JSON document. Joins, duplicate checks (a prospect and the
client it became), searches by name, e-mail or phone, and references copied into descriptions keep working.

| Data | Rule | Example |
|---|---|---|
| Person names (clients, prospects, drivers, third parties, payees, referrers, insured names) | Word by word from built-in Filipino first and last name lists; particles (de, dela, del, delos, jr) kept | `Juan Dela Cruz` -> `Arnel Dela Villareal` |
| Company names (corporate clients) | Fake name from a Filipino word list, legal form kept | `Zentrovia Trading Corp.` -> `Mabuhay Tanglaw Trading Corp.` |
| Insurers, reinsurers, banks, the broker's own companies and branches | Kept (institutions, not personal data) | |
| E-mail addresses | `user<12 hex>@example.test` (reserved test domain) | `juan@mail.ph` -> `user3f9a0c41d2b7@example.test` |
| Mobile numbers | `+63 900 ...` / `0900 ...`, format kept (network code 900 marks a masked number) | `0917 123 4567` -> `0900 482 1937` |
| Other phone numbers | First digits kept, the rest replaced, format kept | |
| TIN | `999-###-###-000` | `123-456-789-000` -> `999-210-448-000` |
| Street lines, house numbers, barangays | Fake street (`12 Mabini St.`), fake number, fake barangay | |
| One-line addresses | Fake street; the trailing city / province part kept | `77 Lacson St., Bacolod` -> `311 Rizal Ave., Bacolod` |
| City, province, postal code, country | Kept (`--mask-locality` replaces city, province and postal code) | |
| Dates of birth | Moved to another day that gives the **same age on the masking date**: age bands, age-based rating and minimum-age checks behave as before | |
| ID, passport, licence, MV file numbers; vehicle plate, chassis and engine numbers | Format-preserving: letters stay letters, digits stay digits, separators kept | `ZXA 9123` -> `QJF 4471` |
| Bank account numbers | Format-preserving, last 4 characters kept | `0012-3456-78` -> `7342-1156-78` |
| Remarks, notes, comments, claim descriptions, consent evidence, data subject request texts | `[masked]` (empty stays empty) | |
| Narrations and texts that repeat names (journal descriptions, bank statement lines, notifications, disbursement descriptions) | Kept readable, every known client name, e-mail, mobile number and TIN inside replaced by its pseudonym | `Premium of Juan Dela Cruz` -> `Premium of Arnel Dela Villareal` |
| JSON documents (policy and quotation documents, claim driver and third party, endorsement changes, client and lead extra fields, audit trail before/after, data load rows, job payloads, remittance data, payment events) | Walked recursively; each key by its name (`firstName`, `insuredName`, `emailId`, `contactNumber`, `plateNumber`, `chassisNumber`, `licenseNumber`, `dateOfBirth`, `locationAddress`, `accountNumber`, `remarks`...), every other string swept as above | |
| Uploaded file names; storage keys of client files | `masked-<hash>.<ext>`; the file part of the key renamed the same way everywhere the key is referred to | |
| Audit trail IP addresses | `192.0.2.x` (documentation range) | |
| Two-factor secrets, quotation approval tokens, payment link tokens and checkout URLs, signature images of signatories | Cleared | |
| Every other text column | Swept: e-mail addresses, mobile numbers, TINs and storage keys replaced; in transaction and system tables known client names too | |

Users (staff): usernames and roles are kept so testers can work with the roles of production. Every password is reset:
the administrator named by `--admin` gets `MASK_ADMIN_PASSWORD`; the others get `MASK_STAFF_PASSWORD` (changed at first
sign-in) or, without it, their sign-in is disabled. Two-factor secrets are cleared and every existing session ends.
Phone, date of birth and address of staff are always masked; names and e-mail addresses with `--mask-staff`.

Emptied: the e-mail outbox (messages to real clients), sign-in sessions, sign-in history, password reset codes and the
password history. E-mail sending is switched off (`notification.email_enabled = false`), so the copy never e-mails a
client even if SMTP is configured; switch it on only with an SMTP server that delivers to a test mailbox.

Not changed: amounts, premiums, balances, rates, dates other than birth dates, document numbers, codes, statuses and the
whole ledger: the trial balance of the masked copy is the trial balance of production on the backup date.

## 6. Evidence to keep

For each refresh, the environment owner keeps, in the change record approved by the DPO:

- the request and approval (who asked, why, target environment, DPO approval);
- the backup used (date and time) and the target database;
- the console output of the dry run and of the masking run, including the verification result, and the output of
  `--verify-only` after the hand-over;
- the audit trail entry of the run (Master > Audit Trail, entity `database`, action `mask`), and the values of
  `system.environment` and `system.masked_at` of the copy;
- confirmation that the restored backup file was deleted from the non-production server and that the salt was not
  stored;
- the date the copy is destroyed (Pre-Prod and support copies).

Keep the evidence for the retention period of the broker's privacy management programme (at least as long as the copy
exists, plus one year).

## 7. Limits

- **Free text is masked by pattern and by known names.** Remarks and notes are replaced completely, but other text
  (descriptions, narrations, reasons) is kept readable: a person's name that appears there but in no catalogued name
  column (for example a relative mentioned only in a description) is not recognised. Common words that are also names
  (May, Grace, Joy...) are not replaced in free text.
- **Pseudonyms may coincide.** Names come from lists of about 120 first and 120 last names, so two different clients can
  get the same masked name; e-mail addresses, mobile numbers, TINs and company names are kept distinct. A replaced
  word can appear in unrelated text of transaction tables (a branch named after a client's surname).
- **Gender, city, province and postal code are kept** (by default), and so are amounts, dates and policy details:
  combined, rare values (a single client in a small municipality with an unusual vehicle) can still single out a
  person. Restrict access to copies accordingly; use `--mask-locality` for wide audiences such as training.
- **Files are masked only when `--storage` is given.** Without it, the copy's upload folder still holds the real
  documents (IDs, photos, proofs of payment, printed policies). Generated report files of the copy are client data too
  and are in the client folders. Logos and product documents are kept.
- **JSON numbers are rewritten through JavaScript** when a document changes: values beyond 15 significant digits would
  lose precision (none are used for money in BrokerVerse).
- **Backups and logs** of the copy taken before masking, the restored dump file and the database server's own logs are
  outside the tool: delete them.
- **Payment gateway and SMTP credentials** are configuration, not personal data: they are not changed. Configure the
  copy with sandbox credentials before starting it.
- The salt is never stored: a later run with another salt gives different pseudonyms; masked copies taken at different
  times cannot be joined to each other by masked value (by design).

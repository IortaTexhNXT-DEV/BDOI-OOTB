-- Non-packaged (bespoke) placements, part 3: the underwriter collaboration room of a Request for Quotation or
-- placement. Selected insurers see the slip, the structured statement of values (SOV: locations and values parsed from
-- an XLSX / CSV) and the loss-run attachments; their bids are tracked in rounds (requested, quoted, countered,
-- accepted, declined, withdrawn) with broker counter-offers, a message thread and one audit timeline. An underwriter
-- can also answer through a signed link without signing in. The accepted bids feed the quotation or placement slip.

CREATE TABLE IF NOT EXISTS uw_rooms (
  id text PRIMARY KEY DEFAULT ('uwr_' || encode(gen_random_bytes(8), 'hex')),
  room_number text UNIQUE,
  title text NOT NULL,
  broker_slip_id text REFERENCES broker_slips(id),
  placement_id text REFERENCES placements(id),
  composed_slip_id text REFERENCES composed_slips(id),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'awarded', 'closed')),
  current_round int NOT NULL DEFAULT 1,
  currency text NOT NULL DEFAULT 'PHP',
  response_due_date date,
  close_reason text,
  quote_id text REFERENCES quotes(id),               -- quotation slip prepared from the award
  award_placement_id text REFERENCES placements(id), -- placement slip prepared from the award
  owner_user_id text REFERENCES users(id),
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS uw_rooms_broker_slip ON uw_rooms(broker_slip_id);
CREATE INDEX IF NOT EXISTS uw_rooms_placement ON uw_rooms(placement_id);

CREATE TABLE IF NOT EXISTS uw_room_insurers (
  id bigserial PRIMARY KEY,
  room_id text NOT NULL REFERENCES uw_rooms(id) ON DELETE CASCADE,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'removed')),
  contact_email text,
  token_hash text,                                   -- sha256 of the latest external link token (earlier links stop working)
  token_expires_at timestamptz,
  last_viewed_at timestamptz,
  invited_by text, invited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, insurance_company_id));
CREATE INDEX IF NOT EXISTS uw_room_insurers_insurer ON uw_room_insurers(insurance_company_id);

CREATE TABLE IF NOT EXISTS uw_sov (
  id bigserial PRIMARY KEY,
  room_id text NOT NULL REFERENCES uw_rooms(id) ON DELETE CASCADE,
  version int NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  file_key text, file_name text,
  location_count int NOT NULL DEFAULT 0,
  totals jsonb NOT NULL DEFAULT '{}',                -- { building, contents, stocks, machinery, businessInterruption, other, total }
  warnings jsonb NOT NULL DEFAULT '[]',
  uploaded_by text, uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, version));

CREATE TABLE IF NOT EXISTS uw_sov_locations (
  id bigserial PRIMARY KEY,
  sov_id bigint NOT NULL REFERENCES uw_sov(id) ON DELETE CASCADE,
  line_no int NOT NULL,
  location_name text, address text, city text, province text, occupancy text, construction text, year_built int,
  building numeric(16,2) NOT NULL DEFAULT 0,
  contents numeric(16,2) NOT NULL DEFAULT 0,
  stocks numeric(16,2) NOT NULL DEFAULT 0,
  machinery numeric(16,2) NOT NULL DEFAULT 0,
  business_interruption numeric(16,2) NOT NULL DEFAULT 0,
  other numeric(16,2) NOT NULL DEFAULT 0,
  total_value numeric(16,2) NOT NULL DEFAULT 0,
  extra jsonb NOT NULL DEFAULT '{}');
CREATE INDEX IF NOT EXISTS uw_sov_locations_sov ON uw_sov_locations(sov_id, line_no);

CREATE TABLE IF NOT EXISTS uw_attachments (
  id bigserial PRIMARY KEY,
  room_id text NOT NULL REFERENCES uw_rooms(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('loss_run', 'sov', 'survey', 'slip', 'message', 'other')),
  file_key text NOT NULL, file_name text NOT NULL,
  description text,
  shared boolean NOT NULL DEFAULT true,              -- visible to the invited underwriters
  insurance_company_id int REFERENCES insurance_companies(id),   -- uploaded by / for one underwriter (external link)
  uploaded_by text, uploaded_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS uw_bids (
  id text PRIMARY KEY DEFAULT ('bid_' || encode(gen_random_bytes(8), 'hex')),
  bid_number text UNIQUE,
  room_id text NOT NULL REFERENCES uw_rooms(id) ON DELETE CASCADE,
  insurance_company_id int NOT NULL REFERENCES insurance_companies(id),
  round int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'quoted', 'countered', 'accepted', 'declined', 'withdrawn')),
  premium numeric(14,2),                             -- quoted net premium for 100% of the risk
  rate numeric(10,6),                                -- % of the sum insured
  capacity_percent numeric(7,4),                     -- line the underwriter writes
  capacity_amount numeric(16,2),
  deductibles text,
  deviations jsonb NOT NULL DEFAULT '[]',            -- [{ clause, requested, offered }] terms that differ from the slip
  validity_date date,
  remarks text,
  counter_premium numeric(14,2),                     -- broker counter-offer this round answers
  counter_rate numeric(10,6),
  counter_capacity_percent numeric(7,4),
  counter_terms text,
  parent_bid_id text REFERENCES uw_bids(id),
  accepted_share numeric(7,4),                       -- share given to this bid when accepted
  decline_reason text,
  submitted_via text NOT NULL DEFAULT 'broker' CHECK (submitted_via IN ('broker', 'link')),
  requested_at timestamptz, responded_at timestamptz,
  created_by text, created_at timestamptz NOT NULL DEFAULT now(),
  updated_by text, updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS uw_bids_room ON uw_bids(room_id, insurance_company_id, round);

CREATE TABLE IF NOT EXISTS uw_messages (
  id bigserial PRIMARY KEY,
  room_id text NOT NULL REFERENCES uw_rooms(id) ON DELETE CASCADE,
  insurance_company_id int REFERENCES insurance_companies(id),   -- the underwriter the thread is with; null = every invited underwriter
  author_type text NOT NULL CHECK (author_type IN ('broker', 'underwriter')),
  author_user_id text REFERENCES users(id),
  author_name text,
  body text NOT NULL,
  attachment_ids bigint[] NOT NULL DEFAULT '{}',
  internal boolean NOT NULL DEFAULT false,           -- broker note not shown to underwriters
  created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS uw_messages_room ON uw_messages(room_id, created_at);

CREATE TABLE IF NOT EXISTS uw_events (
  id bigserial PRIMARY KEY,
  room_id text NOT NULL REFERENCES uw_rooms(id) ON DELETE CASCADE,
  at timestamptz NOT NULL DEFAULT now(),
  actor_type text NOT NULL DEFAULT 'broker' CHECK (actor_type IN ('broker', 'underwriter', 'system')),
  actor text,
  event text NOT NULL,
  insurance_company_id int REFERENCES insurance_companies(id),
  detail jsonb NOT NULL DEFAULT '{}');
CREATE INDEX IF NOT EXISTS uw_events_room ON uw_events(room_id, at);

INSERT INTO document_numbering(code, name, module, prefix, description, created_by) VALUES
 ('uw_room', 'Underwriter Room', 'placement', 'UWR', 'Underwriter collaboration room of a bespoke placement', 'migration:0202'),
 ('uw_bid', 'Underwriter Bid', 'placement', 'BID', 'Bid (quote or counter-offer round) in an underwriter room', 'migration:0202')
ON CONFLICT (code) DO NOTHING;

INSERT INTO app_settings(key, value, "group", label, type) VALUES
 ('bespoke.underwriter_link_ttl_hours', '336', 'bespoke', 'Hours an underwriter response link stays valid (a new link replaces the earlier one)', 'number'),
 ('bespoke.sov_columns', $j${"locationName":["location","location name","site","property"],"address":["address","street","situation"],"city":["city","municipality","city / municipality"],"province":["province","region"],"occupancy":["occupancy","use"],"construction":["construction","construction class"],"yearBuilt":["year built","year","yearbuilt"],"building":["building","buildings","building value"],"contents":["contents","furniture","fixtures"],"stocks":["stocks","stock","inventory"],"machinery":["machinery","equipment","machinery and equipment"],"businessInterruption":["business interruption","bi","gross profit"],"other":["other","others"],"totalValue":["total","total value","total sum insured","tsi"]}$j$, 'bespoke', 'Statement of values upload: accepted column headings per field (case-insensitive)', 'json'),
 ('bespoke.bid_validity_days', '30', 'bespoke', 'Default validity (days) of an underwriter bid that gives none', 'number'),
 ('email.template.underwriter_room_invite', $j${"subject":"Invitation to quote {{roomNumber}} - {{insuredName}}","html":"<p>Dear {{insurerName}} underwriting team,</p><p>We invite you to review the slip and the statement of values of the risk below and to submit your terms.</p><p>Room <b>{{roomNumber}}</b><br/>Insured: {{insuredName}}<br/>Sum insured: {{currency}} {{sumInsured}}<br/>Response due: {{responseDueDate}}</p><p>Open the room: <a href=\"{{link}}\">{{link}}</a> (valid until {{expiresAt}})</p><p>{{companyName}}</p>"}$j$, 'email', 'E-mail: invitation to an underwriter room with the response link', 'json')
ON CONFLICT (key) DO NOTHING;

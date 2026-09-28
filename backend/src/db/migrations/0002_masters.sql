-- Reference data maintained under Master
CREATE TABLE countries (id serial PRIMARY KEY, code text UNIQUE NOT NULL, name text NOT NULL, status text NOT NULL DEFAULT 'active');
CREATE TABLE states (id serial PRIMARY KEY, country_id int NOT NULL REFERENCES countries(id), code text, name text NOT NULL, status text NOT NULL DEFAULT 'active');
CREATE TABLE cities (id serial PRIMARY KEY, state_id int NOT NULL REFERENCES states(id), name text NOT NULL, status text NOT NULL DEFAULT 'active');
CREATE TABLE currencies (id serial PRIMARY KEY, code text UNIQUE NOT NULL, name text NOT NULL, symbol text, decimals int NOT NULL DEFAULT 2, is_base boolean NOT NULL DEFAULT false, exchange_rate numeric(18,6) NOT NULL DEFAULT 1, status text NOT NULL DEFAULT 'active');
CREATE TABLE banks (id serial PRIMARY KEY, code text UNIQUE, name text NOT NULL, swift_code text, status text NOT NULL DEFAULT 'active');
CREATE TABLE insurance_companies (
  id serial PRIMARY KEY, code text UNIQUE, name text NOT NULL, short_name text, tin text,
  address text, contact_person text, contact_email text, contact_phone text,
  commission_rate numeric(6,4), status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE products (
  id serial PRIMARY KEY, code text UNIQUE, name text NOT NULL, line text NOT NULL,  -- motor | fire | marine | casualty | accident | eb
  description text, status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE policy_types (id serial PRIMARY KEY, product_id int REFERENCES products(id), code text, name text NOT NULL, status text NOT NULL DEFAULT 'active');
CREATE TABLE vehicle_brands (id serial PRIMARY KEY, name text UNIQUE NOT NULL, status text NOT NULL DEFAULT 'active');
CREATE TABLE vehicle_models (id serial PRIMARY KEY, brand_id int NOT NULL REFERENCES vehicle_brands(id), name text NOT NULL, status text NOT NULL DEFAULT 'active');
CREATE TABLE vehicle_variants (id serial PRIMARY KEY, model_id int NOT NULL REFERENCES vehicle_models(id), name text NOT NULL, body_type text, seating int, status text NOT NULL DEFAULT 'active');
CREATE TABLE coverages (
  id serial PRIMARY KEY, kind text NOT NULL,                 -- bi | pd | pa
  policy_type_id int REFERENCES policy_types(id),
  label text NOT NULL, amount numeric(14,2) NOT NULL, premium numeric(14,2) NOT NULL, status text NOT NULL DEFAULT 'active');
CREATE TABLE signatories (id serial PRIMARY KEY, name text NOT NULL, designation text, signature_key text, status text NOT NULL DEFAULT 'active');
CREATE TABLE branches (id serial PRIMARY KEY, code text UNIQUE, name text NOT NULL, address text, status text NOT NULL DEFAULT 'active');

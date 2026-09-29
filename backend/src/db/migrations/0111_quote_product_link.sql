-- Quotations were saved without a product (only the line of business and product type), so product reports and the
-- line-of-business PDF templates could not find them. Link a quotation to the product whose code is its line of
-- business (MOTOR, FIRE ...) or product type whenever it is saved without one, and backfill the existing ones.
-- Industrial All Risks is set up in the Product Configurator but was missing from the product master.
INSERT INTO products(code, name, line, description) VALUES ('IAR', 'Industrial All Risks', 'fire', 'Industrial all risks (property)')
  ON CONFLICT (code) DO NOTHING;

CREATE OR REPLACE FUNCTION quotes_link_product() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.product_id IS NULL AND (NEW.lob IS NOT NULL OR NEW.product_type IS NOT NULL) THEN
    NEW.product_id := (SELECT p.id FROM products p WHERE upper(p.code) IN (upper(NEW.lob), upper(NEW.product_type)) ORDER BY p.id LIMIT 1);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER quotes_link_product BEFORE INSERT OR UPDATE OF lob, product_type, product_id ON quotes
  FOR EACH ROW EXECUTE FUNCTION quotes_link_product();

UPDATE quotes q SET product_id = pr.id
FROM products pr
WHERE q.product_id IS NULL
  AND pr.id = (SELECT x.id FROM products x WHERE upper(x.code) IN (upper(q.lob), upper(q.product_type)) ORDER BY x.id LIMIT 1);

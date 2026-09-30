-- A quotation saved without a product was linked to the product whose code is its line of business before its own
-- product type was considered: a Householder quotation (line fire, a package product) became a Fire and Allied Perils
-- quotation (non-package), so the placement journey asked for a Placement Slip and product reports showed Fire; a CTPL
-- quotation became Motor. The product type (code or name) now wins over the line; the line is the fallback.
CREATE OR REPLACE FUNCTION quotes_link_product() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.product_id IS NULL AND (NEW.lob IS NOT NULL OR NEW.product_type IS NOT NULL) THEN
    NEW.product_id := (SELECT p.id FROM products p
      WHERE upper(p.code) IN (upper(NEW.lob), upper(NEW.product_type)) OR lower(p.name) = lower(NEW.product_type)
      ORDER BY (upper(p.code) = upper(NEW.product_type) OR lower(p.name) = lower(NEW.product_type)) DESC NULLS LAST, p.id LIMIT 1);
  END IF;
  RETURN NEW;
END $$;

-- Quotations prepared from a broker slip take the slip's product, and so do the policies issued from them.
UPDATE quotes q SET product_id = b.product_id
FROM broker_slips b
WHERE b.id = q.broker_slip_id AND b.product_id IS NOT NULL AND q.product_id IS DISTINCT FROM b.product_id;
UPDATE policies p SET product_id = q.product_id
FROM quotes q
WHERE q.id = p.quote_id AND q.broker_slip_id IS NOT NULL AND q.product_id IS NOT NULL AND p.product_id IS DISTINCT FROM q.product_id;

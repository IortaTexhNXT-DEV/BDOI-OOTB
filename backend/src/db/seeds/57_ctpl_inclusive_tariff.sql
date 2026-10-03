-- CTPL tariff confirmed by the business (29 Sep 2026): annual amounts per vehicle class inclusive of taxes and the
-- authentication fee, and the 3-year upfront amount for brand-new private cars (LTO 3-year registration). Applied once
-- per motor template (marker ctplBasis); editable afterwards in the Product Configurator.
UPDATE product_templates
SET config = config || $j${
  "ctplBasis": "inclusive",
  "ctplSetting": {
    "motorcycles_tricycles": "300.40", "private_cars": "610.40", "light_medium_trucks": "660.40", "ac_and_tourist_cars": "790.40",
    "taxi_puj_and_mini_bus": "1150.40", "heavy_trucks": "1250.40", "pub_and_tourist_bus": "1500.40"
  },
  "ctplSetting3Year": {"private_cars": "1660.40"}
}$j$::jsonb
WHERE config ? 'vehicleClasses' AND NOT config ? 'ctplBasis';

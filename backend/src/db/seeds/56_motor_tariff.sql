-- Philippine motor tariff on the motor product templates (Product Configurator), applied once per template:
-- Insurance Commission vehicle classes with default seats, CTPL basic premium per class (one-year cover, fixed tariff,
-- not sum insured x rate) and Auto Passenger Personal Accident limits per person and rate. Editable afterwards.
UPDATE product_templates
SET config = config || $j${
  "vehicleClasses": [
    {"code": "private_cars", "label": "Private cars (including jeeps, AUVs and SUVs)", "seats": 5},
    {"code": "light_medium_trucks", "label": "Light / medium trucks (own goods) not over 3,930 kg", "seats": 3},
    {"code": "heavy_trucks", "label": "Heavy trucks (own goods) and private buses over 3,930 kg", "seats": 3},
    {"code": "ac_and_tourist_cars", "label": "AC and tourist cars", "seats": 5},
    {"code": "taxi_puj_and_mini_bus", "label": "Taxi, PUJ and mini bus", "seats": 5},
    {"code": "pub_and_tourist_bus", "label": "PUB and tourist bus", "seats": 50},
    {"code": "motorcycles_tricycles", "label": "Motorcycles / tricycles / trailers", "seats": 2}
  ],
  "ctplSetting": {
    "private_cars": "560.00", "light_medium_trucks": "610.00", "heavy_trucks": "1200.00", "ac_and_tourist_cars": "740.00",
    "taxi_puj_and_mini_bus": "1100.00", "pub_and_tourist_bus": "1450.00", "motorcycles_tricycles": "250.00"
  },
  "appaSetting": {"limits": [25000, 50000, 75000, 100000, 150000, 200000], "ratePercent": 0.1}
}$j$::jsonb
WHERE config ? 'ctplSetting' AND NOT config ? 'vehicleClasses';

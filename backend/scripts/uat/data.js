/**
 * Synthetic Philippine reference data for the UAT scenario. Every person, company and insurer here is fictional;
 * TINs, plate numbers and policy references are made up and only follow the local formats.
 */

export const FIRST_NAMES_F = ['Maria', 'Ana', 'Kristine', 'Jasmine', 'Rowena', 'Maricel', 'Liza', 'Camille', 'Andrea', 'Patricia', 'Joy', 'Rhea',
  'Angelica', 'Grace', 'Michelle', 'Katrina', 'Mylene', 'Aileen', 'Bea', 'Cristina'];
export const FIRST_NAMES_M = ['Jose', 'Juan', 'Mark', 'Paolo', 'Ramon', 'Carlo', 'Miguel', 'Rafael', 'Jerome', 'Noel', 'Dennis', 'Arnel',
  'Rodel', 'Francis', 'Joel', 'Bernard', 'Emmanuel', 'Renato', 'Gabriel', 'Vincent'];
export const LAST_NAMES = ['Santos', 'Reyes', 'Cruz', 'Bautista', 'Ocampo', 'Garcia', 'Mendoza', 'Torres', 'Villanueva', 'Ramos', 'Aquino',
  'Castillo', 'Dela Cruz', 'Navarro', 'Soriano', 'Salazar', 'Pascual', 'Manalo', 'Aguilar', 'Domingo', 'Gonzales', 'Lim', 'Tan', 'Sy',
  'Mercado', 'Samonte', 'Evangelista', 'Magbanua', 'Villareal', 'Panganiban'];

/** Cities of the address master with barangays, streets and ZIP codes. */
export const PLACES = [
  { city: 'Makati', province: 'Metro Manila', zip: '1209', barangays: ['Bel-Air', 'San Lorenzo', 'Poblacion', 'Urdaneta'], streets: ['Jupiter St.', 'Paseo de Roxas', 'Kalayaan Ave.', 'Salcedo St.'] },
  { city: 'Quezon City', province: 'Metro Manila', zip: '1103', barangays: ['Teachers Village East', 'Loyola Heights', 'Kamuning', 'Project 4'], streets: ['Maginhawa St.', 'Katipunan Ave.', 'Kamias Rd.', 'Aurora Blvd.'] },
  { city: 'Pasig', province: 'Metro Manila', zip: '1605', barangays: ['Kapitolyo', 'San Antonio', 'Ugong', 'Oranbo'], streets: ['East Capitol Dr.', 'Meralco Ave.', 'Shaw Blvd.', 'Julia Vargas Ave.'] },
  { city: 'Taguig', province: 'Metro Manila', zip: '1634', barangays: ['Fort Bonifacio', 'Ususan', 'Western Bicutan'], streets: ['5th Ave.', '32nd St.', 'C-5 Rd.'] },
  { city: 'Mandaluyong', province: 'Metro Manila', zip: '1550', barangays: ['Wack-Wack', 'Highway Hills', 'Plainview'], streets: ['Shaw Blvd.', 'Boni Ave.', 'Pioneer St.'] },
  { city: 'Parañaque', province: 'Metro Manila', zip: '1700', barangays: ['BF Homes', 'San Dionisio', 'Sucat'], streets: ['Aguirre Ave.', 'Dr. A. Santos Ave.', 'President Ave.'] },
  { city: 'Manila', province: 'Metro Manila', zip: '1000', barangays: ['Ermita', 'Malate', 'Binondo', 'Sampaloc'], streets: ['M.H. del Pilar St.', 'Taft Ave.', 'Ongpin St.', 'España Blvd.'] },
  { city: 'Cebu City', province: 'Cebu', zip: '6000', barangays: ['Lahug', 'Capitol Site', 'Guadalupe', 'Banilad'], streets: ['Gorordo Ave.', 'Osmeña Blvd.', 'M.J. Cuenco Ave.', 'A.S. Fortuna St.'] },
  { city: 'Mandaue', province: 'Cebu', zip: '6014', barangays: ['Subangdaku', 'Tipolo', 'Centro'], streets: ['A.C. Cortes Ave.', 'Plaridel St.', 'M.C. Briones St.'] },
  { city: 'Lapu-Lapu', province: 'Cebu', zip: '6015', barangays: ['Pusok', 'Basak', 'Mactan'], streets: ['M.L. Quezon Hwy.', 'Airport Rd.'] },
  { city: 'Davao City', province: 'Davao del Sur', zip: '8000', barangays: ['Poblacion', 'Buhangin', 'Matina', 'Lanang'], streets: ['C.M. Recto St.', 'J.P. Laurel Ave.', 'Quimpo Blvd.', 'R. Magsaysay Ave.'] },
];

/** Corporate prospects: fictional companies with their industry and head office city. */
export const COMPANIES = [
  { name: 'Bagong Silangan Agri-Ventures Corp.', industry: 'Rice and corn milling', city: 'Davao City' },
  { name: 'Mactan Coastline Resorts Inc.', industry: 'Resort and hotel', city: 'Lapu-Lapu' },
  { name: 'Kalayaan Steel Fabricators Inc.', industry: 'Steel fabrication', city: 'Pasig' },
  { name: 'Hilaga Logistics and Warehousing Corp.', industry: 'Warehousing and trucking', city: 'Taguig' },
  { name: 'Tanglaw Pharma Distribution Inc.', industry: 'Pharmaceutical distribution', city: 'Mandaluyong' },
  { name: 'Lungsod Builders and Developers Corp.', industry: 'Building construction', city: 'Quezon City' },
  { name: 'Visayan Coconut Oil Mills Inc.', industry: 'Coconut oil milling', city: 'Mandaue' },
  { name: 'Dagat Asul Seafoods Export Corp.', industry: 'Seafood processing and export', city: 'Cebu City' },
  { name: 'Mindanao Power Systems Inc.', industry: 'Power plant engineering', city: 'Davao City' },
  { name: 'Liwayway Printing and Packaging Corp.', industry: 'Printing and packaging', city: 'Parañaque' },
  { name: 'Silangan Retail Holdings Inc.', industry: 'Supermarket chain', city: 'Makati' },
  { name: 'Makiling BPO Solutions Inc.', industry: 'Business process outsourcing', city: 'Taguig' },
  { name: 'Pag-asa Hospital and Medical Center Inc.', industry: 'Hospital', city: 'Quezon City' },
  { name: 'Bayanihan Cooperative Bank', industry: 'Rural banking', city: 'Cebu City' },
  { name: 'Araw Solar Farm Corp.', industry: 'Solar power generation', city: 'Davao City' },
  { name: 'Pinagpala Garments Manufacturing Inc.', industry: 'Garments manufacturing', city: 'Manila' },
  { name: 'Himlayan Cold Storage Corp.', industry: 'Cold storage', city: 'Mandaue' },
  { name: 'Tagumpay Construction Supply Inc.', industry: 'Construction supply trading', city: 'Pasig' },
  { name: 'Sampaguita Foods Corp.', industry: 'Food manufacturing', city: 'Makati' },
  { name: 'Diwata Shipping Lines Inc.', industry: 'Inter-island shipping', city: 'Cebu City' },
  { name: 'Bituin Electronics Assembly Inc.', industry: 'Electronics assembly', city: 'Lapu-Lapu' },
  { name: 'Kabisera Property Management Corp.', industry: 'Office building leasing', city: 'Makati' },
];

/** Fictional Philippine non-life insurers (the reference seed's insurers are left as they are and not used). */
export const INSURERS = [
  { code: 'PCIC', name: 'Pacific Crest Insurance Corp.', short: 'Pacific Crest', city: 'Makati', rate: 0.175, warrantyDays: 60, remitDays: 30, ewt: true },
  { code: 'LUZ', name: 'Luzon Bay Assurance Inc.', short: 'Luzon Bay', city: 'Pasig', rate: 0.15, warrantyDays: 45, remitDays: 30, ewt: true },
  { code: 'VIS', name: 'Visayas Mutual General Insurance Co.', short: 'Visayas Mutual', city: 'Cebu City', rate: 0.16, warrantyDays: 60, remitDays: 45, ewt: true },
  { code: 'MIN', name: 'Mindanao Shield Insurance Corp.', short: 'Mindanao Shield', city: 'Davao City', rate: 0.15, warrantyDays: 30, remitDays: 30, ewt: true },
  { code: 'ARC', name: 'Archipelago General Insurance Co., Inc.', short: 'Archipelago General', city: 'Makati', rate: 0.18, warrantyDays: 90, remitDays: 60, ewt: true },
  { code: 'TALA', name: 'Tala Guaranty and Surety Insurance Corp.', short: 'Tala Guaranty', city: 'Quezon City', rate: 0.14, warrantyDays: 45, remitDays: 30, ewt: true },
  { code: 'HAR', name: 'Harbor Point Non-Life Insurance Inc.', short: 'Harbor Point', city: 'Manila', rate: 0.15, warrantyDays: 60, remitDays: 30, ewt: true },
];

/** Commission rates per insurer code and product code (fractions); missing pairs use the insurer's rate. */
export const COMMISSION_OVERRIDES = [
  ['PCIC', 'MOTOR', 0.20], ['PCIC', 'CTPL', 0.10], ['PCIC', 'FIRE', 0.225], ['PCIC', 'IAR', 0.20],
  ['LUZ', 'MOTOR', 0.175], ['LUZ', 'PA', 0.25], ['LUZ', 'TRAVEL', 0.30], ['LUZ', 'MARINE', 0.20],
  ['VIS', 'FIRE', 0.20], ['VIS', 'HOME', 0.25], ['VIS', 'CAR', 0.15], ['VIS', 'EAR', 0.15],
  ['MIN', 'IAR', 0.175], ['MIN', 'MONEY', 0.20], ['MIN', 'CGL', 0.20],
  ['ARC', 'EB', 0.10], ['ARC', 'MARINE', 0.225], ['ARC', 'FIRE', 0.20],
  ['TALA', 'CGL', 0.175], ['TALA', 'MONEY', 0.20], ['TALA', 'MOTOR', 0.15],
  ['HAR', 'MARINE', 0.25], ['HAR', 'CAR', 0.175], ['HAR', 'PA', 0.25],
];

/** Vehicles for motor quotations: brand, model, class of the motor tariff, typical market value range. */
export const VEHICLES = [
  { brand: 'Toyota', model: 'Vios', variant: '1.3 XLE CVT', type: 'private_cars', value: [650000, 950000] },
  { brand: 'Toyota', model: 'Fortuner', variant: '2.8 LTD 4x4 AT', type: 'private_cars', value: [1800000, 2400000] },
  { brand: 'Mitsubishi', model: 'Montero Sport', variant: 'GLS 2WD AT', type: 'private_cars', value: [1500000, 2100000] },
  { brand: 'Honda', model: 'City', variant: '1.5 V CVT', type: 'private_cars', value: [800000, 1100000] },
  { brand: 'Nissan', model: 'Navara', variant: 'VE 4x2 AT', type: 'light_medium_trucks', value: [1200000, 1600000] },
  { brand: 'Ford', model: 'Ranger', variant: 'XLT 4x2 AT', type: 'light_medium_trucks', value: [1300000, 1700000] },
  { brand: 'Suzuki', model: 'Ertiga', variant: 'GLX AT', type: 'private_cars', value: [800000, 1050000] },
  { brand: 'Hyundai', model: 'Stargate', variant: 'GLS 2.2 AT', type: 'ac_and_tourist_cars', value: [2000000, 2600000] },
  { brand: 'Toyota', model: 'Innova', variant: '2.8 E AT', type: 'private_cars', value: [1300000, 1650000] },
  { brand: 'Isuzu', model: 'mu-X', variant: 'LS-A 4x2 AT', type: 'private_cars', value: [1700000, 2200000] },
];
export const MOTORCYCLES = [
  { brand: 'Honda', model: 'Click 125i', type: 'motorcycles_tricycles' },
  { brand: 'Yamaha', model: 'NMAX 155', type: 'motorcycles_tricycles' },
  { brand: 'Suzuki', model: 'Raider R150', type: 'motorcycles_tricycles' },
];
export const COLOURS = ['Pearl White', 'Silver Metallic', 'Gray Metallic', 'Black Mica', 'Red Mica', 'Blue Metallic'];
export const DESTINATIONS = ['Japan', 'South Korea', 'Singapore', 'Hong Kong', 'Taiwan', 'Vietnam', 'United States', 'Schengen area'];

/** Bank accounts of the broker (bank account master), with the GL cash account each is linked to. */
export const BANK_ACCOUNTS = [
  { code: 'BDO-OPS', name: 'Operating Account', bankCode: 'BDO', bankName: 'Banco de Oro', accountNumber: '0071-2345-6789', accountType: 'Current Account' },
  { code: 'MBT-COL', name: 'Premium Collection Account', bankCode: 'MBT', bankName: 'Metrobank', accountNumber: '152-7-15298765-4', accountType: 'Current Account' },
];

// Fire and Allied Perils - Risk Details field options

export const CONSTRUCTION_TYPES = [
  { label: "Reinforced Concrete (RCC)", value: "Reinforced Concrete (RCC)", labelKey: "fireLead.opt.construction.rcc" },
  { label: "Brick / Masonry", value: "Brick / Masonry", labelKey: "fireLead.opt.construction.brickMasonry" },
  { label: "Steel Structure", value: "Steel Structure", labelKey: "fireLead.opt.construction.steelStructure" },
  { label: "Semi-Concrete (Brick + Timber Roof)", value: "Semi-Concrete (Brick + Timber Roof)", labelKey: "fireLead.opt.construction.semiConcrete" },
  { label: "Timber / Wooden", value: "Timber / Wooden", labelKey: "fireLead.opt.construction.timberWooden" },
  { label: "Metal Sheet / Prefabricated", value: "Metal Sheet / Prefabricated", labelKey: "fireLead.opt.construction.metalSheet" },
  { label: "Composite Construction (Mixed Materials)", value: "Composite Construction (Mixed Materials)", labelKey: "fireLead.opt.construction.composite" },
  { label: "Thatched / Temporary Structure", value: "Thatched / Temporary Structure", labelKey: "fireLead.opt.construction.thatched" },
];

export const BUILDING_TYPES = [
  { label: "Residential – Individual House", value: "Residential – Individual House", labelKey: "fireLead.opt.building.residentialHouse" },
  { label: "Residential – Apartment / Condominium", value: "Residential – Apartment / Condominium", labelKey: "fireLead.opt.building.residentialApartment" },
  { label: "Commercial – Office", value: "Commercial – Office", labelKey: "fireLead.opt.building.commercialOffice" },
  { label: "Commercial – Retail Shop / Mall", value: "Commercial – Retail Shop / Mall", labelKey: "fireLead.opt.building.commercialRetail" },
  { label: "Industrial – Light Manufacturing", value: "Industrial – Light Manufacturing", labelKey: "fireLead.opt.building.industrialLight" },
  { label: "Industrial – Heavy Manufacturing", value: "Industrial – Heavy Manufacturing", labelKey: "fireLead.opt.building.industrialHeavy" },
  { label: "Warehouse / Storage", value: "Warehouse / Storage", labelKey: "fireLead.opt.building.warehouse" },
  { label: "Institutional – School / College", value: "Institutional – School / College", labelKey: "fireLead.opt.building.institutional" },
  { label: "Hospital / Healthcare Facility", value: "Hospital / Healthcare Facility", labelKey: "fireLead.opt.building.hospital" },
  { label: "Hotel / Hospitality", value: "Hotel / Hospitality", labelKey: "fireLead.opt.building.hotel" },
  { label: "Mixed Use Building", value: "Mixed Use Building", labelKey: "fireLead.opt.building.mixedUse" },
];

export const LOCATION_CODE_OPTIONS = [
  { label: "Urban – Low Hazard Zone", value: "Urban – Low Hazard Zone", labelKey: "fireLead.opt.location.urbanLow" },
  { label: "Urban – Moderate Hazard Zone", value: "Urban – Moderate Hazard Zone", labelKey: "fireLead.opt.location.urbanModerate" },
  { label: "Urban – High Hazard Zone", value: "Urban – High Hazard Zone", labelKey: "fireLead.opt.location.urbanHigh" },
  { label: "Suburban – Low Hazard Zone", value: "Suburban – Low Hazard Zone", labelKey: "fireLead.opt.location.suburbanLow" },
  { label: "Suburban – Moderate Hazard Zone", value: "Suburban – Moderate Hazard Zone", labelKey: "fireLead.opt.location.suburbanModerate" },
  { label: "Suburban – High Hazard Zone", value: "Suburban – High Hazard Zone", labelKey: "fireLead.opt.location.suburbanHigh" },
  { label: "Industrial Estate – Low Hazard", value: "Industrial Estate – Low Hazard", labelKey: "fireLead.opt.location.industrialLow" },
  { label: "Industrial Estate – High Hazard", value: "Industrial Estate – High Hazard", labelKey: "fireLead.opt.location.industrialHigh" },
  { label: "Rural Area – Standard Risk", value: "Rural Area – Standard Risk", labelKey: "fireLead.opt.location.rural" },
  { label: "Remote / Isolated Location", value: "Remote / Isolated Location", labelKey: "fireLead.opt.location.remote" },
  { label: "Coastal Area", value: "Coastal Area", labelKey: "fireLead.opt.location.coastal" },
  { label: "Flood-Prone Area", value: "Flood-Prone Area", labelKey: "fireLead.opt.location.floodProne" },
  { label: "Special Economic Zone (SEZ)", value: "Special Economic Zone (SEZ)", labelKey: "fireLead.opt.location.sez" },
];

export const EARTHQUAKE_ZONES = [
  { label: "Zone I – Very Low Seismic Risk", value: "Zone I – Very Low Seismic Risk", labelKey: "fireLead.opt.earthquake.zone1" },
  { label: "Zone II – Low Seismic Risk", value: "Zone II – Low Seismic Risk", labelKey: "fireLead.opt.earthquake.zone2" },
  { label: "Zone III – Moderate Seismic Risk", value: "Zone III – Moderate Seismic Risk", labelKey: "fireLead.opt.earthquake.zone3" },
  { label: "Zone IV – High Seismic Risk", value: "Zone IV – High Seismic Risk", labelKey: "fireLead.opt.earthquake.zone4" },
  { label: "Zone V – Very High Seismic Risk", value: "Zone V – Very High Seismic Risk", labelKey: "fireLead.opt.earthquake.zone5" },
  { label: "Not Applicable / No Earthquake Exposure", value: "Not Applicable / No Earthquake Exposure", labelKey: "fireLead.opt.earthquake.notApplicable" },
];

export const OCCUPANCY_TYPES = [
  { label: "Residential", value: "Residential", labelKey: "fireLead.opt.occupancy.residential" },
  { label: "Commercial (Non-Industrial)", value: "Commercial (Non-Industrial)", labelKey: "fireLead.opt.occupancy.commercial" },
  { label: "Industrial (Manufacturing / Processing)", value: "Industrial (Manufacturing / Processing)", labelKey: "fireLead.opt.occupancy.industrial" },
  { label: "Institutional / Public Buildings", value: "Institutional / Public Buildings", labelKey: "fireLead.opt.occupancy.institutional" },
  { label: "Storage / Warehouse", value: "Storage / Warehouse", labelKey: "fireLead.opt.occupancy.storage" },
];

export const FIRE_PROTECTION_OPTIONS = [
  { label: "Hydrant", value: "Hydrant", labelKey: "fireLead.opt.fireProtection.hydrant" },
  { label: "Sprinkler", value: "Sprinkler", labelKey: "fireLead.opt.fireProtection.sprinkler" },
  { label: "Fire Extinguisher", value: "Fire Extinguisher", labelKey: "fireLead.opt.fireProtection.fireExtinguisher" },
  { label: "None", value: "None", labelKey: "fireLead.opt.fireProtection.none" },
];

// SMI Sum Insured mapping - SMI Desc to SMI Group Code (background, not shown)
export const SMI_ENTRY_FIELDS = [
  { key: "Building", smiGroupCode: "SMIGRP1", label: "Building", labelKey: "fireLead.opt.smi.building" },
  { key: "PlantAndMachinery", smiGroupCode: null, label: "Plant & machinery", labelKey: "fireLead.opt.smi.plantAndMachinery" },
  { key: "OtherContents", smiGroupCode: null, label: "Other contents", labelKey: "fireLead.opt.smi.otherContents" },
  { key: "GrossProfit", smiGroupCode: "SMIGRP2", label: "Gross profit", labelKey: "fireLead.opt.smi.grossProfit" },
  { key: "Wages", smiGroupCode: null, label: "Wages", labelKey: "fireLead.opt.smi.wages" },
  { key: "LossOfRent", smiGroupCode: "SMIGRP3", label: "Loss of Rent / Alternate accommodation", labelKey: "fireLead.opt.smi.lossOfRent" },
];

// Cover config: COVER DESC, SMI GROUP CODE, Basis Cover Y/N, Mandatory Y/N, Rate (%)
export const COVER_CONFIG = [
  { coverDesc: "Fire And Allied Peril", coverDescKey: "fireLead.opt.cover.fireAndAlliedPeril", smiGroupCode: "SMIGRP1", basisCover: true, mandatory: false, rate: 2.5 },
  { coverDesc: "SRCC", coverDescKey: "fireLead.opt.cover.srcc", smiGroupCode: null, basisCover: false, mandatory: true, rate: 0.3 },
  { coverDesc: "Business Interruption", coverDescKey: "fireLead.opt.cover.businessInterruption", smiGroupCode: "SMIGRP2", basisCover: false, mandatory: false, rate: 0.5 },
  { coverDesc: "Storm, Typhoon", coverDescKey: "fireLead.opt.cover.stormTyphoon", smiGroupCode: null, basisCover: false, mandatory: true, rate: 0.1 },
  { coverDesc: "Hail", coverDescKey: "fireLead.opt.cover.hail", smiGroupCode: null, basisCover: false, mandatory: true, rate: 1.5 },
  { coverDesc: "Earthquake", coverDescKey: "fireLead.opt.cover.earthquake", smiGroupCode: null, basisCover: false, mandatory: true, rate: 3.0 },
  { coverDesc: "Loss of Rent/ Alternate Accomodation", coverDescKey: "fireLead.opt.cover.lossOfRent", smiGroupCode: "SMIGRP3", basisCover: false, mandatory: false, rate: 2.5 },
];

// Earthquake Zone loading percentages (SMIGRP1 Premium * Zone %)
export const EARTHQUAKE_ZONE_LOADING_PCT = {
  "Zone I – Very Low Seismic Risk": 0,
  "Zone II – Low Seismic Risk": 5,
  "Zone III – Moderate Seismic Risk": 10,
  "Zone IV – High Seismic Risk": 20,
  "Zone V – Very High Seismic Risk": 25,
  "Not Applicable / No Earthquake Exposure": 0,
};

// Discount validation limits - step by 5% (0, 5, 10, 15)
export const SPRINKLER_DISCOUNT_MAX = 15;
export const FIRE_EXTINGUISHER_DISCOUNT_MAX = 5;
export const DISCOUNT_STEP = 5;

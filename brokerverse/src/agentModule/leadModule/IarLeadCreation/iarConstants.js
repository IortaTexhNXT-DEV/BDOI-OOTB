/** Industrial All Risks — FE constants (mirror BE catalog) */

export const IAR_PRODUCT_TYPE = "Industrial All Risks";
export const IAR_PRODUCT_CODE = "2009";

export const IAR_SECTION_CATALOG = [
  { sectionCode: "MOTOR", sectionLabel: "Motor Commercial" },
  { sectionCode: "FIRE", sectionLabel: "Fire Material Damage" },
  { sectionCode: "TRAVEL", sectionLabel: "Travel" },
  { sectionCode: "CTPL", sectionLabel: "Compulsory Third Party Liability" },
  { sectionCode: "HEALTH", sectionLabel: "Health" },
  { sectionCode: "LIFE", sectionLabel: "Life" },
  { sectionCode: "PROPERTY", sectionLabel: "Property All Risk" },
];

export const IAR_DEFAULT_SECTION_RATES = {
  MOTOR: 0.35,
  FIRE: 0.15,
  TRAVEL: 0.5,
  CTPL: 0.25,
  HEALTH: 0.4,
  LIFE: 0.3,
  PROPERTY: 0.2,
};

export const IAR_SECTION_SUGGESTIONS = {
  MOTOR: {
    items: ["Vehicle", "Fleet Vehicle", "Commercial Vehicle"],
    perils: [
      "Own Damage",
      "Third Party Property Damage",
      "Third party Bodily injury",
      "Theft",
      "Acts of Nature",
    ],
  },
  FIRE: {
    items: ["Building", "Plant & Machinery", "Stock", "Contents"],
    perils: [
      "Fire & Lightning",
      "Explosion",
      "Typhoon & Flood",
      "Earthquake",
      "SRCC",
      "Business Interruption",
    ],
  },
  TRAVEL: {
    items: ["Traveler", "Trip"],
    perils: [
      "Medical Emergency",
      "Trip Cancellation",
      "Lost Baggage",
      "Personal Accident",
    ],
  },
  CTPL: {
    items: ["Vehicle"],
    perils: ["Third Party Bodily Injury", "Third Party Death"],
  },
  HEALTH: {
    items: ["Insured Person", "Employee"],
    perils: ["Hospitalization", "Outpatient", "Emergency", "Dental"],
  },
  LIFE: {
    items: ["Life Assured"],
    perils: ["Death Benefit", "Total Permanent Disability", "Accidental Death"],
  },
  PROPERTY: {
    items: ["Building", "Contents", "Equipment"],
    perils: ["All Risk", "Theft", "Accidental Damage", "Fire"],
  },
};

export const makeId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export function recalculateIarPremiumDetails(premiumDetails = {}) {
  const sectionsIn = Array.isArray(premiumDetails.sections)
    ? premiumDetails.sections
    : [];

  const sections = sectionsIn.map((section) => {
    const items = (section.items || []).map((item) => {
      const perils = (item.perils || []).map((p) => ({
        ...p,
        sumInsured: Number(p.sumInsured) || 0,
      }));
      const itemSumInsured = perils.reduce(
        (s, p) => s + (Number(p.sumInsured) || 0),
        0
      );
      return { ...item, perils, itemSumInsured };
    });
    const sectionSumInsured = items.reduce(
      (s, i) => s + (Number(i.itemSumInsured) || 0),
      0
    );
    const ratePercent = Number(section.ratePercent) || 0;
    const sectionPremium = Number(
      ((sectionSumInsured * ratePercent) / 100).toFixed(2)
    );
    return {
      ...section,
      items,
      ratePercent,
      sectionSumInsured,
      sectionPremium,
    };
  });

  const totalSumInsured = sections.reduce(
    (s, sec) => s + (Number(sec.sectionSumInsured) || 0),
    0
  );
  const totalPremiumPreLevy = Number(
    sections
      .reduce((s, sec) => s + (Number(sec.sectionPremium) || 0), 0)
      .toFixed(2)
  );
  const vatPercent =
    premiumDetails.vatPercent != null
      ? Number(premiumDetails.vatPercent)
      : 0; // callers pass the configured VAT (tax.vat_rate)
  const valueAddedTax = Number(
    ((totalPremiumPreLevy * vatPercent) / 100).toFixed(2)
  );
  const discount = Number(premiumDetails.discount) || 0;
  const discountPercent = Number(premiumDetails.discountPercent) || 0;
  const totalPremiumLevyInclusive = Number(
    Math.max(0, totalPremiumPreLevy + valueAddedTax - discount).toFixed(2)
  );

  return {
    ...premiumDetails,
    sections,
    totalSumInsured,
    totalPremiumPreLevy,
    vatPercent,
    valueAddedTax,
    discount,
    discountPercent,
    totalPremiumLevyInclusive,
    totalPremium: totalPremiumLevyInclusive,
  };
}

export function buildPremiumSectionsFromRisks(iarSections) {
  return (iarSections || []).map((sec) => ({
    sectionId: sec.id,
    sectionCode: sec.sectionCode,
    sectionLabel: sec.sectionLabel,
    ratePercent: IAR_DEFAULT_SECTION_RATES[sec.sectionCode] ?? 0.25,
    sectionSumInsured: 0,
    sectionPremium: 0,
    items: [],
  }));
}

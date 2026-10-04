import { bodilyInjuryOptions, propertyDamageOptions, setQuoteOptions } from "./quoteOptions";
import { currencySymbol, setDisplayCurrency } from "./currencyConverter";

describe("business options from configuration, not code", () => {
  afterEach(() => {
    setQuoteOptions({});
    setDisplayCurrency("PHP");
  });

  it("offers the coverage limits configured in quote.bodily_injury_limits / quote.property_damage_limits", () => {
    setQuoteOptions({ bodilyInjuryLimits: [100000, 250000], propertyDamageLimits: [50000] });
    expect(bodilyInjuryOptions()).toEqual([
      { label: "100,000", value: "100,000" },
      { label: "250,000", value: "250,000" },
    ]);
    expect(propertyDamageOptions()).toEqual([{ label: "50,000", value: "50,000" }]);
  });

  it("offers no limits when none are configured", () => {
    setQuoteOptions({});
    expect(bodilyInjuryOptions()).toEqual([]);
  });

  it("labels amounts with the symbol of the configured display currency", () => {
    setDisplayCurrency("PHP");
    expect(currencySymbol()).toBe("₱");
    setDisplayCurrency("THB");
    expect(currencySymbol()).toBe("฿");
  });
});

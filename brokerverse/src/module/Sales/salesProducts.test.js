import { entryOf, rfqState } from "./salesProducts";

describe("the screen a product is quoted on", () => {
  it("opens the motor wizard for motor products and the own forms of Fire, IAR and employee benefits", () => {
    expect(entryOf({ code: "MOTOR", lob: "MOTOR" })).toBe("motor");
    expect(entryOf({ code: "CTPL", lob: "MOTOR" })).toBe("motor");
    expect(entryOf({ code: "FIRE", lob: "FIRE" })).toBe("fire");
    expect(entryOf({ code: "IAR", lob: "IAR" })).toBe("iar");
    expect(entryOf({ code: "EB", lob: "EB" })).toBe("eb");
  });

  it("sends every other product to a Request for Quotation", () => {
    for (const p of [{ code: "PA", lob: "ACCIDENT" }, { code: "CL-COMP", lob: "LIFE" }, { code: "PARCEL", lob: "MARINE" }, { code: "HOME", lob: "FIRE" }]) {
      expect(entryOf(p)).toBe("rfq");
    }
  });
});

describe("Request for Quotation prefill", () => {
  const product = { id: 7, name: "Personal Accident" };

  it("carries the product and the prospect", () => {
    expect(rfqState(product, { lead: { leadId: "ld_1", firstName: "Ana", lastName: "Cruz" } })).toEqual({
      prefill: { productId: 7, productType: "Personal Accident", leadRefId: "ld_1", leadName: "Ana Cruz" },
    });
  });

  it("carries an existing client, or opens on a new prospect", () => {
    expect(rfqState(product, { client: { clientId: "cl_1", displayName: "Ana Cruz", generatedClientId: "C-0001" } }).prefill)
      .toMatchObject({ clientId: "cl_1", clientName: "Ana Cruz", clientCode: "C-0001" });
    expect(rfqState(product, { newProspect: true }).prefill.newProspect).toBe(true);
    expect(rfqState(null).prefill).toEqual({ productId: undefined, productType: undefined });
  });
});

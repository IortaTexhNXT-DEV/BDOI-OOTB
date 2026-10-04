import {
  actionSeverity, conditionText, outcomeText, refers, authorityText, insurerText, ruleErrors, layoutPlaceholders, layoutFileError,
} from "./ruleLogic";

// t() of the tests: the key with its options, so the assertions read what the screen would look up
const t = (key, opts) => (opts ? `${key} ${JSON.stringify(opts)}` : key);
const fields = [
  { value: "vehicleAge", label: "Vehicle age (years)", type: "number" },
  { value: "sumInsured", label: "Sum insured", type: "number" },
  { value: "fairMarketValue", label: "Fair market value", type: "number" },
  { value: "vehicleUse", label: "Vehicle use", type: "text", options: ["Private", "PUV"] },
  { value: "modified", label: "Vehicle has modifications", type: "boolean" },
];

describe("acceptance rule display", () => {
  it("writes the condition from the structured fields, else shows the stored text", () => {
    expect(conditionText({ field: "vehicleAge", operator: "<=", value: 15 }, fields)).toBe("Vehicle age (years) <= 15");
    expect(conditionText({ field: "sumInsured", operator: ">", valueField: "fairMarketValue", valueFactor: 1.1 }, fields)).toBe("Sum insured > Fair market value x 1.1");
    expect(conditionText({ field: "modified", operator: "=", value: true }, fields)).toBe("Vehicle has modifications");
    expect(conditionText({ condition: "Legacy text" }, fields)).toBe("Legacy text");
  });

  it("states the outcome and its colour from the action", () => {
    expect(outcomeText({ action: "Auto-Accept" }, t)).toContain("underwritingRules.outcome.otherwiseRefer");
    expect(outcomeText({ action: "Auto-Accept", otherwiseAction: "Decline" }, t)).toContain("underwritingRules.outcome.otherwiseDecline");
    expect(outcomeText({ action: "Apply Loading", loadingPercent: 15 }, t)).toBe('underwritingRules.outcome.loading {"percent":15}');
    expect(actionSeverity("Auto-Accept")).toBe("success");
    expect(actionSeverity("Refer")).toBe("warning");
    expect(actionSeverity("Decline")).toBe("danger");
    expect(actionSeverity("Apply Loading")).toBe("info");
  });

  it("names the authority role only for rules that refer, and the insurer or all insurers", () => {
    const roles = [{ value: "processing", label: "Processing Team" }];
    expect(refers({ action: "Auto-Accept" })).toBe(true);
    expect(refers({ action: "Auto-Accept", otherwiseAction: "Decline" })).toBe(false);
    expect(authorityText({ action: "Refer", authorityRole: "processing" }, roles, t)).toBe("Processing Team");
    expect(authorityText({ action: "Decline", authority: "System" }, roles, t)).toBe("underwritingRules.noReferral");
    expect(authorityText({ action: "Refer" }, roles, t)).toBe("underwritingRules.authorityMissing");
    expect(insurerText({ insurerName: "Malayan Insurance Co., Inc." }, t)).toBe("Malayan Insurance Co., Inc.");
    expect(insurerText({}, t)).toBe("underwritingRules.allInsurers");
  });
});

describe("acceptance rule checks before saving", () => {
  const valid = { productId: 1, ruleCode: "R1", ruleName: "Rule", type: "Acceptance", field: "vehicleAge", operator: "<=", value: "15", action: "Auto-Accept", authorityRole: "processing" };

  it("accepts a complete rule", () => {
    expect(ruleErrors(valid, fields, t)).toEqual({});
  });

  it("asks for the value, a number for a number field, the loading % and the authority role", () => {
    expect(Object.keys(ruleErrors({ ...valid, value: "" }, fields, t))).toEqual(["value"]);
    expect(Object.keys(ruleErrors({ ...valid, value: "abc" }, fields, t))).toEqual(["value"]);
    expect(Object.keys(ruleErrors({ ...valid, action: "Apply Loading" }, fields, t))).toEqual(["loadingPercent"]);
    expect(Object.keys(ruleErrors({ ...valid, authorityRole: null }, fields, t))).toEqual(["authorityRole"]);
    expect(ruleErrors({ ...valid, action: "Decline", authorityRole: null }, fields, t)).toEqual({});
    expect(ruleErrors({ ...valid, field: "modified", value: null }, fields, t)).toEqual({});
    expect(ruleErrors({ ...valid, field: "sumInsured", value: null, valueField: "fairMarketValue" }, fields, t)).toEqual({});
    expect(Object.keys(ruleErrors({ ruleCode: "X" }, fields, t)).sort()).toEqual(["action", "field", "operator", "productId", "ruleName", "type"]);
  });
});

describe("document layout upload checks", () => {
  const mergeFields = [{ name: "PolicyNumber" }, { name: "InsuredName" }];
  const blocks = [{ name: "Premium" }];

  it("lists the merge fields used and the unknown ones", () => {
    expect(layoutPlaceholders("{{PolicyNumber}} {{#Premium}} {{Nope}} {{#Nada}}", mergeFields, blocks)).toEqual({ used: ["PolicyNumber", "#Premium"], unknown: ["Nope", "#Nada"] });
  });

  it("accepts text files with known merge fields only", () => {
    expect(layoutFileError({ name: "schedule.txt" }, "Policy {{PolicyNumber}}", mergeFields, blocks, t)).toBeNull();
    expect(layoutFileError({ name: "schedule.md" }, "{{#Premium}}", mergeFields, blocks, t)).toBeNull();
    expect(layoutFileError({ name: "schedule.docx" }, "Policy {{PolicyNumber}}", mergeFields, blocks, t)).toContain("documentManager.onlyText");
    expect(layoutFileError({ name: "s.txt" }, "  ", mergeFields, blocks, t)).toBe("documentManager.emptyLayout");
    expect(layoutFileError({ name: "s.txt" }, "{{PolicyNo}}", mergeFields, blocks, t)).toContain("PolicyNo");
    expect(layoutFileError({ name: "s.txt" }, "Static only", mergeFields, blocks, t)).toBe("documentManager.noFields");
  });
});

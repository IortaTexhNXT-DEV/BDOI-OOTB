import { formatPhone, normalisePhone, PH_PHONE, toFormValues, toPayload, validateProfile } from "./profileForm";
import { initialsOf, roleLineOf } from "../../utility/userIdentity";
import { languageOptions, showLanguagePicker } from "../../utility/languages";
import { badgeText, newestFirst } from "../../agentModule/component/navBar";

describe("My Profile form", () => {
  const base = toFormValues({ firstName: "Juan", lastName: "Santos", displayName: "Juan Santos" });

  it("defaults the country to the Philippines and leaves gender unset", () => {
    expect(base.country).toBe("Philippines");
    expect(base.gender).toBeNull();
  });

  it("accepts Philippine mobile and landline numbers only", () => {
    for (const ok of ["0917 123 4567", "+63 917 123 4567", "(02) 8123 4567", "+63 2 8123 4567", "032 234 5678"]) {
      expect(PH_PHONE.test(normalisePhone(ok))).toBe(true);
    }
    for (const bad of ["12345", "0917 123 456", "+1 415 555 0100", "09171234567890"]) {
      expect(PH_PHONE.test(normalisePhone(bad))).toBe(false);
    }
    expect(formatPhone("09171234567")).toBe("0917 123 4567");
    expect(formatPhone("+639171234567")).toBe("+63 917 123 4567");
    expect(formatPhone("0281234567")).toBe("(02) 8123 4567");
  });

  it("reports field errors before saving", () => {
    const errors = validateProfile({ ...base, displayName: " ", phone: "12345", zipCode: "12", dateOfBirth: new Date(Date.now() + 864e5) });
    expect(errors).toEqual({ displayName: "displayNameRequired", phone: "phoneInvalid", zipCode: "zipInvalid", dateOfBirth: "dateOfBirthInvalid" });
    expect(validateProfile({ ...base, country: "Singapore", zipCode: "018989" })).toEqual({});
  });

  it("sends the e-mail address only when the user may change it", () => {
    const values = { ...base, email: "juan@example.ph", phone: "0917 123 4567", dateOfBirth: new Date(1988, 2, 21), gender: "male" };
    expect(toPayload(values)).not.toHaveProperty("email");
    expect(toPayload(values, { emailEditable: true }).email).toBe("juan@example.ph");
    expect(toPayload(values)).toMatchObject({ phone: "09171234567", dateOfBirth: "1988-03-21", gender: "male", country: "Philippines" });
  });
});

describe("signed-in user identity", () => {
  it("builds initials from the names, the display name or the user ID; never '?'", () => {
    expect(initialsOf({ firstName: "Juan", lastName: "Santos", displayName: "JD" })).toBe("JS");
    expect(initialsOf({ displayName: "Juan dela Cruz Santos" })).toBe("JS");
    expect(initialsOf({ displayName: "BrokerVerse" })).toBe("BV");
    expect(initialsOf({ displayName: "", username: "maria.reyes" })).toBe("MA");
    expect(initialsOf("Ana Lim")).toBe("AL");
  });

  it("shows role names without their bracketed description", () => {
    expect(roleLineOf({ roleNames: ["Processing Team (Placement & Policy Processing)", "Claims"] })).toBe("Processing Team, Claims");
    expect(roleLineOf({ roles: ["system-admin"] })).toBe("System Admin");
  });
});

describe("top bar", () => {
  it("caps the unread badge at 99+", () => {
    expect(badgeText(47)).toBe("47");
    expect(badgeText(99)).toBe("99");
    expect(badgeText(100)).toBe("99+");
  });

  it("lists notifications newest first", () => {
    const list = [{ id: 1, createdAt: "2026-10-01T01:00:00Z" }, { id: 2, createdAt: "2026-10-03T01:00:00Z" }, { id: 3, createdAt: "2026-10-02T01:00:00Z" }];
    expect(newestFirst(list).map((n) => n.id)).toEqual([2, 3, 1]);
  });

  it("shows a language picker only when two or more languages are available", () => {
    expect(showLanguagePicker(languageOptions([{ code: "en" }, { code: "fil" }]))).toBe(false);
    expect(showLanguagePicker([{ value: "en" }, { value: "fil" }])).toBe(true);
    expect(showLanguagePicker([])).toBe(false);
  });
});

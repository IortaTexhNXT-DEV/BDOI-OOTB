import { canOpen, hasPermission } from "./canOpen";

const signIn = (roles, permissions) => {
  localStorage.setItem("USER_ROLES", JSON.stringify(roles));
  localStorage.setItem("USER_ROLE", roles.join(", "));
  if (permissions) localStorage.setItem("USER_PERMISSIONS", JSON.stringify(permissions));
  else localStorage.removeItem("USER_PERMISSIONS");
};

describe("actions shown only when the role may use them (N1)", () => {
  afterEach(() => localStorage.clear());

  it("claims users are not offered Create Policy (Leads) nor Bulk Upload (write:policies)", () => {
    signIn(["claims"], ["read:policies", "read:claims", "write:claims"]);
    expect(canOpen("/agent/leadlisting")).toBe(false);
    expect(hasPermission("write:policies")).toBe(false);
  });

  it("sales users are offered both", () => {
    signIn(["sales"], ["read:leads", "write:leads", "read:policies", "write:policies"]);
    expect(canOpen("/agent/leadlisting")).toBe(true);
    expect(hasPermission("write:policies")).toBe(true);
  });

  it("administrators hold every permission; nothing stored leaves the decision to the server", () => {
    signIn(["ba"], []);
    expect(hasPermission("write:policies")).toBe(true);
    signIn(["sales"]);
    expect(hasPermission("write:policies")).toBe(true);
  });
});

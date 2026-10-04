/**
 * Who is signed in, as the top bar and My Profile show it: name, initials and role, from the stored session
 * (localStorage "user", written at sign-in and on every token refresh) with the older individual keys as fallback.
 */

const readStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null") || {};
  } catch {
    return {};
  }
};

const firstLetter = (s) => {
  const ch = String(s || "").trim().match(/\p{L}|\p{N}/u);
  return ch ? ch[0].toUpperCase() : "";
};

/**
 * Initials: first and last name when known, else the first and last word of the display name, else the first two
 * letters of the user ID. Never "?" for a signed-in user.
 */
export const initialsOf = (person = {}) => {
  const p = typeof person === "string" ? { displayName: person } : person || {};
  const fromNames = `${firstLetter(p.firstName)}${firstLetter(p.lastName)}`;
  if (fromNames.length === 2) return fromNames;
  const words = String(p.displayName || "")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length >= 2) return `${firstLetter(words[0])}${firstLetter(words[words.length - 1])}`;
  if (words.length === 1) {
    // "BrokerVerse" -> "BV"; "Juan" -> "JU"
    const capitals = words[0].match(/\p{Lu}/gu) || [];
    if (capitals.length >= 2) return `${capitals[0]}${capitals[1]}`;
    return words[0].replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase();
  }
  const id = String(p.username || "").replace(/[^\p{L}\p{N}]/gu, "");
  return id ? id.slice(0, 2).toUpperCase() : "";
};

/** "system-admin" -> "System Admin" (when the role's name is not known yet). */
export const roleLabel = (code) =>
  String(code || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");

/** The signed-in user: { userId, username, displayName, firstName, lastName, email, roles, roleNames }. */
export const currentUser = () => {
  const u = readStoredUser();
  let roles = u.roles;
  if (!Array.isArray(roles)) {
    try {
      roles = JSON.parse(localStorage.getItem("USER_ROLES") || "[]");
    } catch {
      roles = [];
    }
  }
  return {
    userId: u.userId || localStorage.getItem("USER_ID") || "",
    username: u.username || localStorage.getItem("USERNAME") || "",
    displayName: u.displayName || localStorage.getItem("USER_NAME") || "",
    firstName: u.firstName || "",
    lastName: u.lastName || "",
    email: u.email || localStorage.getItem("USER_EMAIL") || "",
    roles: Array.isArray(roles) ? roles : [],
    roleNames: Array.isArray(u.roleNames) ? u.roleNames : null,
  };
};

/** Name to show: display name, else first + last name, else the user ID. */
export const displayNameOf = (p = {}) =>
  p.displayName || [p.firstName, p.lastName].filter(Boolean).join(" ") || p.username || "";

/**
 * Role line under the name: role names when known (without a bracketed description: "Processing Team (Placement &
 * Policy Processing)" -> "Processing Team"), else the role codes in words.
 */
export const roleLineOf = (p = {}, { short = true } = {}) =>
  (Array.isArray(p.roleNames) && p.roleNames.length ? p.roleNames : (p.roles || []).map(roleLabel))
    .map((r) => (short ? String(r).replace(/\s*\(.*\)\s*$/, "") : r))
    .join(", ");

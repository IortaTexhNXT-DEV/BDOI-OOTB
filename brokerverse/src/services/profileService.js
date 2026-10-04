import { BASE_URL } from "../utility/constant";
import authService from "./authService";

/** Fired on window after the user saved their profile (the top bar refreshes its name and initials). */
export const PROFILE_UPDATED_EVENT = "bv:profile-updated";

class ProfileRequestError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors || [];
  }
}

const request = async (options = {}) => {
  const response = await fetch(`${BASE_URL}/auth/profile`, {
    ...options,
    headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new ProfileRequestError(body.message || `Request failed (${response.status})`, response.status, body.errors);
  }
  return body.data;
};

let cached = null;

/** Keep the stored session user in step with the saved profile (name, e-mail, role names). */
const remember = (profile) => {
  try {
    const stored = JSON.parse(localStorage.getItem("user") || "{}") || {};
    const merged = {
      ...stored,
      displayName: profile.displayName,
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      email: profile.email || "",
      roleNames: profile.roleNames || stored.roleNames,
    };
    localStorage.setItem("user", JSON.stringify(merged));
    localStorage.setItem("USER_NAME", profile.displayName || "");
    localStorage.setItem("USER_EMAIL", profile.email || "");
  } catch {
    /* storage unavailable */
  }
  return profile;
};

/** The signed-in user's own profile (GET/PUT /auth/profile). */
const profileService = {
  getProfile: () => request().then(remember),
  /** Profile for the top bar: fetched once per page load and shared. */
  getCachedProfile: () => {
    if (!cached) {
      cached = profileService.getProfile().catch((err) => {
        cached = null;
        throw err;
      });
    }
    return cached;
  },
  updateProfile: async (profile) => {
    const saved = remember(await request({ method: "PUT", body: JSON.stringify(profile) }));
    cached = Promise.resolve(saved);
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: saved }));
    return saved;
  },
};

export default profileService;

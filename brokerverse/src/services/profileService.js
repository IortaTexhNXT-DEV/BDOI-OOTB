import { BASE_URL } from "../utility/constant";
import authService from "./authService";

const request = async (options = {}) => {
  const response = await fetch(`${BASE_URL}/auth/profile`, {
    ...options,
    headers: { "Content-Type": "application/json", ...authService.getAuthHeader() },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(body.message || `Request failed (${response.status})`);
  }
  return body.data;
};

/** The signed-in user's own profile (GET/PUT /auth/profile). */
const profileService = {
  getProfile: () => request(),
  updateProfile: (profile) => request({ method: "PUT", body: JSON.stringify(profile) }),
};

export default profileService;

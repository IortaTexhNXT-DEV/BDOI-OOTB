import axios from "axios";
import { BASE_URL } from "./constant";
import { getAccessToken } from "./tokenManager";
import { logout } from "./logout";

const request = axios.create({
    baseURL: BASE_URL,
});

// Alter defaults after instance has been created
// instance.defaults.headers.common["Authorization"] = AUTH_TOKEN;

// set token on request headers
request.interceptors.request.use((config) => {
    // Use only localStorage token
    const token = getAccessToken();
    if (token) {
        return {
            ...config,
            headers: {
                ...config.headers,
                Authorization: `Bearer ${token}`,
            },
        };

    }
    else {
        return {
            ...config,
            headers: {
                ...config.headers,
            },
        };
    }
});

// handle 401 and logout
request.interceptors.response.use(
    (response) => response,
    async (err) => {
        if (err.response?.status === 401) {
            // Call logout API and clear data
            try {
                await logout();
            } catch (logoutError) {
                console.error("Logout on 401 failed:", logoutError);
                // Force redirect even if logout fails
                window.location.href = "/login";
            }
        }
        throw err;
    },
);

export default request;

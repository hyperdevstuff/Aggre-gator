import { createAuthClient } from "better-auth/react";

const AUTH_BASE_URL = import.meta.env.VITE_API_URL;

export const authClient = createAuthClient({
    // Empty/undefined falls back to better-auth's own default: the current
    // origin. The single-process deployment serves the API on that origin.
    baseURL: AUTH_BASE_URL || undefined,
    cookie: true,
});

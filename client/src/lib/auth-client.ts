import { createAuthClient } from "better-auth/react";

const AUTH_BASE_URL = import.meta.env.VITE_API_URL;

export const authClient = createAuthClient({
    baseURL: AUTH_BASE_URL,
    cookie: true,
});

// Server-side configuration. Never import this from client components.
import "server-only";

export const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");
export const API_BASE = `${API_URL}/api/v1`;

export const SESSION_COOKIE = "bm_session";
export const SESSION_COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE === "true";

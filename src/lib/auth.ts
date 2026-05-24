import { cookies } from "next/headers";
import { env } from "./env";

const COOKIE_NAME = "pd_admin";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

async function sessionToken(): Promise<string> {
	const { ADMIN_PASSWORD, SESSION_SECRET } = env();
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(SESSION_SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(ADMIN_PASSWORD));
	return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyLogin(password: string): Promise<boolean> {
	const expected = env().ADMIN_PASSWORD;
	if (!expected) return false;
	if (password.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < password.length; i++) diff |= password.charCodeAt(i) ^ expected.charCodeAt(i);
	return diff === 0;
}

export async function setSession(): Promise<void> {
	const token = await sessionToken();
	const store = await cookies();
	store.set(COOKIE_NAME, token, {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge: COOKIE_MAX_AGE_SECONDS,
	});
}

export async function clearSession(): Promise<void> {
	const store = await cookies();
	store.delete(COOKIE_NAME);
}

export async function isAdmin(): Promise<boolean> {
	const store = await cookies();
	const cookie = store.get(COOKIE_NAME);
	if (!cookie) return false;
	const expected = await sessionToken();
	if (cookie.value.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < cookie.value.length; i++) diff |= cookie.value.charCodeAt(i) ^ expected.charCodeAt(i);
	return diff === 0;
}

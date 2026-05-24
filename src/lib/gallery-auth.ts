import { cookies } from "next/headers";
import { env } from "./env";

const COOKIE_NAME = "pd_unlocked";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// Cookie value is a comma-separated list of HMAC(SESSION_SECRET, slug + ":" + password_hash)
// One token per unlocked gallery. Tokens are tied to the current password_hash, so changing
// the gallery password invalidates them.

async function token(slug: string, password_hash: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(env().SESSION_SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${slug}:${password_hash}`));
	return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function isGalleryUnlocked(slug: string, password_hash: string | null): Promise<boolean> {
	if (!password_hash) return true; // No password set → open access
	const store = await cookies();
	const cookie = store.get(COOKIE_NAME);
	if (!cookie) return false;
	const expected = await token(slug, password_hash);
	const tokens = cookie.value.split(",");
	return tokens.some((t) => constantTimeEqual(t, expected));
}

export async function unlockGallery(slug: string, password_hash: string): Promise<void> {
	const t = await token(slug, password_hash);
	const store = await cookies();
	const existing = store.get(COOKIE_NAME);
	const tokens = existing ? existing.value.split(",").filter(Boolean) : [];
	if (!tokens.includes(t)) tokens.push(t);
	// Cap at a reasonable number to avoid bloat.
	const trimmed = tokens.slice(-20);
	store.set(COOKIE_NAME, trimmed.join(","), {
		httpOnly: true,
		secure: true,
		sameSite: "lax",
		path: "/",
		maxAge: COOKIE_MAX_AGE_SECONDS,
	});
}

function constantTimeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}

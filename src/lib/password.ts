// PBKDF2 password hashing for gallery passwords using Web Crypto.
// Output format: hex string for both salt and hash.

const ITERATIONS = 100_000;
const HASH_BITS = 256;
const SALT_BYTES = 16;

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string): Uint8Array {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return out;
}

async function deriveHash(password: string, salt: Uint8Array): Promise<string> {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password) as BufferSource,
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
		keyMaterial,
		HASH_BITS,
	);
	return bytesToHex(new Uint8Array(bits));
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const hash = await deriveHash(password, salt);
	return { hash, salt: bytesToHex(salt) };
}

export async function verifyPassword(password: string, hash: string, saltHex: string): Promise<boolean> {
	const candidate = await deriveHash(password, hexToBytes(saltHex));
	// constant-time-ish compare
	if (candidate.length !== hash.length) return false;
	let diff = 0;
	for (let i = 0; i < candidate.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
	return diff === 0;
}

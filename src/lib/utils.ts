// Lowercase + digits, no ambiguous chars (no 0/o/1/l)
const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

// Reserved at the root of the URL — must not be assignable to a gallery.
// Match against route segments under src/app/ plus future-safe additions.
const RESERVED_SLUGS = new Set([
	"admin",
	"api",
	"img",
	"login",
	"logout",
	"signin",
	"signout",
	"signup",
	"dashboard",
	"settings",
	"account",
	"favicon",
	"robots",
	"sitemap",
	"about",
	"contact",
	"home",
	"index",
	"public",
	"static",
	"_next",
	"unlock",
]);

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function generateSlug(length = 10): string {
	const bytes = crypto.getRandomValues(new Uint8Array(length));
	let out = "";
	for (let i = 0; i < length; i++) {
		out += SLUG_ALPHABET[bytes[i] % SLUG_ALPHABET.length];
	}
	return out;
}

export function slugify(input: string): string {
	return input
		.toLowerCase()
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 64)
		.replace(/-+$/, "");
}

export function isReservedSlug(slug: string): boolean {
	return RESERVED_SLUGS.has(slug);
}

export function isValidSlug(slug: string): boolean {
	return SLUG_REGEX.test(slug) && !isReservedSlug(slug);
}

export function suggestSlug(clientName: string, venue: string | null, shootDate: string): string {
	// shootDate is YYYY-MM-DD; surface as M-D (no leading zero, no year — keeps URLs short)
	const [, m, d] = shootDate.split("-");
	const datePart = m && d ? `${Number(m)}-${Number(d)}` : "";
	const parts = [clientName, venue ?? "", datePart].filter(Boolean).join(" ");
	return slugify(parts);
}

export function nowSeconds(): number {
	return Math.floor(Date.now() / 1000);
}

export function formatMoney(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

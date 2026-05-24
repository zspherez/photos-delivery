/**
 * Site-wide configuration for this deployment.
 *
 * Edit this file (and `src/config/rates.ts`) when forking the repo for your own
 * photography business. Everything in this file is non-secret — secrets live in
 * `.dev.vars` (local) or `wrangler secret put` (production).
 */

export const SITE = {
	/** Short brand name shown in headers, login page, OG images, etc. */
	brandName: "Rehders Photos",

	/** Public hostname where galleries live. Used in OG metadata, slug input prefix, R2 CORS. */
	domain: "galleries.rehders.photos",

	/** Public marketing site (linked from gallery footers). */
	marketingUrl: "https://rehders.photos",

	/** Legal business name shown on invoices. */
	businessName: "Josh Rehders DBA Rehders Photos",

	/** Business address shown on invoices. Each entry is one line. */
	businessAddressLines: ["240 E 47th Street", "Apt 8F", "New York, NY, 10017"],

	/** Default invoice payment terms label (shown on PDF). */
	paymentTerms: "NET30",

	/** Default invoice due-date offset from issued date, in days. */
	paymentTermsDays: 30,
};

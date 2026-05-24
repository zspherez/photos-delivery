// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RATE CARD — edit this when forking the repo for your business.
//  Defines available packages, their standard-set/hourly/day/double-day
//  rates, and travel-day pricing. All money values are in CENTS.
//  See src/config/site.ts for non-rate config (brand name, domain, etc.).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const PACKAGES = {
	"Photo": {
		standard_cents: 20000,
		hourly_cents: 7500,
		day_cents: 50000,
		double_day_cents: 100000,
	},
	"Photo & Live Video Clips": {
		standard_cents: 40000,
		hourly_cents: 10000,
		day_cents: 80000,
		double_day_cents: 160000,
	},
} as const;

export const PACKAGE_TYPES = Object.keys(PACKAGES) as PackageType[];

export type PackageType = keyof typeof PACKAGES;

export const TRAVEL_DAY_CENTS = 25000;

export type RateTier = "standard" | "hourly" | "day" | "double_day" | "override";

export type RateBreakdown = {
	package_type: PackageType;
	hours_shot: number;
	travel_days: number;
	base_cents: number;
	base_label: string;
	travel_cents: number;
	total_cents: number;
	is_override: boolean;
	tier: RateTier;
	standard_cents: number;
	additional_hours: number;
	hourly_rate_cents: number;
};

export type InvoiceLineItem = {
	description: string;
	quantity: number;
	rate_cents: number;
};

export function calculateRate(
	packageType: PackageType,
	hoursShot: number,
	travelDays: number,
	overrideCents: number | null = null,
): RateBreakdown {
	const rates = PACKAGES[packageType];
	let base_cents: number;
	let base_label: string;
	let tier: RateTier;
	let additional_hours = 0;

	if (overrideCents != null) {
		base_cents = overrideCents;
		base_label = "Custom rate";
		tier = "override";
	} else if (hoursShot <= 2) {
		base_cents = rates.standard_cents;
		base_label = "Standard set (2 hours or less)";
		tier = "standard";
	} else if (hoursShot < 6) {
		// Any portion of an hour beyond 2 counts as a full hour.
		additional_hours = Math.ceil(hoursShot - 2);
		base_cents = rates.standard_cents + additional_hours * rates.hourly_cents;
		base_label = `Standard set + ${additional_hours} additional hour${additional_hours > 1 ? "s" : ""}`;
		tier = "hourly";
	} else if (hoursShot < 16) {
		base_cents = rates.day_cents;
		base_label = "Day rate (6–16 hours)";
		tier = "day";
	} else {
		base_cents = rates.double_day_cents;
		base_label = "Double day rate (16+ hours)";
		tier = "double_day";
	}

	const travel_cents = travelDays * TRAVEL_DAY_CENTS;

	return {
		package_type: packageType,
		hours_shot: hoursShot,
		travel_days: travelDays,
		base_cents,
		base_label,
		travel_cents,
		total_cents: base_cents + travel_cents,
		is_override: overrideCents != null,
		tier,
		standard_cents: rates.standard_cents,
		additional_hours,
		hourly_rate_cents: rates.hourly_cents,
	};
}

function formatShootDate(iso: string): string {
	// "2026-05-16" -> "05/16/2026"
	const [y, m, d] = iso.split("-");
	return `${m}/${d}/${y}`;
}

export function buildInvoiceLineItems(
	rate: RateBreakdown,
	clientName: string,
	venue: string | null,
	shootDateIso: string,
): InvoiceLineItem[] {
	const venuePart = venue ? ` @ ${venue}` : "";
	const dateStr = formatShootDate(shootDateIso);
	const baseDescription = `${rate.package_type} - ${clientName}${venuePart} ${dateStr}`;

	const items: InvoiceLineItem[] = [];

	if (rate.tier === "hourly") {
		// Split standard set from the per-hour overage so the invoice line items show the breakdown.
		items.push({
			description: baseDescription,
			quantity: 1,
			rate_cents: rate.standard_cents,
		});
		items.push({
			description: "Additional hours",
			quantity: rate.additional_hours,
			rate_cents: rate.hourly_rate_cents,
		});
	} else if (rate.tier === "day") {
		items.push({
			description: `${baseDescription} (Day rate)`,
			quantity: 1,
			rate_cents: rate.base_cents,
		});
	} else if (rate.tier === "double_day") {
		items.push({
			description: `${baseDescription} (Double day rate)`,
			quantity: 1,
			rate_cents: rate.base_cents,
		});
	} else {
		// standard or override
		items.push({
			description: baseDescription,
			quantity: 1,
			rate_cents: rate.base_cents,
		});
	}

	if (rate.travel_days > 0) {
		items.push({
			description: `Travel${rate.travel_days > 1 ? ` (${rate.travel_days} days)` : ""}`,
			quantity: rate.travel_days,
			rate_cents: TRAVEL_DAY_CENTS,
		});
	}

	return items;
}

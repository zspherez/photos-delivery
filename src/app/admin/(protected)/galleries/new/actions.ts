"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { PACKAGE_TYPES, type PackageType } from "@/lib/rates";
import { isValidSlug, nowSeconds, suggestSlug } from "@/lib/utils";

async function findUniqueSlug(base: string): Promise<string> {
	const taken = async (s: string) => {
		const row = await db().prepare("SELECT id FROM galleries WHERE slug = ?").bind(s).first();
		return !!row;
	};
	if (!(await taken(base))) return base;
	for (let i = 2; i < 100; i++) {
		const candidate = `${base}-${i}`;
		if (!(await taken(candidate))) return candidate;
	}
	throw new Error("could not find unique slug");
}

async function createInlineClientIfPresent(formData: FormData): Promise<number | null> {
	const name = String(formData.get("new_client_name") ?? "").trim();
	if (!name) return null;
	const email = String(formData.get("new_client_email") ?? "").trim() || null;
	const phone = String(formData.get("new_client_phone") ?? "").trim() || null;
	const billing_address = String(formData.get("new_client_billing_address") ?? "").trim() || null;
	const now = nowSeconds();
	const result = await db()
		.prepare(
			`INSERT INTO clients (name, email, phone, billing_address, default_hourly_rate_cents, created_at, updated_at)
			VALUES (?, ?, ?, ?, NULL, ?, ?) RETURNING id`,
		)
		.bind(name, email, phone, billing_address, now, now)
		.first<{ id: number }>();
	return result?.id ?? null;
}

export async function createGallery(formData: FormData) {
	const inlineClientId = await createInlineClientIfPresent(formData);
	const client_id = inlineClientId ?? Number(formData.get("client_id"));
	const shoot_date = String(formData.get("shoot_date") ?? "").trim();
	const venue = String(formData.get("venue") ?? "").trim() || null;
	const package_type = String(formData.get("package_type") ?? "").trim() as PackageType;
	const hoursRaw = String(formData.get("hours_shot") ?? "").trim();
	const hours_shot = hoursRaw ? Number(hoursRaw) : null;
	const travel_days = Math.max(0, Math.floor(Number(formData.get("travel_days") ?? 0)));
	const overrideRaw = String(formData.get("rate_override") ?? "").trim();
	const rate_override_cents = overrideRaw ? Math.round(Number(overrideRaw) * 100) : null;
	const password = String(formData.get("password") ?? "").trim();
	const notes = String(formData.get("notes") ?? "").trim() || null;
	const slugInput = String(formData.get("slug") ?? "").trim().toLowerCase();

	if (
		!client_id ||
		!shoot_date ||
		!PACKAGE_TYPES.includes(package_type) ||
		hours_shot == null ||
		hours_shot < 0
	) {
		redirect("/admin/galleries/new?error=required");
	}

	const client = await db()
		.prepare("SELECT name FROM clients WHERE id = ?")
		.bind(client_id)
		.first<{ name: string }>();
	if (!client) redirect("/admin/galleries/new?error=client");

	let slug: string;
	if (slugInput) {
		if (!isValidSlug(slugInput)) redirect("/admin/galleries/new?error=slug_invalid");
		const existing = await db().prepare("SELECT id FROM galleries WHERE slug = ?").bind(slugInput).first();
		if (existing) redirect("/admin/galleries/new?error=slug_taken");
		slug = slugInput;
	} else {
		const base = suggestSlug(client.name, venue, shoot_date) || "gallery";
		slug = await findUniqueSlug(isValidSlug(base) ? base : "gallery");
	}

	let password_hash: string | null = null;
	let password_salt: string | null = null;
	if (password) {
		const { hash, salt } = await hashPassword(password);
		password_hash = hash;
		password_salt = salt;
	}

	const now = nowSeconds();
	const result = await db()
		.prepare(
			`INSERT INTO galleries (slug, client_id, shoot_date, venue, package_type, hours_shot, travel_days, rate_override_cents, password_hash, password_salt, notes, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			RETURNING id`,
		)
		.bind(
			slug,
			client_id,
			shoot_date,
			venue,
			package_type,
			hours_shot,
			travel_days,
			rate_override_cents,
			password_hash,
			password_salt,
			notes,
			now,
			now,
		)
		.first<{ id: number }>();

	redirect(`/admin/galleries/${result?.id}`);
}

"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/env";
import { nowSeconds } from "@/lib/utils";

export async function createClient(formData: FormData) {
	const name = String(formData.get("name") ?? "").trim();
	const email = String(formData.get("email") ?? "").trim() || null;
	const phone = String(formData.get("phone") ?? "").trim() || null;
	const billing_address = String(formData.get("billing_address") ?? "").trim() || null;
	const rateRaw = String(formData.get("default_hourly_rate") ?? "").trim();
	const default_hourly_rate_cents = rateRaw ? Math.round(Number(rateRaw) * 100) : null;

	if (!name) redirect("/admin/clients/new?error=name");

	const now = nowSeconds();
	await db()
		.prepare(
			`INSERT INTO clients (name, email, phone, billing_address, default_hourly_rate_cents, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(name, email, phone, billing_address, default_hourly_rate_cents, now, now)
		.run();

	redirect("/admin/clients");
}

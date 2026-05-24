"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/env";
import { nowSeconds } from "@/lib/utils";

export async function updateClient(id: number, formData: FormData) {
	if (!(await isAdmin())) throw new Error("unauthorized");
	const name = String(formData.get("name") ?? "").trim();
	const email = String(formData.get("email") ?? "").trim() || null;
	const phone = String(formData.get("phone") ?? "").trim() || null;
	const billing_address = String(formData.get("billing_address") ?? "").trim() || null;
	const rateRaw = String(formData.get("default_hourly_rate") ?? "").trim();
	const default_hourly_rate_cents = rateRaw ? Math.round(Number(rateRaw) * 100) : null;

	if (!name) redirect(`/admin/clients/${id}?error=name`);

	await db()
		.prepare(
			`UPDATE clients
			SET name = ?, email = ?, phone = ?, billing_address = ?, default_hourly_rate_cents = ?, updated_at = ?
			WHERE id = ?`,
		)
		.bind(name, email, phone, billing_address, default_hourly_rate_cents, nowSeconds(), id)
		.run();

	revalidatePath("/admin/clients");
	revalidatePath(`/admin/clients/${id}`);
	redirect("/admin/clients");
}

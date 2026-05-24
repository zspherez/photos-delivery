"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { buildInvoiceLineItems, calculateRate, PACKAGE_TYPES, type PackageType } from "@/lib/rates";
import { isValidSlug, nowSeconds } from "@/lib/utils";

export async function updateGallery(galleryId: number, formData: FormData) {
	if (!(await isAdmin())) throw new Error("unauthorized");

	const client_id = Number(formData.get("client_id"));
	const shoot_date = String(formData.get("shoot_date") ?? "").trim();
	const venue = String(formData.get("venue") ?? "").trim() || null;
	const package_type = String(formData.get("package_type") ?? "").trim() as PackageType;
	const hoursRaw = String(formData.get("hours_shot") ?? "").trim();
	const hours_shot = hoursRaw ? Number(hoursRaw) : null;
	const travel_days = Math.max(0, Math.floor(Number(formData.get("travel_days") ?? 0)));
	const overrideRaw = String(formData.get("rate_override") ?? "").trim();
	const rate_override_cents = overrideRaw ? Math.round(Number(overrideRaw) * 100) : null;
	const passwordInput = String(formData.get("password") ?? "").trim();
	const clearPassword = formData.get("clear_password") === "on";
	const notes = String(formData.get("notes") ?? "").trim() || null;
	const slugInput = String(formData.get("slug") ?? "").trim().toLowerCase();

	if (
		!client_id ||
		!shoot_date ||
		!PACKAGE_TYPES.includes(package_type) ||
		hours_shot == null ||
		hours_shot < 0 ||
		!slugInput
	) {
		redirect(`/admin/galleries/${galleryId}/edit?error=required`);
	}

	if (!isValidSlug(slugInput)) {
		redirect(`/admin/galleries/${galleryId}/edit?error=slug_invalid`);
	}

	// Ensure slug uniqueness (excluding this gallery).
	const conflict = await db()
		.prepare("SELECT id FROM galleries WHERE slug = ? AND id != ?")
		.bind(slugInput, galleryId)
		.first();
	if (conflict) redirect(`/admin/galleries/${galleryId}/edit?error=slug_taken`);

	// Password handling: blank input = keep existing; "clear_password" = null; otherwise hash new.
	let password_hash: string | null | undefined = undefined;
	let password_salt: string | null | undefined = undefined;
	if (clearPassword) {
		password_hash = null;
		password_salt = null;
	} else if (passwordInput) {
		const { hash, salt } = await hashPassword(passwordInput);
		password_hash = hash;
		password_salt = salt;
	}

	const now = nowSeconds();
	if (password_hash !== undefined) {
		await db()
			.prepare(
				`UPDATE galleries
				SET slug = ?, client_id = ?, shoot_date = ?, venue = ?, package_type = ?, hours_shot = ?,
					travel_days = ?, rate_override_cents = ?, password_hash = ?, password_salt = ?,
					notes = ?, updated_at = ?
				WHERE id = ?`,
			)
			.bind(
				slugInput,
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
				galleryId,
			)
			.run();
	} else {
		await db()
			.prepare(
				`UPDATE galleries
				SET slug = ?, client_id = ?, shoot_date = ?, venue = ?, package_type = ?, hours_shot = ?,
					travel_days = ?, rate_override_cents = ?, notes = ?, updated_at = ?
				WHERE id = ?`,
			)
			.bind(
				slugInput,
				client_id,
				shoot_date,
				venue,
				package_type,
				hours_shot,
				travel_days,
				rate_override_cents,
				notes,
				now,
				galleryId,
			)
			.run();
	}

	// If there's a non-paid invoice on this gallery, refresh its line items from the new rate card.
	// Only paid invoices stay locked (money already changed hands).
	const existingInvoice = await db()
		.prepare("SELECT id, status FROM invoices WHERE gallery_id = ? ORDER BY id DESC LIMIT 1")
		.bind(galleryId)
		.first<{ id: number; status: string }>();
	if (existingInvoice && existingInvoice.status !== "paid") {
		const client = await db()
			.prepare("SELECT name FROM clients WHERE id = ?")
			.bind(client_id)
			.first<{ name: string }>();
		if (client) {
			const newRate = calculateRate(package_type, hours_shot, travel_days, rate_override_cents);
			const newLineItems = buildInvoiceLineItems(newRate, client.name, venue, shoot_date);
			const newTotal = newLineItems.reduce((s, li) => s + li.quantity * li.rate_cents, 0);
			await db()
				.prepare(
					`UPDATE invoices SET amount_cents = ?, line_items_json = ?, updated_at = ? WHERE id = ?`,
				)
				.bind(newTotal, JSON.stringify(newLineItems), now, existingInvoice.id)
				.run();
		}
	}

	revalidatePath("/admin/galleries");
	revalidatePath(`/admin/galleries/${galleryId}`);
	redirect(`/admin/galleries/${galleryId}`);
}

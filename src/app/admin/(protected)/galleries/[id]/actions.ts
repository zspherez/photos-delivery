"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { SITE } from "@/config/site";
import { isAdmin } from "@/lib/auth";
import { db, env } from "@/lib/env";
import { buildInvoicePreview, renderInvoicePdf } from "@/lib/invoice";
import { deleteObject } from "@/lib/r2";
import { nowSeconds } from "@/lib/utils";

type AssetRow = {
	id: number;
	gallery_id: number;
	original_key: string;
	slug: string;
};

async function deleteOne(row: AssetRow) {
	await deleteObject(row.original_key);
	await Promise.allSettled([
		deleteObject(`g/${row.slug}/v/${row.id}-thumb.webp`),
		deleteObject(`g/${row.slug}/v/${row.id}-web.webp`),
	]);
	await db().prepare("DELETE FROM assets WHERE id = ?").bind(row.id).run();
}

export async function deleteAssets(assetIds: number[]): Promise<void> {
	if (!(await isAdmin())) throw new Error("unauthorized");
	if (assetIds.length === 0) return;

	const placeholders = assetIds.map(() => "?").join(",");
	const { results: rows } = await db()
		.prepare(
			`SELECT a.id, a.gallery_id, a.original_key, g.slug
			FROM assets a JOIN galleries g ON g.id = a.gallery_id
			WHERE a.id IN (${placeholders})`,
		)
		.bind(...assetIds)
		.all<AssetRow>();

	await Promise.all(rows.map((row) => deleteOne(row)));

	const galleryIds = new Set(rows.map((r) => r.gallery_id));
	for (const gid of galleryIds) revalidatePath(`/admin/galleries/${gid}`);
}

function toBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunkSize = 0x8000;
	for (let i = 0; i < bytes.length; i += chunkSize) {
		binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
	}
	return btoa(binary);
}

export async function sendInvoice(galleryId: number): Promise<{ ok: boolean; error?: string }> {
	if (!(await isAdmin())) throw new Error("unauthorized");
	const preview = await buildInvoicePreview(galleryId);
	if (!preview) return { ok: false, error: "Gallery not found." };
	if (!preview.client.email) return { ok: false, error: "Client has no email on file." };

	const hdrs = await headers();
	const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
	const proto = hdrs.get("x-forwarded-proto") ?? "http";
	const origin = `${proto}://${host}`;

	const pdfBytes = await renderInvoicePdf(preview, origin);
	const pdfBase64 = toBase64(pdfBytes);
	const filename = `Invoice ${preview.invoice_number}.pdf`;

	const { RESEND_API_KEY, INVOICE_FROM_EMAIL } = env();
	if (!RESEND_API_KEY || !INVOICE_FROM_EMAIL) {
		return { ok: false, error: "Resend not configured." };
	}

	const subject = `Invoice ${preview.invoice_number} from ${SITE.brandName}`;
	const html = `<p>Hi ${escapeHtml(preview.client.name)},</p>
<p>Thanks for the shoot. Your invoice for <strong>${escapeHtml(preview.gallery.package_type)}${
		preview.gallery.venue ? ` @ ${escapeHtml(preview.gallery.venue)}` : ""
	}</strong> on ${escapeHtml(preview.gallery.shoot_date)} is attached.</p>
<p>Total due: <strong>$${(preview.total_cents / 100).toFixed(2)}</strong>, payable within ${escapeHtml(
		preview.payment_terms,
	)}.</p>
<p>— Josh</p>`;

	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			from: INVOICE_FROM_EMAIL,
			to: [preview.client.email],
			subject,
			html,
			attachments: [{ filename, content: pdfBase64 }],
		}),
	});
	if (!res.ok) {
		const text = await res.text();
		return { ok: false, error: `Resend error: ${res.status} ${text.slice(0, 200)}` };
	}

	// Persist the invoice row (create if missing, mark as sent).
	const now = nowSeconds();
	const lineItemsJson = JSON.stringify(preview.line_items);
	if (preview.existing_invoice_id) {
		await db()
			.prepare(
				`UPDATE invoices SET status = 'sent', sent_at = ?, updated_at = ?, amount_cents = ?, line_items_json = ?
				WHERE id = ?`,
			)
			.bind(now, now, preview.total_cents, lineItemsJson, preview.existing_invoice_id)
			.run();
	} else {
		await db()
			.prepare(
				`INSERT INTO invoices (invoice_number, gallery_id, client_id, status, amount_cents, line_items_json,
					issued_date, due_date, payment_terms, sent_at, created_at, updated_at)
				VALUES (?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				preview.invoice_number,
				preview.gallery.id,
				preview.client.id,
				preview.total_cents,
				lineItemsJson,
				preview.issued_date,
				preview.due_date,
				preview.payment_terms,
				now,
				now,
				now,
			)
			.run();
	}

	revalidatePath(`/admin/galleries/${galleryId}`);
	return { ok: true };
}

export async function setCoverPhoto(galleryId: number, assetId: number | null): Promise<void> {
	if (!(await isAdmin())) throw new Error("unauthorized");
	await db()
		.prepare("UPDATE galleries SET cover_asset_id = ?, updated_at = ? WHERE id = ?")
		.bind(assetId, nowSeconds(), galleryId)
		.run();
	revalidatePath(`/admin/galleries/${galleryId}`);
	revalidatePath("/admin/galleries");
}

export async function markInvoicePaid(galleryId: number): Promise<void> {
	if (!(await isAdmin())) throw new Error("unauthorized");
	const now = nowSeconds();
	await db()
		.prepare("UPDATE invoices SET status = 'paid', paid_at = ?, updated_at = ? WHERE gallery_id = ?")
		.bind(now, now, galleryId)
		.run();
	revalidatePath(`/admin/galleries/${galleryId}`);
}

export async function markInvoiceSent(galleryId: number): Promise<void> {
	if (!(await isAdmin())) throw new Error("unauthorized");
	const preview = await buildInvoicePreview(galleryId);
	if (!preview) throw new Error("gallery not found");

	const now = nowSeconds();
	if (preview.existing_invoice_id) {
		await db()
			.prepare("UPDATE invoices SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?")
			.bind(now, now, preview.existing_invoice_id)
			.run();
	} else {
		await db()
			.prepare(
				`INSERT INTO invoices (invoice_number, gallery_id, client_id, status, amount_cents, line_items_json,
					issued_date, due_date, payment_terms, sent_at, created_at, updated_at)
				VALUES (?, ?, ?, 'sent', ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				preview.invoice_number,
				preview.gallery.id,
				preview.client.id,
				preview.total_cents,
				JSON.stringify(preview.line_items),
				preview.issued_date,
				preview.due_date,
				preview.payment_terms,
				now,
				now,
				now,
			)
			.run();
	}
	revalidatePath(`/admin/galleries/${galleryId}`);
}

export type InvoiceLineItemInput = { description: string; quantity: number; rate_cents: number };

export async function saveInvoice(
	galleryId: number,
	input: {
		issued_date: string;
		due_date: string;
		payment_terms: string;
		line_items: InvoiceLineItemInput[];
	},
): Promise<void> {
	if (!(await isAdmin())) throw new Error("unauthorized");
	const preview = await buildInvoicePreview(galleryId);
	if (!preview) throw new Error("gallery not found");

	const cleaned = input.line_items
		.map((li) => ({
			description: String(li.description ?? "").trim(),
			quantity: Math.max(0, Number(li.quantity) || 0),
			rate_cents: Math.max(0, Math.round(Number(li.rate_cents) || 0)),
		}))
		.filter((li) => li.description && li.quantity > 0);
	if (cleaned.length === 0) throw new Error("at least one line item is required");

	const total = cleaned.reduce((s, li) => s + li.quantity * li.rate_cents, 0);
	const now = nowSeconds();
	const json = JSON.stringify(cleaned);

	if (preview.existing_invoice_id) {
		await db()
			.prepare(
				`UPDATE invoices
				SET issued_date = ?, due_date = ?, payment_terms = ?, amount_cents = ?, line_items_json = ?, updated_at = ?
				WHERE id = ?`,
			)
			.bind(
				input.issued_date,
				input.due_date,
				input.payment_terms,
				total,
				json,
				now,
				preview.existing_invoice_id,
			)
			.run();
	} else {
		await db()
			.prepare(
				`INSERT INTO invoices (invoice_number, gallery_id, client_id, status, amount_cents, line_items_json,
					issued_date, due_date, payment_terms, created_at, updated_at)
				VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?)`,
			)
			.bind(
				preview.invoice_number,
				preview.gallery.id,
				preview.client.id,
				total,
				json,
				input.issued_date,
				input.due_date,
				input.payment_terms,
				now,
				now,
			)
			.run();
	}

	revalidatePath(`/admin/galleries/${galleryId}`);
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

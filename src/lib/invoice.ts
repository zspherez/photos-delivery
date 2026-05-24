import { db, env } from "./env";
import { generateInvoicePdf } from "./invoice-pdf";
import { buildInvoiceLineItems, calculateRate, type PackageType } from "./rates";
import type { Client, Gallery } from "./types";

export type InvoicePreview = {
	gallery: Gallery & { client_name: string };
	client: Client;
	invoice_number: string;
	issued_date: string;
	due_date: string;
	payment_terms: string;
	line_items: ReturnType<typeof buildInvoiceLineItems>;
	total_cents: number;
	existing_invoice_id: number | null;
	existing_invoice_status: string | null;
	existing_invoice_sent_at: number | null;
};

import { SITE } from "./../config/site";

function addDays(iso: string, days: number): string {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

async function nextInvoiceNumber(shootDate: string): Promise<string> {
	const ymd = shootDate.replace(/-/g, "");
	const existing = await db()
		.prepare("SELECT COUNT(*) AS c FROM invoices WHERE invoice_number LIKE ?")
		.bind(`${ymd}-%`)
		.first<{ c: number }>();
	const seq = (existing?.c ?? 0) + 1;
	return `${ymd}-${seq}`;
}

export async function buildInvoicePreview(galleryId: number): Promise<InvoicePreview | null> {
	const gallery = await db()
		.prepare(
			`SELECT g.*, c.name AS client_name
			FROM galleries g JOIN clients c ON c.id = g.client_id
			WHERE g.id = ?`,
		)
		.bind(galleryId)
		.first<Gallery & { client_name: string }>();
	if (!gallery) return null;

	const client = await db()
		.prepare("SELECT * FROM clients WHERE id = ?")
		.bind(gallery.client_id)
		.first<Client>();
	if (!client) return null;

	const rate = calculateRate(
		gallery.package_type as PackageType,
		gallery.hours_shot ?? 0,
		gallery.travel_days,
		gallery.rate_override_cents,
	);
	const line_items = buildInvoiceLineItems(rate, client.name, gallery.venue, gallery.shoot_date);
	const total_cents = line_items.reduce((sum, li) => sum + li.quantity * li.rate_cents, 0);

	// If an invoice already exists for this gallery, reuse its number + dates + edited line items.
	const existing = await db()
		.prepare(
			"SELECT id, invoice_number, status, issued_date, due_date, payment_terms, sent_at, line_items_json, amount_cents FROM invoices WHERE gallery_id = ? ORDER BY id DESC LIMIT 1",
		)
		.bind(galleryId)
		.first<{
			id: number;
			invoice_number: string;
			status: string;
			issued_date: string;
			due_date: string;
			payment_terms: string;
			sent_at: number | null;
			line_items_json: string;
			amount_cents: number;
		}>();

	if (existing) {
		let stored_line_items = line_items;
		let stored_total = total_cents;
		try {
			const parsed = JSON.parse(existing.line_items_json);
			if (Array.isArray(parsed) && parsed.length > 0) {
				stored_line_items = parsed;
				stored_total = parsed.reduce((s, li) => s + li.quantity * li.rate_cents, 0);
			}
		} catch {
			// fall back to computed items
		}
		return {
			gallery,
			client,
			invoice_number: existing.invoice_number,
			issued_date: existing.issued_date,
			due_date: existing.due_date,
			payment_terms: existing.payment_terms,
			line_items: stored_line_items,
			total_cents: stored_total,
			existing_invoice_id: existing.id,
			existing_invoice_status: existing.status,
			existing_invoice_sent_at: existing.sent_at,
		};
	}

	const invoice_number = await nextInvoiceNumber(gallery.shoot_date);
	const issued_date = gallery.shoot_date;
	const due_date = addDays(gallery.shoot_date, SITE.paymentTermsDays);
	return {
		gallery,
		client,
		invoice_number,
		issued_date,
		due_date,
		payment_terms: SITE.paymentTerms,
		line_items,
		total_cents,
		existing_invoice_id: null,
		existing_invoice_status: null,
		existing_invoice_sent_at: null,
	};
}

export async function renderInvoicePdf(preview: InvoicePreview, origin: string): Promise<Uint8Array> {
	const {
		BANK_ACCOUNT_NUMBER,
		BANK_ROUTING_NUMBER,
		BANK_NAME,
		BANK_ACCOUNT_TYPE,
		VENMO_PHONE,
	} = env();

	let logo_png: Uint8Array | undefined;
	try {
		const res = await fetch(`${origin}/logo.png`);
		if (res.ok) logo_png = new Uint8Array(await res.arrayBuffer());
	} catch {
		// logo is optional
	}

	return generateInvoicePdf({
		invoice_number: preview.invoice_number,
		bill_to_name: preview.client.name,
		bill_to_address: preview.client.billing_address,
		issued_date: preview.issued_date,
		due_date: preview.due_date,
		payment_terms: preview.payment_terms,
		line_items: preview.line_items,
		total_cents: preview.total_cents,
		bank: {
			account_number: BANK_ACCOUNT_NUMBER ?? "",
			routing_number: BANK_ROUTING_NUMBER ?? "",
			bank_name: BANK_NAME ?? "",
			account_type: BANK_ACCOUNT_TYPE ?? "",
			venmo_phone: VENMO_PHONE ?? "",
		},
		logo_png,
	});
}

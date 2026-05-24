import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { InvoiceLineItem } from "./rates";

export type InvoicePdfInput = {
	invoice_number: string;
	bill_to_name: string;
	bill_to_address?: string | null;
	issued_date: string; // YYYY-MM-DD
	due_date: string; // YYYY-MM-DD
	payment_terms: string;
	line_items: InvoiceLineItem[];
	total_cents: number;
	bank: {
		account_number: string;
		routing_number: string;
		bank_name: string;
		account_type: string;
		venmo_phone: string;
	};
	logo_png?: Uint8Array;
};

import { SITE } from "@/config/site";

const BUSINESS_NAME = SITE.businessName;
const BUSINESS_ADDRESS = SITE.businessAddressLines;

// Colors
const TEXT = rgb(0.18, 0.18, 0.2);
const MUTED = rgb(0.45, 0.45, 0.48);
const ACCENT = rgb(0.647, 0.647, 0.878); // #a5a5e0
const HEADER_BG = rgb(0.93, 0.93, 0.96);
const TABLE_HEADER_BG = rgb(0.2, 0.2, 0.23);
const LIGHT_BORDER = rgb(0.88, 0.88, 0.9);

function formatDate(iso: string): string {
	const [y, m, d] = iso.split("-").map(Number);
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	return `${months[(m ?? 1) - 1]} ${d}, ${y}`;
}

function formatMoney(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

export async function generateInvoicePdf(input: InvoicePdfInput): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	const page = doc.addPage([612, 792]); // US Letter
	const helv = await doc.embedFont(StandardFonts.Helvetica);
	const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);

	const W = 612;
	const margin = 50;

	function text(s: string, x: number, y: number, opts: { size?: number; font?: typeof helv; color?: typeof TEXT; align?: "left" | "right" } = {}) {
		const size = opts.size ?? 10;
		const font = opts.font ?? helv;
		const color = opts.color ?? TEXT;
		let drawX = x;
		if (opts.align === "right") {
			const w = font.widthOfTextAtSize(s, size);
			drawX = x - w;
		}
		page.drawText(s, { x: drawX, y, size, font, color });
	}

	function drawRoundedRect(opts: {
		x: number;
		y: number;
		width: number;
		height: number;
		radius: number;
		color: typeof TEXT;
	}) {
		const { x, y, width: w, height: h, radius: r, color } = opts;
		// SVG path interpreted with y-down; pdf-lib's drawSvgPath flips y around the supplied origin.
		const path = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
		page.drawSvgPath(path, { x, y: y + h, color });
	}

	function textInBox(s: string, opts: {
		boxX: number;
		boxY: number;
		boxW: number;
		boxH: number;
		size: number;
		font: typeof helv;
		color?: typeof TEXT;
		align?: "left" | "right";
		paddingX?: number;
	}) {
		const color = opts.color ?? TEXT;
		const padX = opts.paddingX ?? 0;
		const w = opts.font.widthOfTextAtSize(s, opts.size);
		const drawX =
			opts.align === "right" ? opts.boxX + opts.boxW - w - padX : opts.boxX + padX;
		// Vertically center: use cap height (no descender) so visual midpoint sits at box center.
		const capH = opts.font.heightAtSize(opts.size, { descender: false });
		const baseline = opts.boxY + (opts.boxH - capH) / 2;
		page.drawText(s, { x: drawX, y: baseline, size: opts.size, font: opts.font, color });
	}

	// ── Header ────────────────────────────────────────────────────
	if (input.logo_png) {
		try {
			const logo = await doc.embedPng(input.logo_png);
			const logoScale = 60 / logo.height;
			page.drawImage(logo, {
				x: margin,
				y: 720,
				width: logo.width * logoScale,
				height: logo.height * logoScale,
			});
		} catch {
			// fall through; logo is optional
		}
	}

	text("INVOICE", W - margin, 745, { size: 26, font: helvBold, align: "right" });
	text(`# ${input.invoice_number}`, W - margin, 728, { size: 10, color: MUTED, align: "right" });

	// ── Business + Bill To (left) ────────────────────────────────
	let leftY = 680;
	text(BUSINESS_NAME, margin, leftY, { size: 11, font: helvBold });
	leftY -= 14;
	for (const line of BUSINESS_ADDRESS) {
		text(line, margin, leftY, { size: 10, color: MUTED });
		leftY -= 13;
	}

	leftY -= 14;
	text("Bill To:", margin, leftY, { size: 9, color: MUTED });
	leftY -= 14;
	text(input.bill_to_name.toUpperCase(), margin, leftY, { size: 12, font: helvBold });
	if (input.bill_to_address) {
		for (const line of input.bill_to_address.split(/\r?\n/).filter((l) => l.trim())) {
			leftY -= 13;
			text(line, margin, leftY, { size: 10, color: MUTED });
		}
	}

	// ── Date / Terms / Due / Balance (right) ──────────────────────
	let rightY = 680;
	const rightLabelX = W - margin - 110;
	const rightValueX = W - margin;
	const fields: [string, string][] = [
		["Date:", formatDate(input.issued_date)],
		["Payment Terms:", input.payment_terms],
		["Due Date:", formatDate(input.due_date)],
	];
	for (const [label, value] of fields) {
		text(label, rightLabelX, rightY, { size: 10, color: MUTED, align: "right" });
		text(value, rightValueX, rightY, { size: 10, font: helvBold, align: "right" });
		rightY -= 16;
	}

	// Balance Due highlight (rounded, with text vertically centered)
	rightY -= 14;
	const balanceBox = {
		x: W - margin - 200,
		y: rightY - 10,
		width: 200,
		height: 32,
	};
	drawRoundedRect({ ...balanceBox, radius: 4, color: HEADER_BG });
	textInBox("Balance Due:", {
		boxX: balanceBox.x,
		boxY: balanceBox.y,
		boxW: balanceBox.width - 110,
		boxH: balanceBox.height,
		size: 10,
		font: helvBold,
		align: "right",
	});
	textInBox(formatMoney(input.total_cents), {
		boxX: balanceBox.x,
		boxY: balanceBox.y,
		boxW: balanceBox.width,
		boxH: balanceBox.height,
		size: 12,
		font: helvBold,
		align: "right",
		paddingX: 8,
	});

	// ── Line items table ─────────────────────────────────────────
	const tableTop = 510;
	const tableW = W - margin * 2;
	drawRoundedRect({
		x: margin,
		y: tableTop,
		width: tableW,
		height: 26,
		radius: 4,
		color: TABLE_HEADER_BG,
	});
	const colItem = margin + 12;
	const colQty = W - margin - 240;
	const colRate = W - margin - 130;
	const colAmount = W - margin - 12;
	const white = rgb(1, 1, 1);
	textInBox("Item", { boxX: margin, boxY: tableTop, boxW: tableW, boxH: 26, size: 10, font: helvBold, color: white, paddingX: 12 });
	textInBox("Quantity", { boxX: margin, boxY: tableTop, boxW: colQty - margin, boxH: 26, size: 10, font: helvBold, color: white, align: "right" });
	textInBox("Rate", { boxX: margin, boxY: tableTop, boxW: colRate - margin, boxH: 26, size: 10, font: helvBold, color: white, align: "right" });
	textInBox("Amount", { boxX: margin, boxY: tableTop, boxW: colAmount - margin, boxH: 26, size: 10, font: helvBold, color: white, align: "right" });

	let rowY = tableTop - 22;
	for (const item of input.line_items) {
		text(item.description, colItem, rowY, { size: 10, font: helvBold });
		text(String(item.quantity), colQty, rowY, { size: 10, align: "right" });
		text(formatMoney(item.rate_cents), colRate, rowY, { size: 10, align: "right" });
		text(formatMoney(item.quantity * item.rate_cents), colAmount, rowY, { size: 10, align: "right" });
		rowY -= 24;
	}

	// Total row
	rowY -= 8;
	page.drawLine({
		start: { x: W - margin - 200, y: rowY + 14 },
		end: { x: W - margin, y: rowY + 14 },
		thickness: 0.5,
		color: LIGHT_BORDER,
	});
	text("Total:", colRate, rowY, { size: 10, color: MUTED, align: "right" });
	text(formatMoney(input.total_cents), colAmount, rowY, { size: 11, font: helvBold, align: "right" });

	// ── Notes ─────────────────────────────────────────────────────
	let notesY = rowY - 50;
	text("Notes:", margin, notesY, { size: 9, color: MUTED });
	notesY -= 13;
	const notes = [
		"Payment is due within 30 days of delivery of photos. Late payment will incur a fee of $50.",
		"Payment is accepted via credit card, PayPal, ACH/Wire Transfer, Venmo/Apple Cash/Zelle.",
		"If payment is to be made via PayPal or credit card, a fee of ~3% will be added.",
	];
	for (const n of notes) {
		text(n, margin, notesY, { size: 9 });
		notesY -= 12;
	}

	// ── Terms ─────────────────────────────────────────────────────
	let termsY = notesY - 18;
	text("Terms:", margin, termsY, { size: 9, color: MUTED });
	termsY -= 13;
	const terms = [
		"ACH/Wire Information:",
		`Account Number: ${input.bank.account_number}`,
		`Routing Number: ${input.bank.routing_number}`,
		`Bank: ${input.bank.bank_name}`,
		`Type: ${input.bank.account_type}`,
		"",
		`Venmo/Apple Cash/Zelle: ${input.bank.venmo_phone}`,
		"PayPal/Credit Card contact to arrange.",
	];
	for (const t of terms) {
		if (t) text(t, margin, termsY, { size: 9 });
		termsY -= 12;
	}

	// Tiny accent line at the bottom — subtle brand touch
	page.drawLine({
		start: { x: margin, y: 36 },
		end: { x: margin + 40, y: 36 },
		thickness: 2,
		color: ACCENT,
	});

	return doc.save();
}

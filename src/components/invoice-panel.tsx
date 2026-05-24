"use client";

import { useState, useTransition } from "react";
import { markInvoicePaid, markInvoiceSent, sendInvoice } from "@/app/admin/(protected)/galleries/[id]/actions";

type Props = {
	galleryId: number;
	invoiceNumber: string;
	issuedDate: string;
	dueDate: string;
	paymentTerms: string;
	totalCents: number;
	lineItems: { description: string; quantity: number; rate_cents: number }[];
	clientEmail: string | null;
	status: string | null;
	sentAt: number | null;
};

function formatMoney(cents: number) {
	return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(iso: string): string {
	const [y, m, d] = iso.split("-").map(Number);
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	return `${months[(m ?? 1) - 1]} ${d}, ${y}`;
}

export default function InvoicePanel(props: Props) {
	const [isPending, startTransition] = useTransition();
	const [feedback, setFeedback] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

	const sent = props.status === "sent" || props.status === "paid";
	const paid = props.status === "paid";

	function handleSend() {
		setFeedback(null);
		const ok = confirm(
			sent
				? `Resend invoice ${props.invoiceNumber} to ${props.clientEmail}?`
				: `Send invoice ${props.invoiceNumber} to ${props.clientEmail}?`,
		);
		if (!ok) return;
		startTransition(async () => {
			const res = await sendInvoice(props.galleryId);
			if (res.ok) setFeedback({ kind: "ok", msg: "Invoice sent." });
			else setFeedback({ kind: "err", msg: res.error ?? "Failed to send." });
		});
	}

	function handleMarkPaid() {
		if (!confirm(`Mark invoice ${props.invoiceNumber} as paid?`)) return;
		startTransition(async () => {
			await markInvoicePaid(props.galleryId);
			setFeedback({ kind: "ok", msg: "Marked as paid." });
		});
	}

	function handleMarkSent() {
		if (!confirm(`Mark invoice ${props.invoiceNumber} as sent? (No email will be sent.)`)) return;
		setFeedback(null);
		startTransition(async () => {
			try {
				await markInvoiceSent(props.galleryId);
				setFeedback({ kind: "ok", msg: "Marked as sent." });
			} catch (err) {
				setFeedback({ kind: "err", msg: err instanceof Error ? err.message : "Failed." });
			}
		});
	}

	return (
		<div className="rounded-lg border border-neutral-900 bg-neutral-900/30 overflow-hidden">
			<div className="px-5 py-4 flex items-baseline justify-between gap-4 border-b border-neutral-900">
				<div>
					<div className="flex items-center gap-2">
						<span className="font-mono text-sm text-neutral-300">#{props.invoiceNumber}</span>
						{paid ? (
							<StatusPill tone="success">Paid</StatusPill>
						) : sent ? (
							<StatusPill tone="accent">Sent</StatusPill>
						) : (
							<StatusPill tone="muted">Draft</StatusPill>
						)}
					</div>
					<p className="text-xs text-neutral-500 mt-1">
						Issued {formatDate(props.issuedDate)} · Due {formatDate(props.dueDate)} · {props.paymentTerms}
					</p>
				</div>
				<div className="text-2xl font-semibold tabular-nums">{formatMoney(props.totalCents)}</div>
			</div>

			<div className="divide-y divide-neutral-900">
				{props.lineItems.map((li, i) => (
					<div key={i} className="px-5 py-3 flex items-baseline justify-between gap-4 text-sm">
						<div className="text-neutral-200">{li.description}</div>
						<div className="font-mono text-neutral-400 tabular-nums shrink-0">
							{li.quantity} × {formatMoney(li.rate_cents)}
						</div>
					</div>
				))}
			</div>

			<div className="px-5 py-4 border-t border-neutral-900 flex flex-wrap items-center gap-2">
				<a
					href={`/admin/galleries/${props.galleryId}/invoice/edit`}
					className="inline-flex items-center gap-2 rounded-md border border-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-900 hover:border-neutral-700 transition"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
					Edit
				</a>
				<a
					href={`/api/invoice/${props.galleryId}/pdf?download=1`}
					className="inline-flex items-center gap-2 rounded-md border border-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-900 hover:border-neutral-700 transition"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
						<polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
						<line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
					Download PDF
				</a>
				<a
					href={`/api/invoice/${props.galleryId}/pdf`}
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-2 rounded-md border border-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-900 hover:border-neutral-700 transition"
				>
					Preview
				</a>
				{props.clientEmail ? (
					<button
						onClick={handleSend}
						disabled={isPending}
						className="inline-flex items-center gap-2 rounded-md bg-accent text-neutral-950 font-medium text-sm px-3 py-1.5 hover:bg-[#bdbdee] transition disabled:opacity-50"
					>
						{isPending ? "Sending…" : sent ? "Resend to client" : "Send to client"}
					</button>
				) : (
					<span className="text-xs text-amber-400/80">Add an email to the client to enable sending.</span>
				)}
				{!sent ? (
					<button
						onClick={handleMarkSent}
						disabled={isPending}
						className="inline-flex items-center gap-2 rounded-md border border-neutral-800 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-900 hover:border-neutral-700 transition disabled:opacity-50"
						title="Record this invoice as sent without emailing (e.g. you sent it via text)"
					>
						Mark as sent
					</button>
				) : null}
				{sent && !paid ? (
					<button
						onClick={handleMarkPaid}
						disabled={isPending}
						className="inline-flex items-center gap-2 rounded-md border border-emerald-600/40 text-emerald-400 px-3 py-1.5 text-sm font-medium hover:bg-emerald-600/10 transition"
					>
						Mark as paid
					</button>
				) : null}
				{feedback ? (
					<span
						className={`text-xs ml-2 ${
							feedback.kind === "ok" ? "text-emerald-400" : "text-red-400"
						}`}
					>
						{feedback.msg}
					</span>
				) : null}
				{props.sentAt ? (
					<span className="text-xs text-neutral-500 ml-auto">
						Last sent {new Date(props.sentAt * 1000).toLocaleString()}
					</span>
				) : null}
			</div>
		</div>
	);
}

function StatusPill({
	children,
	tone,
}: {
	children: React.ReactNode;
	tone: "success" | "accent" | "muted";
}) {
	const classes = {
		success: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
		accent: "bg-accent/15 text-accent border-accent/30",
		muted: "bg-neutral-800/70 text-neutral-400 border-neutral-700",
	}[tone];
	return (
		<span className={`inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider border ${classes}`}>
			{children}
		</span>
	);
}

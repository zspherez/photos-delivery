"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveInvoice } from "@/app/admin/(protected)/galleries/[id]/actions";

type LineItem = { description: string; quantity: number; rate_cents: number };

const labelClass = "block text-sm font-medium text-neutral-300 mb-1.5";
const inputClass =
	"w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition";

export default function InvoiceEditor({
	galleryId,
	invoiceNumber,
	issuedDate: initialIssued,
	dueDate: initialDue,
	paymentTerms: initialTerms,
	lineItems: initialLineItems,
}: {
	galleryId: number;
	invoiceNumber: string;
	issuedDate: string;
	dueDate: string;
	paymentTerms: string;
	lineItems: LineItem[];
}) {
	const router = useRouter();
	const [issued, setIssued] = useState(initialIssued);
	const [due, setDue] = useState(initialDue);
	const [terms, setTerms] = useState(initialTerms);
	const [items, setItems] = useState<LineItem[]>(initialLineItems);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function addDaysIso(iso: string, days: number): string {
		if (!iso) return iso;
		const d = new Date(`${iso}T00:00:00Z`);
		d.setUTCDate(d.getUTCDate() + days);
		return d.toISOString().slice(0, 10);
	}

	function changeIssued(next: string) {
		setIssued(next);
		setDue(addDaysIso(next, 30));
	}

	function updateItem(i: number, patch: Partial<LineItem>) {
		setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
	}
	function addItem() {
		setItems((prev) => [...prev, { description: "", quantity: 1, rate_cents: 0 }]);
	}
	function removeItem(i: number) {
		setItems((prev) => prev.filter((_, idx) => idx !== i));
	}

	const total = items.reduce((s, li) => s + li.quantity * li.rate_cents, 0);

	function submit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		startTransition(async () => {
			try {
				await saveInvoice(galleryId, {
					issued_date: issued,
					due_date: due,
					payment_terms: terms,
					line_items: items,
				});
				router.push(`/admin/galleries/${galleryId}`);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Save failed");
			}
		});
	}

	return (
		<form onSubmit={submit} className="space-y-6">
			<div className="rounded-lg bg-neutral-900/30 border border-neutral-900 p-5 space-y-4">
				<div className="flex items-baseline justify-between">
					<h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Details</h2>
					<span className="font-mono text-sm text-neutral-500">#{invoiceNumber}</span>
				</div>
				<div className="grid grid-cols-3 gap-4">
					<label className="block">
						<span className={labelClass}>Issued date</span>
						<input
							type="date"
							value={issued}
							onChange={(e) => changeIssued(e.target.value)}
							required
							className={inputClass}
						/>
					</label>
					<label className="block">
						<span className={labelClass}>Due date</span>
						<input
							type="date"
							value={due}
							onChange={(e) => setDue(e.target.value)}
							required
							className={inputClass}
						/>
					</label>
					<label className="block">
						<span className={labelClass}>Payment terms</span>
						<input
							type="text"
							value={terms}
							onChange={(e) => setTerms(e.target.value)}
							required
							className={inputClass}
						/>
					</label>
				</div>
			</div>

			<div className="rounded-lg bg-neutral-900/30 border border-neutral-900 overflow-hidden">
				<div className="px-5 pt-5 pb-3 flex items-center justify-between">
					<h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Line items</h2>
					<button
						type="button"
						onClick={addItem}
						className="text-sm text-accent hover:text-[#bfbfee] transition inline-flex items-center gap-1"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
							<path d="M12 5v14M5 12h14" strokeLinecap="round" />
						</svg>
						Add line
					</button>
				</div>
				<div className="divide-y divide-neutral-900">
					{items.map((item, i) => (
						<div key={i} className="px-5 py-3 grid grid-cols-[1fr_80px_120px_auto] gap-3 items-center">
							<input
								type="text"
								value={item.description}
								onChange={(e) => updateItem(i, { description: e.target.value })}
								placeholder="Description"
								className={`${inputClass} py-2`}
							/>
							<input
								type="number"
								value={item.quantity}
								min={0}
								step={1}
								onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
								className={`${inputClass} py-2 text-right tabular-nums`}
							/>
							<div className="relative">
								<span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none">$</span>
								<input
									type="number"
									step="0.01"
									min={0}
									value={(item.rate_cents / 100).toFixed(2)}
									onChange={(e) => updateItem(i, { rate_cents: Math.round(Number(e.target.value) * 100) })}
									className={`${inputClass} py-2 pl-6 text-right tabular-nums`}
								/>
							</div>
							<button
								type="button"
								onClick={() => removeItem(i)}
								className="w-9 h-9 rounded-md text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition flex items-center justify-center"
								aria-label="Remove"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
									<line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
								</svg>
							</button>
						</div>
					))}
					{items.length === 0 ? (
						<div className="px-5 py-6 text-sm text-neutral-500">No line items yet.</div>
					) : null}
				</div>
				<div className="px-5 py-4 border-t border-neutral-900 flex items-baseline justify-end gap-4 text-sm">
					<span className="text-neutral-500">Total</span>
					<span className="text-xl font-semibold tabular-nums text-accent">
						${(total / 100).toFixed(2)}
					</span>
				</div>
			</div>

			{error ? <p className="text-sm text-red-400">{error}</p> : null}

			<div className="flex items-center gap-3">
				<button
					type="submit"
					disabled={isPending}
					className="rounded-md bg-neutral-100 text-neutral-950 font-medium px-4 py-2.5 hover:bg-white transition disabled:opacity-50"
				>
					{isPending ? "Saving…" : "Save invoice"}
				</button>
				<Link
					href={`/admin/galleries/${galleryId}`}
					className="rounded-md border border-neutral-800 text-neutral-300 font-medium px-4 py-2.5 hover:bg-neutral-900 hover:border-neutral-700 transition"
				>
					Cancel
				</Link>
			</div>
		</form>
	);
}

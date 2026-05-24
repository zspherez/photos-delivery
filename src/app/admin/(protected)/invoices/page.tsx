import Link from "next/link";
import { db } from "@/lib/env";
import { formatMoney } from "@/lib/utils";

type Row = {
	id: number;
	invoice_number: string;
	gallery_id: number;
	client_name: string;
	shoot_date: string;
	issued_date: string;
	due_date: string;
	status: string;
	amount_cents: number;
	sent_at: number | null;
	paid_at: number | null;
};

type SortKey = "invoice_number" | "client_name" | "issued_date" | "due_date" | "status" | "amount_cents";
type SortDir = "asc" | "desc";

const SORT_COLUMNS: Record<SortKey, string> = {
	invoice_number: "i.invoice_number",
	client_name: "c.name",
	issued_date: "i.issued_date",
	due_date: "i.due_date",
	// Order so action items show first
	status: "CASE i.status WHEN 'sent' THEN 0 WHEN 'draft' THEN 1 WHEN 'paid' THEN 2 WHEN 'void' THEN 3 END",
	amount_cents: "i.amount_cents",
};

function formatDate(iso: string): string {
	const [y, m, d] = iso.split("-").map(Number);
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	return `${months[(m ?? 1) - 1]} ${d}, ${y}`;
}

function statusBadge(status: string) {
	const map: Record<string, { label: string; classes: string }> = {
		draft: { label: "Draft", classes: "bg-neutral-800/70 text-neutral-400 border-neutral-700" },
		sent: { label: "Sent", classes: "bg-accent/15 text-accent border-accent/30" },
		paid: { label: "Paid", classes: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" },
		void: { label: "Void", classes: "bg-red-500/15 text-red-400 border-red-500/30" },
	};
	const v = map[status] ?? map.draft;
	return (
		<span className={`inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider border ${v.classes}`}>
			{v.label}
		</span>
	);
}

export default async function InvoicesList({
	searchParams,
}: {
	searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
	const params = await searchParams;
	const sortKey: SortKey = (params.sort && params.sort in SORT_COLUMNS ? (params.sort as SortKey) : "issued_date");
	const sortDir: SortDir = params.dir === "asc" ? "asc" : "desc";

	const orderBy = SORT_COLUMNS[sortKey];
	const { results } = await db()
		.prepare(
			`SELECT i.id, i.invoice_number, i.gallery_id, c.name AS client_name, g.shoot_date,
				i.issued_date, i.due_date, i.status, i.amount_cents, i.sent_at, i.paid_at
			FROM invoices i
			JOIN galleries g ON g.id = i.gallery_id
			JOIN clients c ON c.id = i.client_id
			ORDER BY ${orderBy} ${sortDir === "asc" ? "ASC" : "DESC"}, i.id DESC`,
		)
		.all<Row>();

	const totals = {
		count: results.length,
		outstandingCents: results
			.filter((r) => r.status === "sent")
			.reduce((s, r) => s + r.amount_cents, 0),
		paidCents: results
			.filter((r) => r.status === "paid")
			.reduce((s, r) => s + r.amount_cents, 0),
	};

	return (
		<div className="space-y-8">
			<div className="flex items-end justify-between flex-wrap gap-4">
				<div>
					<h1 className="text-3xl font-semibold tracking-tight">Invoices</h1>
					<p className="text-sm text-neutral-400 mt-1">
						{totals.count} {totals.count === 1 ? "invoice" : "invoices"}
					</p>
				</div>
				<div className="flex items-center gap-6">
					<Stat label="Outstanding" value={formatMoney(totals.outstandingCents)} tone="accent" />
					<Stat label="Paid" value={formatMoney(totals.paidCents)} tone="success" />
				</div>
			</div>

			{results.length === 0 ? (
				<div className="rounded-lg border border-dashed border-neutral-800 p-12 text-center">
					<p className="text-neutral-300">No invoices yet.</p>
					<p className="text-sm text-neutral-500 mt-1">
						Invoices are generated from each gallery&apos;s detail page.
					</p>
				</div>
			) : (
				<div className="rounded-lg border border-neutral-900 overflow-hidden">
					<table className="w-full text-sm">
						<thead className="bg-neutral-900/50 text-neutral-400 text-xs uppercase tracking-wider">
							<tr>
								<SortHeader column="invoice_number" label="Invoice #" current={sortKey} dir={sortDir} />
								<SortHeader column="client_name" label="Client" current={sortKey} dir={sortDir} />
								<SortHeader column="issued_date" label="Issued" current={sortKey} dir={sortDir} />
								<SortHeader column="due_date" label="Due" current={sortKey} dir={sortDir} />
								<SortHeader column="status" label="Status" current={sortKey} dir={sortDir} />
								<SortHeader column="amount_cents" label="Amount" current={sortKey} dir={sortDir} align="right" />
							</tr>
						</thead>
						<tbody>
							{results.map((r) => (
								<tr key={r.id} className="border-t border-neutral-900 hover:bg-neutral-900/40 transition">
									<td className="px-4 py-3 font-mono text-neutral-200">
										<Link
											href={`/admin/galleries/${r.gallery_id}`}
											className="hover:text-accent transition"
										>
											{r.invoice_number}
										</Link>
									</td>
									<td className="px-4 py-3 text-neutral-200">{r.client_name}</td>
									<td className="px-4 py-3 text-neutral-400">{formatDate(r.issued_date)}</td>
									<td className="px-4 py-3 text-neutral-400">{formatDate(r.due_date)}</td>
									<td className="px-4 py-3">{statusBadge(r.status)}</td>
									<td className="px-4 py-3 text-right text-neutral-100 font-mono tabular-nums">
										{formatMoney(r.amount_cents)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

function SortHeader({
	column,
	label,
	current,
	dir,
	align = "left",
}: {
	column: SortKey;
	label: string;
	current: SortKey;
	dir: SortDir;
	align?: "left" | "right";
}) {
	const isActive = current === column;
	// Toggle direction when clicking the active column; otherwise sensible defaults per column type.
	let nextDir: SortDir;
	if (isActive) {
		nextDir = dir === "asc" ? "desc" : "asc";
	} else {
		// Dates and amounts default to descending; text defaults to ascending.
		nextDir = column === "client_name" || column === "invoice_number" ? "asc" : "desc";
	}
	const href = `/admin/invoices?sort=${column}&dir=${nextDir}`;
	const justify = align === "right" ? "justify-end" : "justify-start";

	return (
		<th className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}>
			<Link
				href={href}
				className={`inline-flex items-center gap-1 ${justify} ${
					isActive ? "text-neutral-200" : "text-neutral-400"
				} hover:text-neutral-100 transition`}
			>
				{label}
				<SortIndicator active={isActive} dir={dir} />
			</Link>
		</th>
	);
}

function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
	if (!active) {
		return (
			<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-30">
				<polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
			</svg>
		);
	}
	return dir === "asc" ? (
		<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
			<polyline points="18 15 12 9 6 15" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	) : (
		<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
			<polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

function Stat({
	label,
	value,
	tone,
}: {
	label: string;
	value: string;
	tone: "accent" | "success";
}) {
	const valueColor = tone === "accent" ? "text-accent" : "text-emerald-400";
	return (
		<div>
			<div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
			<div className={`text-2xl font-semibold tabular-nums mt-1 ${valueColor}`}>{value}</div>
		</div>
	);
}

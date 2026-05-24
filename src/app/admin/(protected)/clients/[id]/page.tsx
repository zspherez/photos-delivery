import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/env";
import type { Client } from "@/lib/types";
import { updateClient } from "./actions";

const inputClass =
	"w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition";
const labelClass = "block text-sm font-medium text-neutral-300 mb-1.5";

export default async function EditClientPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ error?: string }>;
}) {
	const { id } = await params;
	const { error } = await searchParams;
	const client = await db()
		.prepare("SELECT * FROM clients WHERE id = ?")
		.bind(id)
		.first<Client>();
	if (!client) notFound();

	const galleryCount = await db()
		.prepare("SELECT COUNT(*) AS c FROM galleries WHERE client_id = ?")
		.bind(client.id)
		.first<{ c: number }>();

	const action = updateClient.bind(null, client.id);

	return (
		<div className="max-w-xl space-y-8">
			<div>
				<Link
					href="/admin/clients"
					className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-100 transition"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
					Clients
				</Link>
				<h1 className="text-3xl font-semibold tracking-tight mt-3">{client.name}</h1>
				<p className="text-sm text-neutral-400 mt-1">
					{galleryCount?.c ?? 0} {galleryCount?.c === 1 ? "gallery" : "galleries"}
				</p>
			</div>
			<form action={action} className="space-y-4 rounded-lg bg-neutral-900/30 border border-neutral-900 p-5">
				<label className="block">
					<span className={labelClass}>Name</span>
					<input
						type="text"
						name="name"
						required
						defaultValue={client.name}
						className={inputClass}
					/>
					{error === "name" ? <p className="text-sm text-red-400 mt-1">Name is required.</p> : null}
				</label>
				<div className="grid grid-cols-2 gap-4">
					<label className="block">
						<span className={labelClass}>Email</span>
						<input
							type="email"
							name="email"
							defaultValue={client.email ?? ""}
							className={inputClass}
						/>
					</label>
					<label className="block">
						<span className={labelClass}>Phone</span>
						<input
							type="text"
							name="phone"
							defaultValue={client.phone ?? ""}
							className={inputClass}
						/>
					</label>
				</div>
				<label className="block">
					<span className={labelClass}>Billing address</span>
					<textarea
						name="billing_address"
						rows={3}
						defaultValue={client.billing_address ?? ""}
						className={inputClass}
					/>
				</label>
				<label className="block">
					<span className={labelClass}>Default hourly rate (USD)</span>
					<input
						type="number"
						name="default_hourly_rate"
						step="0.01"
						min="0"
						defaultValue={
							client.default_hourly_rate_cents
								? (client.default_hourly_rate_cents / 100).toFixed(2)
								: ""
						}
						className={inputClass}
					/>
				</label>
				<div className="flex items-center gap-3 pt-2">
					<button
						type="submit"
						className="rounded-md bg-neutral-100 text-neutral-950 font-medium px-4 py-2.5 hover:bg-white transition"
					>
						Save changes
					</button>
					<Link
						href="/admin/clients"
						className="rounded-md border border-neutral-800 text-neutral-300 font-medium px-4 py-2.5 hover:bg-neutral-900 hover:border-neutral-700 transition"
					>
						Cancel
					</Link>
				</div>
			</form>
		</div>
	);
}

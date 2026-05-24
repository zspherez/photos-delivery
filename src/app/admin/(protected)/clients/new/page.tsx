import Link from "next/link";
import { createClient } from "./actions";

const inputClass =
	"w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition";
const labelClass = "block text-sm font-medium text-neutral-300 mb-1.5";

export default async function NewClientPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const { error } = await searchParams;
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
				<h1 className="text-3xl font-semibold tracking-tight mt-3">New client</h1>
			</div>
			<form
				action={createClient}
				className="space-y-4 rounded-lg bg-neutral-900/30 border border-neutral-900 p-5"
			>
				<label className="block">
					<span className={labelClass}>Name</span>
					<input type="text" name="name" required className={inputClass} />
					{error === "name" ? <p className="text-sm text-red-400 mt-1">Name is required.</p> : null}
				</label>
				<div className="grid grid-cols-2 gap-4">
					<label className="block">
						<span className={labelClass}>Email</span>
						<input type="email" name="email" className={inputClass} />
					</label>
					<label className="block">
						<span className={labelClass}>Phone</span>
						<input type="text" name="phone" className={inputClass} />
					</label>
				</div>
				<label className="block">
					<span className={labelClass}>Billing address</span>
					<textarea name="billing_address" rows={3} className={inputClass} />
				</label>
				<label className="block">
					<span className={labelClass}>Default hourly rate (USD)</span>
					<input type="number" name="default_hourly_rate" step="0.01" min="0" className={inputClass} />
				</label>
				<div className="flex items-center gap-3 pt-2">
					<button
						type="submit"
						className="rounded-md bg-neutral-100 text-neutral-950 font-medium px-4 py-2.5 hover:bg-white transition"
					>
						Create client
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

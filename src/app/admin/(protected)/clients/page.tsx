import Link from "next/link";
import { db } from "@/lib/env";
import type { Client } from "@/lib/types";

export default async function ClientsList() {
	const { results } = await db()
		.prepare(
			`SELECT c.*, (SELECT COUNT(*) FROM galleries WHERE client_id = c.id) AS gallery_count
			FROM clients c
			ORDER BY name ASC`,
		)
		.all<Client & { gallery_count: number }>();

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-semibold tracking-tight">Clients</h1>
					<p className="text-sm text-neutral-400 mt-1">
						{results.length} {results.length === 1 ? "client" : "clients"}
					</p>
				</div>
				<Link
					href="/admin/clients/new"
					className="inline-flex items-center gap-2 rounded-md bg-neutral-100 text-neutral-950 font-medium text-sm px-4 py-2 hover:bg-white transition"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
						<path d="M12 5v14M5 12h14" strokeLinecap="round" />
					</svg>
					New client
				</Link>
			</div>

			{results.length === 0 ? (
				<div className="rounded-lg border border-dashed border-neutral-800 p-12 text-center">
					<p className="text-neutral-300">No clients yet.</p>
				</div>
			) : (
				<div className="rounded-lg border border-neutral-900 overflow-hidden">
					<table className="w-full text-sm">
						<thead className="bg-neutral-900/50 text-neutral-400 text-xs uppercase tracking-wider">
							<tr>
								<th className="text-left px-4 py-3 font-medium">Name</th>
								<th className="text-left px-4 py-3 font-medium">Email</th>
								<th className="text-left px-4 py-3 font-medium">Phone</th>
								<th className="text-right px-4 py-3 font-medium">Galleries</th>
							</tr>
						</thead>
						<tbody>
							{results.map((c) => (
								<tr key={c.id} className="border-t border-neutral-900 hover:bg-neutral-900/40 transition">
									<td className="px-4 py-3">
										<Link
											href={`/admin/clients/${c.id}`}
											className="font-medium text-neutral-100 hover:text-accent transition"
										>
											{c.name}
										</Link>
									</td>
									<td className="px-4 py-3 text-neutral-400">{c.email ?? "—"}</td>
									<td className="px-4 py-3 text-neutral-400">{c.phone ?? "—"}</td>
									<td className="px-4 py-3 text-right text-neutral-300 font-mono tabular-nums">
										{c.gallery_count}
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

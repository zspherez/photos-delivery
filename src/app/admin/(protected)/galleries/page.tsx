import Link from "next/link";
import { db } from "@/lib/env";

type Row = {
	id: number;
	slug: string;
	shoot_date: string;
	package_type: string;
	venue: string | null;
	client_name: string;
	asset_count: number;
	created_at: number;
	cover_asset_id: number | null;
};

export default async function GalleriesList() {
	const { results } = await db()
		.prepare(
			`SELECT g.id, g.slug, g.shoot_date, g.package_type, g.venue, c.name AS client_name,
				(SELECT COUNT(*) FROM assets WHERE gallery_id = g.id) AS asset_count,
				COALESCE(
					g.cover_asset_id,
					(SELECT id FROM assets WHERE gallery_id = g.id AND type = 'photo' ORDER BY sort_order ASC, id ASC LIMIT 1)
				) AS cover_asset_id,
				g.created_at
			FROM galleries g
			JOIN clients c ON c.id = g.client_id
			ORDER BY g.shoot_date DESC, g.created_at DESC`,
		)
		.all<Row>();

	return (
		<div className="space-y-8">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-3xl font-semibold tracking-tight">Galleries</h1>
					<p className="text-sm text-neutral-400 mt-1">
						{results.length} {results.length === 1 ? "gallery" : "galleries"}
					</p>
				</div>
				<Link
					href="/admin/galleries/new"
					className="inline-flex items-center gap-2 rounded-md bg-neutral-100 text-neutral-950 font-medium text-sm px-4 py-2 hover:bg-white transition"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
						<path d="M12 5v14M5 12h14" strokeLinecap="round" />
					</svg>
					New gallery
				</Link>
			</div>

			{results.length === 0 ? (
				<div className="rounded-lg border border-dashed border-neutral-800 p-12 text-center">
					<p className="text-neutral-300">No galleries yet.</p>
					<p className="text-sm text-neutral-500 mt-1">
						<Link href="/admin/clients/new" className="underline hover:text-neutral-300">
							Create a client
						</Link>
						, then{" "}
						<Link href="/admin/galleries/new" className="underline hover:text-neutral-300">
							create your first gallery
						</Link>
						.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
					{results.map((g) => (
						<Link
							key={g.id}
							href={`/admin/galleries/${g.id}`}
							className="group rounded-lg overflow-hidden bg-neutral-900/40 border border-neutral-900 hover:border-neutral-700 hover:bg-neutral-900 transition"
						>
							<div className="relative aspect-[3/2] bg-neutral-900 overflow-hidden">
								{g.cover_asset_id ? (
									// eslint-disable-next-line @next/next/no-img-element
									<img
										src={`/img/${g.cover_asset_id}/web`}
										alt={g.client_name}
										className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition duration-500"
										loading="lazy"
									/>
								) : (
									<div className="absolute inset-0 flex items-center justify-center text-neutral-700">
										<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
											<rect x="3" y="3" width="18" height="18" rx="2" />
											<circle cx="8.5" cy="8.5" r="1.5" />
											<path d="m21 15-5-5L5 21" />
										</svg>
									</div>
								)}
								<div className="absolute top-2 right-2 px-2 py-1 rounded bg-black/70 text-xs text-neutral-200 backdrop-blur-sm font-medium">
									{g.asset_count}
								</div>
							</div>
							<div className="p-4">
								<div className="flex items-baseline justify-between gap-3">
									<h2 className="font-medium text-neutral-50 truncate group-hover:text-white">
										{g.client_name}
									</h2>
									<span className="text-xs text-neutral-500 shrink-0 font-mono">{g.shoot_date}</span>
								</div>
								<p className="text-sm text-neutral-400 mt-1 truncate">
									{g.package_type}
									{g.venue ? ` · ${g.venue}` : ""}
								</p>
							</div>
						</Link>
					))}
				</div>
			)}
		</div>
	);
}

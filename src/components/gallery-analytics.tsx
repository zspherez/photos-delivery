import Link from "next/link";
import type { GalleryAnalytics } from "@/lib/analytics";

const DAY_SECONDS = 86_400;

function dayKey(d: Date): string {
	const y = d.getUTCFullYear();
	const m = String(d.getUTCMonth() + 1).padStart(2, "0");
	const day = String(d.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function densify30Days(series: { day: string; count: number }[]): { day: string; label: string; count: number }[] {
	const byDay = new Map(series.map((p) => [p.day, p.count]));
	const out: { day: string; label: string; count: number }[] = [];
	const today = new Date();
	for (let i = 29; i >= 0; i--) {
		const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
		const key = dayKey(d);
		out.push({
			day: key,
			label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
			count: byDay.get(key) ?? 0,
		});
	}
	return out;
}

function relativeTime(unix: number): string {
	const diff = Math.floor(Date.now() / 1000) - unix;
	if (diff < 60) return "just now";
	if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
	if (diff < DAY_SECONDS) return `${Math.floor(diff / 3600)}h ago`;
	if (diff < 7 * DAY_SECONDS) return `${Math.floor(diff / DAY_SECONDS)}d ago`;
	const d = new Date(unix * 1000);
	return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function eventLabel(t: "view" | "asset_download" | "zip_download"): string {
	if (t === "view") return "view";
	if (t === "asset_download") return "photo download";
	return "zip download";
}

function countryFlag(cc: string): string {
	if (!cc || cc === "??" || cc.length !== 2) return "·";
	const A = 0x1f1e6;
	const a = "A".charCodeAt(0);
	return String.fromCodePoint(A + cc.toUpperCase().charCodeAt(0) - a, A + cc.toUpperCase().charCodeAt(1) - a);
}

export default function GalleryAnalyticsSection({
	gallery,
	analytics,
}: {
	gallery: { id: number };
	analytics: GalleryAnalytics;
}) {
	const { totals, daily_views, top_assets, countries, recent } = analytics;
	const hasAny =
		totals.views > 0 || totals.photo_downloads > 0 || totals.zip_downloads > 0;

	if (!hasAny) {
		return (
			<section className="space-y-3">
				<h2 className="text-xl font-semibold tracking-tight">Analytics</h2>
				<div className="rounded-lg border border-neutral-900 bg-neutral-950/40 p-6 text-sm text-neutral-500">
					No activity yet. Views, photo downloads, and zip downloads will show up here.
				</div>
			</section>
		);
	}

	const days = densify30Days(daily_views);
	const peakDay = days.reduce((m, d) => (d.count > m ? d.count : m), 0);

	return (
		<section className="space-y-5">
			<div className="flex items-baseline justify-between">
				<h2 className="text-xl font-semibold tracking-tight">Analytics</h2>
				{totals.last_event_at ? (
					<div className="text-xs text-neutral-500">
						last event {relativeTime(totals.last_event_at)}
					</div>
				) : null}
			</div>

			<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
				<Stat label="Views" value={totals.views} />
				<Stat label="Unique visitors" value={totals.unique_visitors} />
				<Stat label="Photo downloads" value={totals.photo_downloads} />
				<Stat label="Zip downloads" value={totals.zip_downloads} />
			</div>

			<div className="rounded-lg border border-neutral-900 bg-neutral-950/40 p-5">
				<div className="flex items-baseline justify-between mb-4">
					<h3 className="text-xs font-medium text-accent uppercase tracking-[0.2em]">
						Views · last 30 days
					</h3>
					<div className="text-xs text-neutral-500 tabular-nums">peak {peakDay}</div>
				</div>
				<div className="flex items-end gap-[2px] h-20">
					{days.map((d) => {
						const pct = peakDay === 0 ? 0 : Math.max(2, Math.round((d.count / peakDay) * 100));
						return (
							<div
								key={d.day}
								className="flex-1 relative group"
								style={{ height: "100%" }}
								title={`${d.label}: ${d.count} ${d.count === 1 ? "view" : "views"}`}
							>
								<div
									className={`absolute bottom-0 left-0 right-0 rounded-sm transition-colors ${
										d.count > 0 ? "bg-accent/70 group-hover:bg-accent" : "bg-neutral-900"
									}`}
									style={{ height: d.count > 0 ? `${pct}%` : "2px" }}
								/>
							</div>
						);
					})}
				</div>
				<div className="flex justify-between mt-2 text-[10px] text-neutral-600 font-mono">
					<span>{days[0]?.label}</span>
					<span>{days[Math.floor(days.length / 2)]?.label}</span>
					<span>today</span>
				</div>
			</div>

			<div className="grid lg:grid-cols-2 gap-4">
				<div className="rounded-lg border border-neutral-900 bg-neutral-950/40 p-5">
					<h3 className="text-xs font-medium text-accent uppercase tracking-[0.2em] mb-4">
						Top downloaded photos
					</h3>
					{top_assets.length === 0 ? (
						<p className="text-sm text-neutral-500">No photo downloads yet.</p>
					) : (
						<ul className="space-y-2">
							{top_assets.map((a) => (
								<li key={a.asset_id} className="flex items-center gap-3">
									{a.type === "photo" ? (
										// eslint-disable-next-line @next/next/no-img-element
										<img
											src={`/img/${a.asset_id}/thumb`}
											alt=""
											className="w-10 h-10 rounded object-cover bg-neutral-900 shrink-0"
										/>
									) : (
										<div className="w-10 h-10 rounded bg-neutral-900 shrink-0 flex items-center justify-center text-[10px] text-neutral-500 uppercase">
											vid
										</div>
									)}
									<span className="flex-1 truncate text-sm text-neutral-300 font-mono">
										{a.original_filename}
									</span>
									<span className="text-sm tabular-nums text-neutral-200 font-medium shrink-0">
										{a.count}
									</span>
								</li>
							))}
						</ul>
					)}
				</div>

				<div className="rounded-lg border border-neutral-900 bg-neutral-950/40 p-5">
					<h3 className="text-xs font-medium text-accent uppercase tracking-[0.2em] mb-4">
						Countries
					</h3>
					{countries.length === 0 ? (
						<p className="text-sm text-neutral-500">No geo data yet.</p>
					) : (
						<ul className="space-y-1.5">
							{countries.map((c) => (
								<li
									key={c.country}
									className="flex items-center gap-3 text-sm"
								>
									<span className="w-6 text-center" aria-hidden="true">
										{countryFlag(c.country)}
									</span>
									<span className="flex-1 text-neutral-300 font-mono">{c.country}</span>
									<span className="tabular-nums text-neutral-200 font-medium">{c.count}</span>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>

			{recent.length > 0 ? (
				<div className="rounded-lg border border-neutral-900 bg-neutral-950/40 p-5">
					<h3 className="text-xs font-medium text-accent uppercase tracking-[0.2em] mb-4">
						Recent activity
					</h3>
					<ul className="space-y-1.5 text-sm">
						{recent.map((e) => (
							<li
								key={e.id}
								className="grid grid-cols-[auto_1fr_auto] items-baseline gap-3 text-neutral-400"
							>
								<span className="text-[10px] uppercase tracking-wider text-accent/80 w-24">
									{eventLabel(e.event_type)}
								</span>
								<span className="truncate font-mono text-xs">
									{e.country ? `${countryFlag(e.country)} ${e.country}` : "·"}
									{e.asset_id ? (
										<>
											{" "}
											·{" "}
											<Link
												href={`/admin/galleries/${gallery.id}`}
												className="text-neutral-500 hover:text-neutral-300"
											>
												asset {e.asset_id}
											</Link>
										</>
									) : null}
								</span>
								<span className="text-xs text-neutral-500 tabular-nums">
									{relativeTime(e.at)}
								</span>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</section>
	);
}

function Stat({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-lg border border-neutral-900 bg-neutral-950/40 px-4 py-3">
			<div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">{label}</div>
			<div className="mt-1 text-2xl font-semibold tabular-nums text-neutral-100">
				{value.toLocaleString()}
			</div>
		</div>
	);
}

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { db } from "./env";
import { nowSeconds } from "./utils";

type EventType = "view" | "asset_download" | "zip_download";

const BOT_UA = /bot|crawler|spider|preview|slurp|facebookexternalhit|whatsapp|telegram|discord|slackbot|embedly|quora link preview|outbrain|pinterest|vkshare|w3c_validator|chatgpt|gptbot|claude-web/i;

export function isBot(ua: string | null | undefined): boolean {
	if (!ua) return true;
	return BOT_UA.test(ua);
}

type ReqHeaders = { get(name: string): string | null };

export function logEvent(
	headers: ReqHeaders,
	galleryId: number,
	eventType: EventType,
	assetId: number | null = null,
): void {
	const ua = headers.get("User-Agent");
	if (isBot(ua)) return;
	const ip = headers.get("CF-Connecting-IP") ?? headers.get("X-Forwarded-For");
	let country: string | null = headers.get("CF-IPCountry");
	let city: string | null = null;
	let region: string | null = null;
	try {
		const cf = getCloudflareContext().cf;
		if (cf) {
			country = (cf.country as string | undefined) ?? country;
			city = (cf.city as string | undefined) ?? null;
			region = (cf.region as string | undefined) ?? null;
		}
	} catch {
		// getCloudflareContext is unavailable outside a request context (e.g. local dev fallback) — fine.
	}
	db()
		.prepare(
			`INSERT INTO download_events (gallery_id, asset_id, event_type, ip, user_agent, country, city, region, at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		)
		.bind(galleryId, assetId, eventType, ip, ua, country, city, region, nowSeconds())
		.run()
		.catch(() => {});
}

export type GalleryAnalytics = {
	totals: {
		views: number;
		unique_visitors: number;
		photo_downloads: number;
		zip_downloads: number;
		first_event_at: number | null;
		last_event_at: number | null;
	};
	daily_views: { day: string; count: number }[];
	top_assets: {
		asset_id: number;
		count: number;
		original_filename: string;
		type: "photo" | "video";
	}[];
	locations: { country: string; region: string; city: string; count: number }[];
	recent: {
		id: number;
		event_type: EventType;
		asset_id: number | null;
		country: string | null;
		region: string | null;
		city: string | null;
		user_agent: string | null;
		at: number;
	}[];
};

const DAY_SECONDS = 86_400;

export async function getGalleryAnalytics(galleryId: number): Promise<GalleryAnalytics> {
	const since30d = nowSeconds() - 30 * DAY_SECONDS;
	const d = db();

	const [totalsRes, dailyRes, topAssetsRes, locationsRes, recentRes] = await d.batch([
		d.prepare(
			`SELECT
				SUM(CASE WHEN event_type = 'view' THEN 1 ELSE 0 END) AS views,
				SUM(CASE WHEN event_type = 'asset_download' THEN 1 ELSE 0 END) AS photo_downloads,
				SUM(CASE WHEN event_type = 'zip_download' THEN 1 ELSE 0 END) AS zip_downloads,
				COUNT(DISTINCT CASE WHEN event_type = 'view'
					THEN COALESCE(ip,'') || '|' || COALESCE(user_agent,'') END) AS unique_visitors,
				MIN(at) AS first_event_at,
				MAX(at) AS last_event_at
			FROM download_events WHERE gallery_id = ?`,
		).bind(galleryId),
		d.prepare(
			`SELECT date(at, 'unixepoch') AS day, COUNT(*) AS count
			FROM download_events
			WHERE gallery_id = ? AND event_type = 'view' AND at >= ?
			GROUP BY day ORDER BY day ASC`,
		).bind(galleryId, since30d),
		d.prepare(
			`SELECT de.asset_id, COUNT(*) AS count, a.original_filename, a.type
			FROM download_events de
			JOIN assets a ON a.id = de.asset_id
			WHERE de.gallery_id = ? AND de.event_type = 'asset_download' AND de.asset_id IS NOT NULL
			GROUP BY de.asset_id
			ORDER BY count DESC, de.asset_id ASC
			LIMIT 10`,
		).bind(galleryId),
		d.prepare(
			`SELECT
				COALESCE(country, '??') AS country,
				COALESCE(region, '') AS region,
				COALESCE(city, '') AS city,
				COUNT(*) AS count
			FROM download_events
			WHERE gallery_id = ?
			GROUP BY country, region, city
			ORDER BY count DESC
			LIMIT 10`,
		).bind(galleryId),
		d.prepare(
			`SELECT id, event_type, asset_id, country, region, city, user_agent, at
			FROM download_events
			WHERE gallery_id = ?
			ORDER BY at DESC
			LIMIT 15`,
		).bind(galleryId),
	]);

	const totalsRow = (totalsRes.results?.[0] ?? {}) as Record<string, number | null>;

	return {
		totals: {
			views: totalsRow.views ?? 0,
			unique_visitors: totalsRow.unique_visitors ?? 0,
			photo_downloads: totalsRow.photo_downloads ?? 0,
			zip_downloads: totalsRow.zip_downloads ?? 0,
			first_event_at: totalsRow.first_event_at ?? null,
			last_event_at: totalsRow.last_event_at ?? null,
		},
		daily_views: (dailyRes.results ?? []) as { day: string; count: number }[],
		top_assets: (topAssetsRes.results ?? []) as GalleryAnalytics["top_assets"],
		locations: (locationsRes.results ?? []) as GalleryAnalytics["locations"],
		recent: (recentRes.results ?? []) as GalleryAnalytics["recent"],
	};
}

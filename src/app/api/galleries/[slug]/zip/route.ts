import { downloadZip } from "client-zip";
import { db } from "@/lib/env";
import { isGalleryUnlocked } from "@/lib/gallery-auth";
import { getObject } from "@/lib/r2";
import { nowSeconds } from "@/lib/utils";

type GalleryRow = {
	id: number;
	slug: string;
	password_hash: string | null;
	expires_at: number | null;
	client_name: string;
	shoot_date: string;
};

type AssetRow = {
	id: number;
	original_key: string;
	original_filename: string;
	uploaded_at: number;
	bytes: number;
};

function safeFilename(s: string): string {
	return s.replace(/[\/\\:*?"<>|]/g, "_").trim() || "gallery";
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;

	const gallery = await db()
		.prepare(
			`SELECT g.id, g.slug, g.password_hash, g.expires_at, c.name AS client_name, g.shoot_date
			FROM galleries g JOIN clients c ON c.id = g.client_id
			WHERE g.slug = ?`,
		)
		.bind(slug)
		.first<GalleryRow>();
	if (!gallery) return new Response("not found", { status: 404 });

	if (gallery.expires_at && gallery.expires_at < nowSeconds()) {
		return new Response("expired", { status: 410 });
	}
	if (!(await isGalleryUnlocked(slug, gallery.password_hash))) {
		return new Response("unauthorized", { status: 401 });
	}

	const { results: assets } = await db()
		.prepare(
			`SELECT id, original_key, original_filename, uploaded_at, bytes
			FROM assets WHERE gallery_id = ?
			ORDER BY sort_order ASC, id ASC`,
		)
		.bind(gallery.id)
		.all<AssetRow>();
	if (assets.length === 0) return new Response("empty gallery", { status: 404 });

	// De-duplicate filenames so the zip has unique entries.
	const used = new Set<string>();
	function uniqueName(name: string): string {
		const cleaned = safeFilename(name);
		if (!used.has(cleaned)) {
			used.add(cleaned);
			return cleaned;
		}
		const dot = cleaned.lastIndexOf(".");
		const base = dot > 0 ? cleaned.slice(0, dot) : cleaned;
		const ext = dot > 0 ? cleaned.slice(dot) : "";
		for (let i = 2; i < 10_000; i++) {
			const candidate = `${base} (${i})${ext}`;
			if (!used.has(candidate)) {
				used.add(candidate);
				return candidate;
			}
		}
		const fallback = `${base}-${crypto.randomUUID()}${ext}`;
		used.add(fallback);
		return fallback;
	}

	// Pre-resolve unique names so they don't change order
	const named = assets.map((a) => ({ asset: a, name: uniqueName(a.original_filename) }));

	async function* entries() {
		for (const { asset, name } of named) {
			const r2 = await getObject(asset.original_key);
			if (!r2 || !r2.body) continue;
			yield {
				name,
				lastModified: new Date(asset.uploaded_at * 1000),
				size: asset.bytes,
				input: r2.body,
			};
		}
	}

	const zipName = safeFilename(`${gallery.client_name} - ${gallery.shoot_date}`) + ".zip";

	const cf = req.headers.get("CF-Connecting-IP") ?? req.headers.get("X-Forwarded-For");
	const ua = req.headers.get("User-Agent");
	const country = req.headers.get("CF-IPCountry");
	db()
		.prepare(
			`INSERT INTO download_events (gallery_id, asset_id, event_type, ip, user_agent, country, at)
			VALUES (?, NULL, 'zip_download', ?, ?, ?, ?)`,
		)
		.bind(gallery.id, cf, ua, country, nowSeconds())
		.run()
		.catch(() => {});

	const zipResponse = downloadZip(entries());
	return new Response(zipResponse.body, {
		headers: {
			"Content-Type": "application/zip",
			"Content-Disposition": `attachment; filename="${zipName}"`,
			"Cache-Control": "no-store",
		},
	});
}

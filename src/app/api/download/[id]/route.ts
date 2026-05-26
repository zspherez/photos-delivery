import { logEvent } from "@/lib/analytics";
import { db } from "@/lib/env";
import { isGalleryUnlocked } from "@/lib/gallery-auth";
import { getObject } from "@/lib/r2";
import { nowSeconds } from "@/lib/utils";

type AssetRow = {
	id: number;
	original_key: string;
	content_type: string;
	original_filename: string;
	gallery_id: number;
	slug: string;
	password_hash: string | null;
	expires_at: number | null;
};

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const row = await db()
		.prepare(
			`SELECT a.id, a.original_key, a.content_type, a.original_filename, a.gallery_id,
				g.slug, g.password_hash, g.expires_at
			FROM assets a JOIN galleries g ON g.id = a.gallery_id
			WHERE a.id = ?`,
		)
		.bind(id)
		.first<AssetRow>();
	if (!row) return new Response("not found", { status: 404 });

	if (row.expires_at && row.expires_at < nowSeconds()) {
		return new Response("expired", { status: 410 });
	}
	if (!(await isGalleryUnlocked(row.slug, row.password_hash))) {
		return new Response("unauthorized", { status: 401 });
	}

	const range = req.headers.get("Range");
	const r2 = await getObject(row.original_key, range);
	if (!r2) return new Response("missing", { status: 500 });

	logEvent(req.headers, row.gallery_id, "asset_download", row.id);

	const headers = new Headers();
	headers.set("Content-Type", row.content_type || "application/octet-stream");
	headers.set("Accept-Ranges", "bytes");
	const safeName = row.original_filename.replace(/"/g, "");
	headers.set("Content-Disposition", `attachment; filename="${safeName}"`);
	const len = r2.headers.get("Content-Length");
	if (len) headers.set("Content-Length", len);
	const cr = r2.headers.get("Content-Range");
	if (cr) headers.set("Content-Range", cr);

	return new Response(r2.body, { status: r2.status, headers });
}

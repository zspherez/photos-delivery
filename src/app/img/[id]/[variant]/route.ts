import { db, env } from "@/lib/env";
import { getObject, putObject } from "@/lib/r2";

const VARIANTS = {
	thumb: 400,
	web: 1600,
} as const;
type Variant = keyof typeof VARIANTS;

type AssetRow = {
	id: number;
	original_key: string;
	content_type: string;
	type: "photo" | "video";
	slug: string;
};

const CACHE_HEADERS = {
	"Content-Type": "image/webp",
	"Cache-Control": "public, max-age=31536000, immutable",
};

export async function GET(
	req: Request,
	{ params }: { params: Promise<{ id: string; variant: string }> },
) {
	const { id, variant } = await params;
	if (!(variant in VARIANTS)) {
		return new Response("invalid variant", { status: 400 });
	}
	const maxDim = VARIANTS[variant as Variant];

	const cache = (typeof caches !== "undefined"
		? (caches as unknown as { default: Cache }).default
		: null);
	const cacheKey = new Request(req.url, { method: "GET" });
	if (cache) {
		const cached = await cache.match(cacheKey);
		if (cached) return cached;
	}

	const row = await db()
		.prepare(
			`SELECT a.id, a.original_key, a.content_type, a.type, g.slug
			FROM assets a JOIN galleries g ON g.id = a.gallery_id
			WHERE a.id = ?`,
		)
		.bind(id)
		.first<AssetRow>();

	if (!row) return new Response("not found", { status: 404 });
	if (row.type !== "photo") return new Response("not a photo", { status: 400 });

	const variantKey = `g/${row.slug}/v/${row.id}-${variant}.webp`;

	const r2Cached = await getObject(variantKey);
	if (r2Cached) {
		const res = new Response(r2Cached.body, { headers: CACHE_HEADERS });
		if (cache) await cache.put(cacheKey, res.clone());
		return res;
	}

	const original = await getObject(row.original_key);
	if (!original || !original.body) return new Response("original missing", { status: 500 });

	const images = env().IMAGES;
	if (!images) return new Response("image binding not available", { status: 500 });
	const result = await images
		.input(original.body)
		.transform({ width: maxDim, fit: "scale-down" })
		.output({ format: "image/webp", quality: 85 });
	const transformed = result.response();

	// Read once so we can both cache to R2 and return to client.
	const webp = await transformed.arrayBuffer();
	await putObject(variantKey, webp, "image/webp");
	const response = new Response(webp, { headers: CACHE_HEADERS });
	if (cache) await cache.put(cacheKey, response.clone());
	return response;
}

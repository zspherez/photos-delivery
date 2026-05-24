import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/env";
import { completeMultipartUpload } from "@/lib/r2";
import { nowSeconds } from "@/lib/utils";

export async function POST(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

	const body = (await req.json()) as {
		key: string;
		uploadId: string;
		parts: { partNumber: number; etag: string }[];
		gallery_id: number;
		filename: string;
		content_type: string;
		size: number;
		width?: number;
		height?: number;
		duration_seconds?: number;
	};

	await completeMultipartUpload(body.key, body.uploadId, body.parts);

	const type = body.content_type.startsWith("video/") ? "video" : "photo";
	const now = nowSeconds();

	// Take the next sort_order in the gallery
	const maxOrder = await db()
		.prepare("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM assets WHERE gallery_id = ?")
		.bind(body.gallery_id)
		.first<{ next: number }>();
	const sortOrder = maxOrder?.next ?? 0;

	const result = await db()
		.prepare(
			`INSERT INTO assets (gallery_id, type, sort_order, original_key, bytes, original_filename, content_type, width, height, duration_seconds, uploaded_at, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			RETURNING id`,
		)
		.bind(
			body.gallery_id,
			type,
			sortOrder,
			body.key,
			body.size,
			body.filename,
			body.content_type,
			body.width ?? null,
			body.height ?? null,
			body.duration_seconds ?? null,
			now,
			now,
		)
		.first<{ id: number }>();

	return NextResponse.json({ asset_id: result?.id });
}

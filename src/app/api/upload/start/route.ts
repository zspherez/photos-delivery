import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { db } from "@/lib/env";
import { createMultipartUpload } from "@/lib/r2";

const MAX_IMAGE_BYTES = 18 * 1024 * 1024;

export async function POST(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

	const body = (await req.json()) as {
		gallery_id: number;
		filename: string;
		content_type: string;
		size?: number;
	};

	if (body.content_type.startsWith("image/") && body.size && body.size > MAX_IMAGE_BYTES) {
		return NextResponse.json(
			{ error: `Image too large (max 18 MB)` },
			{ status: 413 },
		);
	}

	const gallery = await db()
		.prepare("SELECT slug FROM galleries WHERE id = ?")
		.bind(body.gallery_id)
		.first<{ slug: string }>();
	if (!gallery) return NextResponse.json({ error: "gallery not found" }, { status: 404 });

	// Key shape: g/<slug>/o/<uuid>-<filename>
	const uuid = crypto.randomUUID();
	const safeName = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
	const key = `g/${gallery.slug}/o/${uuid}-${safeName}`;

	const uploadId = await createMultipartUpload(key, body.content_type || "application/octet-stream");
	return NextResponse.json({ key, uploadId });
}

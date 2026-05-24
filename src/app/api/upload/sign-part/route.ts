import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { presignUploadPartUrl } from "@/lib/r2";

export async function GET(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

	const url = new URL(req.url);
	const key = url.searchParams.get("key");
	const uploadId = url.searchParams.get("uploadId");
	const partNumber = Number(url.searchParams.get("partNumber"));
	if (!key || !uploadId || !partNumber) {
		return NextResponse.json({ error: "missing params" }, { status: 400 });
	}

	const signedUrl = await presignUploadPartUrl(key, uploadId, partNumber);
	return NextResponse.json({ url: signedUrl });
}

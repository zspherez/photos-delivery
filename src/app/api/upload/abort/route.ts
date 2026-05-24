import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { abortMultipartUpload } from "@/lib/r2";

export async function POST(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
	const body = (await req.json()) as { key: string; uploadId: string };
	await abortMultipartUpload(body.key, body.uploadId);
	return NextResponse.json({ ok: true });
}

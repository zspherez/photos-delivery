"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/env";
import { unlockGallery } from "@/lib/gallery-auth";
import { verifyPassword } from "@/lib/password";

export async function unlockAction(slug: string, formData: FormData) {
	const password = String(formData.get("password") ?? "");
	const row = await db()
		.prepare("SELECT password_hash, password_salt FROM galleries WHERE slug = ?")
		.bind(slug)
		.first<{ password_hash: string | null; password_salt: string | null }>();
	if (!row || !row.password_hash || !row.password_salt) {
		redirect(`/${slug}`);
	}
	const ok = await verifyPassword(password, row.password_hash, row.password_salt);
	if (!ok) {
		redirect(`/${slug}/unlock?error=1`);
	}
	await unlockGallery(slug, row.password_hash);
	redirect(`/${slug}`);
}

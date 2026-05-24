"use server";

import { redirect } from "next/navigation";
import { setSession, verifyLogin } from "@/lib/auth";

export async function loginAction(formData: FormData) {
	const password = String(formData.get("password") ?? "");
	const ok = await verifyLogin(password);
	if (!ok) {
		redirect("/admin/login?error=1");
	}
	await setSession();
	redirect("/admin");
}

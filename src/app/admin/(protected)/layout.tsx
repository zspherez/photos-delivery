import { redirect } from "next/navigation";
import Link from "next/link";
import AdminNav from "@/components/admin-nav";
import BrandMark from "@/components/brand-mark";
import { SITE } from "@/config/site";
import { isAdmin } from "@/lib/auth";
import { logoutAction } from "./actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	if (!(await isAdmin())) {
		redirect("/admin/login");
	}
	return (
		<div className="min-h-screen bg-neutral-950 text-neutral-100">
			<header className="sticky top-0 z-30 bg-neutral-950/85 backdrop-blur border-b border-neutral-900">
				<div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
					<Link
						href="/admin/galleries"
						className="group flex items-center gap-2.5 text-neutral-100 hover:text-white"
					>
						<BrandMark size={26} className="transition-opacity group-hover:opacity-90" />
						<span className="font-semibold tracking-tight">{SITE.brandName}</span>
						<span className="text-xs uppercase tracking-[0.15em] text-accent/80 font-medium">Admin</span>
					</Link>
					<div className="flex items-center gap-4">
						<AdminNav />
						<div className="w-px h-5 bg-neutral-800" />
						<form action={logoutAction}>
							<button
								type="submit"
								className="text-sm text-neutral-400 hover:text-neutral-100 transition px-2 py-1.5"
							>
								Sign out
							</button>
						</form>
					</div>
				</div>
			</header>
			<main className="max-w-6xl mx-auto px-6 py-10">{children}</main>
		</div>
	);
}

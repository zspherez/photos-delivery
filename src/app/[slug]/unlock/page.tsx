import { notFound } from "next/navigation";
import { db } from "@/lib/env";
import { unlockAction } from "./actions";

export default async function UnlockPage({
	params,
	searchParams,
}: {
	params: Promise<{ slug: string }>;
	searchParams: Promise<{ error?: string }>;
}) {
	const { slug } = await params;
	const { error } = await searchParams;
	const row = await db()
		.prepare("SELECT id, password_hash FROM galleries WHERE slug = ?")
		.bind(slug)
		.first<{ id: number; password_hash: string | null }>();
	if (!row) notFound();
	if (!row.password_hash) return null;

	const action = unlockAction.bind(null, slug);

	return (
		<main className="min-h-screen flex items-center justify-center px-4">
			<div className="w-full max-w-sm">
				<div className="text-center mb-8">
					<div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 mb-4 text-neutral-400">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
							<path d="M7 11V7a5 5 0 0 1 10 0v4" />
						</svg>
					</div>
					<h1 className="text-2xl font-semibold tracking-tight">Enter password</h1>
					<p className="text-sm text-neutral-400 mt-1">This gallery is private.</p>
				</div>
				<form
					action={action}
					className="space-y-4 rounded-lg bg-neutral-900/40 border border-neutral-900 p-6"
				>
					<input
						type="password"
						name="password"
						autoFocus
						required
						autoComplete="current-password"
						placeholder="Password"
						className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition"
					/>
					{error ? <p className="text-sm text-red-400">Incorrect password.</p> : null}
					<button
						type="submit"
						className="w-full rounded-md bg-neutral-100 text-neutral-950 font-medium px-3 py-2.5 hover:bg-white transition"
					>
						Unlock
					</button>
				</form>
			</div>
		</main>
	);
}

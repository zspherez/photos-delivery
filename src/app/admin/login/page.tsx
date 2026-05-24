import BrandMark from "@/components/brand-mark";
import { SITE } from "@/config/site";
import { loginAction } from "./actions";

export const metadata = { title: `Admin · ${SITE.brandName}` };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
	const { error } = await searchParams;
	return (
		<main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 px-4">
			<div className="w-full max-w-sm">
				<div className="text-center mb-8">
					<div className="flex justify-center mb-4">
						<BrandMark size={44} />
					</div>
					<h1 className="text-2xl font-semibold tracking-tight">{SITE.brandName}</h1>
					<p className="text-xs uppercase tracking-[0.2em] text-accent mt-2">Admin</p>
				</div>
				<form action={loginAction} className="space-y-4 rounded-lg bg-neutral-900/40 border border-neutral-900 p-6">
					<label className="block">
						<span className="block text-sm font-medium text-neutral-300 mb-1.5">Password</span>
						<input
							type="password"
							name="password"
							autoFocus
							autoComplete="current-password"
							required
							className="w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition"
						/>
					</label>
					{error ? <p className="text-sm text-red-400">Incorrect password.</p> : null}
					<button
						type="submit"
						className="w-full rounded-md bg-neutral-100 text-neutral-950 font-medium px-3 py-2.5 hover:bg-white transition"
					>
						Sign in
					</button>
				</form>
			</div>
		</main>
	);
}

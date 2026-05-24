import Link from "next/link";
import ClientPicker from "@/components/client-picker";
import { SITE } from "@/config/site";
import { db } from "@/lib/env";
import { PACKAGE_TYPES } from "@/lib/rates";
import type { Client } from "@/lib/types";
import { createGallery } from "./actions";

const inputClass =
	"w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition";

const labelClass = "block text-sm font-medium text-neutral-300 mb-1.5";
const helpClass = "block text-xs text-neutral-500 mt-1.5";

export default async function NewGalleryPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const { error } = await searchParams;
	const { results: clients } = await db()
		.prepare("SELECT id, name FROM clients ORDER BY name ASC")
		.all<Pick<Client, "id" | "name">>();

	return (
		<div className="max-w-2xl space-y-8">
			<div>
				<Link
					href="/admin/galleries"
					className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-100 transition"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
					Galleries
				</Link>
				<h1 className="text-3xl font-semibold tracking-tight mt-3">New gallery</h1>
			</div>

			<form action={createGallery} className="space-y-6">
				<Section title="Shoot details">
					<ClientPicker clients={clients} />
					<div className="grid grid-cols-2 gap-4">
						<label className="block">
							<span className={labelClass}>Shoot date</span>
							<input type="date" name="shoot_date" required className={inputClass} />
						</label>
						<label className="block">
							<span className={labelClass}>Venue</span>
							<input type="text" name="venue" placeholder="Elsewhere" className={inputClass} />
						</label>
					</div>
				</Section>

				<Section title="Package & rate">
					<label className="block">
						<span className={labelClass}>Package</span>
						<select name="package_type" required defaultValue="" className={inputClass}>
							<option value="">Select…</option>
							{PACKAGE_TYPES.map((p) => (
								<option key={p} value={p}>
									{p}
								</option>
							))}
						</select>
					</label>
					<div className="grid grid-cols-2 gap-4">
						<label className="block">
							<span className={labelClass}>Hours shot</span>
							<input type="number" name="hours_shot" step="0.25" min="0" placeholder="2" className={inputClass} />
						</label>
						<label className="block">
							<span className={labelClass}>Travel days</span>
							<input type="number" name="travel_days" step="1" min="0" defaultValue={0} className={inputClass} />
							<span className={helpClass}>$250 per day for shows outside NYC</span>
						</label>
					</div>
					<label className="block">
						<span className={labelClass}>Rate override (USD)</span>
						<input type="number" name="rate_override" step="0.01" min="0" className={inputClass} />
						<span className={helpClass}>Leave blank to use the rate card</span>
					</label>
				</Section>

				<Section title="Access">
					<label className="block">
						<span className={labelClass}>URL slug</span>
						<div className="flex items-center rounded-md bg-neutral-900 border border-neutral-800 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/40 transition">
							<span className="pl-3 pr-1 text-sm text-neutral-500 font-mono select-none">{SITE.domain}/</span>
							<input
								type="text"
								name="slug"
								pattern="[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?"
								placeholder="auto"
								className="flex-1 bg-transparent border-0 py-2.5 pr-3 text-neutral-100 placeholder-neutral-500 focus:outline-none font-mono"
							/>
						</div>
						<span className={helpClass}>Lowercase letters, digits, hyphens. Leave blank to auto-generate.</span>
					</label>
					<label className="block">
						<span className={labelClass}>Password</span>
						<input type="text" name="password" placeholder="Leave blank for link-only access" className={inputClass} />
					</label>
				</Section>

				<Section title="Notes">
					<label className="block">
						<span className={labelClass}>Internal notes</span>
						<textarea name="notes" rows={3} className={inputClass} />
					</label>
				</Section>

				{error ? (
					<p className="text-sm text-red-400">
						{error === "slug_taken"
							? "That slug is already taken."
							: error === "slug_invalid"
							? "Slug must be lowercase letters/digits/hyphens and not a reserved name."
							: "All required fields must be filled."}
					</p>
				) : null}

				<div className="flex items-center gap-3">
					<button
						type="submit"
						className="rounded-md bg-neutral-100 text-neutral-950 font-medium px-4 py-2.5 hover:bg-white transition"
					>
						Create gallery
					</button>
					<Link
						href="/admin/galleries"
						className="rounded-md border border-neutral-800 text-neutral-300 font-medium px-4 py-2.5 hover:bg-neutral-900 hover:border-neutral-700 transition"
					>
						Cancel
					</Link>
				</div>
			</form>
		</div>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-lg bg-neutral-900/30 border border-neutral-900 p-5 space-y-4">
			<h2 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">{title}</h2>
			{children}
		</div>
	);
}

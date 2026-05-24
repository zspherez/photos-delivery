import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE } from "@/config/site";
import { db } from "@/lib/env";
import { PACKAGE_TYPES } from "@/lib/rates";
import type { Client, Gallery } from "@/lib/types";
import { updateGallery } from "./actions";

const inputClass =
	"w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition";
const labelClass = "block text-sm font-medium text-neutral-300 mb-1.5";
const helpClass = "block text-xs text-neutral-500 mt-1.5";

export default async function EditGalleryPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ error?: string }>;
}) {
	const { id } = await params;
	const { error } = await searchParams;
	const galleryId = Number(id);

	const gallery = await db()
		.prepare("SELECT * FROM galleries WHERE id = ?")
		.bind(galleryId)
		.first<Gallery>();
	if (!gallery) notFound();

	const { results: clients } = await db()
		.prepare("SELECT id, name FROM clients ORDER BY name ASC")
		.all<Pick<Client, "id" | "name">>();

	const action = updateGallery.bind(null, galleryId);
	const overrideValue = gallery.rate_override_cents != null
		? (gallery.rate_override_cents / 100).toFixed(2)
		: "";
	const hasPassword = !!gallery.password_hash;

	return (
		<div className="max-w-2xl space-y-8">
			<div>
				<Link
					href={`/admin/galleries/${galleryId}`}
					className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-100 transition"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
					Gallery
				</Link>
				<h1 className="text-3xl font-semibold tracking-tight mt-3">Edit gallery</h1>
			</div>

			<form action={action} className="space-y-6">
				<Section title="Shoot details">
					<label className="block">
						<span className={labelClass}>Client</span>
						<select name="client_id" required defaultValue={String(gallery.client_id)} className={inputClass}>
							{clients.map((c) => (
								<option key={c.id} value={c.id}>
									{c.name}
								</option>
							))}
						</select>
					</label>
					<div className="grid grid-cols-2 gap-4">
						<label className="block">
							<span className={labelClass}>Shoot date</span>
							<input
								type="date"
								name="shoot_date"
								required
								defaultValue={gallery.shoot_date}
								className={inputClass}
							/>
						</label>
						<label className="block">
							<span className={labelClass}>Venue</span>
							<input
								type="text"
								name="venue"
								defaultValue={gallery.venue ?? ""}
								className={inputClass}
							/>
						</label>
					</div>
				</Section>

				<Section title="Package & rate">
					<label className="block">
						<span className={labelClass}>Package</span>
						<select
							name="package_type"
							required
							defaultValue={gallery.package_type}
							className={inputClass}
						>
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
							<input
								type="number"
								name="hours_shot"
								step="0.25"
								min="0"
								defaultValue={gallery.hours_shot ?? ""}
								className={inputClass}
							/>
						</label>
						<label className="block">
							<span className={labelClass}>Travel days</span>
							<input
								type="number"
								name="travel_days"
								step="1"
								min="0"
								defaultValue={gallery.travel_days}
								className={inputClass}
							/>
							<span className={helpClass}>$250 per day for shows outside NYC</span>
						</label>
					</div>
					<label className="block">
						<span className={labelClass}>Rate override (USD)</span>
						<input
							type="number"
							name="rate_override"
							step="0.01"
							min="0"
							defaultValue={overrideValue}
							className={inputClass}
						/>
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
								required
								defaultValue={gallery.slug}
								className="flex-1 bg-transparent border-0 py-2.5 pr-3 text-neutral-100 placeholder-neutral-500 focus:outline-none font-mono"
							/>
						</div>
						<span className={helpClass}>Changing this breaks the old link.</span>
					</label>
					<label className="block">
						<span className={labelClass}>
							Password {hasPassword ? <span className="text-accent">(set)</span> : <span className="text-neutral-500">(none)</span>}
						</span>
						<input
							type="text"
							name="password"
							placeholder={hasPassword ? "Type new password to change, or leave blank to keep" : "Set a password"}
							className={inputClass}
						/>
						{hasPassword ? (
							<label className="mt-2 inline-flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
								<input type="checkbox" name="clear_password" className="rounded" />
								Remove password (make gallery link-only)
							</label>
						) : null}
					</label>
				</Section>

				<Section title="Notes">
					<label className="block">
						<span className={labelClass}>Internal notes</span>
						<textarea
							name="notes"
							rows={3}
							defaultValue={gallery.notes ?? ""}
							className={inputClass}
						/>
					</label>
				</Section>

				{error ? (
					<p className="text-sm text-red-400">
						{error === "slug_taken"
							? "That slug is already taken by another gallery."
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
						Save changes
					</button>
					<Link
						href={`/admin/galleries/${galleryId}`}
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

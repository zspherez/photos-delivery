import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import GalleryView from "@/components/gallery-view";
import { SITE } from "@/config/site";
import { logEvent } from "@/lib/analytics";
import { db } from "@/lib/env";
import { isGalleryUnlocked } from "@/lib/gallery-auth";
import type { Asset, Gallery } from "@/lib/types";

type GalleryWithClient = Gallery & { client_name: string };

async function originFromHeaders(): Promise<string> {
	const h = await headers();
	const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
	const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
	return `${proto}://${host}`;
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ slug: string }>;
}): Promise<Metadata> {
	const { slug } = await params;
	const row = await db()
		.prepare(
			`SELECT g.shoot_date, g.venue, g.password_hash, c.name AS client_name,
				COALESCE(g.cover_asset_id, (SELECT id FROM assets WHERE gallery_id = g.id AND type = 'photo' ORDER BY sort_order ASC, id ASC LIMIT 1)) AS cover_asset_id
			FROM galleries g JOIN clients c ON c.id = g.client_id
			WHERE g.slug = ?`,
		)
		.bind(slug)
		.first<{
			shoot_date: string;
			venue: string | null;
			password_hash: string | null;
			client_name: string;
			cover_asset_id: number | null;
		}>();
	if (!row) return { title: `Gallery · ${SITE.brandName}` };

	const origin = await originFromHeaders();
	const title = `${row.client_name} · ${SITE.brandName}`;
	const description = `${row.shoot_date}${row.venue ? ` · ${row.venue}` : ""}`;
	const imageUrl = row.password_hash
		? `${origin}/api/og/locked`
		: row.cover_asset_id
		? `${origin}/img/${row.cover_asset_id}/web`
		: undefined;

	return {
		title,
		description,
		openGraph: {
			title,
			description,
			url: `${origin}/${slug}`,
			type: "website",
			images: imageUrl ? [{ url: imageUrl }] : undefined,
		},
		twitter: {
			card: imageUrl ? "summary_large_image" : "summary",
			title,
			description,
			images: imageUrl ? [imageUrl] : undefined,
		},
	};
}

export default async function GalleryPage({ params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const gallery = await db()
		.prepare(
			`SELECT g.*, c.name AS client_name
			FROM galleries g JOIN clients c ON c.id = g.client_id
			WHERE g.slug = ?`,
		)
		.bind(slug)
		.first<GalleryWithClient>();
	if (!gallery) notFound();

	if (gallery.expires_at && gallery.expires_at < Math.floor(Date.now() / 1000)) {
		return (
			<main className="min-h-screen flex items-center justify-center">
				<div className="text-center text-neutral-400">This gallery has expired.</div>
			</main>
		);
	}

	if (!(await isGalleryUnlocked(slug, gallery.password_hash))) {
		redirect(`/${slug}/unlock`);
	}

	logEvent(await headers(), gallery.id, "view");

	const { results: assets } = await db()
		.prepare("SELECT * FROM assets WHERE gallery_id = ? ORDER BY sort_order ASC, id ASC")
		.bind(gallery.id)
		.all<Asset>();

	return (
		<GalleryView
			slug={slug}
			title={gallery.client_name}
			subtitle={`${gallery.shoot_date}${gallery.venue ? ` · ${gallery.venue}` : ""}`}
			assets={assets.map((a) => ({
				id: a.id,
				type: a.type,
				original_filename: a.original_filename,
				content_type: a.content_type,
				width: a.width ?? 1200,
				height: a.height ?? 1600,
			}))}
		/>
	);
}

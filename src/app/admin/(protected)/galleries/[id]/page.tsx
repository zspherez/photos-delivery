import Link from "next/link";
import { notFound } from "next/navigation";
import AssetGrid from "@/components/asset-grid";
import GalleryAnalyticsSection from "@/components/gallery-analytics";
import GalleryShare from "@/components/gallery-share";
import InvoicePanel from "@/components/invoice-panel";
import UploadZone from "@/components/upload-zone";
import { getGalleryAnalytics } from "@/lib/analytics";
import { db } from "@/lib/env";
import { buildInvoicePreview } from "@/lib/invoice";
import { calculateRate, type PackageType } from "@/lib/rates";
import type { Asset, Gallery } from "@/lib/types";
import { formatMoney } from "@/lib/utils";

type GalleryWithClient = Gallery & { client_name: string };

function formatBytes(n: number): string {
	if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function GalleryDetail({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const gallery = await db()
		.prepare(
			`SELECT g.*, c.name AS client_name
			FROM galleries g
			JOIN clients c ON c.id = g.client_id
			WHERE g.id = ?`,
		)
		.bind(id)
		.first<GalleryWithClient>();

	if (!gallery) notFound();

	const { results: assets } = await db()
		.prepare("SELECT * FROM assets WHERE gallery_id = ? ORDER BY sort_order ASC, id ASC")
		.bind(gallery.id)
		.all<Asset>();

	const photoCount = assets.filter((a) => a.type === "photo").length;
	const videoCount = assets.filter((a) => a.type === "video").length;
	const totalBytes = assets.reduce((sum, a) => sum + a.bytes, 0);

	const rate = calculateRate(
		gallery.package_type as PackageType,
		gallery.hours_shot ?? 0,
		gallery.travel_days,
		gallery.rate_override_cents,
	);

	const invoicePreview = await buildInvoicePreview(gallery.id);
	const analytics = await getGalleryAnalytics(gallery.id);

	return (
		<div className="space-y-10">
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
				<div className="mt-3 flex items-start justify-between gap-4">
					<div>
						<h1 className="text-3xl font-semibold tracking-tight">{gallery.client_name}</h1>
						<dl className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-400">
							<Meta>{gallery.package_type}</Meta>
							<MetaDivider />
							<Meta>{gallery.hours_shot ?? 0}hr</Meta>
							<MetaDivider />
							<Meta className="font-mono">{gallery.shoot_date}</Meta>
							{gallery.venue ? (
								<>
									<MetaDivider />
									<Meta>{gallery.venue}</Meta>
								</>
							) : null}
							{gallery.password_hash ? (
								<>
									<MetaDivider />
									<span className="inline-flex items-center gap-1 text-accent">
										<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
											<rect x="3" y="11" width="18" height="11" rx="2" />
											<path d="M7 11V7a5 5 0 0 1 10 0v4" />
										</svg>
										password
									</span>
								</>
							) : null}
						</dl>
					</div>
					<div className="flex items-center gap-2 shrink-0">
						<Link
							href={`/admin/galleries/${gallery.id}/edit`}
							className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/50 px-3 py-1.5 text-sm font-medium text-neutral-200 hover:bg-neutral-900 hover:border-neutral-700 transition"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
							Edit
						</Link>
						<GalleryShare slug={gallery.slug} />
					</div>
				</div>
			</div>

			<section className="relative rounded-lg overflow-hidden border border-neutral-900 bg-gradient-to-br from-neutral-900/60 via-neutral-900/30 to-neutral-950 p-6">
				<div
					className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-accent to-transparent"
					aria-hidden="true"
				/>
				<div className="flex items-baseline justify-between gap-4">
					<div>
						<h2 className="text-xs font-medium text-accent uppercase tracking-[0.2em]">Rate</h2>
						<p className="text-sm text-neutral-400 mt-1.5">
							{rate.base_label}
							{rate.is_override ? (
								<span className="ml-2 inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider bg-accent/15 text-accent">
									override
								</span>
							) : null}
						</p>
					</div>
					<div className="text-4xl font-semibold tracking-tight text-accent tabular-nums">
						{formatMoney(invoicePreview?.total_cents ?? rate.total_cents)}
					</div>
				</div>
				{invoicePreview && invoicePreview.line_items.length > 0 ? (
					<div className="mt-5 pt-4 border-t border-neutral-900 text-sm space-y-1.5">
						{invoicePreview.line_items.map((li, i) => (
							<div key={i} className="flex justify-between text-neutral-300 gap-4">
								<span className="truncate">
									{li.description}
									{li.quantity > 1 ? (
										<span className="text-neutral-500"> × {li.quantity}</span>
									) : null}
								</span>
								<span className="font-mono text-neutral-400 tabular-nums shrink-0">
									{formatMoney(li.quantity * li.rate_cents)}
								</span>
							</div>
						))}
					</div>
				) : null}
			</section>

			<section className="space-y-5">
				<div className="flex items-baseline justify-between">
					<h2 className="text-xl font-semibold tracking-tight">Assets</h2>
					<div className="text-sm text-neutral-400">
						<span className="text-neutral-200 font-medium">{photoCount}</span> photos
						{videoCount > 0 ? (
							<>
								<span className="mx-2 text-neutral-700">·</span>
								<span className="text-neutral-200 font-medium">{videoCount}</span> videos
							</>
						) : null}
						<span className="mx-2 text-neutral-700">·</span>
						<span className="font-mono">{formatBytes(totalBytes)}</span>
					</div>
				</div>
				<UploadZone galleryId={gallery.id} />
				<AssetGrid
					galleryId={gallery.id}
					coverAssetId={gallery.cover_asset_id}
					assets={assets.map((a) => ({ id: a.id, type: a.type, original_filename: a.original_filename }))}
				/>
			</section>

			<section className="space-y-3">
				<h2 className="text-xl font-semibold tracking-tight">Invoice</h2>
				{invoicePreview ? (
					<InvoicePanel
						galleryId={gallery.id}
						invoiceNumber={invoicePreview.invoice_number}
						issuedDate={invoicePreview.issued_date}
						dueDate={invoicePreview.due_date}
						paymentTerms={invoicePreview.payment_terms}
						totalCents={invoicePreview.total_cents}
						lineItems={invoicePreview.line_items}
						clientEmail={invoicePreview.client.email}
						status={invoicePreview.existing_invoice_status}
						sentAt={invoicePreview.existing_invoice_sent_at}
					/>
				) : null}
			</section>

			<GalleryAnalyticsSection gallery={{ id: gallery.id }} analytics={analytics} />
		</div>
	);
}

function Meta({ children, className }: { children: React.ReactNode; className?: string }) {
	return <span className={className}>{children}</span>;
}

function MetaDivider() {
	return <span className="text-neutral-700">·</span>;
}

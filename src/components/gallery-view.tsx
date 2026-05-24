"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RowsPhotoAlbum } from "react-photo-album";
import "react-photo-album/rows.css";

type Asset = {
	id: number;
	type: "photo" | "video";
	original_filename: string;
	content_type: string;
	width: number;
	height: number;
};

function detectIOS(): boolean {
	if (typeof navigator === "undefined") return false;
	const ua = navigator.userAgent;
	// iPad on iPadOS reports as Mac but has touch.
	const isIpadOS = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
	return /iPad|iPhone|iPod/.test(ua) || isIpadOS;
}

function downloadUrl(id: number): string {
	return `/api/download/${id}`;
}

function fullUrl(asset: Asset): string {
	return asset.type === "video" ? `/api/asset/${asset.id}` : `/img/${asset.id}/web`;
}

export default function GalleryView({
	slug,
	title,
	subtitle,
	assets,
}: {
	slug: string;
	title: string;
	subtitle: string;
	assets: Asset[];
}) {
	const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
	const [isIOS, setIsIOS] = useState(false);
	const [showIOSTip, setShowIOSTip] = useState(false);
	const [showSaveModal, setShowSaveModal] = useState<null | "photo" | "video">(null);

	useEffect(() => {
		const ios = detectIOS();
		setIsIOS(ios);
		if (ios) setShowIOSTip(true);
	}, []);

	const close = useCallback(() => setLightboxIndex(null), []);
	const prev = useCallback(() => setLightboxIndex((i) => (i === null ? null : Math.max(0, i - 1))), []);
	const next = useCallback(
		() => setLightboxIndex((i) => (i === null ? null : Math.min(assets.length - 1, i + 1))),
		[assets.length],
	);

	useEffect(() => {
		if (lightboxIndex === null) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") close();
			else if (e.key === "ArrowLeft") prev();
			else if (e.key === "ArrowRight") next();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [lightboxIndex, close, prev, next]);

	const currentAsset = lightboxIndex !== null ? assets[lightboxIndex] : null;

	const handleDownload = useCallback(
		(asset: Asset) => {
			if (isIOS) {
				setShowSaveModal(asset.type);
				return;
			}
			// Desktop / non-iOS: trigger native download.
			const a = document.createElement("a");
			a.href = downloadUrl(asset.id);
			a.download = asset.original_filename;
			document.body.appendChild(a);
			a.click();
			a.remove();
		},
		[isIOS],
	);

	const photoCount = useMemo(() => assets.filter((a) => a.type === "photo").length, [assets]);
	const videoCount = assets.length - photoCount;

	return (
		<div>
			<header className="max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-8">
				<div className="flex items-end justify-between gap-6 flex-wrap">
					<div>
						<p className="text-xs uppercase tracking-[0.2em] text-accent font-medium mb-3">
							{photoCount} photo{photoCount === 1 ? "" : "s"}
							{videoCount > 0 ? ` · ${videoCount} video${videoCount === 1 ? "" : "s"}` : ""}
						</p>
						<h1 className="text-4xl sm:text-5xl font-semibold tracking-tight">{title}</h1>
						<p className="mt-2 text-neutral-400 text-base sm:text-lg">{subtitle}</p>
					</div>
					{!isIOS && assets.length > 0 ? (
						<a
							href={`/api/galleries/${slug}/zip`}
							className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/50 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-900 hover:border-neutral-700 transition"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
								<polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
								<line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
							</svg>
							Download all
						</a>
					) : null}
				</div>
			</header>

			{showIOSTip ? (
				<div className="max-w-6xl mx-auto px-4 sm:px-6 mb-6">
					<div className="rounded-md bg-amber-950/30 border border-amber-900/40 px-4 py-3 text-sm flex items-start gap-3">
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							className="text-amber-400 mt-0.5 shrink-0"
						>
							<circle cx="12" cy="12" r="10" />
							<line x1="12" y1="8" x2="12" y2="12" />
							<line x1="12" y1="16" x2="12.01" y2="16" />
						</svg>
						<div className="flex-1 text-neutral-200">
							To save to Photos on iPhone: <strong className="text-white">tap a photo</strong>, then
							<strong className="text-white"> press and hold</strong> and choose <em>Save to Photos</em>.
						</div>
						<button
							onClick={() => setShowIOSTip(false)}
							className="text-neutral-500 hover:text-neutral-200 -mt-0.5"
							aria-label="Dismiss"
						>
							×
						</button>
					</div>
				</div>
			) : null}

			<div className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
				<RowsPhotoAlbum
					photos={assets
						.filter((a) => a.type === "photo")
						.map((a) => ({
							key: String(a.id),
							src: `/img/${a.id}/thumb`,
							width: a.width,
							height: a.height,
							alt: a.original_filename,
						}))}
					targetRowHeight={240}
					spacing={6}
					onClick={({ index }) => {
						// Photo album index maps to filtered photos; find true asset index.
						const photos = assets.filter((a) => a.type === "photo");
						const id = photos[index].id;
						setLightboxIndex(assets.findIndex((a) => a.id === id));
					}}
				/>
			</div>

			{currentAsset ? (
				<Lightbox
					asset={currentAsset}
					index={lightboxIndex!}
					total={assets.length}
					onClose={close}
					onPrev={prev}
					onNext={next}
					onDownload={() => handleDownload(currentAsset)}
				/>
			) : null}

			{showSaveModal ? (
				<SaveModal type={showSaveModal} onClose={() => setShowSaveModal(null)} />
			) : null}
		</div>
	);
}

function Lightbox({
	asset,
	index,
	total,
	onClose,
	onPrev,
	onNext,
	onDownload,
}: {
	asset: Asset;
	index: number;
	total: number;
	onClose: () => void;
	onPrev: () => void;
	onNext: () => void;
	onDownload: () => void;
}) {
	return (
		<div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex flex-col" onClick={onClose}>
			<div
				className="flex items-center justify-between px-4 sm:px-6 py-3 text-neutral-300"
				onClick={(e) => e.stopPropagation()}
			>
				<span className="text-sm font-mono text-neutral-500">
					{index + 1} / {total}
				</span>
				<div className="flex items-center gap-2">
					<button
						onClick={onDownload}
						className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/70 px-3 py-1.5 text-sm font-medium text-neutral-100 hover:bg-neutral-800 hover:border-neutral-700 transition"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
							<polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
							<line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
						Download
					</button>
					<button
						onClick={onClose}
						className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-neutral-900 text-neutral-400 hover:text-white transition"
						aria-label="Close"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
							<line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
						</svg>
					</button>
				</div>
			</div>
			<div
				className="flex-1 min-h-0 flex items-center justify-center px-4 pb-4 relative"
				onClick={(e) => e.stopPropagation()}
			>
				{index > 0 ? (
					<button
						onClick={onPrev}
						className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-neutral-200 hover:text-white transition backdrop-blur-sm"
						aria-label="Previous"
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</button>
				) : null}
				{asset.type === "photo" ? (
					// eslint-disable-next-line @next/next/no-img-element
					<img
						src={`/img/${asset.id}/web`}
						alt={asset.original_filename}
						className="max-h-full max-w-full object-contain"
					/>
				) : (
					<video src={`/api/asset/${asset.id}`} controls playsInline className="max-h-full max-w-full" />
				)}
				{index < total - 1 ? (
					<button
						onClick={onNext}
						className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/70 text-neutral-200 hover:text-white transition backdrop-blur-sm"
						aria-label="Next"
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
							<polyline points="9 18 15 12 9 6" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					</button>
				) : null}
			</div>
		</div>
	);
}

function SaveModal({ type, onClose }: { type: "photo" | "video"; onClose: () => void }) {
	return (
		<div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
			<div
				className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-sm text-sm"
				onClick={(e) => e.stopPropagation()}
			>
				<h2 className="text-lg font-medium mb-2">Save to Photos</h2>
				{type === "photo" ? (
					<p className="text-neutral-300">
						On iPhone, downloads don&apos;t go to the Photos app directly. To save:
						<br />
						<br />
						<strong>1.</strong> Press and hold the full-screen photo.
						<br />
						<strong>2.</strong> Choose <em>Save to Photos</em>.
					</p>
				) : (
					<p className="text-neutral-300">
						To save a video to your Photos app:
						<br />
						<br />
						<strong>1.</strong> Tap the share icon in the video player.
						<br />
						<strong>2.</strong> Choose <em>Save Video</em>.
					</p>
				)}
				<button
					onClick={onClose}
					className="mt-4 w-full rounded-md bg-neutral-100 text-neutral-900 font-medium px-3 py-2"
				>
					Got it
				</button>
			</div>
		</div>
	);
}

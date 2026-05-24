"use client";

import { useState, useTransition } from "react";
import { deleteAssets, setCoverPhoto } from "@/app/admin/(protected)/galleries/[id]/actions";

type Asset = {
	id: number;
	type: "photo" | "video";
	original_filename: string;
};

export default function AssetGrid({
	galleryId,
	coverAssetId,
	assets,
}: {
	galleryId: number;
	coverAssetId: number | null;
	assets: Asset[];
}) {
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
	const [hidden, setHidden] = useState<Set<number>>(new Set());
	const [localCover, setLocalCover] = useState<number | null>(coverAssetId);
	const [isPending, startTransition] = useTransition();

	const visible = assets.filter((a) => !hidden.has(a.id));
	const selectedCount = selectedIds.size;

	function handleClick(asset: Asset, index: number, shift: boolean) {
		const next = new Set(selectedIds);
		if (shift && lastClickedIndex !== null) {
			const start = Math.min(lastClickedIndex, index);
			const end = Math.max(lastClickedIndex, index);
			const anchor = visible[lastClickedIndex];
			const add = anchor ? next.has(anchor.id) : true;
			for (let i = start; i <= end; i++) {
				if (add) next.add(visible[i].id);
				else next.delete(visible[i].id);
			}
		} else {
			if (next.has(asset.id)) next.delete(asset.id);
			else next.add(asset.id);
		}
		setSelectedIds(next);
		setLastClickedIndex(index);
	}

	function clearSelection() {
		setSelectedIds(new Set());
		setLastClickedIndex(null);
	}

	function selectAll() {
		setSelectedIds(new Set(visible.map((a) => a.id)));
	}

	function deleteSelected() {
		const ids = Array.from(selectedIds);
		const n = ids.length;
		if (!confirm(`Delete ${n} item${n === 1 ? "" : "s"}? This can't be undone.`)) return;
		startTransition(async () => {
			try {
				await deleteAssets(ids);
				setHidden((prev) => new Set([...prev, ...ids]));
				clearSelection();
			} catch (err) {
				alert(err instanceof Error ? err.message : "Delete failed");
			}
		});
	}

	function toggleCover(assetId: number) {
		const next = localCover === assetId ? null : assetId;
		setLocalCover(next);
		startTransition(async () => {
			try {
				await setCoverPhoto(galleryId, next);
			} catch (err) {
				setLocalCover(localCover); // revert
				alert(err instanceof Error ? err.message : "Failed to set cover");
			}
		});
	}

	if (visible.length === 0) return null;

	return (
		<div className="space-y-3">
			{selectedCount > 0 ? (
				<div className="sticky top-14 z-20 -mx-6 px-6 py-2.5 bg-neutral-950/95 backdrop-blur border-b border-neutral-900 flex items-center justify-between">
					<div className="flex items-center gap-3 text-sm">
						<strong>{selectedCount}</strong>
						<span className="text-neutral-400">selected</span>
						<button onClick={clearSelection} className="text-neutral-400 hover:text-neutral-100">
							Clear
						</button>
						{selectedCount < visible.length ? (
							<button onClick={selectAll} className="text-neutral-400 hover:text-neutral-100">
								Select all ({visible.length})
							</button>
						) : null}
					</div>
					<button
						onClick={deleteSelected}
						disabled={isPending}
						className="rounded-md bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-1.5 text-sm disabled:opacity-50"
					>
						{isPending ? "Deleting…" : `Delete ${selectedCount}`}
					</button>
				</div>
			) : null}

			<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
				{visible.map((asset, i) => (
					<Card
						key={asset.id}
						asset={asset}
						isSelected={selectedIds.has(asset.id)}
						isCover={localCover === asset.id}
						onClick={(e) => handleClick(asset, i, e.shiftKey)}
						onToggleCover={() => toggleCover(asset.id)}
					/>
				))}
			</div>

			<p className="text-xs text-neutral-500">
				Tip: click to select, shift-click for range. Star a photo to use as the gallery cover.
			</p>
		</div>
	);
}

function Card({
	asset,
	isSelected,
	isCover,
	onClick,
	onToggleCover,
}: {
	asset: Asset;
	isSelected: boolean;
	isCover: boolean;
	onClick: (e: React.MouseEvent) => void;
	onToggleCover: () => void;
}) {
	return (
		<div
			onClick={onClick}
			className={`relative aspect-square bg-neutral-900 rounded overflow-hidden cursor-pointer group select-none ${
				isSelected ? "ring-2 ring-blue-500" : isCover ? "ring-2 ring-accent" : ""
			}`}
		>
			{asset.type === "photo" ? (
				// eslint-disable-next-line @next/next/no-img-element
				<img
					src={`/img/${asset.id}/thumb`}
					alt={asset.original_filename}
					className={`absolute inset-0 w-full h-full object-cover transition ${
						isSelected ? "scale-95" : ""
					}`}
					loading="lazy"
					draggable={false}
				/>
			) : (
				<div className="absolute inset-0 flex items-center justify-center text-neutral-500 text-xs uppercase">
					video
				</div>
			)}
			<div
				className={`absolute top-2 left-2 w-6 h-6 rounded-full border-2 flex items-center justify-center text-white text-xs font-bold transition ${
					isSelected
						? "bg-blue-500 border-blue-500 opacity-100"
						: "border-white/90 bg-black/30 opacity-0 group-hover:opacity-100"
				}`}
			>
				{isSelected ? "✓" : null}
			</div>
			{asset.type === "photo" ? (
				<button
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onToggleCover();
					}}
					className={`absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition ${
						isCover
							? "bg-accent text-neutral-950 opacity-100"
							: "bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70"
					}`}
					aria-label={isCover ? "Remove cover" : "Set as cover"}
					title={isCover ? "Cover photo" : "Set as cover"}
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill={isCover ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
						<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" strokeLinejoin="round" />
					</svg>
				</button>
			) : null}
			{isCover ? (
				<div className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-accent/90 text-neutral-950 text-[10px] font-medium uppercase tracking-wider">
					Cover
				</div>
			) : null}
		</div>
	);
}

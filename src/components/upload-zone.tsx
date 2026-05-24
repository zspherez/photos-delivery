"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const PART_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_PARALLEL_FILES = 3;
const MAX_PARALLEL_PARTS = 4;
const MAX_IMAGE_BYTES = 18 * 1024 * 1024; // Cloudflare Image Transformations input cap

type UploadStatus = "pending" | "uploading" | "done" | "error";

type FileUpload = {
	id: string;
	file: File;
	status: UploadStatus;
	progress: number; // 0..1
	error?: string;
};

type StartResp = { key: string; uploadId: string };
type SignPartResp = { url: string };
type CompleteResp = { asset_id: number };

async function startUpload(galleryId: number, file: File): Promise<StartResp> {
	const res = await fetch("/api/upload/start", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			gallery_id: galleryId,
			filename: file.name,
			content_type: file.type || "application/octet-stream",
			size: file.size,
		}),
	});
	if (!res.ok) {
		let detail = "";
		try {
			const j = (await res.json()) as { error?: string };
			detail = j.error ? `: ${j.error}` : "";
		} catch {}
		throw new Error(`start failed: ${res.status}${detail}`);
	}
	return res.json();
}

async function signPart(key: string, uploadId: string, partNumber: number): Promise<string> {
	const url = `/api/upload/sign-part?key=${encodeURIComponent(key)}&uploadId=${encodeURIComponent(
		uploadId,
	)}&partNumber=${partNumber}`;
	const res = await fetch(url);
	if (!res.ok) throw new Error(`sign-part failed: ${res.status}`);
	const json: SignPartResp = await res.json();
	return json.url;
}

async function uploadPart(
	url: string,
	chunk: Blob,
	onProgress: (loaded: number) => void,
): Promise<string> {
	// Use XMLHttpRequest to track upload progress (fetch doesn't expose upload progress yet)
	return new Promise<string>((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", url);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress(e.loaded);
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				const etag = xhr.getResponseHeader("ETag");
				if (!etag) reject(new Error("no ETag header in response"));
				else resolve(etag.replace(/"/g, ""));
			} else {
				reject(new Error(`part upload failed: ${xhr.status} ${xhr.responseText}`));
			}
		};
		xhr.onerror = () => reject(new Error("part upload network error"));
		xhr.send(chunk);
	});
}

async function completeUpload(
	galleryId: number,
	file: File,
	key: string,
	uploadId: string,
	parts: { partNumber: number; etag: string }[],
	dims: { width: number; height: number } | null,
): Promise<CompleteResp> {
	const res = await fetch("/api/upload/complete", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			gallery_id: galleryId,
			filename: file.name,
			content_type: file.type || "application/octet-stream",
			size: file.size,
			key,
			uploadId,
			parts,
			width: dims?.width,
			height: dims?.height,
		}),
	});
	if (!res.ok) throw new Error(`complete failed: ${res.status}`);
	return res.json();
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
	if (!file.type.startsWith("image/")) return null;
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () => {
			resolve({ width: img.naturalWidth, height: img.naturalHeight });
			URL.revokeObjectURL(url);
		};
		img.onerror = () => {
			URL.revokeObjectURL(url);
			resolve(null);
		};
		img.src = url;
	});
}

async function abortUpload(key: string, uploadId: string): Promise<void> {
	await fetch("/api/upload/abort", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ key, uploadId }),
	}).catch(() => {});
}

async function uploadFile(
	galleryId: number,
	file: File,
	onProgress: (p: number) => void,
): Promise<void> {
	const dims = await getImageDimensions(file);
	const { key, uploadId } = await startUpload(galleryId, file);
	const totalParts = Math.max(1, Math.ceil(file.size / PART_SIZE));
	const partProgress = new Array(totalParts).fill(0) as number[];

	const updateProgress = () => {
		const totalLoaded = partProgress.reduce((a, b) => a + b, 0);
		onProgress(file.size === 0 ? 1 : totalLoaded / file.size);
	};

	const partResults = new Array<{ partNumber: number; etag: string }>(totalParts);

	try {
		// Run parts with bounded concurrency
		let nextIndex = 0;
		async function worker() {
			while (true) {
				const i = nextIndex++;
				if (i >= totalParts) return;
				const partNumber = i + 1;
				const start = i * PART_SIZE;
				const end = Math.min(start + PART_SIZE, file.size);
				const chunk = file.slice(start, end);
				const url = await signPart(key, uploadId, partNumber);
				const etag = await uploadPart(url, chunk, (loaded) => {
					partProgress[i] = loaded;
					updateProgress();
				});
				partResults[i] = { partNumber, etag };
				// Mark this part fully loaded in case progress events undercounted
				partProgress[i] = end - start;
				updateProgress();
			}
		}
		await Promise.all(
			Array.from({ length: Math.min(MAX_PARALLEL_PARTS, totalParts) }, () => worker()),
		);
		await completeUpload(galleryId, file, key, uploadId, partResults, dims);
	} catch (err) {
		await abortUpload(key, uploadId);
		throw err;
	}
}

function formatBytes(n: number): string {
	if (n < 1024) return `${n} B`;
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
	if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
	return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function UploadZone({ galleryId }: { galleryId: number }) {
	const router = useRouter();
	const [uploads, setUploads] = useState<FileUpload[]>([]);
	const [isDragging, setIsDragging] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const updateUpload = useCallback((id: string, patch: Partial<FileUpload>) => {
		setUploads((prev) => prev.map((u) => (u.id === id ? { ...u, ...patch } : u)));
	}, []);

	const startBatch = useCallback(
		async (files: File[]) => {
			const newUploads: FileUpload[] = files.map((file) => {
				const isImage = file.type.startsWith("image/");
				const tooBig = isImage && file.size > MAX_IMAGE_BYTES;
				return {
					id: crypto.randomUUID(),
					file,
					status: tooBig ? "error" : "pending",
					progress: 0,
					error: tooBig
						? `Image is ${(file.size / (1024 * 1024)).toFixed(1)} MB — limit is 18 MB. Resize and re-upload.`
						: undefined,
				};
			});
			setUploads((prev) => [...prev, ...newUploads]);

			let cursor = 0;
			async function worker() {
				while (true) {
					const i = cursor++;
					if (i >= newUploads.length) return;
					const u = newUploads[i];
					if (u.status === "error") continue; // pre-flight rejection (size cap, etc.)
					updateUpload(u.id, { status: "uploading" });
					try {
						await uploadFile(galleryId, u.file, (p) => updateUpload(u.id, { progress: p }));
						updateUpload(u.id, { status: "done", progress: 1 });
					} catch (err) {
						updateUpload(u.id, {
							status: "error",
							error: err instanceof Error ? err.message : String(err),
						});
					}
				}
			}
			await Promise.all(
				Array.from({ length: Math.min(MAX_PARALLEL_FILES, newUploads.length) }, () => worker()),
			);
			router.refresh();
		},
		[galleryId, updateUpload, router],
	);

	const onDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault();
			setIsDragging(false);
			const files = Array.from(e.dataTransfer.files);
			if (files.length) startBatch(files);
		},
		[startBatch],
	);

	const onPick = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(e.target.files ?? []);
			if (files.length) startBatch(files);
			if (inputRef.current) inputRef.current.value = "";
		},
		[startBatch],
	);

	const anyActive = uploads.some((u) => u.status === "uploading" || u.status === "pending");

	return (
		<div className="space-y-4">
			<div
				onDragOver={(e) => {
					e.preventDefault();
					setIsDragging(true);
				}}
				onDragLeave={() => setIsDragging(false)}
				onDrop={onDrop}
				onClick={() => inputRef.current?.click()}
				className={`rounded-lg border border-dashed p-10 text-center cursor-pointer transition ${
					isDragging
						? "border-neutral-500 bg-neutral-900/60"
						: "border-neutral-800 bg-neutral-900/20 hover:border-neutral-700 hover:bg-neutral-900/40"
				}`}
			>
				<input
					ref={inputRef}
					type="file"
					multiple
					accept="image/*,video/*"
					className="hidden"
					onChange={onPick}
				/>
				<div className="flex justify-center mb-3 text-neutral-500">
					<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
						<polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round" />
						<line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
				</div>
				<p className="text-neutral-200 font-medium">Drag photos & videos here</p>
				<p className="text-sm text-neutral-500 mt-1">or click to choose files</p>
			</div>

			{uploads.length > 0 ? (
				<div className="rounded-lg border border-neutral-900 divide-y divide-neutral-900 bg-neutral-900/20">
					{uploads.map((u) => (
						<div key={u.id} className="px-4 py-2.5 flex items-center gap-4">
							<div className="flex-1 min-w-0">
								<div className="text-sm truncate text-neutral-200">{u.file.name}</div>
								<div className="text-xs text-neutral-500 mt-0.5 font-mono">{formatBytes(u.file.size)}</div>
							</div>
							<div className="w-40 sm:w-56">
								{u.status === "error" ? (
									<div className="text-xs text-red-400 truncate" title={u.error}>
										{u.error}
									</div>
								) : (
									<div className="h-1 bg-neutral-800 rounded-full overflow-hidden">
										<div
											className={`h-full transition-all duration-300 ${
												u.status === "done" ? "bg-emerald-500" : "bg-neutral-200"
											}`}
											style={{ width: `${Math.round(u.progress * 100)}%` }}
										/>
									</div>
								)}
							</div>
							<div className="w-10 text-right text-xs font-mono text-neutral-500">
								{u.status === "done" ? (
									<span className="text-emerald-400">✓</span>
								) : u.status === "error" ? (
									<span className="text-red-400">!</span>
								) : (
									`${Math.round(u.progress * 100)}%`
								)}
							</div>
						</div>
					))}
				</div>
			) : null}

			{anyActive ? (
				<p className="text-xs text-neutral-500">Keep this tab open until uploads finish.</p>
			) : null}
		</div>
	);
}

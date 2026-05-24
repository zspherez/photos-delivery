"use client";

import { useState } from "react";

export default function GalleryShare({ slug }: { slug: string }) {
	const [copied, setCopied] = useState(false);

	function copy() {
		const url = `${window.location.protocol}//${window.location.host}/${slug}`;
		navigator.clipboard.writeText(url).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 1500);
		});
	}

	return (
		<button
			onClick={copy}
			className="inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-900/50 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900 hover:border-neutral-700 transition font-mono"
			title="Copy share link"
		>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
				{copied ? (
					<polyline points="20 6 9 17 4 12" strokeLinecap="round" strokeLinejoin="round" />
				) : (
					<>
						<rect x="9" y="9" width="13" height="13" rx="2" />
						<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
					</>
				)}
			</svg>
			<span>{copied ? "Copied" : `/${slug}`}</span>
		</button>
	);
}

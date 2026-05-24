import { ImageResponse } from "next/og";
import { SITE } from "@/config/site";

export async function GET(req: Request) {
	const cache = (typeof caches !== "undefined"
		? (caches as unknown as { default: Cache }).default
		: null);
	const cacheKey = new Request(req.url, { method: "GET" });
	if (cache) {
		const cached = await cache.match(cacheKey);
		if (cached) return cached;
	}

	const origin = new URL(req.url).origin;
	const logoUrl = `${origin}/logo.png`;

	// Logo PNG is 2000×1500 (4:3). Render at the same aspect so it doesn't squish.
	// The R glyph occupies only the middle ~40% of the canvas, so size generously.
	const logoWidth = 600;
	const logoHeight = Math.round((logoWidth * 1500) / 2000);

	const response = new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					background: "#0a0a0a",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					fontFamily: "ui-sans-serif, system-ui, sans-serif",
				}}
			>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src={logoUrl}
					width={logoWidth}
					height={logoHeight}
					style={{ display: "block" }}
					alt=""
				/>
				<div
					style={{
						marginTop: 40,
						color: "#a5a5e0",
						fontSize: 32,
						letterSpacing: 12,
						textTransform: "uppercase",
						fontWeight: 600,
						display: "flex",
					}}
				>
					Private Gallery
				</div>
				<div
					style={{
						marginTop: 18,
						color: "#737373",
						fontSize: 22,
						display: "flex",
					}}
				>
					{SITE.brandName}
				</div>
			</div>
		),
		{
			width: 1200,
			height: 630,
			headers: {
				"Cache-Control": "public, max-age=86400, immutable",
			},
		},
	);
	if (cache) await cache.put(cacheKey, response.clone());
	return response;
}

import BrandMark from "@/components/brand-mark";
import { SITE } from "@/config/site";

export default function GalleryLayout({ children }: { children: React.ReactNode }) {
	const marketingHost = SITE.marketingUrl.replace(/^https?:\/\//, "");
	return (
		<div className="min-h-screen flex flex-col bg-neutral-950 text-neutral-100">
			<div className="flex-1">{children}</div>
			<footer className="border-t border-neutral-900 py-6 px-4 sm:px-6">
				<div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-neutral-500">
					<div className="flex items-center gap-2">
						<BrandMark size={18} />
						<span className="font-medium text-neutral-400">{SITE.brandName}</span>
					</div>
					<a
						href={SITE.marketingUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="hover:text-accent transition"
					>
						{marketingHost} →
					</a>
				</div>
			</footer>
		</div>
	);
}

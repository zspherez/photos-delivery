import { SITE } from "@/config/site";

export default function BrandMark({ size = 24, className = "" }: { size?: number; className?: string }) {
	// eslint-disable-next-line @next/next/no-img-element
	return <img src="/logo.png" alt={SITE.brandName} width={size} height={size} className={className} />;
}

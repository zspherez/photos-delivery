import { SITE } from "@/config/site";

export default function Home() {
	return (
		<main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
			<div className="text-center">
				<h1 className="text-4xl font-semibold tracking-tight">{SITE.brandName}</h1>
				<p className="mt-2 text-neutral-400">Galleries are accessed by direct link.</p>
			</div>
		</main>
	);
}

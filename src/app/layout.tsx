import type { Metadata } from "next";
import { Source_Sans_3, Source_Code_Pro } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
	variable: "--font-source-sans",
	subsets: ["latin"],
	weight: ["300", "400", "500", "600", "700"],
});

const sourceMono = Source_Code_Pro({
	variable: "--font-source-mono",
	subsets: ["latin"],
	weight: ["400", "500", "600"],
});

import { SITE } from "@/config/site";

export const metadata: Metadata = {
	title: SITE.brandName,
	description: "Photo and video gallery delivery",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<head>
				<link rel="icon" href="/favicon.svg" type="image/svg+xml"></link>
			</head>
			<body className={`${sourceSans.variable} ${sourceMono.variable} antialiased`}>{children}</body>
		</html>
	);
}

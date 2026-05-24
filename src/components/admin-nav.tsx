"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
	{ href: "/admin/galleries", label: "Galleries" },
	{ href: "/admin/clients", label: "Clients" },
	{ href: "/admin/invoices", label: "Invoices" },
];

export default function AdminNav() {
	const pathname = usePathname();
	return (
		<nav className="flex items-center gap-1 text-sm">
			{ITEMS.map((item) => {
				const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
				return (
					<Link
						key={item.href}
						href={item.href}
						className={`relative px-3 py-1.5 rounded-md transition ${
							active
								? "text-neutral-50 bg-neutral-900"
								: "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900/60"
						}`}
					>
						{item.label}
						{active ? (
							<span className="absolute inset-x-3 -bottom-0.5 h-px bg-accent" aria-hidden="true" />
						) : null}
					</Link>
				);
			})}
		</nav>
	);
}

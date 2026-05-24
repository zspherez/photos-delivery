"use client";

import { useState } from "react";

type ClientOption = { id: number; name: string };

const inputClass =
	"w-full rounded-md bg-neutral-900 border border-neutral-800 px-3 py-2.5 text-neutral-100 placeholder-neutral-500 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/40 transition";
const labelClass = "block text-sm font-medium text-neutral-300 mb-1.5";

export default function ClientPicker({ clients }: { clients: ClientOption[] }) {
	const [selected, setSelected] = useState("");
	const isNew = selected === "new";

	return (
		<div className="space-y-3">
			<label className="block">
				<span className={labelClass}>Client</span>
				<select
					value={selected}
					onChange={(e) => setSelected(e.target.value)}
					name={isNew ? undefined : "client_id"}
					required={!isNew}
					className={inputClass}
				>
					<option value="">Select…</option>
					{clients.map((c) => (
						<option key={c.id} value={c.id}>
							{c.name}
						</option>
					))}
					<option value="new">+ Create new client…</option>
				</select>
			</label>

			{isNew ? (
				<div className="rounded-md border border-accent/30 bg-accent/[0.04] p-4 space-y-3">
					<div className="flex items-center justify-between">
						<span className="text-xs font-medium text-accent uppercase tracking-wider">New client</span>
						<button
							type="button"
							onClick={() => setSelected("")}
							className="text-xs text-neutral-500 hover:text-neutral-200"
						>
							Cancel
						</button>
					</div>
					<label className="block">
						<span className={labelClass}>Name</span>
						<input
							type="text"
							name="new_client_name"
							required
							autoFocus
							placeholder="MARTHA"
							className={inputClass}
						/>
					</label>
					<div className="grid grid-cols-2 gap-3">
						<label className="block">
							<span className={labelClass}>Email</span>
							<input
								type="email"
								name="new_client_email"
								placeholder="client@example.com"
								className={inputClass}
							/>
						</label>
						<label className="block">
							<span className={labelClass}>Phone</span>
							<input type="text" name="new_client_phone" className={inputClass} />
						</label>
					</div>
					<label className="block">
						<span className={labelClass}>Billing address</span>
						<textarea name="new_client_billing_address" rows={2} className={inputClass} />
					</label>
					<p className="text-xs text-neutral-500">
						The client will be created when you save the gallery.
					</p>
				</div>
			) : null}
		</div>
	);
}

export type Client = {
	id: number;
	name: string;
	email: string | null;
	phone: string | null;
	billing_address: string | null;
	default_hourly_rate_cents: number | null;
	created_at: number;
	updated_at: number;
};

export type Gallery = {
	id: number;
	slug: string;
	client_id: number;
	shoot_date: string;
	venue: string | null;
	package_type: string;
	hours_shot: number | null;
	travel_days: number;
	rate_override_cents: number | null;
	password_hash: string | null;
	password_salt: string | null;
	cover_asset_id: number | null;
	expires_at: number | null;
	notes: string | null;
	created_at: number;
	updated_at: number;
};

export type Asset = {
	id: number;
	gallery_id: number;
	type: "photo" | "video";
	sort_order: number;
	original_key: string;
	bytes: number;
	original_filename: string;
	content_type: string;
	width: number | null;
	height: number | null;
	duration_seconds: number | null;
	uploaded_at: number;
	created_at: number;
};

export type DownloadEvent = {
	id: number;
	gallery_id: number;
	asset_id: number | null;
	event_type: "view" | "asset_download" | "zip_download";
	ip: string | null;
	user_agent: string | null;
	country: string | null;
	at: number;
};

export type InvoiceLineItem = {
	description: string;
	quantity: number;
	rate_cents: number;
};

export type Invoice = {
	id: number;
	invoice_number: string;
	gallery_id: number;
	client_id: number;
	status: "draft" | "sent" | "paid" | "void";
	amount_cents: number;
	line_items_json: string;
	issued_date: string;
	due_date: string;
	payment_terms: string;
	sent_at: number | null;
	paid_at: number | null;
	notes: string | null;
	created_at: number;
	updated_at: number;
};

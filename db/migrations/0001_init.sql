-- Schema for photos-delivery
-- Conventions:
--   * IDs are INTEGER PRIMARY KEY (efficient, never exposed in public URLs)
--   * Timestamps are INTEGER unix epoch seconds (created_at, updated_at, etc.)
--   * Dates are TEXT in YYYY-MM-DD format (shoot_date, issued_date, due_date)
--   * Money is INTEGER cents
--   * Galleries are publicly identified by `slug`, not by id

PRAGMA foreign_keys = ON;

CREATE TABLE clients (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	email TEXT,
	phone TEXT,
	billing_address TEXT,
	default_hourly_rate_cents INTEGER,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);

CREATE TABLE galleries (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	slug TEXT NOT NULL UNIQUE,
	client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
	shoot_date TEXT NOT NULL,
	venue TEXT,
	package_type TEXT NOT NULL,
	hours_shot REAL,
	password_hash TEXT,
	password_salt TEXT,
	cover_asset_id INTEGER,
	expires_at INTEGER,
	notes TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);
CREATE INDEX idx_galleries_client_id ON galleries(client_id);

CREATE TABLE assets (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	gallery_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
	type TEXT NOT NULL CHECK (type IN ('photo', 'video')),
	sort_order INTEGER NOT NULL DEFAULT 0,
	original_key TEXT NOT NULL,
	bytes INTEGER NOT NULL,
	original_filename TEXT NOT NULL,
	content_type TEXT NOT NULL,
	width INTEGER,
	height INTEGER,
	duration_seconds REAL,
	uploaded_at INTEGER NOT NULL,
	created_at INTEGER NOT NULL
);
CREATE INDEX idx_assets_gallery_id ON assets(gallery_id, sort_order);

CREATE TABLE download_events (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	gallery_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE CASCADE,
	asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
	event_type TEXT NOT NULL CHECK (event_type IN ('view', 'asset_download', 'zip_download')),
	ip TEXT,
	user_agent TEXT,
	country TEXT,
	at INTEGER NOT NULL
);
CREATE INDEX idx_download_events_gallery_id ON download_events(gallery_id, at);
CREATE INDEX idx_download_events_asset_id ON download_events(asset_id);

CREATE TABLE invoices (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	invoice_number TEXT NOT NULL UNIQUE,
	gallery_id INTEGER NOT NULL REFERENCES galleries(id) ON DELETE RESTRICT,
	client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
	status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'void')),
	amount_cents INTEGER NOT NULL,
	line_items_json TEXT NOT NULL,
	issued_date TEXT NOT NULL,
	due_date TEXT NOT NULL,
	payment_terms TEXT NOT NULL DEFAULT 'NET30',
	sent_at INTEGER,
	paid_at INTEGER,
	notes TEXT,
	created_at INTEGER NOT NULL,
	updated_at INTEGER NOT NULL
);
CREATE INDEX idx_invoices_gallery_id ON invoices(gallery_id);
CREATE INDEX idx_invoices_client_id ON invoices(client_id);

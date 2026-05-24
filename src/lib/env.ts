import { getCloudflareContext } from "@opennextjs/cloudflare";

export function env() {
	return getCloudflareContext().env as CloudflareEnv & {
		ADMIN_PASSWORD: string;
		SESSION_SECRET: string;
		RESEND_API_KEY: string;
		BANK_ACCOUNT_NUMBER: string;
		BANK_ROUTING_NUMBER: string;
		BANK_NAME: string;
		BANK_ACCOUNT_TYPE: string;
		VENMO_PHONE: string;
		R2_ACCESS_KEY_ID: string;
		R2_SECRET_ACCESS_KEY: string;
		R2_JURISDICTION_ENDPOINT: string;
		INVOICE_FROM_EMAIL: string;
	};
}

export function db() {
	return env().DB;
}

export function bucket() {
	return env().BUCKET;
}

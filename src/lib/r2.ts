import { AwsClient } from "aws4fetch";
import { env } from "./env";

const BUCKET_NAME = "photos-delivery-assets";
const PRESIGN_EXPIRES_SECONDS = 6 * 60 * 60;

function client() {
	const { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = env();
	return new AwsClient({
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
		region: "auto",
		service: "s3",
	});
}

function objectUrl(key: string): string {
	return `${env().R2_JURISDICTION_ENDPOINT}/${BUCKET_NAME}/${encodeURI(key)}`;
}

export async function createMultipartUpload(key: string, contentType: string): Promise<string> {
	const url = `${objectUrl(key)}?uploads`;
	const res = await client().fetch(url, {
		method: "POST",
		headers: { "Content-Type": contentType },
	});
	if (!res.ok) throw new Error(`createMultipartUpload failed: ${res.status} ${await res.text()}`);
	const xml = await res.text();
	const m = xml.match(/<UploadId>([^<]+)<\/UploadId>/);
	if (!m) throw new Error(`Could not parse UploadId from response: ${xml}`);
	return m[1];
}

export async function presignUploadPartUrl(
	key: string,
	uploadId: string,
	partNumber: number,
): Promise<string> {
	const url = new URL(objectUrl(key));
	url.searchParams.set("partNumber", String(partNumber));
	url.searchParams.set("uploadId", uploadId);
	url.searchParams.set("X-Amz-Expires", String(PRESIGN_EXPIRES_SECONDS));
	const signed = await client().sign(new Request(url, { method: "PUT" }), {
		aws: { signQuery: true },
	});
	return signed.url;
}

export async function completeMultipartUpload(
	key: string,
	uploadId: string,
	parts: { partNumber: number; etag: string }[],
): Promise<void> {
	const url = `${objectUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`;
	const body =
		`<CompleteMultipartUpload>` +
		parts
			.sort((a, b) => a.partNumber - b.partNumber)
			.map(
				(p) =>
					`<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${escapeXml(p.etag)}</ETag></Part>`,
			)
			.join("") +
		`</CompleteMultipartUpload>`;
	const res = await client().fetch(url, {
		method: "POST",
		body,
		headers: { "Content-Type": "application/xml" },
	});
	if (!res.ok) throw new Error(`completeMultipartUpload failed: ${res.status} ${await res.text()}`);
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
	const url = `${objectUrl(key)}?uploadId=${encodeURIComponent(uploadId)}`;
	const res = await client().fetch(url, { method: "DELETE" });
	if (!res.ok && res.status !== 404) {
		throw new Error(`abortMultipartUpload failed: ${res.status} ${await res.text()}`);
	}
}

export async function deleteObject(key: string): Promise<void> {
	const res = await client().fetch(objectUrl(key), { method: "DELETE" });
	if (!res.ok && res.status !== 404) {
		throw new Error(`deleteObject failed: ${res.status} ${await res.text()}`);
	}
}

export async function getObject(key: string, rangeHeader?: string | null): Promise<Response | null> {
	const headers: Record<string, string> = {};
	if (rangeHeader) headers["Range"] = rangeHeader;
	const res = await client().fetch(objectUrl(key), { method: "GET", headers });
	if (res.status === 404) return null;
	if (!res.ok && res.status !== 206) throw new Error(`getObject failed: ${res.status}`);
	return res;
}

export async function putObject(
	key: string,
	body: ArrayBuffer | Uint8Array,
	contentType: string,
): Promise<void> {
	const bytes = body instanceof Uint8Array ? body : new Uint8Array(body);
	const res = await client().fetch(objectUrl(key), {
		method: "PUT",
		body: bytes as BodyInit,
		headers: {
			"Content-Type": contentType,
			"Content-Length": String(bytes.byteLength),
		},
	});
	if (!res.ok) throw new Error(`putObject failed: ${res.status} ${await res.text()}`);
}

function escapeXml(s: string): string {
	return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

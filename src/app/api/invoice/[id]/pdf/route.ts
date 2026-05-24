import { isAdmin } from "@/lib/auth";
import { buildInvoicePreview, renderInvoicePdf } from "@/lib/invoice";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
	if (!(await isAdmin())) return new Response("unauthorized", { status: 401 });
	const { id } = await params;
	const preview = await buildInvoicePreview(Number(id));
	if (!preview) return new Response("not found", { status: 404 });

	const origin = new URL(req.url).origin;
	const pdfBytes = await renderInvoicePdf(preview, origin);
	const inline = new URL(req.url).searchParams.get("download") !== "1";

	return new Response(new Uint8Array(pdfBytes), {
		headers: {
			"Content-Type": "application/pdf",
			"Content-Length": String(pdfBytes.length),
			"Content-Disposition": `${inline ? "inline" : "attachment"}; filename="Invoice ${preview.invoice_number}.pdf"`,
			"Cache-Control": "no-store",
		},
	});
}

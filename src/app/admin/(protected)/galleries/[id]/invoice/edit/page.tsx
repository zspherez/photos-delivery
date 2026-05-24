import Link from "next/link";
import { notFound } from "next/navigation";
import InvoiceEditor from "@/components/invoice-editor";
import { buildInvoicePreview } from "@/lib/invoice";

export default async function EditInvoicePage({ params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const galleryId = Number(id);
	const preview = await buildInvoicePreview(galleryId);
	if (!preview) notFound();

	return (
		<div className="max-w-3xl space-y-8">
			<div>
				<Link
					href={`/admin/galleries/${galleryId}`}
					className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-100 transition"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
						<polyline points="15 18 9 12 15 6" strokeLinecap="round" strokeLinejoin="round" />
					</svg>
					{preview.gallery.client_name}
				</Link>
				<h1 className="text-3xl font-semibold tracking-tight mt-3">Edit invoice</h1>
			</div>
			<InvoiceEditor
				galleryId={galleryId}
				invoiceNumber={preview.invoice_number}
				issuedDate={preview.issued_date}
				dueDate={preview.due_date}
				paymentTerms={preview.payment_terms}
				lineItems={preview.line_items}
			/>
		</div>
	);
}

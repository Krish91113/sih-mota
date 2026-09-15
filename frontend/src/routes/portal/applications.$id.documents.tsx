import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader, StatusBadge, DocumentCard } from "@/components/mota/bits";
import { UploadZone } from "@/components/mota/UploadZone";
import { DocumentViewer } from "@/components/mota/DocumentViewer";
import { useApplicationQuery } from "@/hooks/api/useApplications";
import { useDocumentsQuery } from "@/hooks/api/useDocuments";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import { useState } from "react";
import { ArrowRight, ShieldCheck, Upload, TriangleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatBytes } from "@/lib/utils";

export const Route = createFileRoute("/portal/applications/$id/documents")({
  component: DocumentsForApplication,
});

const DOCUMENT_SLOTS = [
  { value: "MARKSHEET", label: "Academic Marksheet / Transcript" },
  { value: "CASTE_CERTIFICATE", label: "Scheduled Tribe (ST) Certificate" },
  { value: "INCOME_CERTIFICATE", label: "Income Certificate / Self-Declaration" },
  { value: "ENROLMENT_CERTIFICATE", label: "Institution Admission / Enrolment Proof" },
  { value: "BANK_PASSBOOK", label: "Bank Passbook / Cancelled Cheque" },
  { value: "AADHAAR_CARD", label: "Aadhaar / Identity Proof" },
  { value: "OTHER", label: "Other Supporting Document" },
];

function DocumentsForApplication() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const appQuery = useApplicationQuery(id);
  const documentsQuery = useDocumentsQuery({ application_id: id });
  const [selectedSlot, setSelectedSlot] = useState("MARKSHEET");

  const app = appQuery.data;
  const rawDocs = documentsQuery.data ?? [];
  const documents = rawDocs.map((document) => {
    const size = document["size"];
    const versions = document["versions"];
    const filename = String(document["filename"] || document["document_type"] || "Document");
    const docStatus = String(document["status"] || "PENDING");
    return {
      ...document,
      name: filename,
      file: filename,
      size: size ? formatBytes(String(size)) : "—",
      versions: Number(versions ?? 1),
      status: docStatus,
      required: true,
    };
  });

  const [preview, setPreview] = useState<string | null>(null);
  const previewDoc = documents.find((d) => d.id === preview || d.name === preview);

  const verifiedCount = documents.filter(
    (d) => d.status === "VERIFIED" || d.status === "HUMAN_VERIFIED",
  ).length;
  const pendingCount = documents.filter(
    (d) => d.status === "PENDING" || d.status === "READY",
  ).length;
  const rejectedCount = documents.filter(
    (d) => d.status === "REJECTED" || d.status === "NEEDS_RESUBMISSION",
  ).length;

  if (appQuery.isLoading || documentsQuery.isLoading)
    return <p className="py-12 text-sm text-muted-foreground">Loading documents…</p>;
  if (appQuery.isError || documentsQuery.isError || !app)
    return <p className="py-12 text-sm text-destructive">We could not load these documents.</p>;

  return (
    <div>
      <PageHeader
        title="Application Documents"
        desc={`Upload and track required marksheets and certificates for ${app["application_number"] || app.id}.`}
        action={
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link to="/portal/applications/$id" params={{ id: app.id }}>
              <ArrowRight className="size-4 rotate-180" aria-hidden /> Back to application
            </Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="border-leaf/30 bg-leaf/5 shadow-card">
          <CardContent className="p-4 text-center">
            <p className="font-display text-2xl text-leaf">{verifiedCount}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="p-4 text-center">
            <p className="font-display text-2xl">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Uploaded & Pending Verification</p>
          </CardContent>
        </Card>
        <Card className="border-destructive/30 bg-destructive/5 shadow-card">
          <CardContent className="p-4 text-center">
            <p className="font-display text-2xl text-destructive">{rejectedCount}</p>
            <p className="text-xs text-muted-foreground">Needs Replacement</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {documents.map((d) => (
          <div
            key={d.id || d.name}
            onClick={() => d.file && setPreview(d.id || d.name)}
            className={d.file ? "cursor-pointer" : ""}
          >
            <DocumentCard doc={d} />
          </div>
        ))}

        <Card className="border-dashed shadow-card">
          <CardContent className="p-5">
            <p className="text-sm font-semibold flex items-center gap-2">
              <Upload className="size-4 text-primary" /> Upload Marksheets & Certificates
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Select the document type slot and upload your scanned PDF or clear photograph.
            </p>
            <div className="mt-3">
              <Label className="text-xs text-muted-foreground uppercase">Document Slot</Label>
              <Select value={selectedSlot} onValueChange={setSelectedSlot}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_SLOTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="mt-4">
              <UploadZone
                applicationId={app.id}
                documentType={selectedSlot}
                onUploaded={() => {
                  qc.invalidateQueries({ queryKey: queryKeys.documents.all });
                  qc.invalidateQueries({ queryKey: queryKeys.applications.detail(app.id) });
                  toast.success("Document uploaded to application");
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 flex items-start gap-3 rounded-xl border bg-accent/40 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="text-xs text-muted-foreground">
          Uploads are encrypted and stored in secure cloud storage. Each document is reviewed
          against the scheme checklist during institutional verification and state scrutiny.
        </p>
      </div>

      <DocumentViewer
        open={!!previewDoc}
        onOpenChange={(o) => !o && setPreview(null)}
        title={previewDoc?.name ?? "Document"}
        file={previewDoc?.file}
        size={previewDoc?.size}
        status={previewDoc?.status ?? "Pending"}
        versions={previewDoc?.versions ?? 1}
        {...(previewDoc?.id ? { documentId: previewDoc.id } : {})}
      />
    </div>
  );
}

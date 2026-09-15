import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader, StatusBadge } from "@/components/mota/bits";
import { DataTable, type Column } from "@/components/mota/DataTable";
import { useDocumentsQuery } from "@/hooks/api/useDocuments";
import { useApplicationsQuery } from "@/hooks/api/useApplications";
import type { DocumentMeta } from "@/api/documents";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadZone } from "@/components/mota/UploadZone";
import { DocumentViewer } from "@/components/mota/DocumentViewer";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/queryKeys";
import { useState } from "react";
import { formatBytes } from "@/lib/utils";
import {
  FileText,
  FolderOpen,
  Plus,
  ShieldCheck,
  Upload,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  TriangleAlert,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/documents")({
  head: () => ({
    meta: [{ title: "Document Locker | Applicant Portal" }],
  }),
  component: MyDocuments,
});

const LOCKER_SLOTS = [
  { value: "CASTE_CERTIFICATE", label: "Scheduled Tribe (ST) Certificate" },
  { value: "MARKSHEET", label: "Academic Marksheet / Transcript" },
  { value: "ENROLMENT_CERTIFICATE", label: "Institution Admission / Enrolment Proof" },
  { value: "INCOME_CERTIFICATE", label: "Income Certificate / Self-Declaration" },
  { value: "BANK_PASSBOOK", label: "Bank Passbook First Page / Cancelled Cheque" },
  { value: "AADHAAR_CARD", label: "Aadhaar / Domicile Identity Proof" },
  { value: "RESEARCH_PROPOSAL", label: "Ph.D / Research Synopsis" },
  { value: "OTHER", label: "Other Supporting Certificate" },
];

type DocumentRow = DocumentMeta & {
  name: string;
  typeLabel: string;
  sizeFormatted: string;
  status: string;
  date: string;
  versions?: number;
};

function MyDocuments() {
  const qc = useQueryClient();
  const query = useDocumentsQuery();
  const appsQuery = useApplicationsQuery();
  const activeApp = appsQuery.data?.[0];

  const [selectedSlot, setSelectedSlot] = useState("CASTE_CERTIFICATE");
  const [showUpload, setShowUpload] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null);

  const isLoading = query.isLoading || appsQuery.isLoading;
  const isError = query.isError;

  const rawDocs = query.data ?? [];
  const documents: DocumentRow[] = rawDocs.map((doc) => {
    const slot = LOCKER_SLOTS.find((s) => s.value === doc.document_type);
    const size = doc["size"];
    const versions = doc["versions"];
    const base = {
      ...doc,
      name: doc["filename"] || doc["document_type"] || "Document",
      typeLabel: slot?.label || doc["document_type"] || "General Document",
      sizeFormatted: size ? formatBytes(String(size)) : "—",
      status: doc["status"] || "READY",
      date: doc["created_at"] ? new Date(String(doc["created_at"])).toLocaleDateString() : "Recent",
    };
    return versions !== undefined ? { ...base, versions: Number(versions) } : base;
  });

  const verifiedCount = documents.filter(
    (d) => d.status === "VERIFIED" || d.status === "HUMAN_VERIFIED",
  ).length;
  const pendingCount = documents.filter(
    (d) => d.status === "READY" || d.status === "PENDING",
  ).length;
  const issueCount = documents.filter(
    (d) => d.status === "REJECTED" || d.status === "NEEDS_RESUBMISSION",
  ).length;

  const columns: Column<DocumentRow>[] = [
    {
      key: "name",
      header: "Document File",
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileText className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-medium text-foreground">{r.name}</p>
            <p className="text-xs text-muted-foreground">{r.typeLabel}</p>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      header: "Verification Status",
      sortValue: (r) => r.status,
      cell: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "sizeFormatted",
      header: "Size",
      sortValue: (r) => r.sizeFormatted,
      cell: (r) => (
        <span className="text-xs text-muted-foreground font-mono">{r.sizeFormatted}</span>
      ),
      hideBelowLg: true,
    },
    {
      key: "date",
      header: "Uploaded Date",
      sortValue: (r) => r.date,
      cell: (r) => <span className="text-xs text-muted-foreground">{r.date}</span>,
      hideBelowLg: true,
    },
    {
      key: "actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewDoc(r);
            }}
          >
            <Eye className="size-3.5 mr-1" /> View
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Document Locker"
        desc="Upload and manage your persistent certificates, marksheets, and identity proofs. Documents stored here are automatically attached to any scheme applications you submit."
        action={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowUpload(!showUpload)}>
              <Upload className="size-4 mr-1.5" /> {showUpload ? "Hide Upload" : "Upload Document"}
            </Button>
            {activeApp ? (
              <Button asChild variant="outline">
                <Link to="/portal/applications/$id/documents" params={{ id: activeApp.id }}>
                  <FolderOpen className="size-4 mr-1.5" /> Active Application
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FolderOpen className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold">{documents.length}</p>
              <p className="text-xs text-muted-foreground">Total Documents in Locker</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-leaf/30 bg-leaf/5 shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex size-12 items-center justify-center rounded-xl bg-leaf/10 text-leaf">
              <CheckCircle2 className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold text-leaf">{verifiedCount}</p>
              <p className="text-xs text-muted-foreground">Verified by Authorities</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-accent/40 bg-accent/20 shadow-card">
          <CardContent className="flex items-center gap-4 p-5">
            <span className="flex size-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
              <Clock className="size-6" />
            </span>
            <div>
              <p className="text-2xl font-bold">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Uploaded & Pending Review</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isError ? (
        <Card className="mb-6 border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <TriangleAlert className="size-6 text-destructive" aria-hidden />
            <p className="text-sm font-medium">Could not load your document locker</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Your files are safe. This is usually a temporary network or service issue. You can
              still upload documents below.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => qc.invalidateQueries({ queryKey: queryKeys.documents.all })}
            >
              <RefreshCw className="size-3.5 mr-1" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {isLoading ? (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Loading your document locker…
          </CardContent>
        </Card>
      ) : null}

      {/* Upload Zone Card */}
      {showUpload || documents.length === 0 ? (
        <Card className="mb-6 border-primary/30 shadow-card">
          <CardHeader className="border-b border-dashed pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="size-4 text-primary" /> Upload to Document Locker
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <div className="grid gap-5 md:grid-cols-[16rem_1fr]">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground uppercase">
                  Select Document Category
                </Label>
                <Select value={selectedSlot} onValueChange={setSelectedSlot}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Choose document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCKER_SLOTS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-3 text-xs text-muted-foreground">
                  Your uploaded file will be verified during institution verification and officer
                  scrutiny.
                </p>
              </div>

              <div>
                <UploadZone
                  documentType={selectedSlot}
                  label={`Upload ${LOCKER_SLOTS.find((s) => s.value === selectedSlot)?.label || "Document"}`}
                  onUploaded={() => {
                    qc.invalidateQueries({ queryKey: queryKeys.documents.all });
                    toast.success("Document added to your Document Locker!");
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Documents Table */}
      <DataTable
        data={documents}
        columns={columns}
        getRowKey={(r) => r.id || r.name}
        searchPlaceholder="Search by document name or category..."
        searchKeys={(r) => `${r.name} ${r.typeLabel} ${r.status}`}
        onRowClick={(r) => setPreviewDoc(r)}
      />

      <div className="mt-6 flex items-start gap-3 rounded-xl border bg-accent/40 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p className="text-xs text-muted-foreground">
          <strong>Master FRD Compliance:</strong> Documents in your locker are secured with SHA-256
          integrity hashing and stored encrypted in cloud storage. Whenever you apply to any MoTA
          scheme, required documents are automatically linked to save you from re-uploading.
        </p>
      </div>

      <DocumentViewer
        open={!!previewDoc}
        onOpenChange={(o) => !o && setPreviewDoc(null)}
        title={previewDoc?.name ?? "Document"}
        file={previewDoc?.filename}
        size={previewDoc?.sizeFormatted}
        status={previewDoc?.status ?? "Pending"}
        versions={Number(previewDoc?.versions ?? 1)}
        {...(previewDoc?.id ? { documentId: previewDoc.id } : {})}
      />
    </div>
  );
}

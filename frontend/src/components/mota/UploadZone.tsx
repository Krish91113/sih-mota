import { useRef, useState, type DragEvent } from "react";
import { cn, megabytesToBytes } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CheckCircle2, FileText, Loader2, Upload, X, TriangleAlert } from "lucide-react";
import { uploadDocumentFile } from "@/api/documents";
import { toast } from "sonner";

export function UploadZone({
  accept = "application/pdf,image/jpeg,image/png",
  maxSizeMB = 10,
  applicationId,
  documentType = "MARKSHEET",
  onUploaded,
  label = "Drag & drop or tap to upload",
}: {
  accept?: string;
  maxSizeMB?: number;
  applicationId?: string;
  documentType?: string;
  onUploaded?: (doc?: unknown) => void;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState<{ name: string; size: number; progress: number } | null>(null);
  const [state, setState] = useState<"none" | "uploading" | "processing" | "error">("none");
  const [error, setError] = useState<string | undefined>();

  const handleFiles = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    if (f.size > megabytesToBytes(maxSizeMB)) {
      setState("error");
      setError(`File exceeds the ${maxSizeMB} MB limit. Compress and try again.`);
      return;
    }
    setError(undefined);
    setFile({ name: f.name, size: f.size, progress: 20 });
    setState("uploading");

    try {
      const formData = new FormData();
      formData.append("file", f);

      const params: Record<string, string> = {};
      if (applicationId) params["application_id"] = applicationId;
      if (documentType) params["document_type"] = documentType;

      setFile((prev) => (prev ? { ...prev, progress: 55 } : prev));

      const res = await uploadDocumentFile(formData, params);

      setFile((prev) => (prev ? { ...prev, progress: 100 } : prev));
      setState("processing");
      toast.success(`${f.name} uploaded successfully`);
      onUploaded?.(res);
      setTimeout(() => {
        setState("none");
        setFile(null);
      }, 2500);
    } catch (err: unknown) {
      setState("error");
      const msg =
        err instanceof Error ? err.message : "Failed to upload document. Please try again.";
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        aria-label="Upload a document"
        className={cn(
          "flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors cursor-pointer",
          dragging
            ? "border-primary bg-primary/5"
            : "border-border bg-surface/60 hover:border-primary/50 hover:bg-accent/40",
        )}
      >
        <span className="rounded-full bg-accent p-3 text-accent-foreground">
          <Upload className="size-5" aria-hidden />
        </span>
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">
          PDF, JPG or PNG up to {maxSizeMB} MB · stored securely via ImageKit CDN
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {state === "uploading" && file ? (
        <div className="rounded-lg border bg-card p-4" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2 font-medium">
              <FileText className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="truncate">{file.name}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground font-mono">
              {Math.round(file.progress)}%
            </span>
          </div>
          <Progress value={file.progress} className="mt-3 h-1.5" />
        </div>
      ) : null}

      {state === "processing" ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-leaf/30 bg-leaf/10 p-3 text-sm"
          role="status"
          aria-live="polite"
        >
          <CheckCircle2 className="size-4 shrink-0 text-leaf" aria-hidden />
          <span className="text-leaf">Document uploaded and indexed successfully.</span>
        </div>
      ) : null}

      {state === "error" ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <span className="flex items-center gap-2 text-destructive">
            <TriangleAlert className="size-4 shrink-0" aria-hidden /> {error}
          </span>
          <Button variant="ghost" size="sm" className="h-7" onClick={() => setState("none")}>
            <X className="size-3.5" aria-hidden /> Dismiss
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ProcessingIndicator({
  label = "Reading document and checking readability…",
}: {
  label?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-lg border bg-card p-3 text-sm text-muted-foreground"
      role="status"
    >
      <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden />
      {label}
    </div>
  );
}

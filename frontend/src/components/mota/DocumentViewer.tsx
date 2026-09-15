import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge, AiConfidenceBadge } from "@/components/mota/bits";
import {
  FileText,
  History,
  Download,
  Eye,
  ShieldCheck,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { getDownloadUrl } from "@/api/documents";
import { getAccessToken } from "@/api/client";

export function DocumentViewer({
  open,
  onOpenChange,
  title,
  file,
  size,
  status,
  documentId,
  versions = 1,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  file?: string | undefined;
  size?: string | undefined;
  status: string;
  documentId?: string | undefined;
  versions?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Fetch a short-lived download URL whenever the viewer opens.
  useEffect(() => {
    if (!open || !documentId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDownloadUrl(null);
    getDownloadUrl(documentId)
      .then((res) => {
        if (cancelled) return;
        setDownloadUrl(res.url);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not generate a preview link. Try again.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, documentId]);
  const signedDownloadUrl = downloadUrl ?? "";

  const handleDownload = () => {
    if (!signedDownloadUrl) return;
    const a = document.createElement("a");
    a.href = signedDownloadUrl;
    a.download = file || "document";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const previewUrl = signedDownloadUrl;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="size-5 text-primary" aria-hidden /> {title}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
          <div className="rounded-xl border bg-surface p-6">
            {loading ? (
              <div
                className="flex min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
                <p className="text-sm">Generating a secure preview link…</p>
              </div>
            ) : error ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
                <TriangleAlert className="size-6 text-destructive" aria-hidden />
                <p className="text-sm font-medium">Preview unavailable</p>
                <p className="max-w-xs text-xs text-muted-foreground">{error}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    // Re-trigger the effect by toggling state
                    setError(null);
                    setLoading(false);
                  }}
                >
                  Try again
                </Button>
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                title={`Preview of ${title}`}
                className="h-[480px] w-full rounded-lg border bg-white"
                sandbox="allow-scripts allow-same-origin allow-downloads allow-forms"
              />
            ) : (
              <div
                className="mx-auto max-w-sm space-y-4 rounded-lg bg-white p-5 shadow-card"
                aria-label={`Preview of ${title}`}
              >
                <div className="space-y-1.5 border-b border-dashed pb-4">
                  <div className="h-2 w-2/3 rounded bg-ink/10" />
                  <div className="h-2 w-1/2 rounded bg-ink/10" />
                  <div className="h-2 w-3/4 rounded bg-ink/10" />
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full rounded bg-ink/10" />
                  <div className="h-2 w-full rounded bg-ink/10" />
                  <div className="h-2 w-5/6 rounded bg-ink/10" />
                  <div className="h-2 w-full rounded bg-ink/10" />
                  <div className="h-2 w-2/3 rounded bg-ink/10" />
                </div>
                <div className="flex items-center justify-center rounded-lg bg-primary/10 py-10 text-primary">
                  <ShieldCheck className="size-10" aria-hidden />
                </div>
                <div className="space-y-2">
                  <div className="h-2 w-full rounded bg-ink/10" />
                  <div className="h-2 w-3/4 rounded bg-ink/10" />
                </div>
              </div>
            )}
            <p className="mt-4 text-center text-xs text-muted-foreground">
              {file} · {size} · Securely streamed from ImageKit CDN.
            </p>
          </div>

          <aside className="space-y-4">
            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Document status
              </p>
              <div className="mt-2">
                <StatusBadge status={status} />
              </div>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Details
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">File</dt>
                  <dd className="truncate font-medium">{file}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Size</dt>
                  <dd className="font-medium">{size}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Versions</dt>
                  <dd className="font-medium">{versions}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Automated review
              </p>
              <div className="mt-2">
                <AiConfidenceBadge label="Readability confidence" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                AI review not yet available — manual verification in progress.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <History className="size-3.5" aria-hidden /> Version history
              </p>
              <ul className="mt-3 space-y-2">
                {Array.from({ length: versions }).map((_, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-xs"
                  >
                    <span>
                      v{versions - i} ·{" "}
                      {versions - i === versions
                        ? "current upload"
                        : i === 0
                          ? "replacement"
                          : "original"}
                    </span>
                    <span className="text-muted-foreground">—</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" disabled={!signedDownloadUrl} onClick={handleDownload}>
                <Download className="size-4" aria-hidden /> Download
              </Button>
              <Button
                variant="outline"
                disabled={!signedDownloadUrl}
                onClick={() => {
                  if (signedDownloadUrl) window.open(signedDownloadUrl, "_blank", "noopener");
                }}
              >
                <Eye className="size-4" aria-hidden /> Open original
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              Documents open only through links issued by the portal.{""}
              <Link
                to="/guidelines"
                className="ml-1 text-primary underline-offset-2 hover:underline"
              >
                Guidelines
              </Link>
            </p>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

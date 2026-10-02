import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  PageHeader,
  KpiCard,
  Field,
  StatusBadge,
  ToneBadge,
  LoadingBlock,
  ErrorBlock,
} from "@/components/mota/bits";
import { useConsentHistoryQuery, useCurrentConsentQuery } from "@/hooks/api/useConsent";
import { useCreateConsentMutation, useRevokeConsentMutation } from "@/hooks/api/useConsent";
import { isConsentActive } from "@/api/consent";
import { formatDateTime, formatJson, humanizeField } from "@/lib/format";
import { useState } from "react";
import { ShieldCheck, ShieldOff, ScrollText, FileSignature } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/portal/consent")({
  head: () => ({ meta: [{ title: "Consent & Privacy | Applicant Portal" }] }),
  component: ConsentCentre,
});

/**
 * Consent is fully driven by the live `/consent` endpoints:
 * `GET /consent/current` (active grants), `GET /consent/history` (everything
 * ever recorded), `POST /consent` (grant) and `POST /consent/{id}/revoke`.
 * No consent state is assumed locally.
 */
function ConsentCentre() {
  const current = useCurrentConsentQuery();
  const history = useConsentHistoryQuery();
  const createMutation = useCreateConsentMutation();
  const revokeMutation = useRevokeConsentMutation();

  const [consentType, setConsentType] = useState("DATA_PROCESSING");
  const [purpose, setPurpose] = useState("Application processing");
  const [policyVersion, setPolicyVersion] = useState("1.0");
  const [scope, setScope] = useState("DATA_VERIFICATION");

  const activeRows = current.data ?? [];
  const allRows = history.data ?? [];
  const revoked = allRows.filter((c) => !isConsentActive(c)).length;
  const granted = allRows.filter((c) => isConsentActive(c)).length;

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync({
        consent_type: consentType,
        purpose,
        policy_version: policyVersion,
        scope,
        granted: true,
      });
      toast.success("Consent recorded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record consent");
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeMutation.mutateAsync({ id, reason: "Revoked from the applicant portal" });
      toast.success("Consent revoked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke consent");
    }
  };

  return (
    <div>
      <PageHeader
        title="Consent & privacy"
        desc="Every consent you have granted to process your data, and the full history of what was granted or withdrawn."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Active consents" value={String(activeRows.length)} icon={ShieldCheck} />
        <KpiCard label="Ever granted" value={String(granted)} icon={FileSignature} />
        <KpiCard label="Revoked" value={String(revoked)} icon={ShieldOff} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-leaf" aria-hidden /> Active consents
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {current.isLoading ? (
              <LoadingBlock label="Loading active consents" />
            ) : current.isError ? (
              <ErrorBlock
                label="Could not load your active consents"
                onRetry={() => void current.refetch()}
              />
            ) : activeRows.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                You have no active consents. Grant one below to let us process your applications.
              </p>
            ) : (
              <ul className="space-y-4">
                {activeRows.map((c) => (
                  <li key={c.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">{humanizeField(c.consent_type)}</p>
                      <ToneBadge tone="success">
                        <ShieldCheck className="size-3.5" aria-hidden /> Active
                      </ToneBadge>
                    </div>
                    <dl className="mt-3 grid gap-4 sm:grid-cols-2">
                      <Field label="Purpose" value={c.purpose ?? "—"} />
                      <Field label="Scope" value={humanizeField(c.scope)} />
                      <Field label="Policy version" value={c.policy_version ?? "—"} />
                      <Field label="Granted at" value={formatDateTime(c.granted_at)} />
                      {c.application_id ? (
                        <Field label="Application" value={c.application_id} />
                      ) : null}
                    </dl>
                    <div className="mt-4 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={revokeMutation.isPending}
                        onClick={() => void handleRevoke(c.id)}
                      >
                        <ShieldOff className="size-4" aria-hidden /> Revoke this consent
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="border-b border-dashed pb-3">
            <CardTitle className="text-base">Grant a consent</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <p className="mb-5 text-sm text-muted-foreground">
              Granting consent is recorded in the audit ledger with your user id, the policy version
              and the timestamp. You can withdraw it at any time.
            </p>
            <form className="space-y-4" onSubmit={handleGrant}>
              <div>
                <Label htmlFor="consent-type">Consent type</Label>
                <Input
                  id="consent-type"
                  className="mt-2"
                  value={consentType}
                  onChange={(e) => setConsentType(e.target.value)}
                  required
                  maxLength={80}
                />
              </div>
              <div>
                <Label htmlFor="consent-purpose">Purpose</Label>
                <Input
                  id="consent-purpose"
                  className="mt-2"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  required
                  maxLength={255}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="consent-policy">Policy version</Label>
                  <Input
                    id="consent-policy"
                    className="mt-2"
                    value={policyVersion}
                    onChange={(e) => setPolicyVersion(e.target.value)}
                    maxLength={40}
                  />
                </div>
                <div>
                  <Label htmlFor="consent-scope">Scope</Label>
                  <Input
                    id="consent-scope"
                    className="mt-2"
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    maxLength={100}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  <FileSignature className="size-4" aria-hidden /> Record consent
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6 shadow-card">
        <CardHeader className="border-b border-dashed pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ScrollText className="size-4" aria-hidden /> Consent history
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {history.isLoading ? (
            <LoadingBlock label="Loading consent history" />
          ) : history.isError ? (
            <ErrorBlock
              label="Could not load your consent history"
              onRetry={() => void history.refetch()}
            />
          ) : allRows.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              No consent has ever been recorded on your account.
            </p>
          ) : (
            <ul className="space-y-3">
              {allRows.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-xl border p-4"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {humanizeField(c.consent_type)}
                      <StatusBadge
                        status={isConsentActive(c) ? "ACTIVE" : "REVOKED"}
                        label={isConsentActive(c) ? "Active" : "Revoked"}
                      />
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{c.purpose}</p>
                    <dl className="mt-2 grid gap-3 text-xs sm:grid-cols-3">
                      <Field label="Granted" value={formatDateTime(c.granted_at)} />
                      <Field
                        label="Revoked"
                        value={c.revoked_at ? formatDateTime(c.revoked_at) : "—"}
                      />
                      <Field label="Policy" value={c.policy_version ?? "—"} />
                    </dl>
                    {c.evidence && Object.keys(c.evidence).length > 0 ? (
                      <p className="mt-2 font-mono text-[11px] text-muted-foreground">
                        {formatJson(c.evidence)}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

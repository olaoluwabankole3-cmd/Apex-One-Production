"use client";

/**
 * Operator preview. The server independently denies this endpoint outside
 * explicitly enabled staging and authorizes financial:read + financial:write.
 * No feed storage, bank connector, loss certification or cash movement.
 */
import { FormEvent, useState } from "react";
import { ArrowLeftRight, CircleAlert, Play, ShieldAlert } from "lucide-react";
import InternalOnlyShield from "@/components/layout/InternalOnlyShield";
import { useAuth } from "@/components/auth/AuthContext";
import { apiClient, ApiClientError } from "@/lib/apiClient";
import type { CsvPreviewResult } from "@/lib/backend/domains/reconciliation/csvPreviewService";

const HEADER = "reference,currency,amount_minor,record_id,recorded_at";
const EXPECTED = [
  HEADER,
  "SYN-SETTLE-001,NGN,12500,synthetic-ledger-001,2026-11-02T09:00:00Z",
  "SYN-SETTLE-002,NGN,22000,synthetic-ledger-002,2026-11-02T09:05:00Z",
].join("\n") + "\n";
const OBSERVED = [
  HEADER,
  "SYN-SETTLE-001,NGN,12400,synthetic-provider-001,2026-11-02T09:00:00Z",
  "SYN-SETTLE-002,NGN,22000,synthetic-provider-002,2026-11-02T09:05:00Z",
].join("\n") + "\n";

function PreviewScreen() {
  const { hasPermission } = useAuth();
  const mayRun = hasPermission("financial:write");
  const [kind, setKind] = useState<"settlement" | "fee">("settlement");
  const [expected, setExpected] = useState("");
  const [observed, setObserved] = useState("");
  const [result, setResult] = useState<CsvPreviewResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function example() {
    setKind("settlement");
    setExpected(EXPECTED);
    setObserved(OBSERVED);
    setResult(null);
    setError(null);
  }

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !mayRun) return;
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const data = await apiClient.postData<CsvPreviewResult>("/api/v1/reconciliation/preview", {
        kind, expected: { feedId: "operator-expected-preview", csv: expected },
        observed: { feedId: "operator-observed-preview", csv: observed },
      });
      if (!data.previewOnly || data.sourceStored !== false || data.coverageVerified !== false ||
          data.reconciliation.financialLossAssessed !== false) {
        throw new Error("Unexpected source verification claims");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof ApiClientError && err.status === 404
        ? "Reconciliation preview is unavailable here. An administrator must explicitly enable this synthetic-only feature in controlled staging."
        : "Comparison could not be completed. Verify the CSV format, access permissions and staging availability. No result was recorded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12" id="cortex-reconciliation-workspace">
      <header className="rounded-2xl border border-[#C58D5F]/25 bg-[#24231F] p-6 sm:p-9">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D9A06F]">FINANCIAL OPERATIONS / 01</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-lg bg-[#C58D5F]/10 p-3 text-[#D9A06F]"><ArrowLeftRight size={24}/></span>
          <h1 className="font-display text-3xl font-semibold text-[#F5F1E8]">Reconciliation</h1>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#D3C9BD]">
          Compare two synthetic settlement or mapped-fee sources to identify references
          that need an investigation. These comparisons are provisional and do not
          certify a financial loss, settlement or recovery.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[#C58D5F]/30 px-3 py-1.5 text-xs text-[#D9A06F]">
          <ShieldAlert size={14} /> Synthetic staging preview only · No bank connection
        </div>
      </header>

      {!mayRun ? (
        <section className="rounded-xl border border-white/10 bg-[#292823] p-6 text-sm text-[#D3C9BD]">
          Your role can view financial operations context, but cannot submit preview data.
          A financial-data writer permission is required.
        </section>
      ) : (
        <form onSubmit={(event) => void run(event)} className="space-y-5 rounded-xl border border-white/10 bg-[#292823] p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-[#F5F1E8]">Compare source records</h2>
              <p className="mt-1 text-xs text-[#D3C9BD]/70">Strict CSV, up to 1,000 rows per source. No raw data is retained by this preview.</p>
            </div>
            <button type="button" onClick={example} className="rounded-lg border border-[#C58D5F]/40 px-4 py-2 text-xs font-semibold text-[#D9A06F] hover:bg-[#C58D5F]/10">
              Load synthetic example
            </button>
          </div>
          <label className="block text-xs font-semibold text-[#D3C9BD]">
            Comparison type
            <select value={kind} onChange={e => {setKind(e.target.value as "settlement" | "fee"); setResult(null);}}
              className="mt-2 w-full rounded-lg border border-white/15 bg-[#171715] p-3 text-sm text-[#F5F1E8] sm:max-w-xs">
              <option value="settlement">Settlement</option>
              <option value="fee">Mapped fees</option>
            </select>
          </label>
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="block text-xs font-semibold text-[#D3C9BD]">
              Expected records
              <textarea required rows={8} spellCheck={false} value={expected}
                onChange={e => {setExpected(e.target.value); setResult(null);}}
                className="mt-2 w-full rounded-lg border border-white/15 bg-[#171715] p-4 font-mono text-xs leading-6 text-[#F5F1E8] focus:border-[#C58D5F] focus:outline-none"
                placeholder={HEADER} />
            </label>
            <label className="block text-xs font-semibold text-[#D3C9BD]">
              Observed records
              <textarea required rows={8} spellCheck={false} value={observed}
                onChange={e => {setObserved(e.target.value); setResult(null);}}
                className="mt-2 w-full rounded-lg border border-white/15 bg-[#171715] p-4 font-mono text-xs leading-6 text-[#F5F1E8] focus:border-[#C58D5F] focus:outline-none"
                placeholder={HEADER} />
            </label>
          </div>
          <p className="text-xs leading-5 text-[#D3C9BD]/65">
            Required columns (exact order): <code className="break-all text-[#D9A06F]">{HEADER}</code>.
            Amounts are signed integers in minor currency units, never floating-point amounts.
            Only use generated synthetic inputs here. Never paste real banking or customer records.
          </p>
          <button type="submit" disabled={busy || !expected || !observed}
            className="inline-flex items-center gap-2 rounded-lg bg-[#C58D5F] px-5 py-3 text-sm font-semibold text-[#171715] transition-colors hover:bg-[#D9A06F] disabled:cursor-not-allowed disabled:opacity-40">
            <Play size={16} /> {busy ? "Comparing…" : "Run preview comparison"}
          </button>
          {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100"><CircleAlert size={17} className="shrink-0"/> {error}</p>}
        </form>
      )}

      {result && (
        <section aria-live="polite" className="rounded-xl border border-[#C58D5F]/30 bg-[#24231F] p-5 sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.17em] text-[#D9A06F]">PREVIEW RESULTS · UNVERIFIED</p>
          <h2 className="mt-2 font-display text-2xl font-semibold text-[#F5F1E8]">
            {result.reconciliation.cases.length} reference comparisons
          </h2>
          <p className="mt-2 text-xs text-[#D3C9BD]/70">
            {result.reconciliation.comparedRecords} source lines compared. No source completeness, bank origin or financial loss has been verified.
          </p>
          <div className="mt-5 overflow-x-auto rounded-lg border border-white/10">
            <table className="min-w-[660px] w-full text-left text-xs text-[#D3C9BD]">
              <thead className="bg-white/[0.04] text-[#D9A06F]">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Comparison</th>
                  <th className="px-4 py-3">Expected (minor)</th>
                  <th className="px-4 py-3">Observed (minor)</th>
                  <th className="px-4 py-3">State</th>
                </tr>
              </thead>
              <tbody>
                {result.reconciliation.cases.map(item => (
                  <tr key={item.caseId} className="border-t border-white/[0.07]">
                    <td className="px-4 py-3 font-mono">{item.reference}</td>
                    <td className="px-4 py-3">{item.comparisonStatus.replaceAll("_", " ")}</td>
                    <td className="px-4 py-3 font-mono">{item.expectedAmountMinor ?? "—"}</td>
                    <td className="px-4 py-3 font-mono">{item.observedAmountMinor ?? "—"}</td>
                    <td className="px-4 py-3 text-[#D9A06F]">{item.verificationState}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 text-xs leading-6 text-[#D3C9BD]/65">
            This request-scoped result is not a persisted case. Use the authorized Cases workspace
            to record an investigation; do not treat these provisional amounts as a verified loss.
          </p>
        </section>
      )}
    </div>
  );
}

export default function ReconciliationPage() {
  return <InternalOnlyShield requiredPermission="financial:read"><PreviewScreen /></InternalOnlyShield>;
}

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronRight,
  FileSearch,
  FileStack,
  FolderOpen,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { documentRepository } from "@/lib/data/repositories";
import type { DocumentItem } from "@/lib/types";
import { useAuth } from "@/components/auth/AuthContext";
import { useOrganization } from "@/components/layout/OrganizationContext";
import { documentCategories, documentEvidenceStatus, filterDocuments } from "./documentWorkspaceModel";

function LoadingDocuments() {
  return (
    <div role="status" aria-live="polite" className="flex min-h-60 flex-col items-center justify-center gap-3 rounded-xl border border-[#C5B9A9] bg-[#F5F1E8] p-8 text-[#514B44]">
      <Loader2 size={24} className="animate-spin text-[#A65A2E]" aria-hidden="true" />
      <p className="text-sm font-medium">Loading your authorized document records…</p>
    </div>
  );
}

function RecordFacts({ document }: { document: DocumentItem }) {
  const facts = [
    { label: "Category", value: document.category },
    { label: "File type", value: document.fileType.toUpperCase() },
    { label: "Record size", value: document.size },
    { label: "Added", value: document.date },
    { label: "Added by", value: document.uploadedBy },
    { label: "Page count", value: document.pages > 0 ? String(document.pages) : "Not available" },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="min-w-0 border-t border-[#DED5C8] pt-3">
          <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-[#776C60]">{fact.label}</dt>
          <dd className="mt-1 break-words text-[13px] font-semibold text-[#2A2824]">{fact.value || "Not available"}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function DocumentsWorkspace() {
  const { hasPermission } = useAuth();
  const { isFeatureEnabled } = useOrganization();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await documentRepository.getDocuments();
      setDocuments(response);
      setSelectedId((previous) => response.some((item) => item.id === previous)
        ? previous : (response[0]?.id ?? null));
    } catch {
      // Do not expose API exception internals to the UI or keep stale records.
      setDocuments([]);
      setSelectedId(null);
      setError("Document records could not be retrieved. Your session or the document service may need attention. Nothing has been changed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const categories = useMemo(() => documentCategories(documents), [documents]);
  const visible = useMemo(() => filterDocuments(documents, search, category), [documents, search, category]);
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0] ?? null;
  const readOnly = !hasPermission("document:delete");
  const canSeeKnowledge = hasPermission("knowledge:read");
  const canSeeWorkflows = hasPermission("workflow:read") && isFeatureEnabled("workflowIntelligence");

  const remove = async (id: string) => {
    if (!hasPermission("document:delete") || deletingId !== null || confirmDeleteId !== id) return;
    setDeletingId(id);
    setError(null);
    setNotice(null);
    try {
      const deleted = await documentRepository.deleteDocument(id);
      if (!deleted) throw new Error("Deletion was not confirmed");
      setConfirmDeleteId(null);
      // The delete API already confirms the exact record ID. Update only the
      // in-session list; do not claim deletion failed if a follow-up GET fails.
      setDocuments((current) => current.filter((document) => document.id !== id));
      setSelectedId((current) => current === id ? null : current);
      setNotice("The document service confirmed deletion of the selected record.");
    } catch {
      setError("The document could not be deleted. No successful deletion was confirmed.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-6" id="cortex-documents-workspace">
      <header className="rounded-2xl border border-[#CDBEAD] bg-[#F5F1E8] px-6 py-7 text-[#24231F] sm:px-9 sm:py-9">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#95502B]">Documents</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Review your records</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#635A51]">
          Search for a document and select it to see what has been stored.
          Check any summary or extracted information against the original before relying on it.
        </p>
        <p className="mt-4 text-xs font-semibold text-[#95502B]">
          Important: a stored or indexed document has not been independently verified.
        </p>
      </header>

      <div className="rounded-2xl border border-[#CDBEAD] bg-[#F5F1E8] p-4 text-[#24231F] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg border border-[#D2B59A] bg-[#F1E1D0] p-2.5 text-[#A65A2E]">
              <FileStack size={20} aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-[15px] font-bold">Authorized document library</h2>
              <p className="mt-1 text-xs text-[#685D51]">
                {loading ? "Checking your organization’s records…" : `${documents.length} record${documents.length === 1 ? "" : "s"} available to this session`}
              </p>
            </div>
          </div>
          <button type="button" onClick={() => { setNotice(null); void load(); }} disabled={loading || deletingId !== null}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#B5A391] px-3 py-2 text-xs font-semibold text-[#3C3128] transition-colors hover:bg-[#EAE1D6] disabled:cursor-not-allowed disabled:opacity-40">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} aria-hidden="true" /> Refresh records
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(150px,0.38fr)]">
          <label className="relative block">
            <span className="sr-only">Search authorized documents</span>
            <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#877462]" aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => { setSearch(event.target.value); setConfirmDeleteId(null); }}
              placeholder="Search by name, category or uploader"
              className="min-h-11 w-full rounded-lg border border-[#C6B7A6] bg-white/80 py-2.5 pl-10 pr-3 text-sm text-[#24231F] placeholder:text-[#897D70] focus:border-[#A65A2E] focus:outline-none focus:ring-2 focus:ring-[#A65A2E]/20" />
          </label>
          <label className="block">
            <span className="sr-only">Filter document category</span>
            <select value={category} onChange={(event) => { setCategory(event.target.value); setConfirmDeleteId(null); }}
              className="min-h-11 w-full rounded-lg border border-[#C6B7A6] bg-white/80 px-3 text-sm font-medium text-[#3B332C] focus:border-[#A65A2E] focus:outline-none focus:ring-2 focus:ring-[#A65A2E]/20">
              <option value="all">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D4A9A3] bg-[#FFF1EE] px-5 py-4 text-sm text-[#8E2E31]">
        <p>{error}</p>
        <button type="button" onClick={() => { setNotice(null); void load(); }} className="font-semibold underline underline-offset-4">Try again</button>
      </div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-[#B4C9B1] bg-[#EDF5EC] px-5 py-3 text-sm text-[#34583C]">
        <Check size={16} aria-hidden="true" /> {notice}
      </div>}

      {loading ? <LoadingDocuments /> : documents.length === 0 ? (
        <section className="rounded-2xl border border-[#C6B7A6] bg-[#F5F1E8] px-6 py-12 text-center text-[#24231F]">
          <FolderOpen size={30} className="mx-auto text-[#A65A2E]" aria-hidden="true" />
          <h2 className="mt-4 font-display text-2xl font-bold">No authorized documents yet</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#685D51]">
            {error ? "The library could not be loaded. Retry above before assuming there are no records." :
              "The document service returned no records visible to your organization and permissions. This is not a statement about other organizations."}
          </p>
          <p className="mx-auto mt-5 max-w-lg rounded-lg border border-[#D8C5B2] bg-[#F0E5D7] p-4 text-xs leading-5 text-[#665141]">
            File upload is not enabled in this workspace. CORTEX does not simulate uploads or certify documents. Ask your administrator about the approved ingestion process.
          </p>
        </section>
      ) : visible.length === 0 ? (
        <section className="rounded-2xl border border-[#C6B7A6] bg-[#F5F1E8] px-6 py-12 text-center text-[#24231F]">
          <FileSearch size={28} className="mx-auto text-[#A65A2E]" aria-hidden="true" />
          <h2 className="mt-4 text-xl font-bold">No matching records</h2>
          <p className="mt-2 text-sm text-[#685D51]">Try another name or category. Your search only filters this authorized library.</p>
          <button type="button" onClick={() => { setSearch(""); setCategory("all"); }} className="mt-5 rounded-lg bg-[#A65A2E] px-4 py-2.5 text-xs font-semibold text-white">Clear filters</button>
        </section>
      ) : (
        <section aria-label="Document record explorer" className="grid items-start gap-4 lg:grid-cols-[minmax(280px,0.82fr)_minmax(0,1.5fr)]">
          <div className="overflow-hidden rounded-2xl border border-[#C8B9A8] bg-[#F5F1E8] text-[#24231F]">
            <div className="flex items-center justify-between border-b border-[#DCD0C3] px-5 py-4">
              <h2 className="text-sm font-bold">Records</h2>
              <span className="font-mono text-xs text-[#756759]">{visible.length} shown</span>
            </div>
            <div className="max-h-[640px] space-y-1 overflow-y-auto p-2" role="list" aria-label="Authorized documents">
              {visible.map((document) => {
                const active = selected?.id === document.id;
                const status = documentEvidenceStatus(document);
                return (
                  <div role="listitem" key={document.id}>
                    <button type="button" aria-current={active ? "true" : undefined}
                      onClick={() => { setSelectedId(document.id); setConfirmDeleteId(null); setNotice(null); }}
                      className={`group flex w-full items-start gap-3 rounded-xl border px-3.5 py-4 text-left transition-colors focus-visible:outline-[#A65A2E] ${active ? "border-[#BC865B] bg-[#F0DED0]" : "border-transparent hover:border-[#DAC7B6] hover:bg-white/80"}`}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E9D5C1] text-[#A65A2E]"><FileStack size={17} aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block break-words text-[13px] font-bold leading-5">{document.name}</span>
                        <span className="mt-1.5 block text-[11px] text-[#76695C]">{document.category || "Uncategorized"}</span>
                        <span className="mt-2 inline-flex rounded-full border border-[#C9B8A7] px-2 py-0.5 text-[10px] font-medium text-[#67584B]">{status.title} · unverified</span>
                      </span>
                      <ChevronRight size={16} className={`mt-2 shrink-0 ${active ? "text-[#A65A2E]" : "text-[#A89B8E]"}`} aria-hidden="true" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {selected && <article aria-label={`Document details for ${selected.name}`} className="overflow-hidden rounded-2xl border border-[#C8B9A8] bg-[#F5F1E8] text-[#24231F]">
            <div className="border-b border-[#DCD0C3] bg-[#ECE2D5] px-5 py-5 sm:px-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[.13em] text-[#98603D]">Selected record / details</p>
                  <h2 className="mt-2 break-words font-display text-[clamp(20px,2.4vw,29px)] font-bold tracking-[-.035em]">{selected.name}</h2>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#D0B8A1] bg-[#F8F4EF] px-3 py-1.5 text-[11px] font-semibold text-[#73543D]">
                  <ShieldAlert size={13} aria-hidden="true" /> Unverified source
                </span>
              </div>
              <p className="mt-3 max-w-2xl text-xs leading-6 text-[#665A50]">{documentEvidenceStatus(selected).detail}</p>
            </div>
            <div className="space-y-7 px-5 py-6 sm:px-7 sm:py-7">
              <section aria-labelledby="record-metadata-heading">
                <h3 id="record-metadata-heading" className="mb-4 flex items-center gap-2 text-sm font-bold"><FileSearch size={17} className="text-[#A65A2E]" aria-hidden="true" /> Record information</h3>
                <RecordFacts document={selected} />
              </section>
              <section aria-labelledby="record-summary-heading" className="border-t border-[#DCD0C3] pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="record-summary-heading" className="text-sm font-bold">Stored summary</h3>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#856B56]">Not independently verified</span>
                </div>
                {selected.aiSummary ? (
                  <p className="mt-3 whitespace-pre-wrap rounded-xl border border-[#D8C8B6] bg-white/70 p-4 text-[13px] leading-7 text-[#4F473F]">{selected.aiSummary}</p>
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed border-[#CBBBA9] p-4 text-sm leading-6 text-[#756657]">No source-backed summary is currently stored for this record.</p>
                )}
              </section>
              <section aria-labelledby="record-fields-heading" className="border-t border-[#DCD0C3] pt-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="record-fields-heading" className="text-sm font-bold">Stored extracted fields</h3>
                  <span className="font-mono text-[10px] text-[#856B56]">{selected.extractedFields.length} fields</span>
                </div>
                {selected.extractedFields.length ? (
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    {selected.extractedFields.map((field, index) => (
                      <div key={`${field.label}-${index}`} className="min-w-0 rounded-lg border border-[#D8C8B6] bg-white/75 p-4">
                        <dt className="break-words text-[11px] font-medium uppercase tracking-[.06em] text-[#786D61]">{field.label}</dt>
                        <dd className="mt-2 break-words text-sm font-semibold text-[#342E29]">{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed border-[#CBBBA9] p-4 text-sm leading-6 text-[#756657]">No extracted fields have been made available. This does not mean the original document contains no relevant information.</p>
                )}
              </section>
              <section aria-labelledby="record-next-heading" className="border-t border-[#DCD0C3] pt-6">
                <h3 id="record-next-heading" className="text-sm font-bold">What can I do next?</h3>
                <p className="mt-2 text-xs leading-6 text-[#6D6053]">Compare any stored interpretation against its original source and obtain an authorized review before relying on it for decisions.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {canSeeKnowledge && <Link href="/knowledge-hub" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#A65A2E] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#904822]">Open institutional memory <ArrowRight size={14} aria-hidden="true" /></Link>}
                  {canSeeWorkflows && <Link href="/workflows" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#BCA48D] px-4 py-2.5 text-xs font-semibold hover:bg-[#EADFD2]">View authorized workflows <ArrowRight size={14} aria-hidden="true" /></Link>}
                  {!canSeeKnowledge && !canSeeWorkflows && <p className="text-xs text-[#756657]">Additional follow-up workspaces are not enabled for your session.</p>}
                </div>
              </section>
              {!readOnly && <section aria-labelledby="record-remove-heading" className="rounded-xl border border-[#E3BEB8] bg-[#FFF5F1] p-4">
                <h3 id="record-remove-heading" className="text-sm font-bold text-[#803D3C]">Remove document record</h3>
                <p className="mt-1 text-xs leading-5 text-[#825953]">Deletion is irreversible through this screen. It may also remove its stored object and index; confirm you selected the correct record.</p>
                {confirmDeleteId !== selected.id ? (
                  <button type="button" onClick={() => setConfirmDeleteId(selected.id)} disabled={deletingId !== null}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[#C78B88] px-3 py-2 text-xs font-semibold text-[#963F3B] hover:bg-[#FCE5E0] disabled:opacity-50"><Trash2 size={14} aria-hidden="true" /> Review deletion</button>
                ) : (
                  <div className="mt-3 rounded-lg border border-[#C78B88] bg-white p-3">
                    <p className="text-xs font-semibold text-[#7E3A39]">Confirm deletion of “{selected.name}”?</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={deletingId !== null} onClick={() => void remove(selected.id)}
                        className="rounded-md bg-[#9C3F3D] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">
                        {deletingId === selected.id ? "Deleting…" : "Yes, delete this record"}
                      </button>
                      <button type="button" disabled={deletingId !== null} onClick={() => setConfirmDeleteId(null)}
                        className="rounded-md border border-[#C9A8A4] px-3 py-2 text-xs text-[#673F3B] disabled:opacity-50">Cancel</button>
                    </div>
                  </div>
                )}
              </section>}
            </div>
          </article>}
        </section>
      )}

      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-[#C58D5F]/25 bg-[#302D29] px-5 py-4 text-[#D5C6B8]">
        <ShieldCheck size={18} className="mt-0.5 shrink-0 text-[#C58D5F]" aria-hidden="true" />
        <div className="max-w-4xl text-xs leading-6">
          <p className="font-semibold text-[#F5F1E8]">Document intake is not enabled on this screen.</p>
          <p className="mt-1">Only existing authorized records are displayed. No fake upload or AI verification action is offered. File authenticity, completeness, extraction accuracy and any financial conclusions require separate independent review. Do not upload live bank data for testing.</p>
        </div>
      </div>
    </div>
  );
}

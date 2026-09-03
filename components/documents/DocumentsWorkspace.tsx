"use client";

import { useEffect, useState } from "react";
import { FileStack, Loader2, Trash2, UploadCloud } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import { documentRepository } from "@/lib/data/repositories";
import type { DocumentItem } from "@/lib/types";
import { useAuth } from "@/components/auth/AuthContext";

export default function DocumentsWorkspace() {
  const { hasPermission } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setDocuments(await documentRepository.getDocuments());
    } catch (cause) {
      setDocuments([]);
      setError(cause instanceof Error ? cause.message : "Document request failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (id: string) => {
    setDeletingId(id);
    setError(null);
    try {
      const deleted = await documentRepository.deleteDocument(id);
      if (!deleted) throw new Error("Document deletion was not confirmed");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Document deletion failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <header>
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-gold/70">
          APEX ONE · Knowledge Intake
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ivory">
          Documents
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ivory/50">
          Document records shown here come from the authorized document service. The previous
          simulated drag-and-drop upload has been removed; binary upload UX will be connected
          only to the real storage and ingestion path.
        </p>
      </header>

      <GlassCard className="border-dashed p-5">
        <div className="flex items-start gap-3">
          <UploadCloud size={19} className="mt-0.5 shrink-0 text-gold/70" />
          <div>
            <p className="font-medium text-ivory/80">File upload UI not connected yet</p>
            <p className="mt-1 text-sm leading-6 text-ivory/45">
              APEX ONE will not display a fake upload, extraction, OCR or verification flow.
              Existing authorized document records remain readable below.
            </p>
          </div>
        </div>
      </GlassCard>

      {loading ? (
        <GlassCard className="flex items-center justify-center gap-2 p-8 text-sm text-ivory/45">
          <Loader2 size={16} className="animate-spin" />
          Loading authorized documents…
        </GlassCard>
      ) : documents.length === 0 ? (
        <GlassCard className="border-dashed p-8 text-center">
          <FileStack size={24} className="mx-auto text-gold/70" />
          <h2 className="mt-4 font-display text-xl font-bold text-ivory">
            No document records
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-ivory/45">
            No authorized document records are currently available for this organization.
          </p>
        </GlassCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {documents.map((document) => (
            <GlassCard key={document.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-bold text-ivory">
                    {document.name}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wider text-gold/60">
                    {document.category}
                  </p>
                </div>
                <span className="rounded-full border border-white/[0.08] px-2.5 py-1 text-[10px] uppercase tracking-wider text-ivory/45">
                  {document.status}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-ivory/35">
                <span>{document.fileType.toUpperCase()}</span>
                <span>{document.size}</span>
                <span>{document.date}</span>
                <span>Uploaded by {document.uploadedBy}</span>
              </div>

              {document.aiSummary ? (
                <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <p className="font-mono text-[9.5px] uppercase tracking-wider text-ivory/30">
                    Stored summary
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ivory/50">{document.aiSummary}</p>
                </div>
              ) : null}

              {hasPermission("document:delete") && (
                <button
                  onClick={() => remove(document.id)}
                  disabled={deletingId !== null}
                  className="mt-4 flex items-center gap-2 rounded-lg border border-crimson/20 bg-crimson/[0.05] px-3 py-2 text-xs text-crimson/80 disabled:opacity-50"
                >
                  <Trash2 size={13} />
                  {deletingId === document.id ? "Deleting…" : "Delete record"}
                </button>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-crimson/80">{error}</p>}
    </div>
  );
}

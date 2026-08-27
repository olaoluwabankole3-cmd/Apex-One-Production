"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Search,
  Sparkles,
  Link2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  User,
  ExternalLink,
  ChevronRight,
  UploadCloud,
  FilePlus,
  RefreshCw,
  Send,
  Lock,
  ArrowRight,
  Info,
  Loader2
} from "lucide-react";
import { IntelDocument } from "@/lib/data/demo";
import { documentRepository } from "@/lib/data/repositories";

export default function DocumentsWorkspace() {
  const [documents, setDocuments] = useState<IntelDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedId, setSelectedId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [uploading, setUploading] = useState<boolean>(false);

  // Q&A / Memory Engine State
  const [chatsByDoc, setChatsByDoc] = useState<Record<string, { id: string; role: "user" | "assistant"; content: string }[]>>({});
  const [chatInput, setChatInput] = useState<string>("");
  const [thinking, setThinking] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    documentRepository.getIntelDocuments()
      .then((docs) => {
        if (isMounted) {
          setDocuments(docs);
          if (docs.length > 0) {
            setSelectedId(docs[0].id);
          }
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to load documents:", err);
        if (isMounted) {
          setDocuments([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const selectedDoc = useMemo(() => {
    return documents.find((d) => d.id === selectedId) || documents[0] || null;
  }, [documents, selectedId]);

  // Compute stats dynamically for DOCUMENT OVERVIEW section
  const documentOverview = useMemo(() => {
    return {
      total: documents.length,
      contracts: documents.filter((d) => d.category === "Contract").length,
      policies: documents.filter((d) => d.category === "Policy").length,
      financials: documents.filter((d) => d.category === "Financial Document").length,
      reports: documents.filter((d) => d.category === "Report").length,
      compliance: documents.filter((d) => d.category === "Compliance Document").length,
      recentlyChanged: documents.filter((d) => d.status === "processing").length
    };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            doc.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === "All" || doc.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [documents, searchQuery, selectedCategory]);

  const handleSimulateUpload = async () => {
    if (uploading) return;
    setUploading(true);

    try {
      const createdItem = await documentRepository.createDocument({
        name: "Enterprise Service Level Agreement.pdf",
        category: "Contract",
        fileType: "pdf",
        size: "1.8 MB",
        uploadedBy: "Current User",
        status: "indexed",
        tags: ["Strategic Accounts"]
      });

      const updatedDocs = await documentRepository.getIntelDocuments();
      setDocuments(updatedDocs);
      setSelectedId(createdItem.id);
    } catch (err) {
      console.error("Failed to create document:", err);
    } finally {
      setUploading(false);
    }
  };

  // Pre-configured questions for Document Memory
  const suggestedQueries = [
    "What changed between these two contracts?",
    "What obligations exist in this agreement?",
    "Which customers are mentioned?",
    "What financial commitments are contained here?"
  ];

  const handleSendQuery = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking || !selectedDoc) return;

    const userMsg = { id: `msg-u-${Date.now()}`, role: "user" as const, content: trimmed };
    const currentDocId = selectedDoc.id;

    setChatsByDoc((prev) => ({
      ...prev,
      [currentDocId]: [...(prev[currentDocId] || []), userMsg]
    }));
    setChatInput("");
    setThinking(true);

    try {
      const answer = await documentRepository.getDocumentAnswer(trimmed, selectedDoc);
      const assistantMsg = { id: `msg-a-${Date.now()}`, role: "assistant" as const, content: answer };
      setChatsByDoc((prev) => ({
        ...prev,
        [currentDocId]: [...(prev[currentDocId] || []), assistantMsg]
      }));
    } catch (err) {
      console.error("Error answering document query:", err);
      const errorMsg = { id: `msg-a-${Date.now()}`, role: "assistant" as const, content: "Unable to retrieve document answer at this time." };
      setChatsByDoc((prev) => ({
        ...prev,
        [currentDocId]: [...(prev[currentDocId] || []), errorMsg]
      }));
    } finally {
      setThinking(false);
    }
  };

  const currentChats = selectedDoc ? (chatsByDoc[selectedDoc.id] || []) : [];

  return (
    <div className="space-y-6" id="document-intelligence-workspace">
      
      {/* HEADER BAR */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-[12.5px] font-medium uppercase tracking-[0.12em] text-gold/70 font-mono">
            APEX ONE
          </p>
          <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight text-ivory lg:text-[32px] uppercase">
            Document Intelligence
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ivory/50">
            APEX ONE turns raw files into structured organizational knowledge, extracting core parameters, auditing contracts, and syncing dates.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/[0.08] px-3.5 py-1.5 text-[12px] font-mono text-gold/80">
          <span className="h-2 w-2 rounded-full bg-emerald animate-pulse" />
          Active Intelligence Sync: <span className="font-bold text-ivory">Connected</span>
        </div>
      </div>

      {/* ────────────────── DOCUMENT OVERVIEW METRICS PANEL ────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7" id="document-overview-deck">
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Total Indexed</p>
          <p className="mt-1 font-display text-[22px] font-bold text-ivory">{documentOverview.total}</p>
          <p className="text-[9.5px] text-emerald/80 font-mono mt-0.5">Live vector nodes</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Contracts</p>
          <p className="mt-1 font-display text-[22px] font-bold text-gold">{documentOverview.contracts}</p>
          <p className="text-[9.5px] text-ivory/40 font-mono mt-0.5">Active agreements</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Policies</p>
          <p className="mt-1 font-display text-[22px] font-bold text-ivory">{documentOverview.policies}</p>
          <p className="text-[9.5px] text-ivory/40 font-mono mt-0.5">Internal rules</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Financials</p>
          <p className="mt-1 font-display text-[22px] font-bold text-ivory">{documentOverview.financials}</p>
          <p className="text-[9.5px] text-ivory/40 font-mono mt-0.5">Yield & balance sheets</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Audit Reports</p>
          <p className="mt-1 font-display text-[22px] font-bold text-ivory">{documentOverview.reports}</p>
          <p className="text-[9.5px] text-ivory/40 font-mono mt-0.5">Compliance reviews</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Compliance Filings</p>
          <p className="mt-1 font-display text-[22px] font-bold text-ivory">{documentOverview.compliance}</p>
          <p className="text-[9.5px] text-ivory/40 font-mono mt-0.5">Active submissions</p>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-charcoal/30 p-3.5 shadow-glass-flat col-span-2 sm:col-span-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ivory/40">Recently Changed</p>
          <p className="mt-1 font-display text-[22px] font-bold text-crimson flex items-center gap-1">
            {documentOverview.recentlyChanged} <span className="h-2 w-2 rounded-full bg-crimson animate-pulse" />
          </p>
          <p className="text-[9.5px] text-crimson/80 font-mono mt-0.5">Requires reviews</p>
        </div>
      </div>

      {/* ────────────────── TWO-COLUMN WORKSPACE: LEFT SEARCH / LIST, RIGHT INTEL DOSSIER ────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        
        {/* LEFT WORKSPACE PANELS */}
        <div className="space-y-4">
          
          {/* DRAG-AND-DROP FILE INGESTION SIMULATOR */}
          <div className="rounded-xl border border-dashed border-white/[0.08] bg-charcoal/25 p-4 text-center transition-all hover:bg-charcoal/30">
            <UploadCloud size={24} className="mx-auto text-gold/60 mb-2" />
            <p className="text-[12.5px] font-bold text-ivory">Drag New Document Here</p>
            <p className="text-[10.5px] text-ivory/40 mt-1 leading-normal font-mono">Supports PDF, DOC, XLSX files up to 25MB.</p>
            <button
              onClick={handleSimulateUpload}
              disabled={uploading}
              className="mt-3.5 w-full rounded-lg bg-gold/10 hover:bg-gold/15 border border-gold/30 px-3 py-1.5 text-[11px] font-mono font-bold text-gold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {uploading ? (
                <>
                  <RefreshCw size={11} className="animate-spin text-gold" />
                  Apex Parser Reading...
                </>
              ) : (
                <>
                  <FilePlus size={11} />
                  Simulate Document Upload
                </>
              )}
            </button>
          </div>

          {/* SEARCH & CATEGORY FILTERING */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-4 space-y-3 shadow-glass">
            <div className="relative">
              <input
                type="text"
                placeholder="Search index..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.08] rounded-lg pl-8.5 pr-3 py-1.5 text-[12px] text-ivory focus:outline-none focus:border-gold/50"
              />
              <Search size={12} className="absolute left-3 top-2.5 text-ivory/40" />
            </div>

            {/* Micro Categories buttons */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["All", "Contract", "Financial Document", "Report", "Compliance Document"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded px-2 py-0.5 text-[10px] font-mono border transition-all cursor-pointer ${
                    selectedCategory === cat 
                      ? "bg-gold/10 border-gold text-gold font-bold" 
                      : "bg-white/[0.02] border-white/[0.05] text-ivory/50 hover:bg-white/[0.04]"
                  }`}
                >
                  {cat === "Financial Document" ? "Financial" : cat === "Compliance Document" ? "Compliance" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* DOCUMENTS LIST QUEUE */}
          <div className="rounded-xl border border-white/[0.06] bg-charcoal/40 p-3 space-y-2 shadow-glass max-h-[480px] overflow-y-auto scrollbar-none">
            <p className="text-[10px] font-mono text-ivory/30 uppercase tracking-wider pl-2 mb-1">Index Feed</p>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-ivory/40 gap-2 text-xs">
                <Loader2 className="animate-spin text-gold" size={16} />
                <span>Loading index...</span>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="text-center py-10 text-ivory/30 text-xs font-mono">
                No matching documents
              </div>
            ) : (
              filteredDocuments.map((docItem) => {
                const isSelected = docItem.id === selectedId;
                const isProcessing = docItem.status === "processing";
                return (
                  <button
                    key={docItem.id}
                    onClick={() => setSelectedId(docItem.id)}
                    className={`w-full text-left rounded-lg p-3 transition-all flex items-start gap-3 border ${
                      isSelected 
                        ? "bg-white/[0.05] border-gold/40 shadow-gold-glow-soft" 
                        : "bg-white/[0.01] border-white/[0.04] hover:bg-white/[0.03]"
                    }`}
                  >
                    <FileText size={18} className={`mt-0.5 shrink-0 ${isSelected ? "text-gold" : "text-ivory/40"}`} />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[12.5px] font-bold text-ivory truncate">{docItem.name}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-ivory/45 font-mono mt-1">
                        <span className="bg-white/5 px-1 py-0.1 rounded uppercase text-[8.5px]">{docItem.category}</span>
                        <span>·</span>
                        <span>{docItem.size}</span>
                        {isProcessing && (
                          <span className="text-gold font-bold flex items-center gap-1 animate-pulse">
                            <RefreshCw size={8} className="animate-spin" /> Ingesting
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: RICH DOCUMENT INTELLIGENCE DOSSIER */}
        <div className="space-y-6">
          
          {!selectedDoc ? (
            <div className="rounded-2xl border border-white/[0.08] bg-charcoal/40 p-12 text-center shadow-glass flex flex-col items-center justify-center min-h-[450px]">
              <div className="h-16 w-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold mb-4">
                <FileText size={28} />
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-mono tracking-wide uppercase bg-white/[0.04] border border-white/[0.08] text-ivory/60 mb-3">
                Document Intelligence Repository
              </span>
              <h3 className="font-display text-xl font-bold text-ivory">No documents uploaded</h3>
              <p className="mt-2 text-sm text-ivory/50 max-w-md">
                Upload or sync your enterprise documents, contracts, and regulatory filings to enable deep entity extraction, clause analysis, and AI synthesis.
              </p>
            </div>
          ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedDoc.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.3 }}
              className="rounded-2xl border border-white/[0.06] bg-charcoal/40 p-5 shadow-glass"
            >
              {/* Dossier Header Area */}
              <div className="flex flex-col md:flex-row justify-between items-start gap-4 border-b border-white/[0.05] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono text-gold/80 bg-gold/10 border border-gold/20 px-2 py-0.5 rounded uppercase font-semibold">
                      {selectedDoc.category}
                    </span>
                    <span className="text-[10px] font-mono text-ivory/40 bg-white/5 px-2 py-0.5 rounded">
                      {selectedDoc.businessUnit}
                    </span>
                    <span className="text-[10px] font-mono text-ivory/40">
                      Uploaded by {selectedDoc.uploadedBy} on {selectedDoc.date}
                    </span>
                  </div>
                  <h2 className="font-display text-[19px] font-bold text-ivory mt-2 flex items-center gap-2 leading-snug">
                    <FileText className="text-gold shrink-0" size={20} />
                    {selectedDoc.name}
                  </h2>
                </div>

                <div className="flex shrink-0 items-center gap-2 self-stretch md:self-auto justify-between md:justify-start border-t border-white/[0.04] pt-3 md:pt-0 md:border-0">
                  <div className="text-left md:text-right font-mono">
                    <p className="text-[10.5px] text-ivory/40 uppercase">Metadata Nodes</p>
                    <p className="text-[12px] text-ivory font-bold">{selectedDoc.pages} Pages · {selectedDoc.size}</p>
                  </div>
                  <span className={`h-2.5 w-2.5 rounded-full ${selectedDoc.status === "processed" ? "bg-emerald" : "bg-gold animate-ping"}`} />
                </div>
              </div>

              {selectedDoc.status === "processing" ? (
                <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
                  <RefreshCw size={28} className="animate-spin text-gold" />
                  <p className="text-[13.5px] text-ivory/60 font-mono">APEX ONE Sync Intelligence is scanning and extracting metadata...</p>
                  <p className="text-[11.5px] text-ivory/35 font-mono">Vector locks and cross-system calendar signals are being calculated.</p>
                </div>
              ) : (
                <div className="mt-5 space-y-6">

                  {/* ── USEFUL AI SUMMARY BOX ── */}
                  <div className="rounded-xl border border-gold/25 bg-gold/[0.02] p-5 shadow-gold-glow-soft">
                     <div className="flex items-center gap-2 text-gold mb-3">
                       <Sparkles size={15} className="animate-pulse" />
                       <h3 className="text-[11.5px] font-bold uppercase tracking-[0.08em] font-mono">APEX ONE DEEP INTELLIGENCE SUMMARY</h3>
                     </div>

                     <div className="space-y-4">
                       <div>
                         <span className="text-[10px] font-mono text-ivory/40 uppercase block">Key Finding</span>
                         <p className="text-[13px] text-ivory leading-relaxed font-mono mt-0.5">{selectedDoc.usefulSummary.keyFinding}</p>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div>
                           <span className="text-[10px] font-mono text-gold/70 uppercase block font-semibold">Important Obligations</span>
                           <ul className="mt-1.5 space-y-1.5 text-[12px] text-ivory/80 font-mono">
                             {selectedDoc.usefulSummary.obligations.map((ob, i) => (
                               <li key={i} className="flex items-start gap-2">
                                 <span className="text-gold shrink-0 mt-1">•</span>
                                 <span>{ob}</span>
                               </li>
                             ))}
                           </ul>
                         </div>

                         <div>
                           <span className="text-[10px] font-mono text-crimson uppercase block font-semibold">Legal & Technical Risks</span>
                           <ul className="mt-1.5 space-y-1.5 text-[12px] text-ivory/80 font-mono">
                             {selectedDoc.usefulSummary.risksDetail.map((rk, i) => (
                               <li key={i} className="flex items-start gap-2">
                                 <span className="text-crimson shrink-0 mt-1">•</span>
                                 <span className="text-ivory/80">{rk}</span>
                               </li>
                             ))}
                           </ul>
                         </div>
                       </div>

                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-white/[0.04] pt-3.5">
                         <div>
                           <span className="text-[10px] font-mono text-ivory/40 uppercase block">Obligation Dates Detected</span>
                           <div className="mt-1.5 space-y-2">
                             {selectedDoc.usefulSummary.datesDetail.map((dt, i) => (
                               <div key={i} className="flex justify-between items-center bg-white/[0.02] border border-white/[0.04] rounded px-2.5 py-1 text-[11px] font-mono">
                                 <span className="text-ivory/50">{dt.event}</span>
                                 <span className="text-gold font-semibold flex items-center gap-1">
                                   <Calendar size={10} />
                                   {dt.date}
                                 </span>
                               </div>
                             ))}
                           </div>
                         </div>

                         <div className="flex flex-col justify-between">
                           <div>
                             <span className="text-[10px] font-mono text-ivory/40 uppercase block">Financial Commitment</span>
                             <p className="text-[13px] font-mono text-gold font-bold mt-1">
                               {selectedDoc.usefulSummary.financialExposure}
                             </p>
                           </div>
                           <div className="mt-4 bg-white/[0.03] border border-white/[0.06] p-2.5 rounded-lg flex items-start gap-2">
                             <span className="text-[10px] font-mono text-gold font-bold shrink-0 mt-0.5">DIRECTIVE:</span>
                             <p className="text-[11px] font-mono text-ivory/85 leading-relaxed">
                               {selectedDoc.usefulSummary.recommendedAction}
                             </p>
                           </div>
                         </div>
                       </div>

                     </div>
                  </div>

                  {/* ── ENTITIES DETECTED PANEL ── */}
                  <div className="rounded-xl border border-white/[0.06] bg-charcoal/35 p-4.5">
                    <h3 className="text-[12px] font-bold text-ivory uppercase tracking-wider border-b border-white/[0.04] pb-2">ENTITIES DETECTED</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-[11.5px] font-mono">
                      
                      {/* Customers Mentioned */}
                      <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase block">Customers Mentioned</span>
                        {selectedDoc.entities.customers.map((c) => (
                          <span key={c} className="mt-1.5 block font-bold text-gold flex items-center gap-1">
                            <Lock size={10} className="text-gold" /> {c}
                          </span>
                        ))}
                      </div>

                      {/* Contracts Referenced */}
                      <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase block">Contracts Referenced</span>
                        {selectedDoc.entities.contracts.map((cn) => (
                          <span key={cn} className="mt-1.5 block text-ivory/80 font-bold">
                            #{cn}
                          </span>
                        ))}
                      </div>

                      {/* Financial Values */}
                      <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase block">Financial Values</span>
                        <div className="space-y-1 mt-1.5">
                          {selectedDoc.entities.financialValues.map((val) => (
                            <span key={val} className="block text-emerald font-semibold text-[11px]">
                              {val}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Important Dates */}
                      <div className="bg-white/[0.01] border border-white/[0.03] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase block">Action Items Detected</span>
                        <div className="space-y-1 mt-1.5">
                          {selectedDoc.entities.actions.map((act) => (
                            <span key={act} className="block text-ivory/80 text-[10.5px]">
                              • {act}
                            </span>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* ── DOCUMENT RELATIONSHIPS HUB ── */}
                  <div className="rounded-xl border border-white/[0.06] bg-charcoal/35 p-4.5" id="document-relationships">
                    <div className="flex items-center gap-1.5 border-b border-white/[0.04] pb-2 text-ivory">
                      <Link2 size={13} className="text-gold" />
                      <h3 className="text-[12px] font-bold uppercase tracking-wider">DOCUMENT RELATIONSHIPS</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 mt-4">
                      
                      <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase font-mono block">Related Customer</span>
                        <p className="text-[12px] font-bold text-gold mt-1 hover:underline cursor-pointer flex items-center gap-1">
                          {selectedDoc.relationships.relatedCustomer.name} <ExternalLink size={10} />
                        </p>
                      </div>

                      <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase font-mono block">Related Contract Code</span>
                        <p className="text-[12px] font-mono text-ivory/80 mt-1 font-bold">
                          {selectedDoc.relationships.relatedContract}
                        </p>
                      </div>

                      <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase font-mono block">Related Operational Workflow</span>
                        <p className="text-[12px] text-ivory/80 mt-1">
                          {selectedDoc.relationships.relatedWorkflow}
                        </p>
                      </div>

                      <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase font-mono block">Related Employee</span>
                        <p className="text-[12px] text-ivory/80 mt-1 flex items-center gap-1">
                          <User size={11} className="text-gold/70" /> {selectedDoc.relationships.relatedEmployee}
                        </p>
                      </div>

                      <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase font-mono block">Related Ledger Transaction</span>
                        <p className="text-[12px] font-mono text-emerald mt-1 font-semibold">
                          {selectedDoc.relationships.relatedTransaction}
                        </p>
                      </div>

                      <div className="bg-white/[0.01] border border-white/[0.04] p-3 rounded-lg">
                        <span className="text-[9.5px] text-ivory/40 uppercase font-mono block">Related Board Decision</span>
                        <p className="text-[12px] text-ivory/80 mt-1">
                          {selectedDoc.relationships.relatedDecision}
                        </p>
                      </div>

                    </div>
                  </div>

                  {/* ── TWO-COLUMN BOTTOM SUB-SECTION: DOCUMENT MEMORY Q&A ── */}
                  <div className="rounded-xl border border-white/[0.06] bg-charcoal/35 p-4.5">
                    <h4 className="text-[12px] font-bold text-ivory uppercase tracking-wider border-b border-white/[0.04] pb-2 flex items-center gap-1">
                      <HelpCircle size={13} className="text-gold" /> DOCUMENT MEMORY QUERY
                    </h4>
                    <p className="text-[10.5px] text-ivory/40 mt-1.5 font-mono">Ask standard or custom questions to interrogate legal parameters.</p>
                    
                    {/* Interactive Suggestion Prompts */}
                    <div className="mt-3.5 flex flex-wrap gap-1.5">
                      {suggestedQueries.map((sq, i) => (
                        <button
                          key={i}
                          onClick={() => handleSendQuery(sq)}
                          className="rounded bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] hover:border-gold/30 px-2.5 py-1 text-[11px] font-mono text-ivory/70 hover:text-gold transition-colors text-left"
                        >
                          {sq}
                        </button>
                      ))}
                    </div>

                    {/* Chat Logs */}
                    <div className="mt-4 bg-white/[0.01] border border-white/[0.03] rounded-lg p-3 max-h-[220px] overflow-y-auto space-y-3.5 scrollbar-none">
                      {currentChats.map((msg) => (
                        <div key={msg.id} className={`flex gap-2 text-[11.5px] font-mono ${msg.role === "user" ? "justify-end text-right" : "justify-start text-left"}`}>
                          <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
                            msg.role === "user" 
                              ? "bg-gold/15 border border-gold/30 text-gold" 
                              : "bg-white/[0.02] border border-white/[0.04] text-ivory/90"
                          }`}>
                            <p className="text-[9px] text-ivory/40 uppercase font-semibold mb-0.5">{msg.role === "user" ? "YOU" : "APEX ONE SYSTEM"}</p>
                            <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>
                          </div>
                        </div>
                      ))}

                      {thinking && (
                        <div className="flex gap-2 text-[11.5px] font-mono justify-start items-center">
                          <RefreshCw size={11} className="animate-spin text-gold" />
                          <span className="text-ivory/40 animate-pulse">Scanning document indexes...</span>
                        </div>
                      )}

                      {currentChats.length === 0 && !thinking && (
                        <p className="text-center py-6 text-[11px] font-mono text-ivory/20 italic">No queries active. Ask a contract question above.</p>
                      )}
                    </div>

                    {/* Chat Input */}
                    <div className="mt-4 flex gap-2">
                      <input
                        type="text"
                        placeholder="Interrogate document (e.g. What obligations exist in this agreement?)..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendQuery(chatInput)}
                        className="flex-1 bg-white/[0.03] border border-white/[0.08] rounded-lg px-3 py-2 text-[12px] text-ivory focus:outline-none focus:border-gold/50 placeholder:text-ivory/30"
                      />
                      <button
                        onClick={() => handleSendQuery(chatInput)}
                        className="rounded-lg bg-gold hover:bg-gold-gradient text-matte font-bold px-4 py-2 text-[12px] flex items-center justify-center gap-1 transition-colors"
                      >
                        <Send size={12} /> Ask
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </motion.div>
          </AnimatePresence>
          )}

        </div>

      </div>

    </div>
  );
}

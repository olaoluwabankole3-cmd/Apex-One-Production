"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";
import {
  FRONTEND_API_FAILURE_EVENT,
  type FrontendApiFailureDetail,
} from "@/lib/frontendApiFailure";

export default function ApiFailureBanner() {
  const [failure, setFailure] = useState<FrontendApiFailureDetail | null>(null);

  useEffect(() => {
    const handleFailure = (event: Event) => {
      const customEvent = event as CustomEvent<FrontendApiFailureDetail>;
      if (!customEvent.detail) return;
      setFailure(customEvent.detail);
    };

    window.addEventListener(FRONTEND_API_FAILURE_EVENT, handleFailure);
    return () => window.removeEventListener(FRONTEND_API_FAILURE_EVENT, handleFailure);
  }, []);

  if (!failure) return null;

  return (
    <div
      role="alert"
      className="mx-4 mt-3 flex items-start justify-between gap-4 rounded-xl border border-crimson/30 bg-crimson/10 px-4 py-3 text-sm text-ivory sm:mx-6 lg:mx-10"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-crimson" />
        <div className="min-w-0">
          <p className="font-semibold">Backend request failed</p>
          <p className="mt-0.5 text-[12px] text-ivory/70">{failure.message}</p>
          <p className="mt-1 break-all font-mono text-[10px] text-ivory/40">
            {failure.code}
            {failure.status ? ` · HTTP ${failure.status}` : ""}
            {failure.requestId ? ` · Request ${failure.requestId}` : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        aria-label="Dismiss API failure"
        onClick={() => setFailure(null)}
        className="shrink-0 rounded-md p-1 text-ivory/45 transition-colors hover:bg-white/5 hover:text-ivory"
      >
        <X size={15} />
      </button>
    </div>
  );
}

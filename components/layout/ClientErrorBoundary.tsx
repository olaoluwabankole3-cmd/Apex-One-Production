"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

// Helper to identify third-party browser extension / wallet injection noise
const isExtensionNoise = (val: unknown): boolean => {
  if (!val) return false;
  try {
    const str = typeof val === "string" ? val : JSON.stringify(val);
    const lower = str.toLowerCase();
    return (
      lower.includes("sender-wallet") ||
      lower.includes("sender_getproviderstate") ||
      lower.includes("sender: failed to get initial state") ||
      lower.includes("no account exist") ||
      lower.includes("sender-wallet-providerresult") ||
      lower.includes("chrome-extension://") ||
      lower.includes("moz-extension://") ||
      lower.includes("ethereum") ||
      lower.includes("metamask") ||
      lower.includes("solana") ||
      lower.includes("phantom")
    );
  } catch {
    return false;
  }
};

// Register early global suppression when running in browser
if (typeof window !== "undefined") {
  // 1. Catch unhandled promise rejections from injected scripts
  window.addEventListener(
    "unhandledrejection",
    (event: PromiseRejectionEvent) => {
      if (
        isExtensionNoise(event.reason) ||
        (event.reason && typeof event.reason === "object" && isExtensionNoise(event.reason.message))
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  // 2. Catch global script errors from injected extensions
  window.addEventListener(
    "error",
    (event: ErrorEvent) => {
      if (
        isExtensionNoise(event.message) ||
        isExtensionNoise(event.error) ||
        isExtensionNoise(event.filename)
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true
  );

  // 3. Wrap console.error to filter out extension wallet error logs
  if (typeof console !== "undefined" && console.error) {
    const origConsoleError = console.error;
    console.error = (...args: any[]) => {
      try {
        const fullMsg = args
          .map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a)))
          .join(" ");
        if (isExtensionNoise(fullMsg)) {
          return; // Suppress third-party wallet extension noise
        }
      } catch {
        // Pass through if stringification fails
      }
      origConsoleError.apply(console, args);
    };
  }
}

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ClientErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    // If it is external extension noise, don't crash the UI
    if (isExtensionNoise(error.message) || isExtensionNoise(error.stack)) {
      return { hasError: false };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    if (isExtensionNoise(error.message) || isExtensionNoise(error.stack)) {
      return;
    }
    if (process.env.NODE_ENV === "development") {
      console.warn("ClientErrorBoundary caught application error:", error, errorInfo);
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-matte p-6 text-ivory">
          <div className="max-w-md w-full rounded-xl border border-charcoal-light/60 bg-charcoal/80 p-6 text-center space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-ivory">Something went wrong</h2>
            <p className="text-sm text-silver">
              An unexpected display issue occurred. Please refresh the page to restore the session.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false });
                if (typeof window !== "undefined") window.location.reload();
              }}
              className="px-4 py-2 bg-gold/90 text-matte hover:bg-gold rounded-lg font-medium transition-colors text-sm"
            >
              Refresh Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}


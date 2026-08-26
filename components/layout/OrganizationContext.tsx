"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import {
  OrganizationConfig,
  defaultOrganizationConfig,
  formatCurrency as baseFormatCurrency,
  formatPercent as baseFormatPercent,
  formatNumber as baseFormatNumber,
  formatDate as baseFormatDate
} from "@/lib/organizationConfig";

interface OrganizationContextValue {
  organization: OrganizationConfig;
  setOrganization: (config: OrganizationConfig) => void;
  formatCurrency: (value: number, isCompact?: boolean) => string;
  formatPercent: (value: number, decimals?: number) => string;
  formatNumber: (value: number, decimals?: number, isCompact?: boolean) => string;
  formatDate: (dateStr: string) => string;
  t: {
    customer: string;
    customers: string;
    employee: string;
    employees: string;
    account: string;
    accounts: string;
    revenue: string;
    department: string;
    departments: string;
    subsidiary: string;
    subsidiaries: string;
  };
  isFeatureEnabled: (featureName: keyof OrganizationConfig["features"]) => boolean;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function OrganizationProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganizationState] = useState<OrganizationConfig>(defaultOrganizationConfig);

  const setOrganization = (config: OrganizationConfig) => {
    setOrganizationState(config);
  };

  const formatCurrency = (value: number, isCompact: boolean = false) => {
    return baseFormatCurrency(value, organization.locale.currencySymbol, isCompact);
  };

  const formatPercent = (value: number, decimals: number = 1) => {
    return baseFormatPercent(value, decimals);
  };

  const formatNumber = (value: number, decimals: number = 0, isCompact: boolean = false) => {
    return baseFormatNumber(value, decimals, isCompact);
  };

  const formatDate = (dateStr: string) => {
    return baseFormatDate(dateStr);
  };

  const isFeatureEnabled = (featureName: keyof OrganizationConfig["features"]) => {
    return !!organization.features[featureName];
  };

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        setOrganization,
        formatCurrency,
        formatPercent,
        formatNumber,
        formatDate,
        t: organization.terminology,
        isFeatureEnabled
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error("useOrganization must be used within an OrganizationProvider");
  }
  return context;
}

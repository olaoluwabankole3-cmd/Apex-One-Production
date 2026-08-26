export interface OrganizationConfig {
  id: string;
  name: string;
  displayName: string;
  shortName: string;
  industry: string;
  description?: string;

  branding: {
    logo?: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
  };

  locale: {
    country: string;
    currency: string;
    currencySymbol: string;
    timezone: string;
    dateFormat: string;
    numberFormat: string;
  };

  terminology: {
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

  organizationStructure: {
    businessUnits: string[];
    departments: string[];
  };

  features: {
    aiWorkspace: boolean;
    customerIntelligence: boolean;
    revenueIntelligence: boolean;
    capacityIntelligence: boolean;
    valueIntelligence: boolean;
    workflowIntelligence: boolean;
  };
}

// safe default fictional configuration using APEX DEMO and APEX ONE
export const defaultOrganizationConfig: OrganizationConfig = {
  id: "apex-demo",
  name: "Apex Demo Group",
  displayName: "Apex Demo",
  shortName: "Apex",
  industry: "financial_services",
  description: "Advanced analytics, treasury operations, and strategic advisory services powered by Apex Sync Intelligence.",

  branding: {
    primaryColor: "#0a0a0b",
    secondaryColor: "#1c1c22",
    accentColor: "#c9a961",
  },

  locale: {
    country: "Nigeria",
    currency: "NGN",
    currencySymbol: "₦",
    timezone: "Africa/Lagos",
    dateFormat: "DD/MM/YYYY",
    numberFormat: "en-NG",
  },

  terminology: {
    customer: "Customer",
    customers: "Customers",
    employee: "Relationship Manager",
    employees: "Relationship Managers",
    account: "Account",
    accounts: "Accounts",
    revenue: "Revenue",
    department: "Department",
    departments: "Departments",
    subsidiary: "Subsidiary",
    subsidiaries: "Subsidiaries",
  },

  organizationStructure: {
    businessUnits: [
      "Enterprise Operations",
      "Commercial Operations",
      "Strategic Accounts",
      "Customer Operations"
    ],
    departments: [
      "Treasury Management",
      "Risk Division",
      "Customer Success",
      "Custody",
      "Operations Engineering"
    ]
  },

  features: {
    aiWorkspace: true,
    customerIntelligence: true,
    revenueIntelligence: true,
    capacityIntelligence: true,
    valueIntelligence: true,
    workflowIntelligence: true,
  }
};

export const company = {
  name: "Apex Sync",
  subsidiaries: defaultOrganizationConfig.organizationStructure.businessUnits,
};

// Centralized formatting utilities

export function formatCurrency(
  value: number,
  currencySymbol: string = defaultOrganizationConfig.locale.currencySymbol,
  isCompact: boolean = false
): string {
  if (isNaN(value)) return `${currencySymbol}0`;
  
  if (isCompact) {
    if (value >= 1000000000) {
      return `${currencySymbol}${(value / 1000000000).toFixed(1)}B`;
    }
    if (value >= 1000000) {
      return `${currencySymbol}${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${currencySymbol}${(value / 1000).toFixed(0)}K`;
    }
  }

  return `${currencySymbol}${value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function formatPercent(value: number, decimals: number = 1): string {
  if (isNaN(value)) return "0%";
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(
  value: number,
  decimals: number = 0,
  isCompact: boolean = false
): string {
  if (isNaN(value)) return "0";
  
  if (isCompact) {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}B`;
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}K`;
    }
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(dateStr: string): string {
  // Fallback if empty
  if (!dateStr) return "";
  return dateStr;
}

export type IntegrationProvider = "gmail" | "hubspot" | "slack";

export type LeadStage =
  | "new"
  | "enriching"
  | "scored"
  | "qualified"
  | "disqualified"
  | "outreach_drafted"
  | "outreach_sent"
  | "replied";

export interface Company {
  id: string;
  domain: string;
  name: string;
  industry?: string;
  employeeCount?: number;
  hubspotCompanyId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lead {
  id: string;
  companyId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  title?: string;
  source: string;
  stage: LeadStage;
  hubspotContactId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICPRule {
  field: string;
  operator: "equals" | "contains" | "gt" | "lt" | "in";
  value: string | number | string[];
}

export interface ICPDefinition {
  id: string;
  name: string;
  rules: ICPRule[];
  dealBreakers: ICPRule[];
}

export interface LeadScore {
  id: string;
  leadId: string;
  icpDefinitionId: string;
  fitScore: number;
  intentScore: number;
  rationale: string;
  createdAt: string;
}

/**
 * Persisted integration connections never carry plaintext tokens in
 * application-layer types. `hasValidToken` is derived server-side from
 * whether a decryptable, unexpired token exists.
 */
export interface IntegrationConnection {
  id: string;
  provider: IntegrationProvider;
  scopes: string[];
  hasValidToken: boolean;
  connectedAt: string;
  lastRefreshedAt?: string;
}

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('gmail', 'hubspot', 'slack');

-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM ('new', 'enriching', 'scored', 'qualified', 'disqualified', 'outreach_drafted', 'outreach_sent', 'replied');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('drafted', 'approved', 'sent', 'rejected');

-- CreateEnum
CREATE TYPE "SignalType" AS ENUM ('capex_new_infrastructure', 'platform_replatforming', 'new_it_leadership', 'security_compliance_investment', 'ma_it_integration', 'explicit_budget_or_rfp');

-- CreateEnum
CREATE TYPE "SignalStrength" AS ENUM ('strong', 'weak');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "employeeCount" INTEGER,
    "hubspotCompanyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "title" TEXT,
    "source" TEXT NOT NULL,
    "stage" "LeadStage" NOT NULL DEFAULT 'new',
    "hubspotContactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IcpDefinition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rulesJson" JSONB NOT NULL,
    "dealBreakersJson" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IcpDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadScore" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "icpDefinitionId" TEXT NOT NULL,
    "fitScore" INTEGER NOT NULL,
    "intentScore" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationConnection" (
    "id" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3),
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastRefreshedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "codeVerifier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutreachDraft" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "bodyText" TEXT NOT NULL,
    "gmailDraftId" TEXT,
    "status" "OutreachStatus" NOT NULL DEFAULT 'drafted',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutreachDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Filing" (
    "id" TEXT NOT NULL,
    "cik" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "accessionNumber" TEXT NOT NULL,
    "filedAt" TIMESTAMP(3) NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT,

    CONSTRAINT "Filing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FilingSignal" (
    "id" TEXT NOT NULL,
    "filingId" TEXT NOT NULL,
    "signalType" "SignalType" NOT NULL,
    "strength" "SignalStrength" NOT NULL,
    "quote" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "extractedSystem" TEXT,
    "extractedVendor" TEXT,
    "extractedBudget" TEXT,
    "extractedTimeline" TEXT,
    "score" INTEGER NOT NULL,
    "reviewedRelevant" BOOLEAN,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FilingSignal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_domain_key" ON "Company"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "Company_hubspotCompanyId_key" ON "Company"("hubspotCompanyId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_hubspotContactId_key" ON "Lead"("hubspotContactId");

-- CreateIndex
CREATE INDEX "Lead_stage_idx" ON "Lead"("stage");

-- CreateIndex
CREATE INDEX "LeadScore_leadId_idx" ON "LeadScore"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationConnection_provider_key" ON "IntegrationConnection"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthState_state_key" ON "OAuthState"("state");

-- CreateIndex
CREATE INDEX "OutreachDraft_leadId_idx" ON "OutreachDraft"("leadId");

-- CreateIndex
CREATE INDEX "OutreachDraft_status_idx" ON "OutreachDraft"("status");

-- CreateIndex
CREATE INDEX "AuditLog_targetType_targetId_idx" ON "AuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Filing_accessionNumber_key" ON "Filing"("accessionNumber");

-- CreateIndex
CREATE INDEX "Filing_cik_idx" ON "Filing"("cik");

-- CreateIndex
CREATE INDEX "Filing_filedAt_idx" ON "Filing"("filedAt");

-- CreateIndex
CREATE INDEX "FilingSignal_filingId_idx" ON "FilingSignal"("filingId");

-- CreateIndex
CREATE INDEX "FilingSignal_signalType_idx" ON "FilingSignal"("signalType");

-- CreateIndex
CREATE INDEX "FilingSignal_score_idx" ON "FilingSignal"("score");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScore" ADD CONSTRAINT "LeadScore_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadScore" ADD CONSTRAINT "LeadScore_icpDefinitionId_fkey" FOREIGN KEY ("icpDefinitionId") REFERENCES "IcpDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutreachDraft" ADD CONSTRAINT "OutreachDraft_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Filing" ADD CONSTRAINT "Filing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FilingSignal" ADD CONSTRAINT "FilingSignal_filingId_fkey" FOREIGN KEY ("filingId") REFERENCES "Filing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

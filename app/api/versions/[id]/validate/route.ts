// app/api/versions/[id]/validate/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSettings } from "@/lib/getSettings";
import { UuidSchema } from "@/lib/validateRequest";
import { logger } from "@/lib/logger";
import { withErrorHandler } from "@/lib/withErrorHandler";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!
);

export const GET = withErrorHandler(async (
  _: Request,
  ctx: { params: Promise<{ id: string }> }
) => {
  const { id } = await ctx.params;
  
  // Validate UUID
  const uuidValidation = UuidSchema.safeParse(id);
  if (!uuidValidation.success) {
    return NextResponse.json(
      {
        error: 'Invalid version ID format',
        details: [{ path: 'id', message: 'Must be a valid UUID', code: 'invalid_type' }],
      },
      { status: 400 }
    );
  }

  // Fetch settings
  const settings = await getSettings();

  const issues: { code: string; message: string; severity: "error" | "warning" }[] = [];

  // Get all tabs for this version
  const { data: tabs, error: tabsError } = await supabase
    .from("version_tabs")
    .select("tab, data")
    .eq("version_id", id);

  if (tabsError) {
    logger.error("Validate tabs error", tabsError, { versionId: id });
    return NextResponse.json(
      { ok: false, error: `Failed to fetch tabs: ${tabsError.message}` },
      { status: 500 }
    );
  }

  // Check required tabs exist (from settings)
  const expectedTabs = settings.validation.requireTabs;
  const existingTabs = tabs ? tabs.map((t) => t.tab) : [];

  // Check if required tabs exist (from settings)
  expectedTabs.forEach((tab) => {
    if (!existingTabs.includes(tab)) {
      const tabName = tab.toUpperCase();
      issues.push({
        code: `NO_${tabName}`,
        message: `${tabName} tab is missing`,
        severity: "error",
      });
    }
  });

  // Validate tab schemas and run derivations
  const { validateTabData } = await import('@/lib/schemas/tabs');
  const { derivePnl, deriveBs, deriveCf, checkBsBalance } = await import('@/lib/derive');

  // Validate each tab against its schema
  tabs?.forEach((tab) => {
    const validation = validateTabData(tab.tab as any, tab.data);
    if (!validation.success && validation.error) {
      validation.error.issues.forEach((err) => {
        issues.push({
          code: `SCHEMA_${tab.tab.toUpperCase()}_${err.path.join('_').toUpperCase()}`,
          message: `${tab.tab.toUpperCase()} validation error: ${err.message}`,
          severity: "error",
        });
      });
    }
  });

  // Check PNL tab
  const pnlTab = tabs?.find((t) => t.tab === "pnl");
  if (pnlTab && pnlTab.data) {
    const pnlData = pnlTab.data as Record<string, unknown>;
    const derived = derivePnl(pnlData);
    
    // Check if has meaningful data
    if (!pnlData.revenue && !pnlData.ebit && !pnlData.net_income && !derived.revenue && !derived.ebit && !derived.net_income) {
      issues.push({
        code: "PNL_EMPTY",
        message: "PNL tab exists but contains no financial data",
        severity: "warning",
      });
    }
  }

  // Check BS tab with balance validation
  const bsTab = tabs?.find((t) => t.tab === "bs");
  if (bsTab && bsTab.data) {
    const bsData = bsTab.data as Record<string, unknown>;
    const derived = deriveBs(bsData);
    
    if (!bsData.assets && !bsData.equity && !bsData.liabilities && !derived.assets && !derived.equity && !derived.liabilities) {
      issues.push({
        code: "BS_EMPTY",
        message: "Balance Sheet tab exists but contains no financial data",
        severity: "warning",
      });
    } else {
      // Use derivation to get calculated values
      const finalBs = { ...bsData, ...derived };
      const balanceCheck = checkBsBalance(finalBs, settings.validation.bsTolerance);
      
      if (!balanceCheck.balanced) {
        issues.push({
          code: "BS_NOT_BALANCED",
          message: `Balance sheet does not balance by ${balanceCheck.difference.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
          severity: "error",
        });
      }
    }
  }

  // Check CF tab
  const cfTab = tabs?.find((t) => t.tab === "cf");
  if (cfTab && cfTab.data) {
    const cfData = cfTab.data as Record<string, unknown>;
    const derived = deriveCf(cfData);
    
    // CF validation can be added here if needed
    if (!cfData.operating && !cfData.investing && !cfData.financing && 
        !derived.operating && !derived.investing && !derived.financing) {
      issues.push({
        code: "CF_EMPTY",
        message: "Cash Flow tab exists but contains no financial data",
        severity: "warning",
      });
    }
  }

  // Check existing validations from version_validations table
  const { data: validations, error: valError } = await supabase
    .from("version_validations")
    .select("code, message, severity")
    .eq("version_id", id);

  if (!valError && validations) {
    // Add existing validations as issues
    validations.forEach((val) => {
      issues.push({
        code: val.code,
        message: val.message,
        severity: val.severity as "error" | "warning",
      });
    });
  }

  // Summary: ok is true if no errors (only warnings are acceptable)
  const hasErrors = issues.some((i) => i.severity === "error");
  const ok = !hasErrors;

  logger.info('Validation completed', { versionId: id, ok, issueCount: issues.length });
  return NextResponse.json({ ok, issues });
});

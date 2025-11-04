// lib/getStatementLines.ts
// Helper functions to query and manage version_statement_lines table

import { getServiceClient } from './supabaseServer';

// ============================================================================
// TYPES
// ============================================================================

export interface StatementLine {
  id: string;
  version_id: string;
  statement_type: 'pnl' | 'bs' | 'cf';
  row_key: string;
  row_label: string;
  display_order: number;
  parent_row_key: string | null;
  level: number;
  is_calculated: boolean;
  is_subtotal: boolean;
  formula: string | null;
  created_at: string;
  updated_at: string;
}

export interface StatementLineInput {
  statement_type: 'pnl' | 'bs' | 'cf';
  row_key: string;
  row_label: string;
  display_order: number;
  parent_row_key?: string | null;
  level?: number;
  is_calculated?: boolean;
  is_subtotal?: boolean;
  formula?: string | null;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get all statement lines for a version and statement type
 */
export async function getStatementLines(
  versionId: string,
  statementType: 'pnl' | 'bs' | 'cf'
): Promise<StatementLine[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('version_statement_lines')
    .select('*')
    .eq('version_id', versionId)
    .eq('statement_type', statementType)
    .order('display_order', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as StatementLine[];
}

/**
 * Get all statement lines for a version (all statement types)
 */
export async function getAllStatementLinesForVersion(
  versionId: string
): Promise<Record<'pnl' | 'bs' | 'cf', StatementLine[]>> {
  const [pnl, bs, cf] = await Promise.all([
    getStatementLines(versionId, 'pnl'),
    getStatementLines(versionId, 'bs'),
    getStatementLines(versionId, 'cf'),
  ]);

  return { pnl, bs, cf };
}

/**
 * Get a specific statement line by row_key
 */
export async function getStatementLine(
  versionId: string,
  statementType: 'pnl' | 'bs' | 'cf',
  rowKey: string
): Promise<StatementLine | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('version_statement_lines')
    .select('*')
    .eq('version_id', versionId)
    .eq('statement_type', statementType)
    .eq('row_key', rowKey)
    .single();

  if (error || !data) {
    return null;
  }

  return data as StatementLine;
}

// ============================================================================
// MUTATION FUNCTIONS
// ============================================================================

/**
 * Upsert statement lines for a version
 * This replaces all existing lines for the statement type
 */
export async function upsertStatementLines(
  versionId: string,
  lines: StatementLineInput[]
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  // Validate that all lines have the same statement_type
  if (lines.length > 0) {
    const statementType = lines[0].statement_type;
    const allSameType = lines.every(line => line.statement_type === statementType);
    if (!allSameType) {
      return { success: false, error: 'All lines must have the same statement_type' };
    }

    // Delete existing lines for this statement type
    const { error: deleteError } = await supabase
      .from('version_statement_lines')
      .delete()
      .eq('version_id', versionId)
      .eq('statement_type', statementType);

    if (deleteError) {
      return { success: false, error: `Failed to delete existing lines: ${deleteError.message}` };
    }

    // Insert new lines
    const linesToInsert = lines.map(line => ({
      version_id: versionId,
      statement_type: line.statement_type,
      row_key: line.row_key,
      row_label: line.row_label,
      display_order: line.display_order,
      parent_row_key: line.parent_row_key || null,
      level: line.level ?? 0,
      is_calculated: line.is_calculated ?? false,
      is_subtotal: line.is_subtotal ?? false,
      formula: line.formula || null,
    }));

    const { error: insertError } = await supabase
      .from('version_statement_lines')
      .insert(linesToInsert);

    if (insertError) {
      return { success: false, error: `Failed to insert lines: ${insertError.message}` };
    }
  }

  return { success: true };
}

/**
 * Initialize statement lines from metric_catalog for a version
 * This creates default statement structure based on metric_catalog
 */
export async function initializeStatementLinesFromCatalog(
  versionId: string,
  statementType: 'pnl' | 'bs' | 'cf'
): Promise<{ success: boolean; error?: string; count?: number }> {
  const supabase = getServiceClient();

  // Get metrics from catalog for this statement type
  const { data: metrics, error: metricsError } = await supabase
    .from('metric_catalog')
    .select('metric_key, row_key, row_label, is_calculated, display_order, formula')
    .eq('statement_type', statementType)
    .not('row_key', 'is', null)
    .not('row_label', 'is', null)
    .not('display_order', 'is', null)
    .order('display_order', { ascending: true });

  if (metricsError || !metrics) {
    return { success: false, error: `Failed to fetch metrics: ${metricsError?.message || 'Unknown error'}` };
  }

  // Build statement lines from catalog
  const lines: StatementLineInput[] = metrics.map((metric) => {
    // Determine parent_row_key and level from row_key structure
    const rowKeyParts = metric.row_key!.split('.');
    const level = rowKeyParts.length - 1;
    const parentRowKey = rowKeyParts.length > 1 
      ? rowKeyParts.slice(0, -1).join('.')
      : null;

    return {
      statement_type: statementType,
      row_key: metric.row_key!,
      row_label: metric.row_label!,
      display_order: metric.display_order!,
      parent_row_key: parentRowKey,
      level,
      is_calculated: metric.is_calculated,
      is_subtotal: false, // Can be determined from structure later
      formula: metric.formula,
    };
  });

  // Upsert the lines
  const result = await upsertStatementLines(versionId, lines);

  return {
    ...result,
    count: result.success ? lines.length : undefined,
  };
}

/**
 * Delete all statement lines for a version
 */
export async function deleteStatementLines(
  versionId: string,
  statementType?: 'pnl' | 'bs' | 'cf'
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  let query = supabase
    .from('version_statement_lines')
    .delete()
    .eq('version_id', versionId);

  if (statementType) {
    query = query.eq('statement_type', statementType);
  }

  const { error } = await query;

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}


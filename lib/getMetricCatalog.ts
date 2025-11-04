// lib/getMetricCatalog.ts
// Helper functions to query metric_catalog table

import { getServiceClient } from './supabaseServer';
import { MetricKey } from '@/types';

// ============================================================================
// TYPES
// ============================================================================

export interface MetricCatalogEntry {
  id: string;
  metric_key: string;
  display_name: string;
  unit: string;
  category: 'revenue' | 'pnl' | 'balance_sheet' | 'cash_flow' | 'provisions' | 'other';
  statement_type: 'pnl' | 'bs' | 'cf' | null;
  row_key: string | null;
  row_label: string | null;
  formula: string | null;
  is_calculated: boolean;
  is_historical: boolean;
  display_order: number | null;
  created_at: string;
  updated_at: string;
}

export interface StatementLineMetadata {
  metric_key: string;
  display_name: string;
  unit: string;
  row_key: string;
  row_label: string;
  is_calculated: boolean;
  display_order: number;
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get metric metadata by key
 */
export async function getMetricMetadata(metricKey: MetricKey): Promise<MetricCatalogEntry | null> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('metric_catalog')
    .select('*')
    .eq('metric_key', metricKey)
    .single();

  if (error || !data) {
    return null;
  }

  return data as MetricCatalogEntry;
}

/**
 * Get all metrics for a statement type
 */
export async function getStatementMetrics(
  statementType: 'pnl' | 'bs' | 'cf'
): Promise<StatementLineMetadata[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('metric_catalog')
    .select('metric_key, display_name, unit, row_key, row_label, is_calculated, display_order')
    .eq('statement_type', statementType)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('metric_key', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data
    .filter((entry): entry is StatementLineMetadata => 
      entry.row_key !== null && 
      entry.row_label !== null &&
      entry.display_order !== null
    )
    .map(entry => ({
      metric_key: entry.metric_key,
      display_name: entry.display_name,
      unit: entry.unit,
      row_key: entry.row_key!,
      row_label: entry.row_label!,
      is_calculated: entry.is_calculated,
      display_order: entry.display_order!,
    }));
}

/**
 * Get all metrics by category
 */
export async function getMetricsByCategory(
  category: MetricCatalogEntry['category']
): Promise<MetricCatalogEntry[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('metric_catalog')
    .select('*')
    .eq('category', category)
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('metric_key', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as MetricCatalogEntry[];
}

/**
 * Get all metrics (cached for performance)
 */
export async function getAllMetrics(): Promise<MetricCatalogEntry[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('metric_catalog')
    .select('*')
    .order('category', { ascending: true })
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('metric_key', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as MetricCatalogEntry[];
}

/**
 * Get metric display name (with fallback to key)
 */
export async function getMetricDisplayName(metricKey: MetricKey): Promise<string> {
  const metadata = await getMetricMetadata(metricKey);
  return metadata?.display_name || metricKey;
}

/**
 * Get metric unit (with fallback to empty string)
 */
export async function getMetricUnit(metricKey: MetricKey): Promise<string> {
  const metadata = await getMetricMetadata(metricKey);
  return metadata?.unit || '';
}

/**
 * Check if metric is calculated
 */
export async function isMetricCalculated(metricKey: MetricKey): Promise<boolean> {
  const metadata = await getMetricMetadata(metricKey);
  return metadata?.is_calculated || false;
}


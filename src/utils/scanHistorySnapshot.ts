import type { AIInsights, Analysis, ScanResult } from '../types';

/** Row shape from GET /scan/:id (analysis_json already parsed as `analysis`). */
export interface ScanHistoryDetailRow {
  id: string;
  scan_type: string;
  pet_name: string;
  pet_type: string;
  product_id?: string | null;
  product_name?: string | null;
  product_brand?: string | null;
  product_image?: string | null;
  final_score: number;
  grade: string;
  recommendation: string;
  analysis?: (Analysis & { aiInsights?: AIInsights }) | Record<string, never>;
}

export function scanRowToScanResult(
  scan: ScanHistoryDetailRow,
  historyImageUrl?: string
): ScanResult {
  const raw = (scan.analysis ?? {}) as Analysis & { aiInsights?: AIInsights };
  const { aiInsights, ...analysisRest } = raw;
  const analysis = analysisRest as Analysis;

  const imageUrl =
    historyImageUrl ??
    (scan as ScanHistoryDetailRow & { product_image?: string | null }).product_image ??
    undefined;

  const product = scan.product_id
    ? {
        id: scan.product_id,
        name: scan.product_name ?? 'Product',
        ...(scan.product_brand ? { brand: scan.product_brand } : {}),
        ...(imageUrl ? { image_url: imageUrl } : {}),
      }
    : undefined;

  return {
    scanId: scan.id,
    scanType: scan.scan_type,
    analysis: {
      ...analysis,
      finalScore: analysis.finalScore ?? scan.final_score,
      grade: analysis.grade ?? scan.grade,
      recommendation: analysis.recommendation ?? scan.recommendation,
    },
    ...(aiInsights ? { aiInsights } : {}),
    pet: {
      name: scan.pet_name,
      petType: scan.pet_type,
    },
    ...(product ? { product } : {}),
    extracted: {
      ...(scan.product_name ? { productName: scan.product_name } : {}),
      ...(scan.product_brand ? { brand: scan.product_brand } : {}),
      ...(scan.scan_type === 'manual_input' && !scan.product_name
        ? { productName: 'Manual entry' }
        : {}),
    },
  };
}

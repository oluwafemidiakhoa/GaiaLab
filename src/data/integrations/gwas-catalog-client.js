/**
 * GWAS Catalog Client - gene/trait associations from GWAS studies
 *
 * DATA SOURCE: GWAS Catalog REST API (EBI)
 * - Free, open access
 * - Provides SNP-level associations, traits, and study metadata
 *
 * API Documentation: https://www.ebi.ac.uk/gwas/docs/api
 */

import { fetchWithTimeout, retryWithBackoff } from '../../utils/fetch-with-timeout.js';

const GWAS_BASE = 'https://www.ebi.ac.uk/gwas/rest/api';

export class GwasCatalogClient {
  constructor() {
    this.baseUrl = GWAS_BASE;
    this.version = 'GWAS Catalog REST';
  }

  async getGeneAssociations(geneSymbol, options = {}) {
    const {
      maxResults = 5,
      minPValue = 1e-5
    } = options;

    try {
      const url = `${this.baseUrl}/associations?geneName=${encodeURIComponent(geneSymbol)}`;
      const data = await this.fetchJson(url, 12000);
      const associations = data?._embedded?.associations || [];

      const filtered = [];
      for (const association of associations) {
        const pvalue = this.getPValue(association);
        if (Number.isFinite(pvalue) && pvalue > minPValue) {
          continue;
        }

        const studyHref = association?._links?.study?.href;
        const study = studyHref ? await this.fetchJson(studyHref, 12000).catch(() => null) : null;
        const trait = study?.diseaseTrait?.trait || association?.pvalueDescription || 'Trait not specified';

        filtered.push({
          gene: geneSymbol,
          disease: trait,
          diseaseId: study?.accessionId || association?.studyAccession || null,
          pvalue: Number.isFinite(pvalue) ? pvalue : null,
          score: this.scoreFromPValue(pvalue),
          evidenceTypes: 'GWAS',
          evidenceBreakdown: [{
            type: 'GWAS',
            score: this.scoreFromPValue(pvalue)
          }],
          pmid: study?.publicationInfo?.pubmedId || null,
          studyAccession: study?.accessionId || null,
          sampleSize: study?.initialSampleSize || null,
          source: this.version
        });

        if (filtered.length >= maxResults) {
          break;
        }
      }

      return {
        gene: geneSymbol,
        associations: filtered,
        totalAssociations: associations.length,
        source: this.version
      };
    } catch (error) {
      console.error(`[GWAS Catalog] Failed to fetch associations for ${geneSymbol}:`, error.message);
      return {
        gene: geneSymbol,
        associations: [],
        totalAssociations: 0,
        error: error.message
      };
    }
  }

  async fetchJson(url, timeoutMs) {
    return retryWithBackoff(async () => {
      const response = await fetchWithTimeout(url, {}, timeoutMs);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    }, 2);
  }

  getPValue(association) {
    const direct = Number(association?.pvalue);
    if (Number.isFinite(direct)) {
      return direct;
    }

    const mantissa = Number(association?.pvalueMantissa);
    const exponent = Number(association?.pvalueExponent);
    if (Number.isFinite(mantissa) && Number.isFinite(exponent)) {
      return mantissa * Math.pow(10, exponent);
    }

    return null;
  }

  scoreFromPValue(pvalue) {
    if (!Number.isFinite(pvalue) || pvalue <= 0) {
      return 0.2;
    }
    const score = Math.min(1, (-Math.log10(pvalue)) / 10);
    return Number(score.toFixed(3));
  }
}

export const gwasCatalogClient = new GwasCatalogClient();

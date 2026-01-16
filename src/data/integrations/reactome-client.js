/**
 * Reactome Client - pathway annotations for genes
 *
 * DATA SOURCE: Reactome Content Service
 * - Free, open access pathway database
 * - Provides curated pathway membership
 *
 * API Documentation: https://reactome.org/ContentService/
 */

import { fetchWithTimeout, retryWithBackoff } from '../../utils/fetch-with-timeout.js';

const REACTOME_BASE = 'https://reactome.org/ContentService';

export class ReactomeClient {
  constructor() {
    this.baseUrl = REACTOME_BASE;
    this.cachedVersion = null;
  }

  async getDatabaseVersion() {
    if (this.cachedVersion) {
      return this.cachedVersion;
    }

    try {
      const url = `${this.baseUrl}/data/database/version`;
      const response = await fetchWithTimeout(url, {}, 8000);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      const version = String(text || '').trim();
      this.cachedVersion = version || 'unknown';
      return this.cachedVersion;
    } catch (error) {
      console.warn('[Reactome] Failed to fetch version:', error.message);
      this.cachedVersion = 'unknown';
      return this.cachedVersion;
    }
  }

  async getPathwaysForGene(geneSymbol, options = {}) {
    const { maxResults = 10 } = options;

    try {
      const entry = await this.findReferenceEntity(geneSymbol);
      if (!entry?.stId) {
        return {
          gene: geneSymbol,
          pathways: [],
          totalPathways: 0,
          source: 'Reactome'
        };
      }

      const url = `${this.baseUrl}/data/pathways/low/entity/${entry.stId}`;
      const data = await this.fetchJson(url, 12000);
      const version = await this.getDatabaseVersion();

      const pathways = (Array.isArray(data) ? data : [])
        .filter(item => item?.schemaClass === 'Pathway')
        .map(item => ({
          id: item.stId || item.dbId,
          name: this.stripHtml(item.displayName || item.name?.[0] || 'Pathway'),
          releaseDate: item.releaseDate || null,
          hasDiagram: Boolean(item.hasDiagram),
          source: `Reactome v${version}`
        }))
        .slice(0, maxResults);

      return {
        gene: geneSymbol,
        pathways,
        totalPathways: Array.isArray(data) ? data.length : pathways.length,
        source: `Reactome v${version}`
      };
    } catch (error) {
      console.error(`[Reactome] Failed to fetch pathways for ${geneSymbol}:`, error.message);
      return {
        gene: geneSymbol,
        pathways: [],
        totalPathways: 0,
        error: error.message
      };
    }
  }

  async findReferenceEntity(geneSymbol) {
    const url = `${this.baseUrl}/search/query?query=${encodeURIComponent(geneSymbol)}`;
    const data = await this.fetchJson(url, 10000);
    const results = data?.results || [];

    const entries = results.flatMap(result => result.entries || []);
    const match = entries.find(entry => {
      const exactType = String(entry.exactType || '').toLowerCase();
      const species = entry.species || [];
      const isHuman = species.includes('Homo sapiens');
      return exactType === 'referencegeneproduct' && isHuman;
    });

    return match || null;
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

  stripHtml(value) {
    return String(value || '').replace(/<[^>]+>/g, '').trim();
  }
}

export const reactomeClient = new ReactomeClient();

import axios from 'axios';

/**
 * Semantic Scholar API client for enriching literature with citation metrics
 * Provides citation counts, author networks, OA links, and paper recommendations
 *
 * API Documentation: https://api.semanticscholar.org/api-docs/graph
 * Rate Limit: 1 request/second (100 req/min with API key)
 */
export class SemanticScholarClient {
  constructor() {
    this.baseUrl = 'https://api.semanticscholar.org/graph/v1';
    this.apiKey = process.env.SEMANTIC_SCHOLAR_API_KEY || null;

    // Fields to request from S2 API
    this.fields = [
      'paperId',
      'title',
      'abstract',
      'authors',
      'year',
      'citationCount',
      'influentialCitationCount',
      'openAccessPdf',
      'fieldsOfStudy',
      'publicationTypes',
      'externalIds'
    ].join(',');
  }

  /**
   * Enrich PubMed papers with Semantic Scholar metadata (batch operation)
   * @param {Array<string>} pmids - Array of PubMed IDs
   * @returns {Promise<Object>} Map of {pmid: s2Data} or {pmid: null} if not found
   */
  async enrichByPMID(pmids) {
    if (!pmids || pmids.length === 0) {
      return {};
    }

    try {
      // Semantic Scholar batch endpoint (supports up to 500 papers)
      const ids = pmids.map(pmid => `PMID:${pmid}`);

      const response = await axios.post(
        `${this.baseUrl}/paper/batch`,
        { ids },
        {
          headers: this._getHeaders(),
          params: { fields: this.fields }
        }
      );

      // Build map of PMID → S2 data
      const enrichmentMap = {};

      for (let i = 0; i < pmids.length; i++) {
        const pmid = pmids[i];
        const s2Paper = response.data[i];

        if (s2Paper && !s2Paper.error) {
          enrichmentMap[pmid] = this._parseSemanticScholarPaper(s2Paper);
        } else {
          enrichmentMap[pmid] = null; // Paper not found in S2
        }
      }

      return enrichmentMap;
    } catch (error) {
      console.error('[Semantic Scholar] Batch enrichment error:', error.message);

      // Return empty map on error (graceful degradation)
      return pmids.reduce((map, pmid) => {
        map[pmid] = null;
        return map;
      }, {});
    }
  }

  /**
   * Search Semantic Scholar by title (fallback if PMID not found)
   * @param {string} title - Paper title
   * @returns {Promise<Object|null>} S2 paper data or null
   */
  async searchByTitle(title) {
    try {
      const response = await axios.get(`${this.baseUrl}/paper/search`, {
        headers: this._getHeaders(),
        params: {
          query: title,
          fields: this.fields,
          limit: 1
        }
      });

      if (response.data.data && response.data.data.length > 0) {
        return this._parseSemanticScholarPaper(response.data.data[0]);
      }

      return null;
    } catch (error) {
      console.error(`[Semantic Scholar] Title search error for "${title}":`, error.message);
      return null;
    }
  }

  /**
   * Get paper recommendations (similar papers)
   * @param {string} paperIdOrPmid - Semantic Scholar paper ID (preferred) or PMID
   * @param {number} limit - Number of recommendations (default 5)
   * @returns {Promise<Array>} Array of recommended papers
   */
  async getRecommendations(paperIdOrPmid, limit = 5) {
    try {
      // Format the paper identifier (add PMID: prefix if it's a PMID)
      const paperId = paperIdOrPmid.startsWith('PMID:') || paperIdOrPmid.length > 20
        ? paperIdOrPmid
        : `PMID:${paperIdOrPmid}`;

      const response = await axios.get(
        `${this.baseUrl}/paper/${paperId}/recommendations`,
        {
          headers: this._getHeaders(),
          params: {
            fields: this.fields,
            limit
          }
        }
      );

      if (response.data.recommendedPapers) {
        return response.data.recommendedPapers.map(p => this._parseSemanticScholarPaper(p));
      }

      return [];
    } catch (error) {
      // Silently fail for papers without recommendations (expected for recent/obscure papers)
      if (error.response?.status !== 404) {
        console.error(`[Semantic Scholar] Recommendations error for ${paperIdOrPmid}:`, error.message);
      }
      return [];
    }
  }

  /**
   * Get paper citations (papers that cite this one)
   * @param {string} pmid - Paper PMID
   * @param {number} limit - Number of citations to fetch
   * @returns {Promise<Array>} Array of citing papers
   */
  async getCitations(pmid, limit = 10) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/paper/PMID:${pmid}/citations`,
        {
          headers: this._getHeaders(),
          params: {
            fields: this.fields,
            limit
          }
        }
      );

      if (response.data.data) {
        return response.data.data.map(item => this._parseSemanticScholarPaper(item.citingPaper));
      }

      return [];
    } catch (error) {
      console.error(`[Semantic Scholar] Citations error for PMID:${pmid}:`, error.message);
      return [];
    }
  }

  /**
   * Get paper references (papers cited by this one)
   * @param {string} pmid - Paper PMID
   * @param {number} limit - Number of references to fetch
   * @returns {Promise<Array>} Array of referenced papers
   */
  async getReferences(pmid, limit = 10) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/paper/PMID:${pmid}/references`,
        {
          headers: this._getHeaders(),
          params: {
            fields: this.fields,
            limit
          }
        }
      );

      if (response.data.data) {
        return response.data.data.map(item => this._parseSemanticScholarPaper(item.citedPaper));
      }

      return [];
    } catch (error) {
      console.error(`[Semantic Scholar] References error for PMID:${pmid}:`, error.message);
      return [];
    }
  }

  /**
   * Parse Semantic Scholar paper into simplified structure
   * @private
   */
  _parseSemanticScholarPaper(s2Paper) {
    try {
      return {
        paperId: s2Paper.paperId,
        citationCount: s2Paper.citationCount || 0,
        influentialCitationCount: s2Paper.influentialCitationCount || 0,
        openAccessPdf: s2Paper.openAccessPdf || null,
        authors: s2Paper.authors || [],
        fieldsOfStudy: s2Paper.fieldsOfStudy || [],
        publicationTypes: s2Paper.publicationTypes || [],
        externalIds: s2Paper.externalIds || {},
        year: s2Paper.year,
        title: s2Paper.title,
        abstract: s2Paper.abstract
      };
    } catch (error) {
      console.error('[Semantic Scholar] Error parsing paper:', error.message);
      return null;
    }
  }

  /**
   * Get request headers (with API key if available)
   * @private
   */
  _getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }

    return headers;
  }

  /**
   * Check if Semantic Scholar API is configured
   * @returns {boolean}
   */
  isConfigured() {
    return !!this.apiKey;
  }
}

// Export singleton instance
export const semanticScholarClient = new SemanticScholarClient();

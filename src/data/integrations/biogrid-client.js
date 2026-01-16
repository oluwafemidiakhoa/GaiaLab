/**
 * BioGRID Database Client - Curated Protein & Genetic Interactions
 *
 * BioGRID (Biological General Repository for Interaction Datasets)
 * - 2.8+ million protein and genetic interactions
 * - 85,000+ publications manually curated
 * - Physical and genetic interactions
 * - 100% FREE with API key (unlimited access)
 *
 * KEY FEATURES:
 * - Experimentally validated interactions (yeast two-hybrid, co-IP, etc.)
 * - Genetic interactions (synthetic lethality, rescue, etc.)
 * - Publication evidence for each interaction
 * - Cross-validates STRING computational predictions
 *
 * API Documentation: https://wiki.thebiogrid.org/doku.php/biogridrest
 * Get API Key: https://webservice.thebiogrid.org/
 *
 */

const BIOGRID_API_BASE = 'https://webservice.thebiogrid.org';
const BIOGRID_VERSION = '4.4.236'; // Current BioGRID version

/**
 * BioGRID Database API Client
 * Provides experimentally validated protein interactions
 */
export class BiogridClient {
  constructor() {
    this.baseUrl = BIOGRID_API_BASE;
    this.apiKey = process.env.BIOGRID_API_KEY || null;
    this.version = BIOGRID_VERSION;
    this.taxonId = 9606; // Homo sapiens
  }

  /**
   * Check if API key is configured
   * @private
   */
  isConfigured() {
    if (!this.apiKey) {
      console.warn('[BioGRID] API key not configured. Set BIOGRID_API_KEY in .env');
      console.warn('[BioGRID] Get free key at: https://webservice.thebiogrid.org/');
      return false;
    }
    return true;
  }

  /**
   * Get protein interactions for a gene
   * @param {string} geneSymbol - Gene symbol (e.g., "TP53", "BRCA1")
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Curated interactions with experimental evidence
   */
  async getProteinInteractions(geneSymbol, options = {}) {
    if (!this.isConfigured()) {
      return {
        gene: geneSymbol,
        interactions: [],
        totalInteractions: 0,
        error: 'BioGRID API key not configured'
      };
    }

    const {
      limit = 100,                    // Max interactions to return
      evidenceType = 'all',           // 'physical', 'genetic', or 'all'
      throughputType = 'any'          // 'low', 'high', or 'any'
    } = options;

    try {
      // BioGRID REST API - interactions endpoint
      const url = `${this.baseUrl}/interactions`;
      const params = new URLSearchParams({
        accesskey: this.apiKey,
        format: 'json',
        geneList: geneSymbol,
        searchNames: 'true',
        includeInteractors: 'true',
        taxId: this.taxonId.toString(),
        includeEvidence: 'true',
        max: limit.toString()
      });

      // Add evidence type filter if specified
      if (evidenceType === 'physical') {
        params.append('evidenceList', 'physical');
      } else if (evidenceType === 'genetic') {
        params.append('evidenceList', 'genetic');
      }

      // Add throughput filter if specified
      if (throughputType === 'low') {
        params.append('throughputTag', 'low throughput');
      } else if (throughputType === 'high') {
        params.append('throughputTag', 'high throughput');
      }

      const response = await fetch(`${url}?${params}`);

      if (!response.ok) {
        throw new Error(`BioGRID API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const interactions = Object.values(data); // BioGRID returns object with interaction IDs as keys

      // Parse and format interactions
      const formattedInteractions = interactions.map(int => {
        // Determine which gene is the partner (interactor B)
        const isGeneA = int.OFFICIAL_SYMBOL_A?.toUpperCase() === geneSymbol.toUpperCase();
        const partner = isGeneA ? int.OFFICIAL_SYMBOL_B : int.OFFICIAL_SYMBOL_A;
        const partnerName = isGeneA ? int.ORGANISM_B_NAME : int.ORGANISM_A_NAME;

        return {
          partner,
          partnerName,
          interactionId: int.BIOGRID_INTERACTION_ID,
          evidenceType: int.EXPERIMENTAL_SYSTEM_TYPE, // 'physical' or 'genetic'
          experimentalSystem: int.EXPERIMENTAL_SYSTEM, // e.g., 'Yeast Two-Hybrid', 'Co-immunoprecipitation'
          throughput: int.THROUGHPUT, // 'Low Throughput' or 'High Throughput'
          pubmedId: int.PUBMED_ID,
          author: int.AUTHOR,
          publicationSource: int.SOURCE_DATABASE,
          score: int.SCORE || null, // Some interactions have confidence scores
          validated: true // BioGRID = experimentally validated
        };
      });

      // Calculate evidence strength
      const evidenceStats = this.calculateEvidenceStats(formattedInteractions);

      return {
        gene: geneSymbol,
        interactions: formattedInteractions,
        totalInteractions: formattedInteractions.length,
        evidenceStats,
        source: `BioGRID v${this.version}`
      };
    } catch (error) {
      console.error(`[BioGRID] Failed to fetch interactions for ${geneSymbol}:`, error.message);
      return {
        gene: geneSymbol,
        interactions: [],
        totalInteractions: 0,
        error: error.message
      };
    }
  }

  /**
   * Calculate evidence statistics
   * @private
   */
  calculateEvidenceStats(interactions) {
    const stats = {
      physical: interactions.filter(i => i.evidenceType === 'physical').length,
      genetic: interactions.filter(i => i.evidenceType === 'genetic').length,
      lowThroughput: interactions.filter(i => i.throughput === 'Low Throughput').length,
      highThroughput: interactions.filter(i => i.throughput === 'High Throughput').length,
      uniquePublications: new Set(interactions.map(i => i.pubmedId)).size,
      topExperiments: this.getTopExperiments(interactions)
    };

    return stats;
  }

  /**
   * Get top experimental systems used
   * @private
   */
  getTopExperiments(interactions) {
    const experimentCounts = {};
    interactions.forEach(int => {
      const exp = int.experimentalSystem;
      experimentCounts[exp] = (experimentCounts[exp] || 0) + 1;
    });

    return Object.entries(experimentCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([experiment, count]) => ({ experiment, count }));
  }

  /**
   * Get interactions between multiple genes (network)
   * @param {string[]} geneSymbols - Array of gene symbols
   * @returns {Promise<Object>} Network of interactions among input genes
   */
  async getGeneNetwork(geneSymbols) {
    if (!this.isConfigured()) {
      return {
        genes: geneSymbols,
        network: [],
        error: 'BioGRID API key not configured'
      };
    }

    try {
      // Fetch all interactions for the gene set
      const url = `${this.baseUrl}/interactions`;
      const params = new URLSearchParams({
        accesskey: this.apiKey,
        format: 'json',
        geneList: geneSymbols.join('|'),
        searchNames: 'true',
        includeInteractors: 'true',
        taxId: this.taxonId.toString(),
        includeEvidence: 'true',
        selfInteractionsExcluded: 'true'
      });

      const response = await fetch(`${url}?${params}`);

      if (!response.ok) {
        throw new Error(`BioGRID network error: ${response.status}`);
      }

      const data = await response.json();
      const interactions = Object.values(data);

      // Filter to only interactions between input genes
      const geneSet = new Set(geneSymbols.map(g => g.toUpperCase()));
      const networkEdges = interactions.filter(int => {
        const geneA = int.OFFICIAL_SYMBOL_A?.toUpperCase();
        const geneB = int.OFFICIAL_SYMBOL_B?.toUpperCase();
        return geneSet.has(geneA) && geneSet.has(geneB);
      });

      return {
        genes: geneSymbols,
        network: networkEdges.map(int => ({
          source: int.OFFICIAL_SYMBOL_A,
          target: int.OFFICIAL_SYMBOL_B,
          evidenceType: int.EXPERIMENTAL_SYSTEM_TYPE,
          experiment: int.EXPERIMENTAL_SYSTEM,
          pubmedId: int.PUBMED_ID,
          interactionId: int.BIOGRID_INTERACTION_ID
        })),
        totalEdges: networkEdges.length,
        source: `BioGRID v${this.version}`
      };
    } catch (error) {
      console.error(`[BioGRID] Network fetch failed:`, error.message);
      return {
        genes: geneSymbols,
        network: [],
        error: error.message
      };
    }
  }

  /**
   * Search interactions by publication (PubMed ID)
   * @param {string} pubmedId - PubMed ID
   * @returns {Promise<Array>} Interactions from that publication
   */
  async getInteractionsByPublication(pubmedId) {
    if (!this.isConfigured()) {
      return { interactions: [], error: 'API key not configured' };
    }

    try {
      const url = `${this.baseUrl}/interactions`;
      const params = new URLSearchParams({
        accesskey: this.apiKey,
        format: 'json',
        pubmedList: pubmedId,
        taxId: this.taxonId.toString(),
        includeEvidence: 'true'
      });

      const response = await fetch(`${url}?${params}`);

      if (!response.ok) {
        throw new Error(`BioGRID publication search error: ${response.status}`);
      }

      const data = await response.json();
      const interactions = Object.values(data);

      return {
        pubmedId,
        interactions: interactions.map(int => ({
          geneA: int.OFFICIAL_SYMBOL_A,
          geneB: int.OFFICIAL_SYMBOL_B,
          evidenceType: int.EXPERIMENTAL_SYSTEM_TYPE,
          experiment: int.EXPERIMENTAL_SYSTEM
        })),
        totalInteractions: interactions.length,
        source: 'BioGRID'
      };
    } catch (error) {
      console.error(`[BioGRID] Publication search failed for ${pubmedId}:`, error.message);
      return {
        pubmedId,
        interactions: [],
        error: error.message
      };
    }
  }

  /**
   * Get interaction confidence based on evidence
   * @param {Object} interaction - BioGRID interaction object
   * @returns {number} Confidence score (0-1)
   */
  calculateConfidence(interaction) {
    let confidence = 0.5; // Base confidence for any BioGRID entry

    // Physical interactions are more direct
    if (interaction.evidenceType === 'physical') {
      confidence += 0.2;
    }

    // Low throughput = more careful validation
    if (interaction.throughput === 'Low Throughput') {
      confidence += 0.15;
    }

    // High-quality experimental methods
    const highQualityMethods = [
      'Co-immunoprecipitation',
      'Pull Down',
      'Reconstituted Complex',
      'Co-purification',
      'Co-crystal Structure'
    ];

    if (highQualityMethods.some(method => interaction.experimentalSystem?.includes(method))) {
      confidence += 0.15;
    }

    return Math.min(1.0, confidence);
  }
}

// Export singleton instance
export const biogridClient = new BiogridClient();

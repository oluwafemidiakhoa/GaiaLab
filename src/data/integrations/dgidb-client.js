/**
 * DGIdb (Drug-Gene Interaction Database) Client
 *
 * DGIdb aggregates drug-gene interactions from 40+ sources including:
 * - FDA approved drugs
 * - Clinical trials (ClinicalTrials.gov)
 * - ChEMBL, DrugBank, PharmGKB
 * - Literature-mined interactions
 *
 * KEY ADVANTAGES:
 * - 100% FREE, no API key required
 * - 40,000+ drug-gene interactions
 * - 10,000+ genes covered
 * - Modern GraphQL API (migrated from REST v2)
 * - Real-time data aggregation
 *
 * USE CASES:
 * - Drug repurposing candidate discovery
 * - Fallback when ChEMBL/DrugBank fail
 * - Cross-validation of drug-target relationships
 *
 * API Documentation: https://www.dgidb.org/api
 * GraphQL Endpoint: https://dgidb.org/api/graphql
 *
 */

import { fetchWithTimeout, retryWithBackoff } from '../../utils/fetch-with-timeout.js';

const DGIDB_GRAPHQL_ENDPOINT = 'https://dgidb.org/api/graphql';

/**
 * DGIdb API Client (GraphQL)
 * Provides comprehensive drug-gene interactions from 40+ sources
 */
export class DGIdbClient {
  constructor() {
    this.graphqlEndpoint = DGIDB_GRAPHQL_ENDPOINT;
    this.cache = new Map(); // Cache for gene query results
  }

  /**
   * Get drug-gene interactions for multiple genes using GraphQL
   * @param {string[]} geneSymbols - Array of gene symbols
   * @returns {Promise<Array>} Drug interactions with metadata
   */
  async getInteractions(geneSymbols) {
    if (!geneSymbols || geneSymbols.length === 0) {
      return [];
    }

    const cacheKey = geneSymbols.sort().join(',');

    // Check cache first
    if (this.cache.has(cacheKey)) {
      console.log(`[DGIdb] Cache hit for ${geneSymbols.length} genes`);
      return this.cache.get(cacheKey);
    }

    try {
      console.log(`[DGIdb] Fetching interactions for ${geneSymbols.length} genes via GraphQL...`);

      const interactions = await retryWithBackoff(async () => {
        // Fetch interactions for each gene separately (GraphQL doesn't support bulk queries)
        const results = await Promise.all(
          geneSymbols.map(gene => this.fetchGeneInteractions(gene))
        );

        // Flatten results
        return results.flat();
      }, 3);

      // Cache the result
      this.cache.set(cacheKey, interactions);
      const geneCount = new Set(interactions.map(i => i.gene)).size;
      console.log(`[DGIdb] Found ${interactions.length} interactions for ${geneCount} genes`);

      return interactions;
    } catch (error) {
      console.error(`[DGIdb] Error fetching interactions:`, error.message);
      return [];
    }
  }

  /**
   * Fetch interactions for a single gene using GraphQL
   * @private
   */
  async fetchGeneInteractions(geneSymbol) {
    const query = `
      query GeneInteractions($geneNames: [String!]!) {
        genes(names: $geneNames) {
          nodes {
            name
            interactions {
              drug {
                name
                approved
                conceptId
              }
              interactionTypes {
                type
              }
              interactionScore
              publications {
                pmid
              }
              sources {
                fullName
              }
            }
          }
        }
      }
    `;

    const response = await fetchWithTimeout(
      this.graphqlEndpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { geneNames: [geneSymbol] }
        })
      },
      20000 // 20s timeout for GraphQL
    );

    if (!response.ok) {
      throw new Error(`DGIdb GraphQL error: ${response.status}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.warn(`[DGIdb] GraphQL errors for ${geneSymbol}:`, result.errors);
      return [];
    }

    return this.parseGraphQLResponse(result.data, geneSymbol);
  }

  /**
   * Parse GraphQL response into standardized format
   * @private
   */
  parseGraphQLResponse(data, geneSymbol) {
    const interactions = [];

    if (!data || !data.genes || !data.genes.nodes || data.genes.nodes.length === 0) {
      return interactions;
    }

    // Process all gene nodes (usually just one for single gene queries)
    for (const geneNode of data.genes.nodes) {
      const gene = geneNode.name || geneSymbol;

      if (!geneNode.interactions || geneNode.interactions.length === 0) {
        continue;
      }

      for (const interaction of geneNode.interactions) {
        if (!interaction.drug) continue;

        interactions.push({
          gene,
          drug: interaction.drug.name,
          chemblId: interaction.drug.conceptId || null,
          interactionType: this.formatInteractionTypes(interaction.interactionTypes),
          interactionScore: interaction.interactionScore || null,
          sources: interaction.sources?.map(s => s.fullName) || [],
          sourceCount: interaction.sources?.length || 0,
          pmids: interaction.publications?.map(p => p.pmid) || [],
          approved: interaction.drug.approved || false,
          phase: this.estimatePhaseFromApproval(interaction.drug.approved),
          drugClaim: null,
          geneClaim: null
        });
      }
    }

    return interactions;
  }

  /**
   * Estimate phase from approval status
   * @private
   */
  estimatePhaseFromApproval(approved) {
    return approved ? 4 : 1; // 4 = FDA approved, 1 = Phase 1/preclinical
  }

  /**
   * Format interaction types into readable string
   * @private
   */
  formatInteractionTypes(types) {
    if (!types || types.length === 0) return 'Unknown';
    // GraphQL returns array of objects like [{type: "inhibitor"}]
    return types.map(t => t.type || t).join(', ');
  }

  /**
   * Estimate clinical phase from DGIdb metadata
   * @private
   */
  estimatePhase(interaction) {
    // If FDA approved, it's phase 4
    if (interaction.fda_approved) {
      return 4;
    }

    const sources = interaction.sources?.map(s => s.sourceDbName.toLowerCase()) || [];

    // Check for clinical trial indicators
    if (sources.includes('clinicaltrials.gov')) {
      return 2; // Assume active clinical trial (Phase 2)
    }

    // Check for therapeutic target databases (usually validated targets)
    if (sources.includes('ttd') || sources.includes('therapeutic target database')) {
      return 2;
    }

    // Check for drug databases (likely preclinical or approved)
    if (sources.includes('chembl') || sources.includes('drugbank')) {
      return 1; // Assume Phase 1 or preclinical with strong evidence
    }

    // Default: preclinical/research stage
    return 0;
  }

  /**
   * Convert DGIdb interaction to standardized drug format (ChEMBL-compatible)
   * @param {Object} interaction - DGIdb interaction object
   * @returns {Object} Standardized drug object
   */
  toDrugFormat(interaction) {
    return {
      chemblId: interaction.chemblId || `DGIDB:${interaction.drug}`,
      name: interaction.drug,
      genes: [interaction.gene],
      maxPhase: interaction.phase,
      phaseLabel: this.getPhaseLabel(interaction.phase),
      sources: ['DGIdb', ...interaction.sources],
      validated: interaction.sourceCount > 1 ? 'multi-source' : 'single-source',
      interactionType: interaction.interactionType,
      interactionScore: interaction.interactionScore,
      pmids: interaction.pmids,
      sourceCount: interaction.sourceCount,
      // DGIdb-specific fields
      approved: interaction.approved,
      drugClaim: interaction.drugClaim,
      geneClaim: interaction.geneClaim
    };
  }

  /**
   * Get clinical phase label
   * @private
   */
  getPhaseLabel(phase) {
    const labels = {
      4: 'FDA Approved',
      3: 'Phase 3',
      2: 'Phase 2',
      1: 'Phase 1',
      0: 'Preclinical'
    };
    return labels[phase] || 'Unknown';
  }

  /**
   * Get drugs for a single gene (convenience method)
   * @param {string} geneSymbol - Gene symbol
   * @returns {Promise<Array>} Drug interactions for the gene
   */
  async getDrugsForGene(geneSymbol) {
    const interactions = await this.getInteractions([geneSymbol]);
    return interactions.filter(i => i.gene.toUpperCase() === geneSymbol.toUpperCase());
  }

  /**
   * Get only FDA-approved drugs for genes
   * @param {string[]} geneSymbols - Array of gene symbols
   * @returns {Promise<Array>} Approved drugs only
   */
  async getApprovedDrugs(geneSymbols) {
    const interactions = await this.getInteractions(geneSymbols);
    return interactions.filter(i => i.approved || i.phase === 4);
  }

  /**
   * Search drugs by name using GraphQL
   * @param {string} drugName - Drug name to search
   * @returns {Promise<Array>} Matching drugs across all genes
   */
  async searchDrug(drugName) {
    try {
      console.log(`[DGIdb] Searching for drug: ${drugName} via GraphQL...`);

      const query = `
        query DrugSearch($drugNames: [String!]!) {
          drugs(names: $drugNames) {
            nodes {
              name
              approved
              conceptId
              interactions {
                gene {
                  name
                }
                interactionTypes {
                  type
                }
                interactionScore
                publications {
                  pmid
                }
                sources {
                  fullName
                }
              }
            }
          }
        }
      `;

      const response = await fetchWithTimeout(
        this.graphqlEndpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: { drugNames: [drugName] }
          })
        },
        20000
      );

      if (!response.ok) {
        throw new Error(`DGIdb GraphQL error: ${response.status}`);
      }

      const result = await response.json();

      if (result.errors) {
        console.warn(`[DGIdb] GraphQL errors for drug ${drugName}:`, result.errors);
        return [];
      }

      return this.parseDrugSearchResponse(result.data, drugName);
    } catch (error) {
      console.error(`[DGIdb] Drug search failed for "${drugName}":`, error.message);
      return [];
    }
  }

  /**
   * Parse drug search GraphQL response
   * @private
   */
  parseDrugSearchResponse(data, drugName) {
    const interactions = [];

    if (!data || !data.drugs || !data.drugs.nodes || data.drugs.nodes.length === 0) {
      return interactions;
    }

    // Process all drug nodes (may have multiple entries for the same drug name)
    for (const drugNode of data.drugs.nodes) {
      const drug = drugNode.name || drugName;

      if (!drugNode.interactions || drugNode.interactions.length === 0) {
        continue;
      }

      for (const interaction of drugNode.interactions) {
        if (!interaction.gene) continue;

        interactions.push({
          gene: interaction.gene.name,
          drug,
          chemblId: drugNode.conceptId || null,
          interactionType: this.formatInteractionTypes(interaction.interactionTypes),
          interactionScore: interaction.interactionScore || null,
          sources: interaction.sources?.map(s => s.fullName) || [],
          sourceCount: interaction.sources?.length || 0,
          pmids: interaction.publications?.map(p => p.pmid) || [],
          approved: drugNode.approved || false,
          phase: this.estimatePhaseFromApproval(drugNode.approved),
          drugClaim: null,
          geneClaim: null
        });
      }
    }

    return interactions;
  }

  /**
   * Get statistics about DGIdb coverage for genes
   * @param {string[]} geneSymbols - Array of gene symbols
   * @returns {Promise<Object>} Coverage statistics
   */
  async getCoverageStats(geneSymbols) {
    const interactions = await this.getInteractions(geneSymbols);

    const genesWithDrugs = new Set(interactions.map(i => i.gene));
    const uniqueDrugs = new Set(interactions.map(i => i.drug));
    const approvedDrugs = interactions.filter(i => i.approved);

    return {
      totalGenes: geneSymbols.length,
      genesWithDrugs: genesWithDrugs.size,
      coveragePercent: ((genesWithDrugs.size / geneSymbols.length) * 100).toFixed(1),
      totalInteractions: interactions.length,
      uniqueDrugs: uniqueDrugs.size,
      approvedDrugs: approvedDrugs.length,
      avgInteractionsPerGene: (interactions.length / geneSymbols.length).toFixed(1),
      sourceBreakdown: this.calculateSourceBreakdown(interactions)
    };
  }

  /**
   * Calculate breakdown of interactions by source
   * @private
   */
  calculateSourceBreakdown(interactions) {
    const breakdown = {};

    for (const interaction of interactions) {
      for (const source of interaction.sources) {
        breakdown[source] = (breakdown[source] || 0) + 1;
      }
    }

    // Sort by count (descending)
    return Object.entries(breakdown)
      .sort((a, b) => b[1] - a[1])
      .reduce((obj, [key, val]) => {
        obj[key] = val;
        return obj;
      }, {});
  }
}

// Export singleton instance
export const dgidbClient = new DGIdbClient();

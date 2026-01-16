/**
 * Open Targets Platform API Client - Disease-Gene Associations
 *
 * Open Targets Platform is a comprehensive resource that integrates:
 * - Genetic associations (GWAS, rare diseases, somatic mutations)
 * - Known drug targets
 * - Pathway analysis
 * - Animal models
 * - Literature evidence
 *
 * KEY FEATURES:
 * - 100% FREE, unlimited GraphQL API
 * - Association scores (0-1) with evidence breakdown
 * - 60,000+ diseases, 25,000+ genes
 * - Integrates 20+ data sources
 *
 * API Documentation: https://platform-docs.opentargets.org/data-access/graphql-api
 *
 */

const OPENTARGETS_API = 'https://api.platform.opentargets.org/api/v4/graphql';

/**
 * Open Targets Platform API Client
 * Provides disease-gene associations with genetic evidence
 */
export class OpenTargetsClient {
  constructor() {
    this.apiUrl = OPENTARGETS_API;
  }

  /**
   * Get disease associations for a gene
   * @param {string} geneSymbol - Gene symbol (e.g., "TP53", "BRCA1")
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Disease associations with scores
   */
  async getDiseaseAssociations(geneSymbol, options = {}) {
    const {
      minScore = 0.1,        // Minimum association score (0-1)
      maxResults = 10,       // Max diseases to return
      diseaseContext = null  // Optional: filter by disease name
    } = options;

    try {
      // GraphQL query for target (gene) disease associations
      const query = `
        query targetDiseases($ensemblId: String!) {
          target(ensemblId: $ensemblId) {
            id
            approvedSymbol
            approvedName
            associatedDiseases(page: { size: 50, index: 0 }) {
              count
              rows {
                disease {
                  id
                  name
                }
                score
                datatypeScores {
                  id
                  score
                }
              }
            }
          }
        }
      `;

      // First, convert gene symbol to Ensembl ID
      const ensemblId = await this.getEnsemblId(geneSymbol);

      if (!ensemblId) {
        return {
          gene: geneSymbol,
          associations: [],
          totalDiseases: 0,
          error: 'Gene not found in Open Targets'
        };
      }

      // Execute GraphQL query with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { ensemblId }
        }),
        signal: controller.signal
      }).finally(() => clearTimeout(timeoutId));

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Open Targets API HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      const target = data.data?.target;

      if (!target || !target.associatedDiseases) {
        return {
          gene: geneSymbol,
          associations: [],
          totalDiseases: 0
        };
      }

      // Filter and sort associations
      let associations = target.associatedDiseases.rows
        .filter(row => row.score >= minScore)
        .map(row => ({
          disease: row.disease.name,
          diseaseId: row.disease.id,
          score: parseFloat(row.score.toFixed(3)),
          confidenceLevel: this.getConfidenceLevel(row.score),
          evidenceTypes: this.parseEvidenceTypes(row.datatypeScores),
          evidenceBreakdown: row.datatypeScores.map(dt => ({
            type: this.getEvidenceTypeName(dt.id),
            score: parseFloat(dt.score.toFixed(3))
          }))
        }));

      // Filter by disease context if provided
      if (diseaseContext) {
        const contextLower = diseaseContext.toLowerCase();
        associations = associations.filter(a =>
          a.disease.toLowerCase().includes(contextLower)
        );
      }

      // Sort by score (highest first) and limit
      associations.sort((a, b) => b.score - a.score);
      associations = associations.slice(0, maxResults);

      return {
        gene: geneSymbol,
        ensemblId,
        associations,
        totalDiseases: target.associatedDiseases.count,
        avgScore: associations.length > 0
          ? (associations.reduce((sum, a) => sum + a.score, 0) / associations.length).toFixed(3)
          : 0,
        source: 'Open Targets Platform v23.12'
      };
    } catch (error) {
      console.error(`[Open Targets] Failed to fetch associations for ${geneSymbol}:`, error.message);
      return {
        gene: geneSymbol,
        associations: [],
        totalDiseases: 0,
        error: error.message
      };
    }
  }

  /**
   * Convert gene symbol to Ensembl ID (required for Open Targets queries)
   * @private
   */
  async getEnsemblId(geneSymbol) {
    const query = `
      query search($queryString: String!) {
        search(queryString: $queryString, entityNames: ["target"], page: { size: 1, index: 0 }) {
          hits {
            id
            entity
            object {
              ... on Target {
                id
                approvedSymbol
              }
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { queryString: geneSymbol }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Open Targets] HTTP ${response.status}: ${errorText}`);
        return null;
      }

      const data = await response.json();
      const hits = data.data?.search?.hits || [];

      // Find exact match
      const exactMatch = hits.find(hit =>
        hit.object?.approvedSymbol?.toUpperCase() === geneSymbol.toUpperCase()
      );

      return exactMatch?.id || hits[0]?.id || null;
    } catch (error) {
      console.error(`[Open Targets] Failed to resolve Ensembl ID for ${geneSymbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get confidence level based on association score
   * @private
   */
  getConfidenceLevel(score) {
    if (score >= 0.7) return 'high';      // Strong genetic evidence
    if (score >= 0.4) return 'medium';    // Moderate evidence
    return 'low';                         // Weak evidence
  }

  /**
   * Parse evidence types from datatype scores
   * @private
   */
  parseEvidenceTypes(datatypeScores) {
    return datatypeScores
      .filter(dt => dt.score > 0)
      .map(dt => this.getEvidenceTypeName(dt.id))
      .join(', ');
  }

  /**
   * Get human-readable evidence type name
   * @private
   */
  getEvidenceTypeName(datatypeId) {
    const typeMap = {
      'genetic_association': 'Genetic Association',
      'somatic_mutation': 'Somatic Mutation',
      'known_drug': 'Known Drug',
      'affected_pathway': 'Affected Pathway',
      'literature': 'Literature',
      'rna_expression': 'RNA Expression',
      'animal_model': 'Animal Model'
    };
    return typeMap[datatypeId] || datatypeId;
  }

  /**
   * Search for diseases by name
   * @param {string} diseaseName - Disease name or partial name
   * @param {number} maxResults - Maximum results to return
   * @returns {Promise<Array>} Array of disease objects
   */
  async searchDiseases(diseaseName, maxResults = 10) {
    const query = `
      query search($queryString: String!) {
        search(queryString: $queryString, entityNames: ["disease"], page: { size: ${maxResults} }) {
          hits {
            id
            entity
            object {
              ... on Disease {
                id
                name
                description
              }
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { queryString: diseaseName }
        })
      });

      const data = await response.json();
      const hits = data.data?.search?.hits || [];

      return hits.map(hit => ({
        id: hit.id,
        name: hit.object.name,
        description: hit.object.description
      }));
    } catch (error) {
      console.error(`[Open Targets] Disease search failed for "${diseaseName}":`, error.message);
      return [];
    }
  }

  /**
   * Get drug information for a gene target
   * @param {string} geneSymbol - Gene symbol
   * @returns {Promise<Object>} Known drugs targeting this gene
   */
  async getKnownDrugs(geneSymbol) {
    const ensemblId = await this.getEnsemblId(geneSymbol);

    if (!ensemblId) {
      return { gene: geneSymbol, drugs: [], error: 'Gene not found' };
    }

    const query = `
      query targetDrugs($ensemblId: String!) {
        target(ensemblId: $ensemblId) {
          id
          approvedSymbol
          knownDrugs {
            count
            rows {
              drug {
                name
                maximumClinicalTrialPhase
                drugType
              }
              disease {
                name
              }
              mechanismOfAction
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          variables: { ensemblId }
        })
      });

      const data = await response.json();
      const target = data.data?.target;

      if (!target?.knownDrugs) {
        return { gene: geneSymbol, drugs: [], totalDrugs: 0 };
      }

      const drugs = target.knownDrugs.rows.map(row => ({
        name: row.drug.name,
        phase: row.drug.maximumClinicalTrialPhase,
        type: row.drug.drugType,
        disease: row.disease?.name,
        mechanism: row.mechanismOfAction
      }));

      return {
        gene: geneSymbol,
        ensemblId,
        drugs,
        totalDrugs: target.knownDrugs.count,
        source: 'Open Targets Platform'
      };
    } catch (error) {
      console.error(`[Open Targets] Failed to fetch drugs for ${geneSymbol}:`, error.message);
      return {
        gene: geneSymbol,
        drugs: [],
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const openTargetsClient = new OpenTargetsClient();

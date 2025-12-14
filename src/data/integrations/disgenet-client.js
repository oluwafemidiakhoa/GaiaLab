/**
 * DisGeNET Client - disease-gene associations from curated databases
 *
 * DATA SOURCE: DisGeNET REST API (https://www.disgenet.org)
 * - FREE for academic use (requires API key)
 * - 1.1M gene-disease associations
 * - Curated from GWAS, animal models, literature
 * - Evidence scores (0-1) based on publication count
 *
 * INTELLIGENCE VALUE:
 * - CROSS-VALIDATES Open Targets for disease associations
 * - When DisGeNET + Open Targets agree → HIGH confidence
 * - Complementary evidence: GWAS vs genetic evidence
 * - Reveals disease mechanisms through gene-disease networks
 *
 * API KEY: Get free key at https://www.disgenet.org/signup/
 */

export class DisgenetClient {
  constructor() {
    this.baseUrl = 'https://www.disgenet.org/api';
    this.apiKey = process.env.DISGENET_API_KEY || '';

    if (!this.apiKey) {
      console.warn('[DisGeNET] ⚠️  API key not configured. Set DISGENET_API_KEY in .env');
      console.warn('[DisGeNET] Get free key at: https://www.disgenet.org/signup/');
    }
  }

  /**
   * Get disease associations for a gene
   * @param {string} geneSymbol - Gene symbol (e.g., "BRCA1")
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Disease associations with evidence scores
   */
  async getDiseaseAssociations(geneSymbol, options = {}) {
    if (!this.apiKey) {
      return {
        error: 'DisGeNET API key not configured',
        gene: geneSymbol,
        message: 'Get free key at https://www.disgenet.org/signup/'
      };
    }

    const {
      minScore = 0.3, // Minimum evidence score (0-1)
      maxResults = 50,
      diseaseType = 'all' // 'disease', 'phenotype', or 'all'
    } = options;

    try {
      console.log(`[DisGeNET] Fetching disease associations for ${geneSymbol}...`);

      // PHASE 1: Search for gene to get DisGeNET gene ID
      const geneId = await this.searchGene(geneSymbol);
      if (!geneId) {
        return {
          error: `Gene not found in DisGeNET: ${geneSymbol}`,
          gene: geneSymbol
        };
      }

      // PHASE 2: Get gene-disease associations
      const url = `${this.baseUrl}/gda/gene/${geneId}`;
      const params = new URLSearchParams({
        format: 'json',
        limit: maxResults.toString(),
        min_score: minScore.toString()
      });

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        } else if (response.status === 404) {
          return {
            gene: geneSymbol,
            associations: [],
            totalAssociations: 0
          };
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Format associations
      const formattedAssociations = (data || []).map(assoc => ({
        diseaseId: assoc.disease_id,
        diseaseName: assoc.disease_name,
        diseaseType: assoc.disease_type, // disease, phenotype, group
        score: parseFloat(assoc.score), // Evidence score 0-1
        evidenceIndex: parseFloat(assoc.ei || 0), // Evidence index
        publicationCount: parseInt(assoc.n_pmids || 0),
        sources: this.parseSources(assoc.source),
        diseaseClass: assoc.disease_class_name,
        semanticType: assoc.disease_semantic_type
      }));

      // Calculate statistics
      const avgScore = formattedAssociations.reduce((sum, a) => sum + a.score, 0) / formattedAssociations.length || 0;
      const highConfidence = formattedAssociations.filter(a => a.score >= 0.6).length;

      return {
        gene: geneSymbol,
        geneId,
        associations: formattedAssociations,
        totalAssociations: formattedAssociations.length,
        stats: {
          avgScore: parseFloat(avgScore.toFixed(3)),
          highConfidence, // score >= 0.6
          maxScore: Math.max(...formattedAssociations.map(a => a.score), 0),
          totalPublications: formattedAssociations.reduce((sum, a) => sum + a.publicationCount, 0)
        },
        source: 'DisGeNET'
      };

    } catch (error) {
      console.error(`[DisGeNET] Error fetching ${geneSymbol}:`, error.message);
      return {
        error: error.message,
        gene: geneSymbol
      };
    }
  }

  /**
   * Search for gene to get DisGeNET gene ID (Entrez ID)
   * @private
   */
  async searchGene(geneSymbol) {
    try {
      const url = `${this.baseUrl}/gene/${geneSymbol}`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`[DisGeNET] Gene not found: ${geneSymbol}`);
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Return Entrez gene ID
      if (data && data.length > 0) {
        return data[0].gene_id;
      }

      return null;
    } catch (error) {
      console.error(`[DisGeNET] Gene search error for ${geneSymbol}:`, error.message);
      return null;
    }
  }

  /**
   * Parse source string into array of database names
   * @private
   */
  parseSources(sourceString) {
    if (!sourceString) return [];

    // DisGeNET sources: CURATED (literature), GWASCAT (GWAS), etc.
    return sourceString.split(',').map(s => s.trim());
  }

  /**
   * Get diseases associated with multiple genes (find shared diseases)
   * Useful for pathway/module analysis
   */
  async getSharedDiseases(geneSymbols, options = {}) {
    const { minGenes = 2, minScore = 0.4 } = options;

    try {
      console.log(`[DisGeNET] Finding shared diseases for ${geneSymbols.length} genes...`);

      // Fetch associations for all genes
      const allAssociations = await Promise.all(
        geneSymbols.map(gene => this.getDiseaseAssociations(gene, { minScore, maxResults: 100 }))
      );

      // Count disease occurrences across genes
      const diseaseGeneMap = new Map();

      for (let i = 0; i < allAssociations.length; i++) {
        const result = allAssociations[i];
        if (result.error || !result.associations) continue;

        const gene = geneSymbols[i];
        for (const assoc of result.associations) {
          const key = assoc.diseaseId;
          if (!diseaseGeneMap.has(key)) {
            diseaseGeneMap.set(key, {
              diseaseId: assoc.diseaseId,
              diseaseName: assoc.diseaseName,
              diseaseType: assoc.diseaseType,
              genes: [],
              avgScore: 0,
              totalPublications: 0
            });
          }

          const disease = diseaseGeneMap.get(key);
          disease.genes.push({ gene, score: assoc.score, pubs: assoc.publicationCount });
          disease.totalPublications += assoc.publicationCount;
        }
      }

      // Filter diseases associated with >= minGenes
      const sharedDiseases = Array.from(diseaseGeneMap.values())
        .filter(d => d.genes.length >= minGenes)
        .map(d => ({
          ...d,
          geneCount: d.genes.length,
          avgScore: d.genes.reduce((sum, g) => sum + g.score, 0) / d.genes.length
        }))
        .sort((a, b) => b.geneCount - a.geneCount || b.avgScore - a.avgScore);

      return {
        totalGenes: geneSymbols.length,
        sharedDiseases: sharedDiseases.slice(0, 20),
        stats: {
          totalShared: sharedDiseases.length,
          maxGenes: Math.max(...sharedDiseases.map(d => d.geneCount), 0)
        }
      };

    } catch (error) {
      console.error('[DisGeNET] Shared disease analysis error:', error.message);
      return {
        totalGenes: geneSymbols.length,
        sharedDiseases: [],
        error: error.message
      };
    }
  }

  /**
   * Batch fetch disease associations for multiple genes
   */
  async getMultipleGenes(geneSymbols, options = {}) {
    console.log(`[DisGeNET] Fetching disease associations for ${geneSymbols.length} genes...`);
    const startTime = Date.now();

    // DisGeNET rate limit: ~10 requests/sec
    // Fetch in batches with delays to be respectful
    const batchSize = 5;
    const delayMs = 600;

    const results = [];
    for (let i = 0; i < geneSymbols.length; i += batchSize) {
      const batch = geneSymbols.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(gene => this.getDiseaseAssociations(gene, options))
      );

      results.push(...batchResults);

      // Delay between batches (except for last batch)
      if (i + batchSize < geneSymbols.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const fetchTime = Date.now() - startTime;
    const successful = results.filter(r => !r.error).length;
    console.log(`[DisGeNET] Fetched ${successful}/${results.length} genes in ${fetchTime}ms`);

    return results;
  }
}

// Export singleton instance
export const disgenetClient = new DisgenetClient();

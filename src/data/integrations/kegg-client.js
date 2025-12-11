import axios from 'axios';

/**
 * KEGG (Kyoto Encyclopedia of Genes and Genomes) client
 * Retrieves pathway information and gene-pathway associations
 */
export class KEGGClient {
  constructor() {
    this.baseUrl = 'https://rest.kegg.jp';
  }

  /**
   * Find KEGG gene ID for a human gene symbol
   * @param {string} geneSymbol - Gene symbol (e.g., 'TP53')
   * @returns {Promise<string|null>} KEGG gene ID (e.g., 'hsa:7157') or null
   */
  async findGeneId(geneSymbol) {
    try {
      const response = await axios.get(`${this.baseUrl}/find/genes/${geneSymbol}`);

      const lines = response.data.split('\n').filter(l => l.trim());

      // Look for human gene (hsa: prefix)
      for (const line of lines) {
        if (line.includes('hsa:')) {
          const parts = line.split('\t');
          if (parts.length >= 2) {
            const geneId = parts[0].trim();
            return geneId;
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`KEGG find gene error for ${geneSymbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get pathways associated with a gene
   * @param {string} geneSymbol - Gene symbol
   * @returns {Promise<Array>} Array of pathway objects
   */
  async getGenePathways(geneSymbol) {
    try {
      const geneId = await this.findGeneId(geneSymbol);
      if (!geneId) {
        return [];
      }

      // Get pathways for this gene
      const response = await axios.get(`${this.baseUrl}/link/pathway/${geneId}`);

      const lines = response.data.split('\n').filter(l => l.trim());
      const pathwayIds = [];

      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const pathwayId = parts[1].trim();
          pathwayIds.push(pathwayId);
        }
      }

      // Fetch details for each pathway
      const pathways = await Promise.all(
        pathwayIds.map(id => this.getPathwayDetails(id))
      );

      return pathways.filter(p => p !== null);
    } catch (error) {
      console.error(`KEGG pathway error for ${geneSymbol}:`, error.message);
      return [];
    }
  }

  /**
   * Get detailed information about a pathway
   * @param {string} pathwayId - KEGG pathway ID (e.g., 'hsa05200')
   * @returns {Promise<Object|null>} Pathway details or null
   */
  async getPathwayDetails(pathwayId) {
    try {
      const response = await axios.get(`${this.baseUrl}/get/${pathwayId}`);

      const data = response.data;
      const lines = data.split('\n');

      let name = 'Unknown pathway';
      let description = '';
      let category = 'Unknown';
      const genes = [];

      let currentSection = null;

      for (const line of lines) {
        if (line.startsWith('NAME')) {
          name = line.substring(4).trim();
        } else if (line.startsWith('DESCRIPTION')) {
          description = line.substring(11).trim();
        } else if (line.startsWith('CLASS')) {
          category = line.substring(5).trim().split(';')[0].trim();
        } else if (line.startsWith('GENE')) {
          currentSection = 'GENE';
          const genePart = line.substring(4).trim();
          if (genePart) {
            this.parseGeneLine(genePart, genes);
          }
        } else if (currentSection === 'GENE' && line.startsWith(' ')) {
          this.parseGeneLine(line.trim(), genes);
        } else if (!line.startsWith(' ')) {
          currentSection = null;
        }
      }

      return {
        id: pathwayId,
        name,
        description: description || name,
        category,
        geneCount: genes.length,
        genes: genes.slice(0, 20), // Limit to first 20 genes
        source: 'KEGG'
      };
    } catch (error) {
      console.error(`KEGG pathway details error for ${pathwayId}:`, error.message);
      return null;
    }
  }

  /**
   * Parse a gene line from KEGG pathway response
   * @private
   */
  parseGeneLine(line, genes) {
    // Format: "7157  TP53; tumor protein p53"
    const match = line.match(/^(\d+)\s+([A-Z0-9]+);?\s*(.*)?$/);
    if (match) {
      genes.push({
        entrezId: match[1],
        symbol: match[2],
        name: match[3] || ''
      });
    }
  }

  /**
   * Get pathways for multiple genes and find enriched pathways
   * @param {Array<string>} geneSymbols - Array of gene symbols
   * @returns {Promise<Array>} Array of pathways with gene associations
   */
  async getEnrichedPathways(geneSymbols) {
    try {
      // Get pathways for each gene
      const allPathwayPromises = geneSymbols.map(symbol => this.getGenePathways(symbol));
      const allPathways = await Promise.all(allPathwayPromises);

      // Flatten and aggregate by pathway ID
      const pathwayMap = new Map();

      for (let i = 0; i < geneSymbols.length; i++) {
        const gene = geneSymbols[i];
        const pathways = allPathways[i];

        for (const pathway of pathways) {
          if (!pathwayMap.has(pathway.id)) {
            pathwayMap.set(pathway.id, {
              ...pathway,
              inputGenes: [],
              inputGeneCount: 0
            });
          }

          const p = pathwayMap.get(pathway.id);
          p.inputGenes.push(gene);
          p.inputGeneCount++;
        }
      }

      // Convert to array and calculate enrichment score
      const enrichedPathways = Array.from(pathwayMap.values());

      for (const pathway of enrichedPathways) {
        // Simple enrichment score: (input genes in pathway / total input genes)
        pathway.enrichmentScore = pathway.inputGeneCount / geneSymbols.length;

        // Estimate significance (simplified - not true Fisher's exact)
        // This is a placeholder - pathway-aggregator.js will do proper statistics
        pathway.estimatedPValue = 1.0 / (pathway.inputGeneCount + 1);
      }

      // Sort by number of input genes (most enriched first)
      enrichedPathways.sort((a, b) => b.inputGeneCount - a.inputGeneCount);

      return enrichedPathways;
    } catch (error) {
      console.error('KEGG enriched pathways error:', error.message);
      return [];
    }
  }

  /**
   * Get human-readable pathway categories
   * @returns {Array<string>} Common pathway categories
   */
  getPathwayCategories() {
    return [
      'Metabolism',
      'Genetic Information Processing',
      'Environmental Information Processing',
      'Cellular Processes',
      'Organismal Systems',
      'Human Diseases',
      'Drug Development'
    ];
  }
}

// Export singleton instance
export const keggClient = new KEGGClient();

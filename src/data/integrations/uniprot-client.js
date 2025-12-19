import axios from 'axios';

/**
 * UniProt client for protein/gene data
 * Retrieves protein function, tissue expression, and other metadata
 */
export class UniProtClient {
  constructor() {
    this.baseUrl = 'https://rest.uniprot.org/uniprotkb';
  }

  /**
   * Search UniProt for a gene symbol (searches across organisms, prioritizes human)
   * @param {string} geneSymbol - Gene symbol (e.g., 'TP53')
   * @returns {Promise<Object|null>} Gene data or null if not found
   */
  async getGeneData(geneSymbol) {
    try {
      // Search for human genes first
      const query = `gene:${geneSymbol} AND organism_id:9606`; // 9606 = Homo sapiens
      const params = {
        query,
        format: 'json',
        size: 1 // Only need top result
      };

      const response = await axios.get(`${this.baseUrl}/search`, { params });

      if (response.data?.results && response.data.results.length > 0) {
        return this.parseUniProtEntry(response.data.results[0], geneSymbol);
      }

      return null;
    } catch (error) {
      console.error(`UniProt search error for ${geneSymbol}:`, error.message);
      return null;
    }
  }

  /**
   * Parse UniProt entry into simplified gene data structure
   * @private
   */
  parseUniProtEntry(entry, requestedGeneSymbol) {
    try {
      // Extract primary gene name
      const geneNames = entry.genes || [];
      const primaryGene = geneNames.find(g => g.geneName) || {};
      const symbol = primaryGene.geneName?.value || requestedGeneSymbol;

      // Extract protein names
      const proteinDescription = entry.proteinDescription || {};
      const recommendedName = proteinDescription.recommendedName;
      const fullName = recommendedName?.fullName?.value || 'Unknown protein';

      // Extract function from comments
      const comments = entry.comments || [];
      const functionComment = comments.find(c => c.commentType === 'FUNCTION');
      const functionText = functionComment?.texts?.[0]?.value || 'Function not well characterized';

      // Extract tissue expression
      const tissueComment = comments.find(c => c.commentType === 'TISSUE SPECIFICITY');
      const tissueExpression = tissueComment?.texts?.[0]?.value || 'Expression pattern not well characterized';

      // Extract subcellular location
      const locationComment = comments.find(c => c.commentType === 'SUBCELLULAR LOCATION');
      const subcellularLocation = locationComment?.subcellularLocations?.[0]?.location?.value || 'Unknown';

      // Extract keywords (biological processes, molecular functions)
      const keywords = entry.keywords || [];
      const biologicalProcesses = keywords
        .filter(k => k.category === 'Biological process')
        .map(k => k.name)
        .slice(0, 5);

      const molecularFunctions = keywords
        .filter(k => k.category === 'Molecular function')
        .map(k => k.name)
        .slice(0, 5);

      // Extract protein length
      const sequence = entry.sequence || {};
      const proteinLength = sequence.length || 0;

      // Extract UniProt ID
      const uniprotId = entry.primaryAccession || 'Unknown';

      return {
        symbol,
        uniprotId,
        name: fullName,
        function: this.truncateText(functionText, 300),
        tissueExpression: this.truncateText(tissueExpression, 200),
        subcellularLocation,
        biologicalProcesses,
        molecularFunctions,
        proteinLength,
        organism: 'Homo sapiens',
        source: 'UniProt'
      };
    } catch (error) {
      console.error('Error parsing UniProt entry:', error.message);
      return {
        symbol: requestedGeneSymbol,
        name: 'Unknown',
        function: 'Data unavailable',
        source: 'UniProt'
      };
    }
  }

  /**
   * Get gene data for multiple genes (parallel requests)
   * @param {Array<string>} geneSymbols - Array of gene symbols
   * @returns {Promise<Array>} Array of gene data objects
   */
  async getMultipleGenes(geneSymbols) {
    const promises = geneSymbols.map(symbol => this.getGeneData(symbol));
    const results = await Promise.all(promises);

    // Return all results, including nulls (replaced with fallback objects)
    return results.map((result, index) => {
      if (result !== null) {
        return result;
      }
      // Fallback for genes not found in UniProt
      return {
        symbol: geneSymbols[index].toUpperCase(),
        name: 'Not found in UniProt',
        function: 'Data not available in UniProt database - gene may be poorly annotated or have alternative nomenclature',
        source: 'UniProt (not found)',
        dataAvailable: false
      };
    });
  }

  /**
   * Truncate text to specified length with ellipsis
   * @private
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * Get protein-protein interactions from UniProt
   * @param {string} geneSymbol - Gene symbol
   * @returns {Promise<Array>} Array of interacting partners
   */
  async getProteinInteractions(geneSymbol) {
    try {
      const geneData = await this.getGeneData(geneSymbol);
      if (!geneData) return [];

      const uniprotId = geneData.uniprotId;
      const response = await axios.get(`${this.baseUrl}/${uniprotId}.json`);

      const entry = response.data;
      const comments = entry.comments || [];
      const interactionComments = comments.filter(c => c.commentType === 'INTERACTION');

      const interactions = [];
      for (const comment of interactionComments) {
        const interactants = comment.interactions || [];
        for (const interactant of interactants) {
          const partner = interactant.interactantTwo;
          if (partner?.geneName) {
            interactions.push({
              partner: partner.geneName,
              uniprotId: partner.uniprotAccession,
              experiments: interactant.numberOfExperiments || 0
            });
          }
        }
      }

      return interactions;
    } catch (error) {
      console.error(`Error fetching interactions for ${geneSymbol}:`, error.message);
      return [];
    }
  }
}

// Export singleton instance
export const uniprotClient = new UniProtClient();

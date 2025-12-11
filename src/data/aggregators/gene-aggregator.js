import { uniprotClient } from '../integrations/uniprot-client.js';

/**
 * Gene Aggregator - consolidates gene data from multiple sources
 * Primary source: UniProt (can be extended with other databases)
 */
export class GeneAggregator {
  constructor() {
    this.uniprot = uniprotClient;
  }

  /**
   * Fetch comprehensive gene data for multiple genes
   * @param {Array<string>} geneSymbols - Array of gene symbols
   * @returns {Promise<Array>} Array of gene data objects
   */
  async fetchGeneData(geneSymbols) {
    if (!geneSymbols || geneSymbols.length === 0) {
      return [];
    }

    try {
      // Fetch from UniProt (parallel requests)
      const uniprotData = await this.uniprot.getMultipleGenes(geneSymbols);

      // Create a map for quick lookup
      const geneMap = new Map();
      for (const gene of uniprotData) {
        geneMap.set(gene.symbol.toUpperCase(), gene);
      }

      // Ensure all requested genes have entries (even if data not found)
      const consolidatedGenes = geneSymbols.map((symbol, index) => {
        const normalizedSymbol = symbol.toUpperCase();
        const uniprotInfo = geneMap.get(normalizedSymbol);

        if (uniprotInfo) {
          return {
            ...uniprotInfo,
            centrality: this.calculateCentrality(index, geneSymbols.length),
            importanceScore: Math.max(0.3, 0.95 - index * 0.08)
          };
        }

        // Fallback for genes not found in UniProt
        return {
          symbol: normalizedSymbol,
          name: 'Data not available',
          function: 'Function not well characterized in databases',
          tissueExpression: 'Expression pattern not available',
          biologicalProcesses: [],
          molecularFunctions: [],
          source: 'Unknown',
          centrality: this.calculateCentrality(index, geneSymbols.length),
          importanceScore: Math.max(0.3, 0.95 - index * 0.08),
          dataAvailable: false
        };
      });

      return consolidatedGenes;
    } catch (error) {
      console.error('Gene aggregation error:', error.message);
      // Return basic structure for all genes even on error
      return geneSymbols.map((symbol, index) => ({
        symbol: symbol.toUpperCase(),
        name: 'Error fetching data',
        function: 'Data unavailable due to error',
        centrality: this.calculateCentrality(index, geneSymbols.length),
        importanceScore: Math.max(0.3, 0.95 - index * 0.08)
      }));
    }
  }

  /**
   * Calculate gene centrality score (0-1)
   * First genes in the list are assumed to be more central to the analysis
   * @private
   */
  calculateCentrality(index, total) {
    // Exponential decay - first gene is most central
    return Math.exp(-index / total);
  }

  /**
   * Fetch protein-protein interaction network for genes
   * @param {Array<string>} geneSymbols - Array of gene symbols
   * @returns {Promise<Object>} Interaction network
   */
  async fetchInteractionNetwork(geneSymbols) {
    try {
      const interactionPromises = geneSymbols.map(symbol =>
        this.uniprot.getProteinInteractions(symbol)
      );

      const allInteractions = await Promise.all(interactionPromises);

      // Build network
      const network = {
        nodes: geneSymbols.map(symbol => ({ id: symbol, type: 'input' })),
        edges: []
      };

      for (let i = 0; i < geneSymbols.length; i++) {
        const gene = geneSymbols[i];
        const interactions = allInteractions[i];

        for (const interaction of interactions) {
          network.edges.push({
            source: gene,
            target: interaction.partner,
            experiments: interaction.experiments
          });

          // Add interacting partner as node if not already present
          if (!network.nodes.find(n => n.id === interaction.partner)) {
            network.nodes.push({
              id: interaction.partner,
              type: 'interactor'
            });
          }
        }
      }

      return network;
    } catch (error) {
      console.error('Interaction network error:', error.message);
      return {
        nodes: geneSymbols.map(s => ({ id: s, type: 'input' })),
        edges: []
      };
    }
  }

  /**
   * Analyze gene list for common biological themes
   * @param {Array<Object>} geneData - Output from fetchGeneData()
   * @returns {Object} Theme analysis
   */
  analyzeThemes(geneData) {
    const processCounter = new Map();
    const functionCounter = new Map();

    for (const gene of geneData) {
      // Count biological processes
      for (const process of gene.biologicalProcesses || []) {
        processCounter.set(process, (processCounter.get(process) || 0) + 1);
      }

      // Count molecular functions
      for (const func of gene.molecularFunctions || []) {
        functionCounter.set(func, (functionCounter.get(func) || 0) + 1);
      }
    }

    // Convert to sorted arrays
    const topProcesses = Array.from(processCounter.entries())
      .map(([process, count]) => ({ process, count, proportion: count / geneData.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topFunctions = Array.from(functionCounter.entries())
      .map(([func, count]) => ({ function: func, count, proportion: count / geneData.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      biologicalProcesses: topProcesses,
      molecularFunctions: topFunctions
    };
  }
}

// Export singleton instance
export const geneAggregator = new GeneAggregator();

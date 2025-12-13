/**
 * STRING Database Client - Protein-Protein Interaction Networks
 *
 * STRING (Search Tool for the Retrieval of Interacting Genes/Proteins)
 * - World's largest database of known and predicted protein-protein interactions
 * - 67+ million proteins from 14,000+ organisms
 * - Combines experimental data, computational prediction, and text mining
 * - 100% FREE, unlimited API access
 *
 * API Documentation: https://string-db.org/help/api/
 *
 * @author Oluwafemi Idiakhoa
 */

const STRING_API_BASE = 'https://string-db.org/api';
const STRING_VERSION = 'json'; // Response format
const SPECIES_HUMAN = '9606'; // NCBI taxonomy ID for Homo sapiens

/**
 * STRING Database API Client
 * Provides protein interaction networks with confidence scores
 */
export class StringClient {
  constructor() {
    this.baseUrl = STRING_API_BASE;
    this.species = SPECIES_HUMAN;
  }

  /**
   * Get protein-protein interactions for a single gene
   * @param {string} geneSymbol - Gene symbol (e.g., "TP53", "BRCA1")
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Interaction data with confidence scores
   */
  async getProteinInteractions(geneSymbol, options = {}) {
    const {
      limit = 10,              // Max number of interactors
      requiredScore = 700,     // Min confidence (0-1000, 700 = high confidence)
      networkType = 'physical' // 'physical' or 'functional'
    } = options;

    try {
      // STRING API: interaction_partners endpoint
      const url = `${this.baseUrl}/${STRING_VERSION}/interaction_partners`;
      const params = new URLSearchParams({
        identifiers: geneSymbol,
        species: this.species,
        limit: limit.toString(),
        required_score: requiredScore.toString(),
        network_type: networkType
      });

      const response = await fetch(`${url}?${params}`);

      if (!response.ok) {
        throw new Error(`STRING API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Parse and format interactions
      return {
        gene: geneSymbol,
        interactions: data.map(partner => ({
          partner: partner.preferredName_B || partner.stringId_B,
          partnerFullName: partner.annotation || 'Unknown protein',
          score: partner.score, // Confidence score (0-1000)
          scoreNormalized: (partner.score / 1000).toFixed(3), // Normalized to 0-1
          evidenceTypes: this.parseEvidenceChannels(partner),
          ncbiTaxonId: partner.ncbiTaxonId
        })),
        totalInteractions: data.length,
        minConfidence: requiredScore,
        source: 'STRING v12.0'
      };
    } catch (error) {
      console.error(`[STRING] Failed to fetch interactions for ${geneSymbol}:`, error.message);
      return {
        gene: geneSymbol,
        interactions: [],
        totalInteractions: 0,
        error: error.message
      };
    }
  }

  /**
   * Get enrichment analysis for a set of genes
   * @param {string[]} geneSymbols - Array of gene symbols
   * @returns {Promise<Object>} Enriched pathways and processes
   */
  async getEnrichment(geneSymbols) {
    try {
      const url = `${this.baseUrl}/${STRING_VERSION}/enrichment`;
      const params = new URLSearchParams({
        identifiers: geneSymbols.join('\n'),
        species: this.species
      });

      const response = await fetch(`${url}?${params}`);

      if (!response.ok) {
        throw new Error(`STRING enrichment error: ${response.status}`);
      }

      const data = await response.json();

      return {
        genes: geneSymbols,
        enrichment: data.map(item => ({
          category: item.category,
          term: item.term,
          description: item.description,
          numberOfGenes: item.number_of_genes,
          pValue: item.p_value,
          fdr: item.fdr, // False discovery rate
          inputGenes: item.inputGenes ? item.inputGenes.split(',') : []
        })),
        source: 'STRING Enrichment'
      };
    } catch (error) {
      console.error('[STRING] Enrichment analysis failed:', error.message);
      return {
        genes: geneSymbols,
        enrichment: [],
        error: error.message
      };
    }
  }

  /**
   * Get network image URL for visualization
   * @param {string[]} geneSymbols - Array of gene symbols
   * @param {Object} options - Image options
   * @returns {string} URL to network image
   */
  getNetworkImageUrl(geneSymbols, options = {}) {
    const {
      requiredScore = 700,
      networkFlavor = 'confidence', // 'confidence', 'evidence', 'actions'
      hideDisconnected = true
    } = options;

    const params = new URLSearchParams({
      identifiers: geneSymbols.join('\n'),
      species: this.species,
      required_score: requiredScore.toString(),
      network_flavor: networkFlavor,
      hide_disconnected_nodes: hideDisconnected ? '1' : '0'
    });

    return `${this.baseUrl}/image/network?${params}`;
  }

  /**
   * Get detailed network data for multiple genes
   * @param {string[]} geneSymbols - Array of gene symbols
   * @param {Object} options - Network options
   * @returns {Promise<Object>} Complete network with all edges
   */
  async getNetwork(geneSymbols, options = {}) {
    const {
      requiredScore = 700,
      addNodes = 0 // Add this many high-confidence interactors
    } = options;

    try {
      const url = `${this.baseUrl}/${STRING_VERSION}/network`;
      const params = new URLSearchParams({
        identifiers: geneSymbols.join('\n'),
        species: this.species,
        required_score: requiredScore.toString(),
        add_nodes: addNodes.toString()
      });

      const response = await fetch(`${url}?${params}`);

      if (!response.ok) {
        throw new Error(`STRING network error: ${response.status}`);
      }

      const data = await response.json();

      // Build adjacency list for network analysis
      const nodes = new Set();
      const edges = data.map(edge => {
        const nodeA = edge.preferredName_A || edge.stringId_A;
        const nodeB = edge.preferredName_B || edge.stringId_B;
        nodes.add(nodeA);
        nodes.add(nodeB);

        return {
          source: nodeA,
          target: nodeB,
          score: edge.score,
          scoreNormalized: (edge.score / 1000).toFixed(3),
          evidenceTypes: this.parseEvidenceChannels(edge)
        };
      });

      return {
        genes: geneSymbols,
        nodes: Array.from(nodes),
        edges,
        networkSize: nodes.size,
        edgeCount: edges.length,
        avgConfidence: edges.reduce((sum, e) => sum + e.score, 0) / edges.length,
        imageUrl: this.getNetworkImageUrl(geneSymbols, options),
        source: 'STRING Network'
      };
    } catch (error) {
      console.error('[STRING] Network fetch failed:', error.message);
      return {
        genes: geneSymbols,
        nodes: [],
        edges: [],
        error: error.message
      };
    }
  }

  /**
   * Parse evidence channels from STRING interaction
   * @private
   */
  parseEvidenceChannels(interaction) {
    const evidence = [];

    // STRING provides 7 evidence channels (0-1 scores)
    if (interaction.nscore > 0) evidence.push({ type: 'neighborhood', score: interaction.nscore });
    if (interaction.fscore > 0) evidence.push({ type: 'gene_fusion', score: interaction.fscore });
    if (interaction.pscore > 0) evidence.push({ type: 'phylogenetic', score: interaction.pscore });
    if (interaction.ascore > 0) evidence.push({ type: 'coexpression', score: interaction.ascore });
    if (interaction.escore > 0) evidence.push({ type: 'experiments', score: interaction.escore });
    if (interaction.dscore > 0) evidence.push({ type: 'databases', score: interaction.dscore });
    if (interaction.tscore > 0) evidence.push({ type: 'textmining', score: interaction.tscore });

    return evidence;
  }

  /**
   * Calculate network centrality for genes
   * @param {string[]} geneSymbols - Array of gene symbols
   * @returns {Promise<Object>} Centrality metrics for each gene
   */
  async calculateCentrality(geneSymbols) {
    const network = await this.getNetwork(geneSymbols, { addNodes: 5 });

    if (!network.edges || network.edges.length === 0) {
      return { genes: geneSymbols, centrality: {}, error: 'No network data' };
    }

    // Calculate degree centrality (number of connections)
    const degreeCentrality = {};
    network.nodes.forEach(node => {
      degreeCentrality[node] = network.edges.filter(
        e => e.source === node || e.target === node
      ).length;
    });

    // Normalize by max degree
    const maxDegree = Math.max(...Object.values(degreeCentrality));
    Object.keys(degreeCentrality).forEach(node => {
      degreeCentrality[node] = degreeCentrality[node] / maxDegree;
    });

    return {
      genes: geneSymbols,
      centrality: degreeCentrality,
      networkHub: Object.keys(degreeCentrality).reduce((a, b) =>
        degreeCentrality[a] > degreeCentrality[b] ? a : b
      ),
      source: 'STRING Centrality'
    };
  }
}

// Export singleton instance
export const stringClient = new StringClient();

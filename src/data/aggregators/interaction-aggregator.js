/**
 * Protein Interaction Network Aggregator
 *
 * INTELLIGENCE SYNTHESIS: Combines multiple interaction databases to create
 * a unified, cross-validated view of protein-protein interaction networks
 *
 * This demonstrates how MULTIPLE SOURCES create HIGHER CONFIDENCE:
 * - STRING confirms with BioGRID = HIGH CONFIDENCE
 * - Only one source = MEDIUM CONFIDENCE
 * - Cross-database validation = TRUTH EMERGENCE
 *
 * This is the future of biological intelligence: MULTI-SOURCE VALIDATION
 *
 * @author Oluwafemi Idiakhoa
 */

import { stringClient } from '../integrations/string-client.js';
import { biogridClient } from '../integrations/biogrid-client.js';

/**
 * Interaction Network Aggregator
 * Synthesizes protein interaction data from multiple sources
 */
export class InteractionAggregator {
  constructor() {
    this.sources = ['STRING', 'BioGRID']; // Multi-source validation
    this.confidenceThresholds = {
      high: 0.7,    // 70%+ confidence or multi-source validation
      medium: 0.4,  // 40-70% confidence
      low: 0.0      // <40% confidence
    };
  }

  /**
   * INTELLIGENCE SYNTHESIS: Fetch and combine interaction networks
   * @param {string[]} geneSymbols - Array of gene symbols
   * @param {Object} options - Aggregation options
   * @returns {Promise<Object>} Unified interaction network with confidence scores
   */
  async fetchNetworks(geneSymbols, options = {}) {
    const {
      minConfidence = 0.7,        // Minimum confidence score (0-1)
      maxInteractors = 10,        // Max interactors per gene
      includeEnrichment = true,   // Include pathway enrichment
      calculateCentrality = true  // Calculate network hubs
    } = options;

    console.log(`[Interaction Aggregator] Fetching networks for ${geneSymbols.length} genes...`);
    const startTime = Date.now();

    try {
      // PHASE 1: Fetch interactions from all sources in parallel
      const [stringInteractions, stringNetwork, biogridInteractions] = await Promise.all([
        this.fetchStringInteractions(geneSymbols, minConfidence, maxInteractors),
        this.fetchStringNetwork(geneSymbols, minConfidence),
        this.fetchBioGridInteractions(geneSymbols, maxInteractors)
      ]);

      // PHASE 2: Merge and validate interactions (CROSS-VALIDATION!)
      const mergedInteractions = this.mergeInteractions([stringInteractions, biogridInteractions]);

      // PHASE 3: Calculate network topology metrics
      const topology = this.calculateNetworkTopology(stringNetwork);

      // PHASE 4: Enrichment analysis (if requested)
      let enrichment = null;
      if (includeEnrichment && geneSymbols.length >= 3) {
        enrichment = await this.fetchEnrichment(geneSymbols);
      }

      // PHASE 5: Centrality analysis (if requested)
      let centrality = null;
      if (calculateCentrality) {
        centrality = await this.calculateCentrality(geneSymbols);
      }

      const fetchTime = Date.now() - startTime;
      const validatedCount = mergedInteractions.filter(i => i.validated).length;
      console.log(`[Interaction Aggregator] Fetched networks in ${fetchTime}ms (${validatedCount}/${mergedInteractions.length} cross-validated)`);

      return {
        genes: geneSymbols,
        interactions: mergedInteractions,
        network: {
          nodes: stringNetwork.nodes || [],
          edges: stringNetwork.edges || [],
          topology,
          imageUrl: stringNetwork.imageUrl
        },
        enrichment,
        centrality,
        stats: {
          totalInteractions: mergedInteractions.length,
          avgConfidence: this.calculateAvgConfidence(mergedInteractions),
          sources: this.sources,
          fetchTime: `${fetchTime}ms`
        },
        source: 'Interaction Aggregator (Multi-Source Synthesis)'
      };
    } catch (error) {
      console.error('[Interaction Aggregator] Network fetch failed:', error);
      return {
        genes: geneSymbols,
        interactions: [],
        error: error.message
      };
    }
  }

  /**
   * Fetch interactions from STRING database
   * @private
   */
  async fetchStringInteractions(geneSymbols, minConfidence, maxInteractors) {
    const requiredScore = Math.round(minConfidence * 1000); // Convert to STRING scale (0-1000)

    const interactions = await Promise.all(
      geneSymbols.map(gene =>
        stringClient.getProteinInteractions(gene, {
          limit: maxInteractors,
          requiredScore
        })
      )
    );

    return interactions.flatMap(result =>
      result.interactions.map(int => ({
        gene: result.gene,
        partner: int.partner,
        partnerName: int.partnerFullName,
        confidence: parseFloat(int.scoreNormalized),
        score: int.score,
        evidenceTypes: int.evidenceTypes,
        source: 'STRING',
        validated: false // Will be set to true if confirmed by another source
      }))
    );
  }

  /**
   * Fetch complete network from STRING
   * @private
   */
  async fetchStringNetwork(geneSymbols, minConfidence) {
    const requiredScore = Math.round(minConfidence * 1000);
    return await stringClient.getNetwork(geneSymbols, {
      requiredScore,
      addNodes: 5 // Add 5 high-confidence external nodes
    });
  }

  /**
   * Fetch interactions from BioGRID database
   * @private
   */
  async fetchBioGridInteractions(geneSymbols, maxInteractors) {
    const interactions = await Promise.all(
      geneSymbols.map(gene =>
        biogridClient.getProteinInteractions(gene, {
          limit: maxInteractors,
          evidenceType: 'all', // Physical and genetic
          throughputType: 'any'
        })
      )
    );

    return interactions.flatMap(result => {
      if (result.error) {
        console.warn(`[BioGRID] ${result.error} for ${result.gene}`);
        return [];
      }

      return result.interactions.map(int => ({
        gene: result.gene,
        partner: int.partner,
        partnerName: int.partnerName,
        confidence: biogridClient.calculateConfidence(int),
        evidenceType: int.evidenceType,
        experimentalSystem: int.experimentalSystem,
        throughput: int.throughput,
        pubmedId: int.pubmedId,
        source: 'BioGRID',
        validated: true // BioGRID = experimentally validated
      }));
    });
  }

  /**
   * INTELLIGENCE SYNTHESIS: Merge interactions from multiple sources
   * Cross-validation increases confidence
   * @private
   */
  mergeInteractions(interactionSets) {
    // Flatten all interactions
    const allInteractions = interactionSets.flat();

    // Group by gene-partner pair
    const grouped = {};
    allInteractions.forEach(int => {
      const key = `${int.gene}::${int.partner}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(int);
    });

    // Merge and calculate consensus confidence
    return Object.entries(grouped).map(([key, interactions]) => {
      const [gene, partner] = key.split('::');
      const sources = [...new Set(interactions.map(i => i.source))];
      const avgConfidence = interactions.reduce((sum, i) => sum + i.confidence, 0) / interactions.length;

      // MULTI-SOURCE BOOST: If validated by multiple sources, increase confidence
      const validationBoost = sources.length > 1 ? 0.15 : 0;
      const finalConfidence = Math.min(1.0, avgConfidence + validationBoost);

      return {
        gene,
        partner,
        partnerName: interactions[0].partnerName,
        confidence: finalConfidence,
        confidenceLevel: this.getConfidenceLevel(finalConfidence),
        sources,
        validated: sources.length > 1, // Cross-validated!
        evidenceCount: interactions.reduce((sum, i) => sum + (i.evidenceTypes?.length || 0), 0),
        evidenceTypes: this.mergeEvidence(interactions)
      };
    }).sort((a, b) => b.confidence - a.confidence); // Sort by confidence
  }

  /**
   * Merge evidence types from multiple sources
   * @private
   */
  mergeEvidence(interactions) {
    const allEvidence = {};
    interactions.forEach(int => {
      if (int.evidenceTypes) {
        int.evidenceTypes.forEach(ev => {
          if (!allEvidence[ev.type]) {
            allEvidence[ev.type] = [];
          }
          allEvidence[ev.type].push(ev.score);
        });
      }
    });

    return Object.entries(allEvidence).map(([type, scores]) => ({
      type,
      score: Math.max(...scores), // Take highest score
      sources: scores.length
    }));
  }

  /**
   * Calculate network topology metrics
   * @private
   */
  calculateNetworkTopology(network) {
    if (!network.edges || network.edges.length === 0) {
      return null;
    }

    // Calculate degree distribution
    const degrees = {};
    network.edges.forEach(edge => {
      degrees[edge.source] = (degrees[edge.source] || 0) + 1;
      degrees[edge.target] = (degrees[edge.target] || 0) + 1;
    });

    const degreeValues = Object.values(degrees);
    const avgDegree = degreeValues.reduce((a, b) => a + b, 0) / degreeValues.length;
    const maxDegree = Math.max(...degreeValues);

    // Find hub proteins (high degree centrality)
    const hubs = Object.entries(degrees)
      .filter(([_, degree]) => degree >= avgDegree * 1.5)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([protein, degree]) => ({ protein, degree, centrality: degree / maxDegree }));

    return {
      nodeCount: network.nodes.length,
      edgeCount: network.edges.length,
      avgDegree: avgDegree.toFixed(2),
      maxDegree,
      density: (2 * network.edges.length) / (network.nodes.length * (network.nodes.length - 1)),
      hubs,
      avgConfidence: network.avgConfidence
    };
  }

  /**
   * Fetch pathway enrichment for gene set
   * @private
   */
  async fetchEnrichment(geneSymbols) {
    try {
      const enrichment = await stringClient.getEnrichment(geneSymbols);

      // Filter and sort by significance
      const significant = enrichment.enrichment
        .filter(item => item.fdr < 0.05) // FDR < 5%
        .sort((a, b) => a.pValue - b.pValue)
        .slice(0, 10); // Top 10

      return {
        pathways: significant.filter(item => item.category.includes('KEGG') || item.category.includes('Reactome')),
        processes: significant.filter(item => item.category.includes('Process')),
        components: significant.filter(item => item.category.includes('Component')),
        functions: significant.filter(item => item.category.includes('Function'))
      };
    } catch (error) {
      console.error('[Interaction Aggregator] Enrichment failed:', error);
      return null;
    }
  }

  /**
   * Calculate centrality metrics
   * @private
   */
  async calculateCentrality(geneSymbols) {
    try {
      return await stringClient.calculateCentrality(geneSymbols);
    } catch (error) {
      console.error('[Interaction Aggregator] Centrality calculation failed:', error);
      return null;
    }
  }

  /**
   * Get confidence level label
   * @private
   */
  getConfidenceLevel(confidence) {
    if (confidence >= this.confidenceThresholds.high) return 'high';
    if (confidence >= this.confidenceThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Calculate average confidence across all interactions
   * @private
   */
  calculateAvgConfidence(interactions) {
    if (!interactions || interactions.length === 0) return 0;
    const sum = interactions.reduce((acc, int) => acc + int.confidence, 0);
    return (sum / interactions.length).toFixed(3);
  }

  /**
   * Find shared interactors across genes (potential pathway mediators)
   * @param {Object} networkData - Network data from fetchNetworks()
   * @returns {Array} Shared interactors with connectivity scores
   */
  findSharedInteractors(networkData) {
    const { interactions, genes } = networkData;

    // Group interactors by gene
    const geneInteractors = {};
    genes.forEach(gene => {
      geneInteractors[gene] = interactions
        .filter(int => int.gene === gene)
        .map(int => int.partner);
    });

    // Find proteins that interact with multiple input genes
    const partnerCounts = {};
    Object.values(geneInteractors).forEach(partners => {
      partners.forEach(partner => {
        partnerCounts[partner] = (partnerCounts[partner] || 0) + 1;
      });
    });

    // Return shared interactors (interact with 2+ input genes)
    return Object.entries(partnerCounts)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([partner, count]) => ({
        protein: partner,
        connectsGenes: count,
        connectivity: count / genes.length,
        role: count >= genes.length * 0.5 ? 'hub' : 'connector'
      }));
  }
}

// Export singleton instance
export const interactionAggregator = new InteractionAggregator();

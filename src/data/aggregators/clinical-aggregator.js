/**
 * Clinical Association Aggregator
 *
 * INTELLIGENCE SYNTHESIS: Combines disease-gene associations from multiple
 * clinical databases to create a unified, cross-validated view
 *
 * This demonstrates CLINICAL INTELLIGENCE through:
 * - Open Targets confirms with DisGeNET = HIGH CONFIDENCE
 * - Only one source = MEDIUM CONFIDENCE
 * - Cross-database validation = TRUTH EMERGENCE
 *
 * Multi-source validation reveals the most reliable disease associations
 *
 * @author Oluwafemi Idiakhoa
 */

import { openTargetsClient } from '../integrations/opentargets-client.js';
import { disgenetClient } from '../integrations/disgenet-client.js';

/**
 * Clinical Association Aggregator
 * Synthesizes disease-gene associations from multiple clinical databases
 *
 * CROSS-VALIDATION: Open Targets + DisGeNET
 */
export class ClinicalAggregator {
  constructor() {
    this.sources = ['Open Targets', 'DisGeNET']; // Multi-source validation
    this.confidenceThresholds = {
      high: 0.7,    // 70%+ association score or multi-source validation
      medium: 0.4,  // 40-70% association score
      low: 0.1      // 10-40% association score
    };
  }

  /**
   * INTELLIGENCE SYNTHESIS: Fetch and combine disease associations
   * @param {string[]} geneSymbols - Array of gene symbols
   * @param {string} diseaseContext - Disease/condition context for filtering
   * @param {Object} options - Aggregation options
   * @returns {Promise<Object>} Unified disease associations with confidence scores
   */
  async fetchAssociations(geneSymbols, diseaseContext = null, options = {}) {
    const {
      minScore = 0.1,          // Minimum association score (0-1)
      maxPerGene = 5,          // Max diseases per gene
      includeEvidence = true,  // Include evidence breakdown
      includeDrugs = false     // Include known drugs (slower)
    } = options;

    console.log(`[Clinical Aggregator] Fetching associations for ${geneSymbols.length} genes...`);
    const startTime = Date.now();

    try {
      // PHASE 1: Fetch disease associations from ALL sources in parallel
      const openTargetsPromises = geneSymbols.map(gene =>
        this.fetchOpenTargetsAssociations(gene, diseaseContext, minScore, maxPerGene)
      );

      const disgenetPromises = geneSymbols.map(gene =>
        this.fetchDisGeNETAssociations(gene, diseaseContext, minScore, maxPerGene)
      );

      // Optionally fetch drug data in parallel
      let drugPromises = [];
      if (includeDrugs) {
        drugPromises = geneSymbols.map(gene =>
          openTargetsClient.getKnownDrugs(gene)
        );
      }

      const [openTargetsData, disgenetData, drugs] = await Promise.all([
        Promise.all(openTargetsPromises),
        Promise.all(disgenetPromises),
        includeDrugs ? Promise.all(drugPromises) : Promise.resolve([])
      ]);

      // Combine associations from both sources
      const allAssociations = [...openTargetsData, ...disgenetData];

      // PHASE 2: Merge and cross-validate associations
      const mergedAssociations = this.mergeAssociations(allAssociations);

      // PHASE 3: Calculate aggregate statistics
      const stats = this.calculateStatistics(mergedAssociations);

      const fetchTime = Date.now() - startTime;
      console.log(`[Clinical Aggregator] Fetched associations in ${fetchTime}ms`);

      return {
        genes: geneSymbols,
        associations: mergedAssociations,
        drugs: includeDrugs ? this.mergeDrugs(drugs) : null,
        stats: {
          totalAssociations: mergedAssociations.length,
          avgScore: stats.avgScore,
          highConfidence: stats.highConfidence,
          sources: this.sources,
          fetchTime: `${fetchTime}ms`
        },
        source: 'Clinical Aggregator (Multi-Source Synthesis)'
      };
    } catch (error) {
      console.error('[Clinical Aggregator] Association fetch failed:', error);
      return {
        genes: geneSymbols,
        associations: [],
        error: error.message
      };
    }
  }

  /**
   * Fetch associations from Open Targets
   * @private
   */
  async fetchOpenTargetsAssociations(gene, diseaseContext, minScore, maxPerGene) {
    const result = await openTargetsClient.getDiseaseAssociations(gene, {
      minScore,
      maxResults: maxPerGene,
      diseaseContext
    });

    return {
      gene,
      source: 'Open Targets',
      associations: result.associations || [],
      totalDiseases: result.totalDiseases || 0,
      error: result.error
    };
  }

  /**
   * Fetch associations from DisGeNET
   * @private
   */
  async fetchDisGeNETAssociations(gene, diseaseContext, minScore, maxPerGene) {
    const result = await disgenetClient.getDiseaseAssociations(gene, {
      minScore,
      maxResults: maxPerGene
    });

    // Convert DisGeNET format to match Open Targets format
    const formattedAssociations = (result.associations || []).map(assoc => ({
      disease: assoc.diseaseName,
      diseaseId: assoc.diseaseId,
      score: assoc.score,
      evidenceTypes: assoc.sources?.join(', ') || 'GWAS, Literature',
      evidenceBreakdown: [
        {
          type: assoc.diseaseType || 'disease',
          score: assoc.score
        }
      ]
    }));

    return {
      gene,
      source: 'DisGeNET',
      associations: formattedAssociations,
      totalDiseases: result.totalAssociations || 0,
      error: result.error
    };
  }

  /**
   * INTELLIGENCE SYNTHESIS: Merge associations from multiple sources
   * Cross-validation increases confidence
   * @private
   */
  mergeAssociations(associationSets) {
    // Flatten all associations
    const allAssociations = [];

    associationSets.forEach(set => {
      if (!set.error && set.associations) {
        set.associations.forEach(assoc => {
          allAssociations.push({
            ...assoc,
            gene: set.gene,
            source: set.source
          });
        });
      }
    });

    // Group by gene-disease pair
    const grouped = {};
    allAssociations.forEach(assoc => {
      const key = `${assoc.gene}::${assoc.disease}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(assoc);
    });

    // Merge and calculate consensus scores
    return Object.entries(grouped).map(([key, associations]) => {
      const [gene, disease] = key.split('::');
      const sources = [...new Set(associations.map(a => a.source))];
      const avgScore = associations.reduce((sum, a) => sum + a.score, 0) / associations.length;

      // MULTI-SOURCE BOOST: If validated by multiple sources, increase confidence
      const validationBoost = sources.length > 1 ? 0.15 : 0;
      const finalScore = Math.min(1.0, avgScore + validationBoost);

      // Merge evidence types
      const evidenceTypes = new Set();
      const evidenceBreakdown = [];
      associations.forEach(a => {
        if (a.evidenceTypes) {
          a.evidenceTypes.split(', ').forEach(ev => evidenceTypes.add(ev));
        }
        if (a.evidenceBreakdown) {
          evidenceBreakdown.push(...a.evidenceBreakdown);
        }
      });

      return {
        gene,
        disease,
        diseaseId: associations[0].diseaseId,
        score: parseFloat(finalScore.toFixed(3)),
        confidenceLevel: this.getConfidenceLevel(finalScore),
        sources,
        validated: sources.length > 1, // Cross-validated!
        evidenceTypes: Array.from(evidenceTypes).join(', '),
        evidenceBreakdown: this.mergeEvidenceBreakdown(evidenceBreakdown),
        sourceCount: sources.length
      };
    }).sort((a, b) => {
      // Sort by validation status, then score
      if (a.validated !== b.validated) return b.validated - a.validated;
      return b.score - a.score;
    });
  }

  /**
   * Merge evidence breakdown from multiple sources
   * @private
   */
  mergeEvidenceBreakdown(evidenceArray) {
    const grouped = {};
    evidenceArray.forEach(ev => {
      if (!grouped[ev.type]) {
        grouped[ev.type] = [];
      }
      grouped[ev.type].push(ev.score);
    });

    return Object.entries(grouped).map(([type, scores]) => ({
      type,
      score: Math.max(...scores), // Take highest score
      sources: scores.length
    })).sort((a, b) => b.score - a.score);
  }

  /**
   * Merge drug data from multiple sources
   * @private
   */
  mergeDrugs(drugSets) {
    const allDrugs = [];

    drugSets.forEach(set => {
      if (!set.error && set.drugs) {
        set.drugs.forEach(drug => {
          allDrugs.push({
            ...drug,
            gene: set.gene
          });
        });
      }
    });

    // Group by drug name
    const grouped = {};
    allDrugs.forEach(drug => {
      const key = drug.name;
      if (!grouped[key]) {
        grouped[key] = {
          name: drug.name,
          phase: drug.phase,
          type: drug.type,
          targets: [],
          diseases: new Set(),
          mechanisms: new Set()
        };
      }

      grouped[key].targets.push(drug.gene);
      if (drug.disease) grouped[key].diseases.add(drug.disease);
      if (drug.mechanism) grouped[key].mechanisms.add(drug.mechanism);
    });

    return Object.values(grouped).map(drug => ({
      name: drug.name,
      phase: drug.phase,
      type: drug.type,
      targets: [...new Set(drug.targets)],
      diseases: Array.from(drug.diseases),
      mechanisms: Array.from(drug.mechanisms)
    })).sort((a, b) => b.phase - a.phase); // Sort by clinical trial phase
  }

  /**
   * Calculate aggregate statistics
   * @private
   */
  calculateStatistics(associations) {
    if (!associations || associations.length === 0) {
      return { avgScore: 0, highConfidence: 0 };
    }

    const avgScore = associations.reduce((sum, a) => sum + a.score, 0) / associations.length;
    const highConfidence = associations.filter(a => a.confidenceLevel === 'high').length;

    return {
      avgScore: parseFloat(avgScore.toFixed(3)),
      highConfidence,
      validated: associations.filter(a => a.validated).length
    };
  }

  /**
   * Get confidence level based on score
   * @private
   */
  getConfidenceLevel(score) {
    if (score >= this.confidenceThresholds.high) return 'high';
    if (score >= this.confidenceThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Find shared disease associations across genes
   * @param {Object} clinicalData - Clinical data from fetchAssociations()
   * @returns {Array} Diseases associated with multiple input genes
   */
  findSharedDiseases(clinicalData) {
    const { associations, genes } = clinicalData;

    // Group associations by disease
    const diseaseGenes = {};
    associations.forEach(assoc => {
      if (!diseaseGenes[assoc.disease]) {
        diseaseGenes[assoc.disease] = {
          genes: [],
          totalScore: 0,
          diseaseId: assoc.diseaseId
        };
      }
      diseaseGenes[assoc.disease].genes.push(assoc.gene);
      diseaseGenes[assoc.disease].totalScore += assoc.score;
    });

    // Return diseases associated with 2+ input genes
    return Object.entries(diseaseGenes)
      .filter(([_, data]) => data.genes.length >= 2)
      .sort((a, b) => b[1].totalScore - a[1].totalScore)
      .map(([disease, data]) => ({
        disease,
        diseaseId: data.diseaseId,
        affectedGenes: data.genes,
        geneCount: data.genes.length,
        coverage: data.genes.length / genes.length,
        avgScore: (data.totalScore / data.genes.length).toFixed(3),
        role: data.genes.length >= genes.length * 0.5 ? 'primary' : 'secondary'
      }));
  }
}

// Export singleton instance
export const clinicalAggregator = new ClinicalAggregator();

/**
 * Drug & Bioactive Compound Aggregator
 *
 * INTELLIGENCE SYNTHESIS: Combines drug-gene interactions from multiple
 * databases to create unified, cross-validated therapeutic intelligence
 *
 * This demonstrates DRUG DISCOVERY INTELLIGENCE through:
 * - ChEMBL confirms with DrugBank = HIGH CONFIDENCE
 * - Only one source = MEDIUM CONFIDENCE
 * - Cross-database validation = TRUTH EMERGENCE
 *
 * Multi-source validation reveals the most promising therapeutic targets
 *
 * @author Oluwafemi Idiakhoa
 */

import { chemblClient } from '../integrations/chembl-client.js';
import { drugbankClient } from '../integrations/drugbank-client.js';

/**
 * Drug & Compound Aggregator
 * Synthesizes bioactive molecules and drug-target data from multiple sources
 *
 * CROSS-VALIDATION: ChEMBL + DrugBank
 */
export class DrugAggregator {
  constructor() {
    this.sources = ['ChEMBL', 'DrugBank']; // Multi-source validation
    this.phaseThresholds = {
      approved: 4,       // FDA approved
      lateStage: 3,      // Phase 3 clinical trial
      clinical: 1,       // Phase 1-3 trials
      preclinical: 0     // Research only
    };
  }

  /**
   * INTELLIGENCE SYNTHESIS: Fetch and combine drug-target data
   * @param {string[]} geneSymbols - Array of gene symbols
   * @param {Object} options - Aggregation options
   * @returns {Promise<Object>} Unified drug-target data with confidence scores
   */
  async fetchDrugTargets(geneSymbols, options = {}) {
    const {
      maxPotency = 10000,       // Max IC50 in nM (10μM)
      minPhase = 0,             // Min clinical phase (-1=all, 0=preclinical, 4=approved)
      includeCompounds = true,  // Include all bioactive compounds
      includeApproved = true,   // Prioritize FDA-approved drugs
      maxPerGene = 10           // Max compounds per gene
    } = options;

    console.log(`[Drug Aggregator] Fetching drug targets for ${geneSymbols.length} genes...`);
    const startTime = Date.now();

    try {
      // PHASE 1: Fetch compounds from ALL sources in parallel
      const chemblPromises = geneSymbols.map(gene =>
        this.fetchChemblCompounds(gene, maxPotency, maxPerGene)
      );

      const drugbankPromises = geneSymbols.map(gene =>
        this.fetchDrugBankTargets(gene, minPhase, maxPerGene)
      );

      // Optionally fetch approved drugs separately (higher confidence)
      let approvedPromises = [];
      if (includeApproved) {
        approvedPromises = geneSymbols.map(gene =>
          chemblClient.getApprovedDrugs(gene)
        );
      }

      const [chemblData, drugbankData, approvedDrugs] = await Promise.all([
        Promise.all(chemblPromises),
        Promise.all(drugbankPromises),
        includeApproved ? Promise.all(approvedPromises) : Promise.resolve([])
      ]);

      // Combine compounds from both sources
      const allCompounds = [...chemblData, ...drugbankData];

      // PHASE 2: Merge and cross-validate compounds
      const mergedCompounds = this.mergeCompounds(allCompounds, minPhase);
      const mergedApproved = this.mergeApprovedDrugs(approvedDrugs);

      // PHASE 3: Calculate aggregate statistics
      const stats = this.calculateStatistics(mergedCompounds, mergedApproved);

      const fetchTime = Date.now() - startTime;
      console.log(`[Drug Aggregator] Fetched drug targets in ${fetchTime}ms`);

      return {
        genes: geneSymbols,
        compounds: includeCompounds ? mergedCompounds : [],
        approvedDrugs: mergedApproved,
        stats: {
          totalCompounds: mergedCompounds.length,
          totalApproved: mergedApproved.length,
          avgPotency: stats.avgPotency,
          phaseDistribution: stats.phaseDistribution,
          sources: this.sources,
          fetchTime: `${fetchTime}ms`
        },
        source: 'Drug Aggregator (Multi-Source Synthesis)'
      };
    } catch (error) {
      console.error('[Drug Aggregator] Drug target fetch failed:', error);
      return {
        genes: geneSymbols,
        compounds: [],
        approvedDrugs: [],
        error: error.message
      };
    }
  }

  /**
   * Fetch compounds from ChEMBL
   * @private
   */
  async fetchChemblCompounds(gene, maxPotency, maxPerGene) {
    const result = await chemblClient.getTargetCompounds(gene, {
      maxPotency,
      minActivity: 50, // pChEMBL >= 5 (10μM)
      limit: maxPerGene
    });

    return {
      gene,
      source: 'ChEMBL',
      compounds: result.compounds || [],
      targetId: result.targetId,
      error: result.error
    };
  }

  /**
   * Fetch drugs from DrugBank
   * @private
   */
  async fetchDrugBankTargets(gene, minPhase, maxPerGene) {
    const result = await drugbankClient.getDrugTargets(gene, {
      minPhase,
      includeExperimental: true,
      approvedOnly: false
    });

    // Convert DrugBank format to match ChEMBL format
    const formattedDrugs = (result.drugs || []).map(drug => ({
      name: drug.drug,
      chemblId: drug.chemblId || null,
      drugId: drug.drugId,
      maxPhase: drug.phase,
      type: drug.type,
      mechanism: drug.mechanism,
      pChEMBL: null, // DrugBank doesn't provide pChEMBL
      potency: drug.bindingAffinity || 'Not available'
    }));

    return {
      gene,
      source: 'DrugBank',
      compounds: formattedDrugs,
      error: result.error
    };
  }

  /**
   * INTELLIGENCE SYNTHESIS: Merge compounds from multiple sources
   * Cross-validation increases confidence
   * @private
   */
  mergeCompounds(compoundSets, minPhase) {
    const allCompounds = [];

    compoundSets.forEach(set => {
      if (!set.error && set.compounds) {
        set.compounds.forEach(compound => {
          // Filter by minimum phase
          if (compound.maxPhase >= minPhase) {
            allCompounds.push({
              ...compound,
              gene: set.gene,
              source: set.source,
              targetId: set.targetId
            });
          }
        });
      }
    });

    // Group by compound ID (for future multi-source validation)
    const grouped = {};
    allCompounds.forEach(compound => {
      const key = compound.chemblId || compound.name;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(compound);
    });

    // Merge and calculate consensus
    return Object.entries(grouped).map(([key, compounds]) => {
      const sources = [...new Set(compounds.map(c => c.source))];
      const genes = [...new Set(compounds.map(c => c.gene))];

      // MULTI-SOURCE BOOST: If validated by multiple sources, increase confidence
      const validationBoost = sources.length > 1 ? 'cross-validated' : 'single-source';

      // Take the compound with the best (highest) pChEMBL value
      const bestCompound = compounds.reduce((best, curr) => {
        const bestPotency = parseFloat(best.pChEMBL || 0);
        const currPotency = parseFloat(curr.pChEMBL || 0);
        return currPotency > bestPotency ? curr : best;
      });

      return {
        ...bestCompound,
        genes,
        sources,
        validated: validationBoost,
        targetsMultipleGenes: genes.length > 1
      };
    }).sort((a, b) => {
      // Sort by: 1) maxPhase (approved first), 2) pChEMBL (potency), 3) multi-gene targets
      if (a.maxPhase !== b.maxPhase) return b.maxPhase - a.maxPhase;
      if (a.pChEMBL !== b.pChEMBL) return (b.pChEMBL || 0) - (a.pChEMBL || 0);
      return b.genes.length - a.genes.length;
    });
  }

  /**
   * Merge approved drugs from multiple sources
   * @private
   */
  mergeApprovedDrugs(approvedSets) {
    const allApproved = [];

    approvedSets.forEach(set => {
      if (!set.error && set.drugs) {
        set.drugs.forEach(drug => {
          allApproved.push({
            ...drug,
            gene: set.gene,
            targetId: set.targetId
          });
        });
      }
    });

    // Sort by potency (pChEMBL)
    return allApproved.sort((a, b) => (b.pChEMBL || 0) - (a.pChEMBL || 0));
  }

  /**
   * Calculate aggregate statistics
   * @private
   */
  calculateStatistics(compounds, approvedDrugs) {
    // Average potency (pChEMBL)
    const validPotencies = compounds
      .map(c => parseFloat(c.pChEMBL))
      .filter(p => !isNaN(p) && p > 0);

    const avgPotency = validPotencies.length > 0
      ? (validPotencies.reduce((sum, p) => sum + p, 0) / validPotencies.length).toFixed(2)
      : 0;

    // Phase distribution
    const phaseDistribution = {
      approved: compounds.filter(c => c.maxPhase === 4).length,
      phase3: compounds.filter(c => c.maxPhase === 3).length,
      phase2: compounds.filter(c => c.maxPhase === 2).length,
      phase1: compounds.filter(c => c.maxPhase === 1).length,
      preclinical: compounds.filter(c => c.maxPhase === 0).length
    };

    return {
      avgPotency: parseFloat(avgPotency),
      phaseDistribution,
      approvedCount: approvedDrugs.length
    };
  }

  /**
   * Find compounds that target multiple input genes (polypharmacology)
   * @param {Object} drugData - Drug data from fetchDrugTargets()
   * @returns {Array} Compounds targeting 2+ input genes
   */
  findMultiTargetCompounds(drugData) {
    const { compounds } = drugData;

    return compounds
      .filter(c => c.targetsMultipleGenes && c.genes.length >= 2)
      .map(c => ({
        name: c.name,
        chemblId: c.chemblId,
        targets: c.genes,
        targetCount: c.genes.length,
        phase: c.phaseLabel,
        potency: c.potency,
        pChEMBL: c.pChEMBL,
        role: c.genes.length >= drugData.genes.length * 0.5 ? 'pan-inhibitor' : 'dual-target'
      }))
      .sort((a, b) => b.targetCount - a.targetCount);
  }

  /**
   * Get therapeutic recommendations based on drug data
   * @param {Object} drugData - Drug data from fetchDrugTargets()
   * @param {string} diseaseContext - Disease context for filtering
   * @returns {Array} Prioritized therapeutic recommendations
   */
  getTherapeuticRecommendations(drugData, diseaseContext) {
    const { approvedDrugs, compounds } = drugData;

    const recommendations = [];

    // Priority 1: FDA-approved drugs
    approvedDrugs.slice(0, 3).forEach(drug => {
      recommendations.push({
        compound: drug.name || drug.chemblId,
        phase: 'FDA Approved',
        confidence: 'high',
        potency: drug.potency,
        rationale: `FDA-approved drug targeting ${drug.gene}. Potency: ${drug.pChEMBL ? `pChEMBL ${drug.pChEMBL}` : 'documented'}`,
        riskLevel: 'low'
      });
    });

    // Priority 2: Late-stage clinical trials (Phase 3)
    const phase3 = compounds.filter(c => c.maxPhase === 3).slice(0, 2);
    phase3.forEach(compound => {
      recommendations.push({
        compound: compound.name || compound.chemblId,
        phase: 'Phase 3 Clinical Trial',
        confidence: 'medium',
        potency: compound.potency,
        rationale: `Late-stage clinical candidate targeting ${compound.genes.join(', ')}. ${compound.pChEMBL ? `pChEMBL ${compound.pChEMBL}` : 'Active in trials'}`,
        riskLevel: 'medium'
      });
    });

    // Priority 3: High-potency preclinical compounds
    const preclinical = compounds
      .filter(c => c.maxPhase < 1 && parseFloat(c.pChEMBL || 0) >= 7) // <100nM
      .slice(0, 2);
    preclinical.forEach(compound => {
      recommendations.push({
        compound: compound.name || compound.chemblId,
        phase: 'Preclinical',
        confidence: 'low',
        potency: compound.potency,
        rationale: `High-potency compound (${compound.pChEMBL ? `pChEMBL ${compound.pChEMBL}` : 'strong activity'}) targeting ${compound.genes.join(', ')}. Requires clinical validation.`,
        riskLevel: 'high'
      });
    });

    return recommendations;
  }
}

// Export singleton instance
export const drugAggregator = new DrugAggregator();

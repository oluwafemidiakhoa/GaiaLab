/**
 * DrugBank Client - comprehensive drug-target information
 *
 * DATA SOURCE: DrugBank REST API (https://www.drugbank.com)
 * - FREE API with limited access (requires API key for full access)
 * - 14,000+ FDA-approved & experimental drugs
 * - Drug-target interactions with binding affinities
 * - Pharmacology, mechanisms, clinical trial data
 * - Chemical structures and properties
 *
 * INTELLIGENCE VALUE:
 * - CROSS-VALIDATES ChEMBL for drug-target relationships
 * - When DrugBank + ChEMBL agree → HIGH confidence drug target
 * - Reveals approved drugs vs experimental compounds
 * - Mechanism of action insights
 * - Drug repurposing opportunities
 *
 * NOTE: DrugBank API requires paid subscription for full access
 * This client implements a fallback using public DrugBank data
 *
 * Alternative: Use public DrugBank XML dataset or web scraping
 * Get API key at: https://www.drugbank.com/api
 */

import { fetchWithTimeout } from '../../utils/fetch-with-timeout.js';

export class DrugbankClient {
  constructor() {
    this.apiKey = process.env.DRUGBANK_API_KEY || '';
    this.baseUrl = 'https://api.drugbank.com/v1';

    // Public DrugBank data fallback
    this.publicData = this.initializePublicData();

    if (!this.apiKey) {
      console.warn('[DrugBank] ⚠️  API key not configured. Using limited public data fallback.');
      console.warn('[DrugBank] Get API key at: https://www.drugbank.com/api (paid)');
    }
  }

  /**
   * Check if DrugBank API key is configured (full access).
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(this.apiKey);
  }

  /**
   * Initialize public DrugBank data for common drug targets
   * In production, this would load from a curated JSON file or database
   * @private
   */
  initializePublicData() {
    // Curated drug-gene interactions for common targets
    // This is a MINIMAL fallback - real implementation would use full DrugBank dataset
    return {
      'BRCA1': [
        { drug: 'Olaparib', type: 'Inhibitor', phase: 4, approved: true, mechanism: 'PARP inhibitor (synthetic lethality)' },
        { drug: 'Talazoparib', type: 'Inhibitor', phase: 4, approved: true, mechanism: 'PARP inhibitor' }
      ],
      'EGFR': [
        { drug: 'Erlotinib', type: 'Inhibitor', phase: 4, approved: true, mechanism: 'Tyrosine kinase inhibitor' },
        { drug: 'Gefitinib', type: 'Inhibitor', phase: 4, approved: true, mechanism: 'Tyrosine kinase inhibitor' },
        { drug: 'Osimertinib', type: 'Inhibitor', phase: 4, approved: true, mechanism: 'EGFR T790M inhibitor' }
      ],
      'ALK': [
        { drug: 'Crizotinib', type: 'Inhibitor', phase: 4, approved: true, mechanism: 'ALK/MET/ROS1 inhibitor' },
        { drug: 'Alectinib', type: 'Inhibitor', phase: 4, approved: true, mechanism: 'ALK inhibitor' }
      ],
      'TP53': [
        { drug: 'APR-246', type: 'Reactivator', phase: 2, approved: false, mechanism: 'Restores mutant p53 function' }
      ],
      'APOE': [],
      'APP': [
        { drug: 'Aducanumab', type: 'Antibody', phase: 4, approved: true, mechanism: 'Anti-amyloid antibody' }
      ],
      'HTT': [
        { drug: 'Tominersen', type: 'Antisense', phase: 3, approved: false, mechanism: 'HTT mRNA degradation' }
      ],
      'CFTR': [
        { drug: 'Ivacaftor', type: 'Potentiator', phase: 4, approved: true, mechanism: 'CFTR channel potentiator' },
        { drug: 'Lumacaftor', type: 'Corrector', phase: 4, approved: true, mechanism: 'CFTR protein folding' }
      ]
    };
  }

  /**
   * Get drugs targeting a specific gene
   * @param {string} geneSymbol - Gene symbol (e.g., "EGFR")
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Drug-target relationships
   */
  async getDrugTargets(geneSymbol, options = {}) {
    const {
      approvedOnly = false,
      minPhase = 0, // Minimum clinical trial phase
      includeExperimental = true
    } = options;

    try {
      console.log(`[DrugBank] Fetching drug targets for ${geneSymbol}...`);

      let drugs = [];

      if (this.apiKey) {
        // Use API if available
        drugs = await this.fetchFromAPI(geneSymbol, options);
      } else {
        // Fallback to public curated data
        drugs = this.fetchFromPublicData(geneSymbol);
      }

      // Filter by options
      if (approvedOnly) {
        drugs = drugs.filter(d => d.approved);
      }

      if (!includeExperimental) {
        drugs = drugs.filter(d => d.approved || d.phase >= 3);
      }

      drugs = drugs.filter(d => (d.phase || 0) >= minPhase);

      // Calculate statistics
      const approved = drugs.filter(d => d.approved).length;
      const clinical = drugs.filter(d => !d.approved && d.phase >= 1).length;
      const experimental = drugs.filter(d => d.phase === 0).length;

      return {
        gene: geneSymbol,
        drugs,
        totalDrugs: drugs.length,
        stats: {
          approved,
          clinical,
          experimental,
          phaseDistribution: this.calculatePhaseDistribution(drugs),
          mechanismTypes: this.extractMechanismTypes(drugs)
        },
        source: this.apiKey ? 'DrugBank API' : 'DrugBank (Public Data)',
        dataComplete: !!this.apiKey // Indicates if using full API or limited fallback
      };

    } catch (error) {
      console.error(`[DrugBank] Error fetching ${geneSymbol}:`, error.message);
      return {
        error: error.message,
        gene: geneSymbol
      };
    }
  }

  /**
   * Fetch from DrugBank API (requires paid subscription)
   * @private
   */
  async fetchFromAPI(geneSymbol, options) {
    try {
      const url = `${this.baseUrl}/drugs?target=${geneSymbol}`;

      const response = await fetchWithTimeout(url, {
        headers: {
          'Authorization': this.apiKey,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        } else if (response.status === 403) {
          console.warn('[DrugBank] API subscription required. Falling back to public data.');
          return this.fetchFromPublicData(geneSymbol);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      // Parse API response
      return (data.results || []).map(drug => ({
        drugId: drug.drugbank_id,
        drug: drug.name,
        type: drug.drug_type,
        phase: drug.max_phase || 0,
        approved: drug.groups?.includes('approved') || false,
        mechanism: drug.mechanism_of_action,
        bindingAffinity: drug.binding_affinity,
        chemblId: drug.external_ids?.chembl
      }));

    } catch (error) {
      console.error('[DrugBank] API fetch error:', error.message);
      return this.fetchFromPublicData(geneSymbol);
    }
  }

  /**
   * Fetch from public curated data (fallback)
   * @private
   */
  fetchFromPublicData(geneSymbol) {
    const normalized = geneSymbol.toUpperCase();

    if (this.publicData[normalized]) {
      return this.publicData[normalized].map(drug => ({
        ...drug,
        drugId: `DB-${drug.drug}`,
        source: 'Public DrugBank Data'
      }));
    }

    console.log(`[DrugBank] No public data available for ${geneSymbol}`);
    return [];
  }

  /**
   * Calculate phase distribution
   * @private
   */
  calculatePhaseDistribution(drugs) {
    const distribution = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

    drugs.forEach(drug => {
      const phase = drug.phase || 0;
      distribution[phase] = (distribution[phase] || 0) + 1;
    });

    return distribution;
  }

  /**
   * Extract unique mechanism types
   * @private
   */
  extractMechanismTypes(drugs) {
    const types = new Set();

    drugs.forEach(drug => {
      if (drug.type) {
        types.add(drug.type);
      }
    });

    return Array.from(types);
  }

  /**
   * Find drugs targeting multiple genes (polypharmacology)
   * @param {Array<string>} geneSymbols - Array of gene symbols
   * @returns {Promise<Array>} Drugs targeting 2+ input genes
   */
  async findMultiTargetDrugs(geneSymbols) {
    console.log(`[DrugBank] Finding multi-target drugs for ${geneSymbols.length} genes...`);

    try {
      // Fetch drug targets for all genes
      const allTargets = await Promise.all(
        geneSymbols.map(gene => this.getDrugTargets(gene))
      );

      // Count drug occurrences across genes
      const drugGeneMap = new Map();

      allTargets.forEach((result, idx) => {
        if (result.error || !result.drugs) return;

        const gene = geneSymbols[idx];
        result.drugs.forEach(drug => {
          const key = drug.drug;
          if (!drugGeneMap.has(key)) {
            drugGeneMap.set(key, {
              drug: drug.drug,
              type: drug.type,
              approved: drug.approved,
              phase: drug.phase,
              targets: [],
              mechanisms: []
            });
          }

          const drugData = drugGeneMap.get(key);
          drugData.targets.push(gene);
          if (drug.mechanism && !drugData.mechanisms.includes(drug.mechanism)) {
            drugData.mechanisms.push(drug.mechanism);
          }
        });
      });

      // Filter drugs targeting 2+ genes
      const multiTargetDrugs = Array.from(drugGeneMap.values())
        .filter(d => d.targets.length >= 2)
        .sort((a, b) => b.targets.length - a.targets.length);

      return {
        totalGenes: geneSymbols.length,
        multiTargetDrugs: multiTargetDrugs.slice(0, 20),
        stats: {
          total: multiTargetDrugs.length,
          approved: multiTargetDrugs.filter(d => d.approved).length,
          maxTargets: Math.max(...multiTargetDrugs.map(d => d.targets.length), 0)
        }
      };

    } catch (error) {
      console.error('[DrugBank] Multi-target drug search error:', error.message);
      return {
        totalGenes: geneSymbols.length,
        multiTargetDrugs: [],
        error: error.message
      };
    }
  }

  /**
   * Batch fetch drug targets for multiple genes
   */
  async getMultipleGenes(geneSymbols, options = {}) {
    console.log(`[DrugBank] Fetching drug targets for ${geneSymbols.length} genes...`);
    const startTime = Date.now();

    // No rate limiting needed for public data fallback
    // With API: respect limits (varies by subscription tier)
    const results = await Promise.all(
      geneSymbols.map(gene => this.getDrugTargets(gene, options))
    );

    const fetchTime = Date.now() - startTime;
    const successful = results.filter(r => !r.error).length;
    console.log(`[DrugBank] Fetched ${successful}/${results.length} genes in ${fetchTime}ms`);

    return results;
  }
}

// Export singleton instance
export const drugbankClient = new DrugbankClient();

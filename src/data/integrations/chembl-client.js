/**
 * ChEMBL Database Client - Bioactive Molecules & Drug Discovery
 *
 * ChEMBL is a manually curated database of bioactive molecules with drug-like properties
 * - 2.4+ million compounds
 * - 1.4+ million assays
 * - 20+ million bioactivity data points
 * - 100% FREE, unlimited REST API
 *
 * KEY USE CASES:
 * - Find drugs/compounds that target specific genes
 * - Discover bioactive molecules with IC50/EC50 data
 * - Identify mechanism of action for drug discovery
 * - Cross-validate with Open Targets and DrugBank
 *
 * API Documentation: https://chembl.gitbook.io/chembl-interface-documentation/web-services
 *
 */

import { fetchWithTimeout, retryWithBackoff } from '../../utils/fetch-with-timeout.js';

const CHEMBL_API_BASE = 'https://www.ebi.ac.uk/chembl/api/data';

/**
 * ChEMBL Database API Client
 * Provides bioactive molecules and drug-target interactions
 */
export class ChemblClient {
  constructor() {
    this.baseUrl = CHEMBL_API_BASE;
    this.species = 'Homo sapiens'; // Human
    this.targetCache = new Map(); // Gene symbol → ChEMBL target ID cache
  }

  /**
   * Get bioactive compounds that target a gene
   * @param {string} geneSymbol - Gene symbol (e.g., "TP53", "EGFR")
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Bioactive molecules with potency data
   */
  async getTargetCompounds(geneSymbol, options = {}) {
    const {
      maxPotency = 10000,      // Max IC50/Ki in nM (10μM default, lower = more potent)
      minActivity = 50,        // Min activity value (pChEMBL >= 5 = <10μM)
      limit = 20               // Max compounds to return
    } = options;

    try {
      // Step 1: Find ChEMBL target ID for the gene
      const targetId = await this.getTargetId(geneSymbol);

      if (!targetId) {
        return {
          gene: geneSymbol,
          compounds: [],
          totalCompounds: 0,
          error: 'Gene target not found in ChEMBL'
        };
      }

      // Step 2: Get bioactivity data for the target
      const activities = await this.getBioactivities(targetId, maxPotency, minActivity);

      // Step 3: Get compound details for top activities
      const compounds = await this.enrichCompoundData(activities.slice(0, limit));

      // Step 4: Format results
      const formattedCompounds = compounds.map(compound => ({
        chemblId: compound.molecule_chembl_id,
        name: compound.pref_name || 'Unnamed compound',
        maxPhase: compound.max_phase, // 0=research, 1-3=clinical, 4=approved
        phaseLabel: this.getPhaseLabel(compound.max_phase),
        molecularWeight: compound.molecule_properties?.mw_freebase,
        activityType: compound.activity_type, // IC50, Ki, EC50, etc.
        activityValue: compound.activity_value,
        activityUnits: compound.activity_units,
        pChEMBL: compound.pchembl_value, // Standardized potency (-log10 M)
        potency: this.getPotencyLabel(compound.pchembl_value),
        assayDescription: compound.assay_description,
        pubmedId: compound.document_chembl_id
      }));

      return {
        gene: geneSymbol,
        targetId,
        compounds: formattedCompounds,
        totalCompounds: activities.length,
        avgPotency: this.calculateAvgPotency(formattedCompounds),
        source: 'ChEMBL v33'
      };
    } catch (error) {
      console.error(`[ChEMBL] Failed to fetch compounds for ${geneSymbol}:`, error.message);
      return {
        gene: geneSymbol,
        compounds: [],
        totalCompounds: 0,
        error: error.message
      };
    }
  }

  /**
   * Get ChEMBL target ID for a gene symbol with caching and retry
   * @private
   */
  async getTargetId(geneSymbol) {
    // Check cache first
    if (this.targetCache.has(geneSymbol)) {
      console.log(`[ChEMBL] Cache hit for ${geneSymbol}`);
      return this.targetCache.get(geneSymbol);
    }

    try {
      // Try multiple search strategies with retry logic
      const targetId = await this.findTargetWithStrategies(geneSymbol);

      // Cache the result (even if null)
      this.targetCache.set(geneSymbol, targetId);

      return targetId;
    } catch (error) {
      console.error(`[ChEMBL] Target ID lookup failed for ${geneSymbol}:`, error.message);
      return null;
    }
  }

  /**
   * Try multiple search strategies to find ChEMBL target ID
   * @private
   */
  async findTargetWithStrategies(geneSymbol) {
    const strategies = [
      // Strategy 1: Exact gene symbol with organism
      () => this.searchTarget(geneSymbol, { target_organism: this.species }),

      // Strategy 2: Gene symbol with target type filter
      () => this.searchTarget(geneSymbol, { target_type: 'SINGLE PROTEIN' }),

      // Strategy 3: With "human" prefix
      () => this.searchTarget(`human ${geneSymbol}`),

      // Strategy 4: Simple search (no filters)
      () => this.searchTarget(geneSymbol)
    ];

    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`[ChEMBL] Trying strategy ${i + 1} for ${geneSymbol}...`);
        const targetId = await strategies[i]();
        if (targetId) {
          console.log(`[ChEMBL] Found target ${targetId} for ${geneSymbol} (strategy ${i + 1})`);
          return targetId;
        }
      } catch (error) {
        console.log(`[ChEMBL] Strategy ${i + 1} failed for ${geneSymbol}, trying next...`);
        continue;
      }
    }

    console.warn(`[ChEMBL] No target found for ${geneSymbol} after trying all strategies`);
    return null;
  }

  /**
   * Search for target with retry logic
   * @private
   */
  async searchTarget(query, filters = {}) {
    return await retryWithBackoff(async () => {
      const params = new URLSearchParams({ q: query, ...filters });
      const url = `${this.baseUrl}/target/search.json?${params}`;

      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`ChEMBL target search error: ${response.status}`);
      }

      const data = await response.json();
      const targets = data.targets || [];

      if (targets.length === 0) return null;

      // Find exact match by gene symbol
      const exactMatch = targets.find(t =>
        t.target_components?.some(comp =>
          comp.target_component_synonyms?.some(syn =>
            syn.component_synonym?.toUpperCase() === query.toUpperCase()
          )
        )
      );

      if (exactMatch) {
        return exactMatch.target_chembl_id;
      }

      // Return first result
      return targets[0]?.target_chembl_id || null;
    }, 3); // Max 3 retry attempts
  }

  /**
   * Get bioactivity data for a target with retry logic
   * @private
   */
  async getBioactivities(targetId, maxPotency, minActivity) {
    try {
      return await retryWithBackoff(async () => {
        // Query for activities with good potency (pChEMBL >= minActivity)
        const url = `${this.baseUrl}/activity.json?target_chembl_id=${targetId}&pchembl_value__gte=${minActivity / 10}&limit=100&offset=0`;
        const response = await fetchWithTimeout(url);

        if (!response.ok) {
          throw new Error(`ChEMBL activity search error: ${response.status}`);
        }

        const data = await response.json();
        const activities = data.activities || [];

        // Filter by max potency (IC50/Ki < maxPotency nM)
        return activities
          .filter(act => {
            const value = parseFloat(act.value);
            const units = act.units?.toLowerCase();

            // Convert to nM if needed
            let valueInNM = value;
            if (units === 'um') valueInNM = value * 1000;
            else if (units === 'mm') valueInNM = value * 1000000;
            else if (units === 'pm') valueInNM = value / 1000;

            return valueInNM <= maxPotency;
          })
          .sort((a, b) => {
            // Sort by pChEMBL (higher = more potent)
            const aVal = parseFloat(a.pchembl_value || 0);
            const bVal = parseFloat(b.pchembl_value || 0);
            return bVal - aVal;
          });
      }, 3); // Max 3 retry attempts
    } catch (error) {
      console.error(`[ChEMBL] Bioactivity fetch failed for ${targetId}:`, error.message);
      return [];
    }
  }

  /**
   * Enrich compound data with additional details (with retry logic)
   * @private
   */
  async enrichCompoundData(activities) {
    const enriched = [];

    for (const activity of activities) {
      try {
        const moleculeId = activity.molecule_chembl_id;

        // Use retry logic for molecule fetch
        const moleculeData = await retryWithBackoff(async () => {
          const url = `${this.baseUrl}/molecule/${moleculeId}.json`;
          const response = await fetchWithTimeout(url);

          if (!response.ok) {
            throw new Error(`Molecule fetch error: ${response.status}`);
          }

          return await response.json();
        }, 3);

        enriched.push({
          ...moleculeData,
          activity_type: activity.standard_type,
          activity_value: activity.value,
          activity_units: activity.units,
          pchembl_value: activity.pchembl_value,
          assay_description: activity.assay_description,
          document_chembl_id: activity.document_chembl_id
        });
      } catch (error) {
        // If molecule fetch fails after retries, use activity data only
        console.error(`[ChEMBL] Molecule enrichment failed for ${activity.molecule_chembl_id}:`, error.message);

        enriched.push({
          molecule_chembl_id: activity.molecule_chembl_id,
          pref_name: null,
          max_phase: -1,
          molecule_properties: null,
          activity_type: activity.standard_type,
          activity_value: activity.value,
          activity_units: activity.units,
          pchembl_value: activity.pchembl_value,
          assay_description: activity.assay_description,
          document_chembl_id: activity.document_chembl_id
        });
      }
    }

    return enriched;
  }

  /**
   * Get clinical phase label
   * @private
   */
  getPhaseLabel(phase) {
    const labels = {
      '-1': 'Unknown',
      '0': 'Preclinical',
      '0.5': 'Early Phase 1',
      '1': 'Phase 1',
      '2': 'Phase 2',
      '3': 'Phase 3',
      '4': 'FDA Approved'
    };
    return labels[String(phase)] || 'Unknown';
  }

  /**
   * Get potency label based on pChEMBL value
   * @private
   */
  getPotencyLabel(pchembl) {
    if (!pchembl) return 'unknown';
    const value = parseFloat(pchembl);

    if (value >= 9) return 'very high';    // <1 nM
    if (value >= 7) return 'high';         // 1-100 nM
    if (value >= 5) return 'moderate';     // 100 nM - 10 μM
    return 'low';                          // >10 μM
  }

  /**
   * Calculate average potency
   * @private
   */
  calculateAvgPotency(compounds) {
    const validPotencies = compounds
      .map(c => parseFloat(c.pChEMBL))
      .filter(p => !isNaN(p) && p > 0);

    if (validPotencies.length === 0) return 0;

    const avg = validPotencies.reduce((sum, p) => sum + p, 0) / validPotencies.length;
    return parseFloat(avg.toFixed(2));
  }

  /**
   * Get approved drugs for a gene target
   * @param {string} geneSymbol - Gene symbol
   * @returns {Promise<Object>} FDA-approved drugs only
   */
  async getApprovedDrugs(geneSymbol) {
    const result = await this.getTargetCompounds(geneSymbol, {
      maxPotency: 1000, // 1μM - tighter cutoff for approved drugs
      minActivity: 70,   // pChEMBL >= 7 (100nM)
      limit: 10
    });

    // Filter to only approved drugs (phase 4)
    const approvedDrugs = result.compounds.filter(c => c.maxPhase === 4);

    return {
      gene: geneSymbol,
      targetId: result.targetId,
      drugs: approvedDrugs,
      totalApproved: approvedDrugs.length,
      source: 'ChEMBL v33'
    };
  }

  /**
   * Search compounds by name or ChEMBL ID
   * @param {string} query - Compound name or ChEMBL ID
   * @returns {Promise<Array>} Matching compounds
   */
  async searchCompounds(query) {
    try {
      const url = `${this.baseUrl}/molecule/search.json?q=${encodeURIComponent(query)}&limit=10`;
      const response = await fetchWithTimeout(url);

      if (!response.ok) {
        throw new Error(`ChEMBL compound search error: ${response.status}`);
      }

      const data = await response.json();
      const molecules = data.molecules || [];

      return molecules.map(m => ({
        chemblId: m.molecule_chembl_id,
        name: m.pref_name,
        maxPhase: m.max_phase,
        phaseLabel: this.getPhaseLabel(m.max_phase),
        molecularWeight: m.molecule_properties?.mw_freebase,
        smiles: m.molecule_structures?.canonical_smiles
      }));
    } catch (error) {
      console.error(`[ChEMBL] Compound search failed for "${query}":`, error.message);
      return [];
    }
  }
}

// Export singleton instance
export const chemblClient = new ChemblClient();

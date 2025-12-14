/**
 * ClinVar Client - variant pathogenicity and clinical significance
 *
 * DATA SOURCE: NCBI ClinVar E-utilities API
 * - FREE, unlimited academic use
 * - Clinical interpretations of genetic variants
 * - Pathogenic/Benign/VUS classifications
 * - Links variants to diseases
 * - Expert-curated variant-disease relationships
 *
 * INTELLIGENCE VALUE:
 * - Identifies disease-causing variants in genes
 * - Reveals mechanisms: loss-of-function vs gain-of-function
 * - Complements Ensembl genomic data with clinical significance
 * - Enables precision medicine insights
 *
 * API: https://www.ncbi.nlm.nih.gov/clinvar/docs/help/
 */

export class ClinvarClient {
  constructor() {
    this.baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    this.apiKey = process.env.NCBI_API_KEY || '';
    this.rateLimit = this.apiKey ? 10 : 3; // requests/second
  }

  /**
   * Get pathogenic variants for a gene
   * @param {string} geneSymbol - Gene symbol (e.g., "BRCA1")
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Pathogenic variants with clinical significance
   */
  async getPathogenicVariants(geneSymbol, options = {}) {
    const {
      minSignificance = 'likely_pathogenic', // pathogenic, likely_pathogenic, uncertain
      maxResults = 50,
      includeVUS = false // Include Variants of Uncertain Significance
    } = options;

    try {
      console.log(`[ClinVar] Fetching pathogenic variants for ${geneSymbol}...`);

      // PHASE 1: Search ClinVar for gene variants
      const searchIds = await this.searchVariants(geneSymbol, minSignificance, includeVUS);

      if (!searchIds || searchIds.length === 0) {
        return {
          gene: geneSymbol,
          variants: [],
          totalVariants: 0,
          message: 'No pathogenic variants found'
        };
      }

      // PHASE 2: Fetch detailed variant information
      const variants = await this.fetchVariantDetails(searchIds.slice(0, maxResults));

      // Filter and format variants
      const formattedVariants = variants
        .filter(v => v && v.clinicalSignificance)
        .map(v => ({
          variantId: v.id,
          name: v.name,
          hgvs: v.hgvs,
          clinicalSignificance: v.clinicalSignificance,
          reviewStatus: v.reviewStatus,
          conditions: v.conditions,
          molecularConsequence: v.molecularConsequence,
          alleleFrequency: v.alleleFrequency,
          submitters: v.submitters
        }));

      // Calculate statistics
      const pathogenic = formattedVariants.filter(v =>
        v.clinicalSignificance.toLowerCase().includes('pathogenic')
      ).length;

      const benign = formattedVariants.filter(v =>
        v.clinicalSignificance.toLowerCase().includes('benign')
      ).length;

      const vus = formattedVariants.filter(v =>
        v.clinicalSignificance.toLowerCase().includes('uncertain')
      ).length;

      return {
        gene: geneSymbol,
        variants: formattedVariants,
        totalVariants: formattedVariants.length,
        stats: {
          pathogenic,
          likelyPathogenic: formattedVariants.filter(v =>
            v.clinicalSignificance.toLowerCase() === 'likely pathogenic'
          ).length,
          benign,
          likelyBenign: formattedVariants.filter(v =>
            v.clinicalSignificance.toLowerCase() === 'likely benign'
          ).length,
          vus,
          reviewed: formattedVariants.filter(v =>
            v.reviewStatus && v.reviewStatus.includes('reviewed')
          ).length
        },
        source: 'ClinVar'
      };

    } catch (error) {
      console.error(`[ClinVar] Error fetching ${geneSymbol}:`, error.message);
      return {
        error: error.message,
        gene: geneSymbol
      };
    }
  }

  /**
   * Search ClinVar for variant IDs
   * @private
   */
  async searchVariants(geneSymbol, minSignificance, includeVUS) {
    try {
      // Build search query
      let query = `${geneSymbol}[gene]`;

      // Filter by clinical significance
      if (!includeVUS) {
        query += ' AND (pathogenic[CLNSIG] OR likely pathogenic[CLNSIG])';
      } else {
        query += ' AND (pathogenic[CLNSIG] OR likely pathogenic[CLNSIG] OR uncertain significance[CLNSIG])';
      }

      const params = new URLSearchParams({
        db: 'clinvar',
        term: query,
        retmax: '200', // Max results
        retmode: 'json'
      });

      if (this.apiKey) {
        params.append('api_key', this.apiKey);
      }

      const url = `${this.baseUrl}/esearch.fcgi?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const ids = data.esearchresult?.idlist || [];

      console.log(`[ClinVar] Found ${ids.length} variants for ${geneSymbol}`);
      return ids;

    } catch (error) {
      console.error(`[ClinVar] Search error for ${geneSymbol}:`, error.message);
      return [];
    }
  }

  /**
   * Fetch detailed variant information
   * @private
   */
  async fetchVariantDetails(variantIds) {
    if (!variantIds || variantIds.length === 0) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        db: 'clinvar',
        id: variantIds.join(','),
        retmode: 'xml'
      });

      if (this.apiKey) {
        params.append('api_key', this.apiKey);
      }

      const url = `${this.baseUrl}/esummary.fcgi?${params}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const xmlText = await response.text();

      // Parse XML to extract variant details
      const variants = this.parseVariantXML(xmlText);

      return variants;

    } catch (error) {
      console.error('[ClinVar] Variant details fetch error:', error.message);
      return [];
    }
  }

  /**
   * Parse ClinVar XML response
   * @private
   */
  parseVariantXML(xmlText) {
    const variants = [];

    try {
      // Extract variant data from XML using regex (lightweight parsing)
      // In production, use a proper XML parser like 'fast-xml-parser'

      const docSumMatches = xmlText.matchAll(/<DocumentSummary[^>]*>(.*?)<\/DocumentSummary>/gs);

      for (const match of docSumMatches) {
        const docSum = match[1];

        // Extract fields
        const id = this.extractXMLField(docSum, 'uid');
        const title = this.extractXMLField(docSum, 'title');
        const clinicalSignificance = this.extractXMLField(docSum, 'clinical_significance');
        const reviewStatus = this.extractXMLField(docSum, 'review_status');
        const conditions = this.extractXMLField(docSum, 'trait_set');

        if (id && clinicalSignificance) {
          variants.push({
            id,
            name: title || `Variant ${id}`,
            hgvs: this.extractHGVS(title),
            clinicalSignificance: clinicalSignificance,
            reviewStatus: reviewStatus || 'not reviewed',
            conditions: conditions || 'Unknown',
            molecularConsequence: this.inferConsequence(title, clinicalSignificance),
            alleleFrequency: null, // Not in summary
            submitters: 1 // Simplified
          });
        }
      }

    } catch (error) {
      console.error('[ClinVar] XML parsing error:', error.message);
    }

    return variants;
  }

  /**
   * Extract field from XML
   * @private
   */
  extractXMLField(xml, fieldName) {
    const regex = new RegExp(`<${fieldName}[^>]*>(.+?)<\/${fieldName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].replace(/<[^>]+>/g, '') : null;
  }

  /**
   * Extract HGVS notation from variant title
   * @private
   */
  extractHGVS(title) {
    if (!title) return null;

    // Look for HGVS patterns like c.123A>G or p.Arg123Gln
    const hgvsMatch = title.match(/(c\.[^\s]+|p\.[^\s]+)/);
    return hgvsMatch ? hgvsMatch[1] : title;
  }

  /**
   * Infer molecular consequence from clinical significance
   * @private
   */
  inferConsequence(title, significance) {
    if (!title) return 'unknown';

    const lowerTitle = title.toLowerCase();

    if (lowerTitle.includes('nonsense') || lowerTitle.includes('frameshift')) {
      return 'loss-of-function';
    } else if (lowerTitle.includes('missense')) {
      return 'missense';
    } else if (lowerTitle.includes('splice')) {
      return 'splice-affecting';
    } else if (lowerTitle.includes('deletion') || lowerTitle.includes('duplication')) {
      return 'structural';
    }

    return 'unknown';
  }

  /**
   * Batch fetch variants for multiple genes
   */
  async getMultipleGenes(geneSymbols, options = {}) {
    console.log(`[ClinVar] Fetching variants for ${geneSymbols.length} genes...`);
    const startTime = Date.now();

    // Respect rate limits (3 req/sec without key, 10 req/sec with key)
    const batchSize = this.rateLimit;
    const delayMs = 1100; // Slightly over 1 second for safety

    const results = [];
    for (let i = 0; i < geneSymbols.length; i += batchSize) {
      const batch = geneSymbols.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(gene => this.getPathogenicVariants(gene, options))
      );

      results.push(...batchResults);

      // Delay between batches (except for last batch)
      if (i + batchSize < geneSymbols.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const fetchTime = Date.now() - startTime;
    const successful = results.filter(r => !r.error).length;
    console.log(`[ClinVar] Fetched ${successful}/${results.length} genes in ${fetchTime}ms`);

    return results;
  }
}

// Export singleton instance
export const clinvarClient = new ClinvarClient();

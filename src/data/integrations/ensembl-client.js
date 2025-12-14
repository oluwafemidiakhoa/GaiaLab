/**
 * Ensembl Client - genomic coordinates, transcripts, and variants
 *
 * DATA SOURCE: Ensembl REST API (https://rest.ensembl.org)
 * - FREE, unlimited academic use
 * - Genomic coordinates (chromosome, start, end)
 * - Transcript isoforms with expression patterns
 * - Variant data (SNPs, structural variants)
 * - Cross-species comparative genomics
 *
 * INTELLIGENCE VALUE:
 * - Maps genes to precise genomic locations
 * - Reveals alternative splicing complexity
 * - Identifies disease-associated variants
 * - Enables genomic context for multi-gene analyses
 */

export class EnsemblClient {
  constructor() {
    this.baseUrl = 'https://rest.ensembl.org';
    this.species = 'homo_sapiens';
  }

  /**
   * Get comprehensive genomic data for a gene
   * @param {string} geneSymbol - Gene symbol (e.g., "BRCA1")
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Genomic coordinates, transcripts, variants
   */
  async getGeneData(geneSymbol, options = {}) {
    const {
      includeTranscripts = true,
      includeVariants = false, // Variants are slow, disabled by default
      maxVariants = 100
    } = options;

    try {
      console.log(`[Ensembl] Fetching genomic data for ${geneSymbol}...`);

      // PHASE 1: Lookup gene to get stable ID
      const geneId = await this.lookupSymbol(geneSymbol);
      if (!geneId) {
        return {
          error: `Gene symbol not found in Ensembl: ${geneSymbol}`,
          gene: geneSymbol
        };
      }

      // PHASE 2: Get detailed gene info in parallel
      const promises = [
        this.getGeneInfo(geneId)
      ];

      if (includeTranscripts) {
        promises.push(this.getTranscripts(geneId));
      }

      if (includeVariants) {
        promises.push(this.getVariants(geneId, maxVariants));
      }

      const results = await Promise.all(promises);
      const geneInfo = results[0];
      const transcripts = includeTranscripts ? results[1] : [];
      const variants = includeVariants ? results[2] : [];

      return {
        gene: geneSymbol,
        ensemblId: geneId,
        location: {
          chromosome: geneInfo.seq_region_name,
          start: geneInfo.start,
          end: geneInfo.end,
          strand: geneInfo.strand === 1 ? '+' : '-',
          assembly: geneInfo.assembly_name
        },
        description: geneInfo.description,
        biotype: geneInfo.biotype, // protein_coding, lncRNA, etc.
        transcripts: transcripts.map(t => ({
          id: t.id,
          length: t.length,
          biotype: t.biotype,
          isCanonical: t.is_canonical === 1,
          translationLength: t.Translation?.length || null,
          proteinId: t.Translation?.id || null
        })),
        stats: {
          totalTranscripts: transcripts.length,
          canonicalTranscript: transcripts.find(t => t.is_canonical === 1)?.id,
          longestTranscript: transcripts.reduce((max, t) =>
            t.length > (max?.length || 0) ? t : max, null)?.id,
          proteinCodingTranscripts: transcripts.filter(t => t.biotype === 'protein_coding').length
        },
        variants: variants.slice(0, maxVariants),
        variantCount: variants.length,
        source: 'Ensembl'
      };

    } catch (error) {
      console.error(`[Ensembl] Error fetching ${geneSymbol}:`, error.message);
      return {
        error: error.message,
        gene: geneSymbol
      };
    }
  }

  /**
   * Lookup gene symbol to get stable Ensembl ID
   * @private
   */
  async lookupSymbol(geneSymbol) {
    try {
      const url = `${this.baseUrl}/lookup/symbol/${this.species}/${geneSymbol}?content-type=application/json`;

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 400 || response.status === 404) {
          console.warn(`[Ensembl] Gene symbol not found: ${geneSymbol}`);
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.id; // Ensembl stable ID (e.g., ENSG00000139618)
    } catch (error) {
      console.error(`[Ensembl] Lookup error for ${geneSymbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get detailed gene information
   * @private
   */
  async getGeneInfo(ensemblId) {
    const url = `${this.baseUrl}/lookup/id/${ensemblId}?content-type=application/json;expand=1`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get all transcripts for a gene
   * @private
   */
  async getTranscripts(ensemblId) {
    try {
      const url = `${this.baseUrl}/lookup/id/${ensemblId}?content-type=application/json;expand=1`;

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return data.Transcript || [];
    } catch (error) {
      console.error(`[Ensembl] Transcript fetch error:`, error.message);
      return [];
    }
  }

  /**
   * Get variants associated with a gene
   * NOTE: This can be slow for genes with many variants
   * @private
   */
  async getVariants(ensemblId, maxVariants = 100) {
    try {
      // Get variants overlapping gene region
      const url = `${this.baseUrl}/overlap/id/${ensemblId}?feature=variation;content-type=application/json`;

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 400) {
          console.warn(`[Ensembl] No variants found for ${ensemblId}`);
          return [];
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const variants = await response.json();

      // Filter and format variants
      return variants
        .filter(v => v.source === 'dbSNP') // Focus on validated SNPs
        .slice(0, maxVariants)
        .map(v => ({
          id: v.id, // rs number
          location: `${v.seq_region_name}:${v.start}-${v.end}`,
          alleles: v.alt_alleles,
          consequenceType: v.consequence_type,
          clinicalSignificance: v.clinical_significance || 'unknown'
        }));
    } catch (error) {
      console.error(`[Ensembl] Variant fetch error:`, error.message);
      return [];
    }
  }

  /**
   * Get gene homologs across species (comparative genomics)
   * Useful for evolutionary conservation analysis
   */
  async getHomologs(ensemblId, targetSpecies = ['mus_musculus', 'rattus_norvegicus']) {
    try {
      const url = `${this.baseUrl}/homology/id/${ensemblId}?content-type=application/json;target_species=${targetSpecies.join(';target_species=')}`;

      const response = await fetch(url, {
        headers: { 'Accept': 'application/json' }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      // Extract homologs
      const homologs = [];
      if (data.data && data.data[0]?.homologies) {
        for (const homology of data.data[0].homologies) {
          homologs.push({
            species: homology.target.species,
            geneId: homology.target.id,
            protein_id: homology.target.protein_id,
            type: homology.type, // ortholog_one2one, etc.
            identity: homology.target.perc_id,
            similarity: homology.target.perc_pos
          });
        }
      }

      return homologs;
    } catch (error) {
      console.error(`[Ensembl] Homolog fetch error:`, error.message);
      return [];
    }
  }

  /**
   * Batch fetch gene data for multiple genes
   * Uses rate limiting to respect Ensembl's fair use policy
   */
  async getMultipleGenes(geneSymbols, options = {}) {
    console.log(`[Ensembl] Fetching genomic data for ${geneSymbols.length} genes...`);
    const startTime = Date.now();

    // Ensembl recommends max 15 requests/sec
    // We'll be conservative: fetch in batches with delays
    const batchSize = 10;
    const delayMs = 700; // ~14 requests/sec with overhead

    const results = [];
    for (let i = 0; i < geneSymbols.length; i += batchSize) {
      const batch = geneSymbols.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map(gene => this.getGeneData(gene, options))
      );

      results.push(...batchResults);

      // Delay between batches (except for last batch)
      if (i + batchSize < geneSymbols.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const fetchTime = Date.now() - startTime;
    console.log(`[Ensembl] Fetched ${results.length} genes in ${fetchTime}ms`);

    return results;
  }
}

// Export singleton instance
export const ensemblClient = new EnsemblClient();

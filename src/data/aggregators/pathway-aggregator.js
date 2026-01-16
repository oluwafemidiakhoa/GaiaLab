import { keggClient } from '../integrations/kegg-client.js';
import { reactomeClient } from '../integrations/reactome-client.js';
import * as stats from 'simple-statistics';

/**
 * Pathway Aggregator with statistical enrichment analysis
 * Performs Fisher's exact test to identify significantly enriched pathways
 */
export class PathwayAggregator {
  constructor() {
    this.kegg = keggClient;
    this.reactome = reactomeClient;
    // Approximate human genome: 20,000 protein-coding genes
    this.totalGenesInGenome = 20000;
    this.canonicalTagRules = [
      { tag: 'dna repair', patterns: [/dna repair/i, /base excision/i, /nucleotide excision/i, /homologous recombination/i, /double[- ]strand/i, /non[- ]homologous/i, /mismatch repair/i, /fanconi/i] },
      { tag: 'cell cycle', patterns: [/cell cycle/i, /mitotic/i, /checkpoint/i, /cyclin/i, /\bcdk\b/i] },
      { tag: 'p53', patterns: [/p53/i] },
      { tag: 'apoptosis', patterns: [/apoptosis/i, /programmed cell death/i] },
      { tag: 'immune', patterns: [/immune/i, /t[- ]cell/i, /b[- ]cell/i, /interferon/i, /cytokine/i, /antigen/i, /innate/i, /adaptive/i] },
      { tag: 'inflammation', patterns: [/inflamm/i, /nf[- ]?kappa/i, /\btnf\b/i, /interleukin/i, /\bil-?\d+/i, /chemokine/i] },
      { tag: 'metabolic', patterns: [/metabol/i, /glycolysis/i, /gluconeogenesis/i, /glucose/i, /lipid/i, /fatty acid/i, /beta-oxidation/i, /tca/i, /krebs/i, /citric acid/i, /insulin/i, /oxidative phosphorylation/i] },
      { tag: 'mitochondrial', patterns: [/mitochond/i, /oxidative phosphorylation/i, /electron transport/i, /respiratory chain/i] },
      { tag: 'autophagy', patterns: [/autophagy/i, /lysosom/i, /mitophagy/i] },
      { tag: 'synaptic', patterns: [/synapse/i, /synaptic/i, /neurotrans/i] },
      { tag: 'amyloid', patterns: [/amyloid/i, /secretase/i, /\bapp\b/i] },
      { tag: 'tau', patterns: [/\btau\b/i, /microtubule/i] },
      { tag: 'synuclein', patterns: [/synuclein/i] },
      { tag: 'epigenetic', patterns: [/epigenetic/i, /methylation/i, /chromatin/i, /histone/i, /acetylation/i] },
      { tag: 'angiogenesis', patterns: [/angiogenesis/i, /\bvegf\b/i] },
      { tag: 'growth factor', patterns: [/\begfr\b/i, /\bpdgf\b/i, /\bfgf\b/i, /\btgf\b/i, /\berbb\b/i] },
      { tag: 'pi3k-akt', patterns: [/pi3k/i, /\bakt\b/i, /\bmtor\b/i] },
      { tag: 'ras-mapk', patterns: [/\bras\b/i, /\bmapk\b/i, /\berk\b/i, /\bmek\b/i] }
    ];
  }

  /**
   * Get enriched pathways for a list of genes
   * @param {Array<string>} geneList - Array of gene symbols
   * @returns {Promise<Array>} Enriched pathways with p-values
   */
  async enrichPathways(geneList) {
    if (!geneList || geneList.length === 0) {
      return [];
    }

    try {
      // Get pathways from KEGG + Reactome in parallel
      const [keggPathways, reactomePathways] = await Promise.all([
        this.kegg.getEnrichedPathways(geneList),
        this.fetchReactomePathways(geneList)
      ]);

      const combinedPathways = this.mergePathways(keggPathways, reactomePathways);

      // Calculate statistical enrichment
      const enrichedPathways = this.calculateEnrichment(geneList, combinedPathways);

      // Sort by p-value (most significant first)
      enrichedPathways.sort((a, b) => a.pvalue - b.pvalue);

      // Return top 20 pathways
      return enrichedPathways.slice(0, 20);
    } catch (error) {
      console.error('Pathway enrichment error:', error.message);
      return [];
    }
  }

  /**
   * Calculate pathway enrichment using hypergeometric test
   * (approximation of Fisher's exact test for pathway analysis)
   * @private
   */
  calculateEnrichment(inputGenes, pathways) {
    const inputGeneCount = inputGenes.length;

    return pathways.map(pathway => {
      const pathwayGeneCount = pathway.totalPathwayGenes || pathway.geneCount || 100; // Default if unknown
      const overlap = pathway.inputGeneCount || pathway.inputGenes?.length || 1;

      // Hypergeometric test parameters:
      // - Total genes in genome: ~20,000
      // - Genes in pathway: pathwayGeneCount
      // - Input genes: inputGeneCount
      // - Overlap: overlap (genes both in input and pathway)

      const pvalue = this.hypergeometricTest({
        totalGenes: this.totalGenesInGenome,
        pathwaySize: pathwayGeneCount,
        sampleSize: inputGeneCount,
        overlap: overlap
      });

      // Calculate fold enrichment
      const expectedOverlap = (pathwayGeneCount * inputGeneCount) / this.totalGenesInGenome;
      const foldEnrichment = expectedOverlap > 0 ? overlap / expectedOverlap : 1.0;

      // Enrichment score (0-1, where 1 is most enriched)
      const enrichmentScore = Math.min(1.0, foldEnrichment * (1 - pvalue));

      return {
        id: pathway.id,
        name: pathway.name,
        category: pathway.category || 'Unknown',
        canonicalTags: this.deriveCanonicalTags(pathway),
        pvalue,
        foldEnrichment,
        enrichmentScore,
        genesInPathway: pathway.inputGenes || [],
        geneCount: overlap,
        totalPathwayGenes: pathwayGeneCount,
        description: pathway.description || '',
        source: pathway.source || 'KEGG',
        significance: pvalue < 0.05 ? 'significant' : 'not significant'
      };
    });
  }

  deriveCanonicalTags(pathway) {
    const text = `${pathway?.name || ''} ${pathway?.description || ''} ${pathway?.category || ''}`.toLowerCase();
    const tags = new Set();

    this.canonicalTagRules.forEach(rule => {
      if (rule.patterns.some(pattern => pattern.test(text))) {
        tags.add(rule.tag);
      }
    });

    if ((pathway?.category || '').toLowerCase().includes('metabolism')) {
      tags.add('metabolic');
    }

    return Array.from(tags);
  }

  async fetchReactomePathways(geneList) {
    const pathwayMap = new Map();
    const results = await Promise.all(
      geneList.map(gene => this.reactome.getPathwaysForGene(gene, { maxResults: 15 }))
    );

    for (let i = 0; i < geneList.length; i++) {
      const gene = geneList[i];
      const result = results[i];
      const pathways = result?.pathways || [];

      for (const pathway of pathways) {
        if (!pathwayMap.has(pathway.id)) {
          pathwayMap.set(pathway.id, {
            id: pathway.id,
            name: pathway.name,
            category: 'Reactome',
            description: pathway.name,
            source: pathway.source,
            inputGenes: [],
            inputGeneCount: 0,
            totalPathwayGenes: 150
          });
        }

        const entry = pathwayMap.get(pathway.id);
        entry.inputGenes.push(gene);
        entry.inputGeneCount += 1;
      }
    }

    return Array.from(pathwayMap.values());
  }

  mergePathways(keggPathways, reactomePathways) {
    const combined = new Map();

    for (const pathway of [...(keggPathways || []), ...(reactomePathways || [])]) {
      const key = pathway.id || pathway.name;
      if (!combined.has(key)) {
        combined.set(key, { ...pathway });
        continue;
      }

      const existing = combined.get(key);
      const existingGenes = new Set(existing.inputGenes || []);
      (pathway.inputGenes || []).forEach(gene => existingGenes.add(gene));
      existing.inputGenes = Array.from(existingGenes);
      existing.inputGeneCount = existing.inputGenes.length;
      existing.source = [existing.source, pathway.source].filter(Boolean).join(' + ');
      combined.set(key, existing);
    }

    return Array.from(combined.values());
  }

  /**
   * Hypergeometric test (approximation of Fisher's exact test)
   * Calculates probability of observing this many overlapping genes by chance
   * @private
   */
  hypergeometricTest({ totalGenes, pathwaySize, sampleSize, overlap }) {
    // P-value = probability of seeing >= overlap genes by random chance
    // Using hypergeometric distribution:
    // P(X >= k) where X ~ Hypergeometric(N, K, n)
    // N = total genes, K = pathway size, n = sample size, k = overlap

    // For simplicity, using binomial approximation
    // (exact hypergeometric requires complex libraries)

    const expectedProportion = pathwaySize / totalGenes;
    const pSuccess = expectedProportion;

    // Binomial test: P(X >= overlap) where X ~ Binomial(n, p)
    let pvalue = 0;
    for (let k = overlap; k <= sampleSize; k++) {
      pvalue += this.binomialProbability(sampleSize, k, pSuccess);
    }

    // Clamp to [0, 1]
    return Math.max(0, Math.min(1, pvalue));
  }

  /**
   * Calculate binomial probability
   * @private
   */
  binomialProbability(n, k, p) {
    const coefficient = this.binomialCoefficient(n, k);
    return coefficient * Math.pow(p, k) * Math.pow(1 - p, n - k);
  }

  /**
   * Calculate binomial coefficient (n choose k)
   * @private
   */
  binomialCoefficient(n, k) {
    if (k < 0 || k > n) return 0;
    if (k === 0 || k === n) return 1;

    // Optimize by using smaller k
    k = Math.min(k, n - k);

    let result = 1;
    for (let i = 0; i < k; i++) {
      result *= (n - i);
      result /= (i + 1);
    }

    return result;
  }

  /**
   * Get pathway categories ranked by enrichment
   * @param {Array} enrichedPathways - Output from enrichPathways()
   * @returns {Array} Category summaries
   */
  summarizeByCategory(enrichedPathways) {
    const categoryMap = new Map();

    for (const pathway of enrichedPathways) {
      const category = pathway.category || 'Other';

      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          pathwayCount: 0,
          avgPvalue: 0,
          topPathways: []
        });
      }

      const cat = categoryMap.get(category);
      cat.pathwayCount++;
      cat.avgPvalue += pathway.pvalue;
      cat.topPathways.push(pathway.name);
    }

    const categories = Array.from(categoryMap.values());

    // Calculate average p-values
    for (const cat of categories) {
      cat.avgPvalue /= cat.pathwayCount;
      cat.topPathways = cat.topPathways.slice(0, 3); // Top 3 per category
    }

    // Sort by average p-value
    categories.sort((a, b) => a.avgPvalue - b.avgPvalue);

    return categories;
  }

  /**
   * Filter pathways by significance threshold
   * @param {Array} pathways - Enriched pathways
   * @param {number} threshold - P-value threshold (default: 0.05)
   * @returns {Array} Significant pathways only
   */
  filterSignificant(pathways, threshold = 0.05) {
    return pathways.filter(p => p.pvalue < threshold);
  }
}

// Export singleton instance
export const pathwayAggregator = new PathwayAggregator();

import { uniprotClient } from '../integrations/uniprot-client.js';
import { goClient } from '../integrations/go-client.js';
import { ensemblClient } from '../integrations/ensembl-client.js';
import { clinvarClient } from '../integrations/clinvar-client.js';

/**
 * Gene Aggregator - consolidates gene data from multiple sources
 *
 * MULTI-SOURCE INTELLIGENCE:
 * - UniProt: Protein function, expression, structure
 * - Gene Ontology: Standardized functional annotations (BP/MF/CC)
 * - Ensembl: Genomic coordinates, transcripts, variants
 * - ClinVar: Pathogenic variants with clinical significance
 *
 * Four-layer synthesis: Genomic → Clinical → Protein → Functional
 */
export class GeneAggregator {
  constructor() {
    this.uniprot = uniprotClient;
    this.go = goClient;
    this.ensembl = ensemblClient;
    this.clinvar = clinvarClient;
  }

  /**
   * Fetch comprehensive gene data from multiple sources
   * FOUR-LAYER SYNTHESIS: Genomic (Ensembl) + Clinical (ClinVar) + Protein (UniProt) + Functional (GO)
   * @param {Array<string>} geneSymbols - Array of gene symbols
   * @returns {Promise<Array>} Array of enriched gene data objects
   */
  async fetchGeneData(geneSymbols) {
    if (!geneSymbols || geneSymbols.length === 0) {
      return [];
    }

    try {
      console.log(`[Gene Aggregator] Fetching data for ${geneSymbols.length} genes from Ensembl + ClinVar + UniProt + GO...`);
      const startTime = Date.now();

      // PARALLEL FETCH: 4 sources simultaneously
      const [ensemblData, clinvarData, uniprotData, goAnnotationsArray] = await Promise.all([
        this.ensembl.getMultipleGenes(geneSymbols, {
          includeTranscripts: true,
          includeVariants: false // Disabled for speed
        }),
        this.clinvar.getMultipleGenes(geneSymbols, {
          maxResults: 20,
          includeVUS: false // Only pathogenic/likely pathogenic
        }),
        this.uniprot.getMultipleGenes(geneSymbols),
        Promise.all(geneSymbols.map(gene => this.go.getGeneAnnotations(gene, {
          aspect: 'all',
          maxResults: 50
        })))
      ]);

      const fetchTime = Date.now() - startTime;
      console.log(`[Gene Aggregator] Fetched gene data in ${fetchTime}ms`);

      // Create maps for quick lookup
      const ensemblMap = new Map();
      for (const gene of ensemblData) {
        if (!gene.error) {
          ensemblMap.set(gene.gene.toUpperCase(), gene);
        }
      }

      const clinvarMap = new Map();
      for (const gene of clinvarData) {
        if (!gene.error && gene.variants) {
          clinvarMap.set(gene.gene.toUpperCase(), gene);
        }
      }

      const uniprotMap = new Map();
      for (const gene of uniprotData) {
        uniprotMap.set(gene.symbol.toUpperCase(), gene);
      }

      const goMap = new Map();
      for (const goResult of goAnnotationsArray) {
        if (!goResult.error && goResult.annotations) {
          goMap.set(goResult.gene.toUpperCase(), goResult);
        }
      }

      // MERGE: Combine Ensembl + ClinVar + UniProt + GO data for each gene
      const consolidatedGenes = geneSymbols.map((symbol, index) => {
        const normalizedSymbol = symbol.toUpperCase();
        const ensemblInfo = ensemblMap.get(normalizedSymbol);
        const clinvarInfo = clinvarMap.get(normalizedSymbol);
        const uniprotInfo = uniprotMap.get(normalizedSymbol);
        const goInfo = goMap.get(normalizedSymbol);

        if (uniprotInfo) {
          return {
            ...uniprotInfo,
            centrality: this.calculateCentrality(index, geneSymbols.length),
            importanceScore: Math.max(0.3, 0.95 - index * 0.08),
            // Add genomic coordinates from Ensembl
            genomicLocation: ensemblInfo ? {
              chromosome: ensemblInfo.location?.chromosome,
              start: ensemblInfo.location?.start,
              end: ensemblInfo.location?.end,
              strand: ensemblInfo.location?.strand,
              assembly: ensemblInfo.location?.assembly,
              ensemblId: ensemblInfo.ensemblId,
              transcriptCount: ensemblInfo.stats?.totalTranscripts || 0,
              canonicalTranscript: ensemblInfo.stats?.canonicalTranscript,
              source: 'Ensembl'
            } : null,
            // Add pathogenic variants from ClinVar
            pathogenicVariants: clinvarInfo ? {
              totalVariants: clinvarInfo.totalVariants,
              pathogenic: clinvarInfo.stats?.pathogenic || 0,
              likelyPathogenic: clinvarInfo.stats?.likelyPathogenic || 0,
              reviewed: clinvarInfo.stats?.reviewed || 0,
              topVariants: clinvarInfo.variants?.slice(0, 5) || [],
              hasPathogenic: (clinvarInfo.stats?.pathogenic || 0) > 0,
              source: 'ClinVar'
            } : null,
            // Add GO annotations
            goAnnotations: goInfo ? {
              totalAnnotations: goInfo.totalAnnotations,
              biologicalProcesses: goInfo.summary?.topProcesses || [],
              molecularFunctions: goInfo.summary?.topFunctions || [],
              cellularComponents: goInfo.summary?.topComponents || [],
              experimentalEvidence: goInfo.summary?.experimentalEvidence || 0,
              source: 'Gene Ontology'
            } : null
          };
        }

        // Fallback for genes not found in UniProt
        return {
          symbol: normalizedSymbol,
          name: ensemblInfo?.description || 'Data not available',
          function: 'Function not well characterized in databases',
          tissueExpression: 'Expression pattern not available',
          biologicalProcesses: goInfo?.summary?.topProcesses || [],
          molecularFunctions: goInfo?.summary?.topFunctions || [],
          source: ensemblInfo ? 'Ensembl + ClinVar + GO' : (goInfo ? 'Gene Ontology' : 'Unknown'),
          centrality: this.calculateCentrality(index, geneSymbols.length),
          importanceScore: Math.max(0.3, 0.95 - index * 0.08),
          dataAvailable: !!(ensemblInfo || clinvarInfo || goInfo),
          genomicLocation: ensemblInfo ? {
            chromosome: ensemblInfo.location?.chromosome,
            start: ensemblInfo.location?.start,
            end: ensemblInfo.location?.end,
            strand: ensemblInfo.location?.strand,
            assembly: ensemblInfo.location?.assembly,
            ensemblId: ensemblInfo.ensemblId,
            transcriptCount: ensemblInfo.stats?.totalTranscripts || 0,
            canonicalTranscript: ensemblInfo.stats?.canonicalTranscript,
            source: 'Ensembl'
          } : null,
          pathogenicVariants: clinvarInfo ? {
            totalVariants: clinvarInfo.totalVariants,
            pathogenic: clinvarInfo.stats?.pathogenic || 0,
            likelyPathogenic: clinvarInfo.stats?.likelyPathogenic || 0,
            reviewed: clinvarInfo.stats?.reviewed || 0,
            topVariants: clinvarInfo.variants?.slice(0, 5) || [],
            hasPathogenic: (clinvarInfo.stats?.pathogenic || 0) > 0,
            source: 'ClinVar'
          } : null,
          goAnnotations: goInfo ? {
            totalAnnotations: goInfo.totalAnnotations,
            biologicalProcesses: goInfo.summary?.topProcesses || [],
            molecularFunctions: goInfo.summary?.topFunctions || [],
            cellularComponents: goInfo.summary?.topComponents || [],
            experimentalEvidence: goInfo.summary?.experimentalEvidence || 0,
            source: 'Gene Ontology'
          } : null
        };
      });

      return consolidatedGenes;
    } catch (error) {
      console.error('[Gene Aggregator] Error:', error.message);
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

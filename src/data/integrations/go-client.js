/**
 * Gene Ontology (GO) API Client - Functional Annotations
 *
 * Gene Ontology Consortium provides standardized annotations for:
 * - Biological Processes (BP): cellular senescence, DNA repair, etc.
 * - Molecular Functions (MF): protein binding, kinase activity, etc.
 * - Cellular Components (CC): nucleus, mitochondrion, etc.
 *
 * KEY FEATURES:
 * - 100% FREE, unlimited API access
 * - Standardized ontology terms across all species
 * - Evidence codes for annotation quality
 * - Cross-species functional conservation
 *
 * API Documentation: http://api.geneontology.org/api
 *
 * @author Oluwafemi Idiakhoa
 */

const GO_API_BASE = 'http://api.geneontology.org/api';

/**
 * Gene Ontology API Client
 * Provides standardized functional annotations
 */
export class GoClient {
  constructor() {
    this.baseUrl = GO_API_BASE;
    this.taxonId = 'NCBITaxon:9606'; // Homo sapiens
  }

  /**
   * Get GO annotations for a gene
   * @param {string} geneSymbol - Gene symbol (e.g., "TP53", "BRCA1")
   * @param {Object} options - Query options
   * @returns {Promise<Object>} GO annotations with evidence codes
   */
  async getGeneAnnotations(geneSymbol, options = {}) {
    const {
      aspect = 'all',           // 'biological_process', 'molecular_function', 'cellular_component', or 'all'
      evidenceFilter = null,    // Filter by evidence code (e.g., 'EXP' for experimental)
      maxResults = 100          // Max annotations to return
    } = options;

    try {
      // Step 1: Search for gene to get ID
      const geneId = await this.searchGene(geneSymbol);

      if (!geneId) {
        return {
          gene: geneSymbol,
          annotations: [],
          totalAnnotations: 0,
          error: 'Gene not found in Gene Ontology'
        };
      }

      // Step 2: Get bioentity annotations
      const url = `${this.baseUrl}/bioentity/gene/${geneId}/function`;
      const params = new URLSearchParams({
        rows: maxResults.toString()
      });

      if (aspect !== 'all') {
        params.append('aspect', aspect);
      }

      const response = await fetch(`${url}?${params}`);

      if (!response.ok) {
        throw new Error(`GO API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const associations = data.associations || [];

      // Parse and format annotations
      let formattedAnnotations = associations.map(assoc => ({
        goId: assoc.object?.id,
        goTerm: assoc.object?.label,
        aspect: this.getAspectLabel(assoc.object?.aspect),
        description: assoc.object?.definition,
        evidenceCode: assoc.evidence?.type,
        evidenceLabel: this.getEvidenceLabel(assoc.evidence?.type),
        reference: assoc.publications?.[0]?.id,
        assignedBy: assoc.provided_by,
        qualifier: assoc.qualifiers?.join(', '),
        isExperimental: this.isExperimentalEvidence(assoc.evidence?.type)
      }));

      // Filter by evidence if requested
      if (evidenceFilter) {
        formattedAnnotations = formattedAnnotations.filter(a =>
          a.evidenceCode === evidenceFilter
        );
      }

      // Group by aspect for summary
      const summary = this.calculateSummary(formattedAnnotations);

      return {
        gene: geneSymbol,
        geneId,
        annotations: formattedAnnotations,
        totalAnnotations: formattedAnnotations.length,
        summary,
        source: 'Gene Ontology Consortium'
      };
    } catch (error) {
      console.error(`[Gene Ontology] Failed to fetch annotations for ${geneSymbol}:`, error.message);
      return {
        gene: geneSymbol,
        annotations: [],
        totalAnnotations: 0,
        error: error.message
      };
    }
  }

  /**
   * Search for gene by symbol
   * @private
   */
  async searchGene(geneSymbol) {
    try {
      const url = `${this.baseUrl}/search/entity/autocomplete/${encodeURIComponent(geneSymbol)}`;
      const params = new URLSearchParams({
        category: 'gene',
        taxon: this.taxonId,
        rows: '5'
      });

      const response = await fetch(`${url}?${params}`);

      if (!response.ok) {
        throw new Error(`GO search error: ${response.status}`);
      }

      const data = await response.json();
      const docs = data.docs || [];

      // Find exact match by label
      const exactMatch = docs.find(doc =>
        doc.label?.toUpperCase() === geneSymbol.toUpperCase()
      );

      if (exactMatch) {
        return exactMatch.id;
      }

      // Fallback: take first human gene result
      const humanGene = docs.find(doc => doc.taxon?.id === this.taxonId);
      return humanGene?.id || null;
    } catch (error) {
      console.error(`[Gene Ontology] Gene search failed for ${geneSymbol}:`, error.message);
      return null;
    }
  }

  /**
   * Get aspect label
   * @private
   */
  getAspectLabel(aspect) {
    const labels = {
      'P': 'Biological Process',
      'F': 'Molecular Function',
      'C': 'Cellular Component'
    };
    return labels[aspect] || aspect;
  }

  /**
   * Get evidence code label
   * @private
   */
  getEvidenceLabel(code) {
    const labels = {
      'EXP': 'Inferred from Experiment',
      'IDA': 'Inferred from Direct Assay',
      'IPI': 'Inferred from Physical Interaction',
      'IMP': 'Inferred from Mutant Phenotype',
      'IGI': 'Inferred from Genetic Interaction',
      'IEP': 'Inferred from Expression Pattern',
      'HTP': 'Inferred from High Throughput Experiment',
      'HDA': 'Inferred from High Throughput Direct Assay',
      'HMP': 'Inferred from High Throughput Mutant Phenotype',
      'HGI': 'Inferred from High Throughput Genetic Interaction',
      'HEP': 'Inferred from High Throughput Expression Pattern',
      'IBA': 'Inferred from Biological aspect of Ancestor',
      'IBD': 'Inferred from Biological aspect of Descendant',
      'IKR': 'Inferred from Key Residues',
      'IRD': 'Inferred from Rapid Divergence',
      'ISS': 'Inferred from Sequence or structural Similarity',
      'ISO': 'Inferred from Sequence Orthology',
      'ISA': 'Inferred from Sequence Alignment',
      'ISM': 'Inferred from Sequence Model',
      'IGC': 'Inferred from Genomic Context',
      'RCA': 'Inferred from Reviewed Computational Analysis',
      'TAS': 'Traceable Author Statement',
      'NAS': 'Non-traceable Author Statement',
      'IC': 'Inferred by Curator',
      'ND': 'No biological Data available',
      'IEA': 'Inferred from Electronic Annotation'
    };
    return labels[code] || code;
  }

  /**
   * Check if evidence is experimental
   * @private
   */
  isExperimentalEvidence(code) {
    const experimentalCodes = ['EXP', 'IDA', 'IPI', 'IMP', 'IGI', 'IEP', 'HTP', 'HDA', 'HMP', 'HGI', 'HEP'];
    return experimentalCodes.includes(code);
  }

  /**
   * Calculate summary statistics
   * @private
   */
  calculateSummary(annotations) {
    const byAspect = {
      'Biological Process': annotations.filter(a => a.aspect === 'Biological Process'),
      'Molecular Function': annotations.filter(a => a.aspect === 'Molecular Function'),
      'Cellular Component': annotations.filter(a => a.aspect === 'Cellular Component')
    };

    const experimental = annotations.filter(a => a.isExperimental);

    return {
      byAspect: {
        biologicalProcess: byAspect['Biological Process'].length,
        molecularFunction: byAspect['Molecular Function'].length,
        cellularComponent: byAspect['Cellular Component'].length
      },
      experimentalEvidence: experimental.length,
      computationalEvidence: annotations.length - experimental.length,
      topProcesses: byAspect['Biological Process']
        .filter(a => a.isExperimental)
        .slice(0, 5)
        .map(a => a.goTerm),
      topFunctions: byAspect['Molecular Function']
        .filter(a => a.isExperimental)
        .slice(0, 5)
        .map(a => a.goTerm),
      topComponents: byAspect['Cellular Component']
        .filter(a => a.isExperimental)
        .slice(0, 3)
        .map(a => a.goTerm)
    };
  }

  /**
   * Get enriched GO terms for a gene set
   * @param {string[]} geneSymbols - Array of gene symbols
   * @returns {Promise<Object>} Enriched GO terms
   */
  async getEnrichment(geneSymbols) {
    try {
      // This would use PANTHER or similar enrichment service
      // For now, we'll aggregate individual gene annotations
      const annotations = await Promise.all(
        geneSymbols.map(gene => this.getGeneAnnotations(gene))
      );

      // Find common GO terms across genes
      const termCounts = {};
      annotations.forEach(result => {
        if (!result.error && result.annotations) {
          result.annotations.forEach(annot => {
            const term = annot.goTerm;
            if (!termCounts[term]) {
              termCounts[term] = {
                count: 0,
                genes: [],
                goId: annot.goId,
                aspect: annot.aspect
              };
            }
            termCounts[term].count++;
            termCounts[term].genes.push(result.gene);
          });
        }
      });

      // Get terms shared by multiple genes
      const enrichedTerms = Object.entries(termCounts)
        .filter(([_, data]) => data.count >= 2) // Shared by 2+ genes
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20)
        .map(([term, data]) => ({
          goTerm: term,
          goId: data.goId,
          aspect: data.aspect,
          geneCount: data.count,
          genes: data.genes,
          coverage: data.count / geneSymbols.length
        }));

      return {
        genes: geneSymbols,
        enrichedTerms,
        totalTerms: enrichedTerms.length,
        source: 'Gene Ontology (manual enrichment)'
      };
    } catch (error) {
      console.error('[Gene Ontology] Enrichment failed:', error.message);
      return {
        genes: geneSymbols,
        enrichedTerms: [],
        error: error.message
      };
    }
  }

  /**
   * Get GO term details
   * @param {string} goId - GO term ID (e.g., "GO:0006915")
   * @returns {Promise<Object>} GO term details
   */
  async getTermDetails(goId) {
    try {
      const url = `${this.baseUrl}/ontol/term/${goId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`GO term lookup error: ${response.status}`);
      }

      const data = await response.json();

      return {
        goId: data.id,
        label: data.label,
        definition: data.definition,
        aspect: this.getAspectLabel(data.aspect),
        synonyms: data.synonyms || [],
        isObsolete: data.is_obsolete || false
      };
    } catch (error) {
      console.error(`[Gene Ontology] Term lookup failed for ${goId}:`, error.message);
      return {
        goId,
        error: error.message
      };
    }
  }
}

// Export singleton instance
export const goClient = new GoClient();

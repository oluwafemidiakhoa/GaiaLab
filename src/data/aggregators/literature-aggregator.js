import { pubmedClient } from '../integrations/pubmed-client.js';

/**
 * Literature Aggregator - finds and synthesizes relevant scientific papers
 * Uses PubMed to build evidence for biological insights
 */
export class LiteratureAggregator {
  constructor() {
    this.pubmed = pubmedClient;
  }

  /**
   * Search for papers relevant to genes and disease context
   * @param {Array<string>} genes - Gene symbols
   * @param {string} diseaseContext - Disease or biological context
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Relevant papers with metadata
   */
  async searchRelevantPapers(genes, diseaseContext, options = {}) {
    const { maxResults = 30 } = options;

    try {
      // Search for papers mentioning multiple genes + disease context
      const papers = await this.pubmed.getMultiGenePapers(genes, {
        diseaseContext,
        maxResults
      });

      // Rank papers by relevance
      const rankedPapers = this.rankPapersByRelevance(papers, genes);

      return rankedPapers.slice(0, maxResults);
    } catch (error) {
      console.error('Literature search error:', error.message);
      return [];
    }
  }

  /**
   * Rank papers by relevance to the gene list
   * @private
   */
  rankPapersByRelevance(papers, genes) {
    return papers.map(paper => {
      let relevanceScore = paper.relevanceScore || 1.0;

      // Boost score based on number of mentioned genes
      const mentionedCount = paper.mentionedGenes?.length || 0;
      relevanceScore *= (1 + mentionedCount * 0.2);

      // Boost recent papers (exponential decay from current year)
      const currentYear = new Date().getFullYear();
      const paperYear = parseInt(paper.year) || currentYear - 10;
      const yearDiff = currentYear - paperYear;
      const recencyBoost = Math.exp(-yearDiff / 3); // Decay over ~3 years
      relevanceScore *= (0.5 + 0.5 * recencyBoost);

      // Boost high-impact journals (simplified - could use impact factors)
      const highImpactJournals = ['nature', 'science', 'cell', 'pnas', 'jama'];
      const journalLower = paper.journal.toLowerCase();
      if (highImpactJournals.some(j => journalLower.includes(j))) {
        relevanceScore *= 1.3;
      }

      return {
        ...paper,
        relevanceScore
      };
    }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /**
   * Extract key themes from literature corpus
   * @param {Array<Object>} papers - Papers from searchRelevantPapers()
   * @returns {Array} Identified themes
   */
  extractThemes(papers) {
    if (!papers || papers.length === 0) {
      return [];
    }

    // Simple keyword extraction from titles and abstracts
    const keywords = new Map();

    const therapeuticKeywords = ['therapy', 'therapeutic', 'drug', 'treatment', 'inhibitor', 'target'];
    const mechanismKeywords = ['pathway', 'signaling', 'regulation', 'activation', 'suppression'];
    const diseaseKeywords = ['cancer', 'tumor', 'disease', 'disorder', 'syndrome'];

    for (const paper of papers) {
      const text = `${paper.title} ${paper.abstract}`.toLowerCase();

      // Count therapeutic mentions
      for (const keyword of therapeuticKeywords) {
        if (text.includes(keyword)) {
          keywords.set('therapeutic', (keywords.get('therapeutic') || 0) + 1);
        }
      }

      // Count mechanism mentions
      for (const keyword of mechanismKeywords) {
        if (text.includes(keyword)) {
          keywords.set('mechanism', (keywords.get('mechanism') || 0) + 1);
        }
      }

      // Count disease mentions
      for (const keyword of diseaseKeywords) {
        if (text.includes(keyword)) {
          keywords.set('disease', (keywords.get('disease') || 0) + 1);
        }
      }
    }

    const themes = [
      {
        id: 'therapeutic',
        name: 'Therapeutic Applications & Drug Discovery',
        summary: 'Recent work explores therapeutic interventions and drug targets.',
        paperCount: keywords.get('therapeutic') || 0,
        proportion: (keywords.get('therapeutic') || 0) / papers.length
      },
      {
        id: 'mechanism',
        name: 'Molecular Mechanisms & Pathway Analysis',
        summary: 'Studies investigate signaling pathways and regulatory mechanisms.',
        paperCount: keywords.get('mechanism') || 0,
        proportion: (keywords.get('mechanism') || 0) / papers.length
      },
      {
        id: 'disease',
        name: 'Disease Context & Clinical Relevance',
        summary: 'Research focuses on disease pathology and clinical implications.',
        paperCount: keywords.get('disease') || 0,
        proportion: (keywords.get('disease') || 0) / papers.length
      }
    ];

    return themes.filter(t => t.paperCount > 0);
  }

  /**
   * Get citation-ready references from papers
   * @param {Array<Object>} papers - Papers array
   * @returns {Array} Formatted citations
   */
  formatCitations(papers) {
    return papers.map(paper => ({
      pmid: paper.pmid,
      citation: `${paper.authors}. ${paper.title}. ${paper.journal}. ${paper.year}.`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${paper.pmid}/`
    }));
  }
}

// Export singleton instance
export const literatureAggregator = new LiteratureAggregator();

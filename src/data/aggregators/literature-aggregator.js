import { pubmedClient } from '../integrations/pubmed-client.js';
import { semanticScholarClient } from '../integrations/semantic-scholar-client.js';

/**
 * Literature Aggregator - finds and synthesizes relevant scientific papers
 * Uses PubMed for biomedical literature + Semantic Scholar for citation metrics
 */
export class LiteratureAggregator {
  constructor() {
    this.pubmed = pubmedClient;
    this.semanticScholar = semanticScholarClient;
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
      // STEP 1: Fetch papers from PubMed
      const papers = await this.pubmed.getMultiGenePapers(genes, {
        diseaseContext,
        maxResults
      });

      // STEP 2: Enrich with Semantic Scholar metadata (citation counts, author data, OA links)
      const enrichedPapers = await this._enrichWithSemanticScholar(papers);

      // STEP 3: Rank papers by relevance (now uses citation counts from S2!)
      const rankedPapers = this.rankPapersByRelevance(enrichedPapers, genes);

      return rankedPapers.slice(0, maxResults);
    } catch (error) {
      console.error('Literature search error:', error.message);
      return [];
    }
  }

  /**
   * Enrich PubMed papers with Semantic Scholar metadata
   * Adds citation counts, author data, OA links, and more
   * @private
   */
  async _enrichWithSemanticScholar(papers) {
    if (!papers || papers.length === 0) {
      return papers;
    }

    // Check if Semantic Scholar is configured
    if (!this.semanticScholar.isConfigured()) {
      console.log('[Semantic Scholar] ⚠️  API key not configured - skipping enrichment');
      console.log('[Semantic Scholar] Get free key at: https://www.semanticscholar.org/product/api');
      return papers;
    }

    try {
      const startTime = Date.now();
      const pmids = papers.map(p => p.pmid);

      console.log(`[Semantic Scholar] Enriching ${pmids.length} papers...`);

      // Batch fetch S2 data for all papers
      const s2DataMap = await this.semanticScholar.enrichByPMID(pmids);

      // Merge S2 fields into PubMed papers
      const enriched = papers.map(paper => {
        const s2Data = s2DataMap[paper.pmid];

        if (!s2Data) {
          // Paper not found in Semantic Scholar - keep original
          return paper;
        }

        // Merge S2 enrichment into paper
        return {
          ...paper,
          citationCount: s2Data.citationCount || 0,
          influentialCitationCount: s2Data.influentialCitationCount || 0,
          openAccessUrl: s2Data.openAccessPdf?.url || null,
          semanticAuthors: s2Data.authors || null,
          fieldsOfStudy: s2Data.fieldsOfStudy || [],
          semanticScholarId: s2Data.paperId || null
        };
      });

      const enrichTime = Date.now() - startTime;
      const enrichedCount = enriched.filter(p => p.citationCount > 0).length;
      const avgCitations = enrichedCount > 0
        ? Math.round(enriched.reduce((sum, p) => sum + (p.citationCount || 0), 0) / enrichedCount)
        : 0;

      console.log(`[Semantic Scholar] ✅ Enriched ${enrichedCount}/${papers.length} papers in ${enrichTime}ms (avg ${avgCitations} citations)`);

      return enriched;
    } catch (error) {
      console.error('[Semantic Scholar] ❌ Enrichment failed, using PubMed data only:', error.message);
      return papers; // Graceful degradation
    }
  }

  /**
   * Rank papers by relevance to the gene list
   * Prioritizes: review papers, high-impact journals, seminal studies
   * @private
   */
  rankPapersByRelevance(papers, genes) {
    return papers.map(paper => {
      let relevanceScore = paper.relevanceScore || 1.0;

      // PRIORITY 1: Review papers (2x weight for authoritative overviews)
      const isReview = paper.publicationTypes?.includes('Review') ||
                       paper.publicationTypes?.includes('Journal Article Review') ||
                       (paper.title && paper.title.toLowerCase().includes('review:')) ||
                       (paper.abstract && paper.abstract.toLowerCase().includes('this review'));
      if (isReview) {
        relevanceScore *= 2.0;
      }

      // PRIORITY 2: High-impact review journals (definitive sources)
      const reviewJournals = [
        'nat rev', 'nature reviews', 'annu rev', 'annual review',
        'cell rev', 'trends', 'curr opin', 'crit rev'
      ];
      const journalLower = (paper.journal || '').toLowerCase();
      if (reviewJournals.some(j => journalLower.includes(j))) {
        relevanceScore *= 1.8;
      }

      // PRIORITY 3: Top-tier research journals
      const topJournals = [
        'nature', 'science', 'cell', 'nejm', 'lancet',
        'nat genet', 'nat biotechnol', 'nat neurosci', 'nat med',
        'cell stem cell', 'neuron', 'immunity', 'cancer cell'
      ];
      if (topJournals.some(j => journalLower.includes(j)) && !reviewJournals.some(j => journalLower.includes(j))) {
        relevanceScore *= 1.5;
      }

      // PRIORITY 4: Seminal papers (highly cited older papers = foundational)
      const citationCount = paper.citationCount || 0;
      if (citationCount > 500) {
        relevanceScore *= 1.6; // Seminal discovery papers
      } else if (citationCount > 100) {
        relevanceScore *= 1.3; // Highly influential
      }

      // Boost score based on number of mentioned genes
      const mentionedCount = paper.mentionedGenes?.length || 0;
      relevanceScore *= (1 + mentionedCount * 0.2);

      // Balance recency vs. established findings
      const currentYear = new Date().getFullYear();
      const paperYear = parseInt(paper.year) || currentYear - 10;
      const yearDiff = currentYear - paperYear;

      // Prefer papers from last 2-5 years (validated but current)
      if (yearDiff >= 2 && yearDiff <= 5) {
        relevanceScore *= 1.2;
      } else if (yearDiff < 2) {
        relevanceScore *= 0.9; // Too recent = not yet validated
      } else if (yearDiff > 10 && citationCount < 100) {
        relevanceScore *= 0.7; // Old + low citations = less relevant
      }

      return {
        ...paper,
        relevanceScore,
        isReview, // Flag for display purposes
        citationCount
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

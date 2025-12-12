import axios from 'axios';
import { parseStringPromise } from 'xml2js';

/**
 * PubMed client using NCBI E-utilities API
 * Provides access to biomedical literature for gene analysis
 */
export class PubMedClient {
  constructor() {
    this.baseUrl = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
    this.email = 'gaialab@example.com'; // Required by NCBI for courtesy
    this.tool = 'GaiaLab';
    this.apiKey = process.env.NCBI_API_KEY || null; // Optional: increases rate limit
  }

  /**
   * Search PubMed for papers relevant to a gene
   * @param {string} geneSymbol - Gene symbol (e.g., 'TP53', 'BRCA1')
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of PubMed IDs
   */
  async searchGeneRelevantPapers(geneSymbol, options = {}) {
    const {
      maxResults = 50,
      reldate = 730, // Last 2 years by default
      diseaseContext = null
    } = options;

    try {
      // Build search query targeting gene-disease-therapy connections
      let query = `${geneSymbol}[Gene Symbol]`;

      if (diseaseContext) {
        query += ` AND (${diseaseContext}[Title/Abstract])`;
      }

      query += ` AND (therapy[MeSH] OR pathway[Title/Abstract] OR drug[Title/Abstract] OR therapeutic[Title/Abstract])`;

      const params = {
        db: 'pubmed',
        term: query,
        retmax: maxResults,
        retmode: 'json',
        sort: 'relevance',
        email: this.email,
        tool: this.tool
      };

      if (reldate) {
        params.reldate = reldate; // Days back to search
        params.datetype = 'pdat'; // Publication date
      }

      if (this.apiKey) {
        params.api_key = this.apiKey;
      }

      const response = await axios.get(`${this.baseUrl}/esearch.fcgi`, { params });

      if (response.data?.esearchresult?.idlist) {
        return response.data.esearchresult.idlist;
      }

      return [];
    } catch (error) {
      console.error(`PubMed search error for ${geneSymbol}:`, error.message);
      return [];
    }
  }

  /**
   * Fetch paper metadata for a list of PubMed IDs
   * @param {Array<string>} pmids - PubMed IDs
   * @returns {Promise<Array>} Array of paper metadata objects
   */
  async fetchPaperMetadata(pmids) {
    if (!pmids || pmids.length === 0) {
      return [];
    }

    try {
      const params = {
        db: 'pubmed',
        id: pmids.join(','),
        retmode: 'xml',
        rettype: 'abstract',
        email: this.email,
        tool: this.tool
      };

      if (this.apiKey) {
        params.api_key = this.apiKey;
      }

      const response = await axios.get(`${this.baseUrl}/efetch.fcgi`, { params });

      // Parse XML response
      const parsed = await parseStringPromise(response.data);

      return this.extractPaperMetadata(parsed);
    } catch (error) {
      console.error('PubMed fetch error:', error.message);
      return [];
    }
  }

  /**
   * Extract structured metadata from PubMed XML
   * @private
   */
  extractPaperMetadata(parsedXml) {
    const papers = [];

    try {
      const articles = parsedXml?.PubmedArticleSet?.PubmedArticle || [];

      for (const article of articles) {
        const medlineCitation = article.MedlineCitation?.[0];
        const articleData = medlineCitation?.Article?.[0];

        if (!articleData) continue;

        const pmid = medlineCitation?.PMID?.[0]?._ || medlineCitation?.PMID?.[0];
        const title = articleData?.ArticleTitle?.[0] || 'No title';

        // Extract abstract
        const abstractParts = articleData?.Abstract?.[0]?.AbstractText || [];
        const abstractText = abstractParts
          .map(part => typeof part === 'string' ? part : part._)
          .join(' ');

        // Extract journal info
        const journal = articleData?.Journal?.[0];
        const journalTitle = journal?.Title?.[0] || journal?.ISOAbbreviation?.[0] || 'Unknown';

        // Extract publication year
        const pubDate = journal?.JournalIssue?.[0]?.PubDate?.[0];
        const year = pubDate?.Year?.[0] || pubDate?.MedlineDate?.[0]?.substring(0, 4) || 'Unknown';

        // Extract authors (first 3)
        const authorList = articleData?.AuthorList?.[0]?.Author || [];
        const authors = authorList.slice(0, 3).map(author => {
          const lastName = author.LastName?.[0] || '';
          const initials = author.Initials?.[0] || '';
          return `${lastName} ${initials}`.trim();
        });

        papers.push({
          pmid,
          title,
          abstract: abstractText || 'No abstract available',
          journal: journalTitle,
          year,
          authors: authors.join(', '),
          relevanceScore: 1.0 - (papers.length * 0.01) // Decay by search rank
        });
      }
    } catch (error) {
      console.error('Error extracting paper metadata:', error.message);
    }

    return papers;
  }

  /**
   * Search and fetch papers in one call (convenience method)
   * @param {string} geneSymbol - Gene symbol
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Array of paper metadata
   */
  async getRelevantPapers(geneSymbol, options = {}) {
    const pmids = await this.searchGeneRelevantPapers(geneSymbol, options);

    if (pmids.length === 0) {
      return [];
    }

    // Fetch in batches of 100 (NCBI limit)
    const batchSize = 100;
    const batches = [];

    for (let i = 0; i < pmids.length; i += batchSize) {
      const batch = pmids.slice(i, i + batchSize);
      batches.push(this.fetchPaperMetadata(batch));
    }

    const results = await Promise.all(batches);
    return results.flat();
  }

  /**
   * Search for papers about multiple genes (aggregated)
   * @param {Array<string>} genes - Array of gene symbols
   * @param {Object} options - Search options
   * @returns {Promise<Array>} Aggregated papers with gene associations
   */
  async getMultiGenePapers(genes, options = {}) {
    const { maxResults = 20, diseaseContext = null } = options;

    try {
      // Build combined query for all genes
      const geneQuery = genes.map(g => `${g}[Gene Symbol]`).join(' OR ');
      let query = `(${geneQuery})`;

      if (diseaseContext) {
        query += ` AND (${diseaseContext}[Title/Abstract])`;
      }

      query += ` AND (pathway[Title/Abstract] OR therapeutic[Title/Abstract])`;

      const params = {
        db: 'pubmed',
        term: query,
        retmax: maxResults,
        retmode: 'json',
        sort: 'relevance',
        reldate: 730,
        datetype: 'pdat',
        email: this.email,
        tool: this.tool
      };

      if (this.apiKey) {
        params.api_key = this.apiKey;
      }

      const response = await axios.get(`${this.baseUrl}/esearch.fcgi`, { params });
      const pmids = response.data?.esearchresult?.idlist || [];

      if (pmids.length === 0) {
        return [];
      }

      const papers = await this.fetchPaperMetadata(pmids);

      // Tag each paper with which genes it mentions
      return papers.map(paper => ({
        ...paper,
        mentionedGenes: genes.filter(gene => {
          const title = String(paper.title || '').toUpperCase();
          const abstract = String(paper.abstract || '').toUpperCase();
          const geneUpper = gene.toUpperCase();
          return title.includes(geneUpper) || abstract.includes(geneUpper);
        })
      }));
    } catch (error) {
      console.error('Multi-gene paper search error:', error.message);
      return [];
    }
  }
}

// Export singleton instance
export const pubmedClient = new PubMedClient();

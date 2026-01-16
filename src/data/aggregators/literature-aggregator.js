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
      const rankedPapers = this.rankPapersByRelevance(enrichedPapers, genes, diseaseContext);
      const annotatedPapers = this.annotateEvidencePolarity(rankedPapers, genes, diseaseContext);
      const enrichedSignals = this.annotateStudySignals(annotatedPapers);
      const qualitySignals = this.annotateQualitySignals(enrichedSignals);

      return qualitySignals.slice(0, maxResults);
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
  rankPapersByRelevance(papers, genes, diseaseContext) {
    const diseaseTokens = this.tokenizeContext(diseaseContext);
    const diseasePhrase = String(diseaseContext || '').toLowerCase().trim();

    return papers.map(paper => {
      let relevanceScore = paper.relevanceScore || 1.0;

      // PRIORITY 1: Review papers (2x weight for authoritative overviews)
      const titleLower = String(paper.title || '').toLowerCase();
      const abstractLower = String(paper.abstract || '').toLowerCase();
      const isReview = paper.publicationTypes?.includes('Review') ||
                       paper.publicationTypes?.includes('Journal Article Review') ||
                       titleLower.includes('review:') ||
                       abstractLower.includes('this review');
      if (isReview) {
        relevanceScore *= 2.0;
      }

      // PRIORITY 2: High-impact review journals (definitive sources)
      const reviewJournals = [
        'nat rev', 'nature reviews', 'annu rev', 'annual review',
        'cell rev', 'trends', 'curr opin', 'crit rev'
      ];
      const journalLower = String(paper.journal || '').toLowerCase();
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

      const combinedText = `${titleLower} ${abstractLower}`.trim();

      // Boost if disease context appears in title/abstract
      if (diseasePhrase && combinedText.includes(diseasePhrase)) {
        relevanceScore *= 1.3;
      }

      if (diseaseTokens.length > 0) {
        let matchScore = 0;
        for (const token of diseaseTokens) {
          if (titleLower.includes(token)) {
            matchScore += 2;
          } else if (abstractLower.includes(token)) {
            matchScore += 1;
          }
        }

        if (matchScore > 0) {
          relevanceScore *= (1 + Math.min(matchScore, 6) * 0.08);
        } else {
          relevanceScore *= 0.85;
        }
      }

      // Boost if gene symbols appear in the title (strong relevance)
      if (genes && genes.length > 0) {
        const titleGeneHits = genes.filter(gene =>
          titleLower.includes(String(gene || '').toLowerCase())
        ).length;
        if (titleGeneHits > 0) {
          relevanceScore *= (1 + Math.min(titleGeneHits, 3) * 0.1);
        }
      }

      // Boost for clinical trial/meta-analysis signals
      const clinicalTypes = ['Clinical Trial', 'Randomized Controlled Trial', 'Meta-Analysis'];
      if (paper.publicationTypes?.some(type => clinicalTypes.includes(type))) {
        relevanceScore *= 1.15;
      }

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

  annotateEvidencePolarity(papers, genes, diseaseContext) {
    const positivePatterns = [
      /\bstrongly associated\b/i,
      /\bassociated with\b/i,
      /\bsignificant(?:ly)? (?:association|correlation|increase|decrease)\b/i,
      /\bpositive association\b/i,
      /\bpromot(?:e|es|ed|ing)\b/i,
      /\bdrives\b/i,
      /\bkey role\b/i,
      /\bcritical\b/i,
      /\benhances?\b/i,
      /\bupregulat(?:e|es|ed|ion)\b/i,
      /\bdownregulat(?:e|es|ed|ion)\b/i
    ];

    const negativePatterns = [
      /\bno association\b/i,
      /\bnot associated\b/i,
      /\bno significant\b/i,
      /\bnot significant\b/i,
      /\bfailed to\b/i,
      /\bno evidence\b/i,
      /\bno effect\b/i,
      /\bnot correlated\b/i,
      /\bnegative (?:results|finding|association)\b/i,
      /\bcontradict(?:s|ory|ing)?\b/i,
      /\bconflict(?:s|ing)?\b/i,
      /\binconsistent\b/i
    ];

    return (papers || []).map(paper => {
      const text = `${paper.title || ''} ${paper.abstract || ''}`.toLowerCase();
      const supportHits = this.countPatternHits(text, positivePatterns);
      const contradictHits = this.countPatternHits(text, negativePatterns);

      let evidencePolarity = 'neutral';
      if (supportHits > 0 && contradictHits === 0) {
        evidencePolarity = 'support';
      } else if (contradictHits > 0 && supportHits === 0) {
        evidencePolarity = 'contradict';
      } else if (supportHits > 0 && contradictHits > 0) {
        evidencePolarity = 'mixed';
      }

      const contradictionMeta = (evidencePolarity === 'contradict' || evidencePolarity === 'mixed')
        ? this.classifyContradictions(text)
        : { tags: [], summary: null };

      return {
        ...paper,
        evidencePolarity,
        evidenceSignals: {
          supportHits,
          contradictHits
        },
        contradictionTags: contradictionMeta.tags,
        contradictionSummary: contradictionMeta.summary
      };
    });
  }

  classifyContradictions(text) {
    const content = String(text || '').toLowerCase();
    const tags = new Set();

    if (/\bno association\b|\bnot associated\b|\bno evidence\b|\bno effect\b/.test(content)) {
      tags.add('no_association');
    }
    if (/\bno significant\b|\bnot significant\b|\bnon[- ]significant\b|\bp\s*[>≥]\s*0\.0?5\b|\bdid not reach significance\b/.test(content)) {
      tags.add('statistical');
    }
    if (/\bfailed to replicate\b|\bnot replicated\b|\bcould not reproduce\b|\bfailed to reproduce\b/.test(content)) {
      tags.add('replication');
    }
    if (/\binconsistent\b|\bconflicting\b|\bheterogeneous\b|\bvariable results\b|\bdiscordant\b/.test(content)) {
      tags.add('heterogeneity');
    }
    if (/\bcohort\b|\bpopulation\b|\bethnic\b|\bethnicity\b|\bsex-specific\b|\bgender\b|\bage-specific\b|\bpediatric\b|\badult\b/.test(content)) {
      tags.add('population');
    }
    if (/\bin vitro\b|\bin vivo\b|\bcell line\b|\bmouse\b|\bmurine\b|\brat\b|\bxenograft\b|\borganoid\b|\banimal model\b/.test(content)) {
      tags.add('model');
    }
    if (/\bassay\b|\bmethod\b|\bprotocol\b|\bplatform\b|\bbatch effects\b|\bartifact\b/.test(content)) {
      tags.add('methodological');
    }
    if (/\bdose-dependent\b|\bdose response\b|\btime-dependent\b|\bshort-term\b|\blong-term\b|\bduration\b/.test(content)) {
      tags.add('dose_time');
    }
    const upSignals = /\b(increase|increased|upregulat(?:e|es|ed|ion)|elevat(?:e|es|ed|ion)|overexpress(?:ed|ion)?|gain of function)\b/;
    const downSignals = /\b(decrease|decreased|downregulat(?:e|es|ed|ion)|reduc(?:e|es|ed|tion)|suppress(?:ed|ion)?|loss of function)\b/;
    if (upSignals.test(content) && downSignals.test(content)) {
      tags.add('directionality');
    }
    if (/\b(overall survival|progression[- ]free|response rate|endpoint|outcome|hazard ratio|odds ratio|biomarker)\b/.test(content)) {
      tags.add('endpoint');
    }
    if (/\b(publication bias|reporting bias|selective reporting|p-hacking|file drawer)\b/.test(content)) {
      tags.add('publication_bias');
    }
    if (/\bunderpowered\b|\blow power\b|\bsmall sample\b|\blimited sample\b/.test(content)) {
      tags.add('underpowered');
    }
    const preclinicalSignals = /\b(in vitro|in vivo|cell line|xenograft|organoid|mouse|mice|murine|rat|zebrafish)\b/;
    const clinicalSignals = /\b(clinical trial|patients|patient cohort|phase i|phase ii|phase iii|phase iv|prospective|retrospective|randomized)\b/;
    if (preclinicalSignals.test(content) && clinicalSignals.test(content)) {
      tags.add('translation_gap');
    }

    if (tags.size === 0) {
      tags.add('unspecified');
    }

    const tagList = Array.from(tags);
    const summary = this.formatContradictionSummary(tagList);

    return { tags: tagList, summary };
  }

  getContradictionLabelMap() {
    return {
      no_association: 'No association',
      statistical: 'Non-significant statistics',
      replication: 'Replication failure',
      heterogeneity: 'Heterogeneity',
      population: 'Population-specific',
      model: 'Model/system mismatch',
      methodological: 'Methodological',
      dose_time: 'Dose/time effects',
      directionality: 'Opposite effect direction',
      endpoint: 'Endpoint mismatch',
      publication_bias: 'Publication bias',
      underpowered: 'Underpowered sample',
      translation_gap: 'Preclinical vs clinical gap',
      early_phase: 'Early-phase trial',
      unspecified: 'Unspecified'
    };
  }

  formatContradictionSummary(tags) {
    const labels = this.getContradictionLabelMap();
    return (tags || []).map(tag => labels[tag] || tag).join(', ');
  }

  augmentContradictionTags(paper) {
    const baseTags = new Set(paper.contradictionTags || []);
    const polarity = paper.evidencePolarity || 'neutral';
    if (!['contradict', 'mixed'].includes(polarity)) {
      return Array.from(baseTags);
    }

    const sampleSize = Number(paper.sampleSize || 0);
    const studyType = paper.studyType || 'unknown';
    const trialPhase = String(paper.trialPhase || '').toUpperCase();

    const sampleThreshold = studyType === 'preclinical' ? 15 : 50;
    if (sampleSize > 0 && sampleSize < sampleThreshold) {
      baseTags.add('underpowered');
    }

    if (trialPhase && ['I', 'I/II', 'II'].includes(trialPhase)) {
      baseTags.add('early_phase');
    }

    if (baseTags.has('unspecified') && baseTags.size > 1) {
      baseTags.delete('unspecified');
    }

    return Array.from(baseTags);
  }

  computeContradictionSeverity(tags) {
    const tagSet = new Set(tags || []);
    if (tagSet.size === 0) return null;

    const high = new Set(['replication', 'no_association', 'statistical', 'directionality']);
    const moderate = new Set([
      'heterogeneity',
      'population',
      'endpoint',
      'methodological',
      'dose_time',
      'translation_gap',
      'underpowered',
      'publication_bias',
      'early_phase'
    ]);

    if ([...tagSet].some(tag => high.has(tag))) {
      return 'high';
    }
    if ([...tagSet].some(tag => moderate.has(tag))) {
      return 'moderate';
    }
    return 'low';
  }

  annotateStudySignals(papers) {
    return (papers || []).map(paper => {
      const text = `${paper.title || ''} ${paper.abstract || ''}`.trim();
      const { studyType, studyDesign, sampleSize, sampleSizeText } = this.extractStudySignals(
        text,
        paper.publicationTypes || [],
        paper.isReview
      );

      return {
        ...paper,
        studyType,
        studyDesign,
        sampleSize,
        sampleSizeText
      };
    });
  }

  annotateQualitySignals(papers) {
    return (papers || []).map(paper => {
      const publicationTypes = paper.publicationTypes || [];
      const journal = String(paper.journal || '');
      const text = `${paper.title || ''} ${paper.abstract || ''}`.trim();

      const journalTier = this.classifyJournalTier(journal);
      const trialPhase = this.extractTrialPhase(text, publicationTypes);
      const isRetracted = publicationTypes.some(type => /retracted|retraction/i.test(type)) ||
        /retracted|retraction/i.test(String(paper.title || ''));

      const qualityFlags = [];
      if (isRetracted) qualityFlags.push('retracted');
      if (trialPhase) qualityFlags.push(`trial:${trialPhase}`);
      if (journalTier) qualityFlags.push(`tier:${journalTier}`);

      const contradictionTags = this.augmentContradictionTags({
        contradictionTags: paper.contradictionTags,
        evidencePolarity: paper.evidencePolarity,
        sampleSize: paper.sampleSize,
        studyType: paper.studyType,
        trialPhase
      });
      const contradictionSummary = contradictionTags.length
        ? this.formatContradictionSummary(contradictionTags)
        : null;
      const contradictionSeverity = this.computeContradictionSeverity(contradictionTags);

      return {
        ...paper,
        journalTier,
        trialPhase,
        isRetracted,
        qualityFlags,
        contradictionTags,
        contradictionSummary,
        contradictionSeverity
      };
    });
  }

  classifyJournalTier(journal) {
    const name = String(journal || '').toLowerCase();
    if (!name) return 'unknown';

    const tier1 = [
      'nature', 'science', 'cell', 'new england journal of medicine', 'nejm', 'lancet'
    ];
    const tier2 = [
      'nature medicine', 'nature genetics', 'nature biotechnology', 'cancer cell', 'immunity',
      'neuron', 'jama', 'bmj', 'pnas', 'annals of oncology', 'clinical cancer research',
      'blood', 'circulation', 'jci', 'cell stem cell'
    ];

    if (tier1.some(term => name.includes(term))) {
      return 'tier1';
    }
    if (tier2.some(term => name.includes(term))) {
      return 'tier2';
    }
    return 'tier3';
  }

  extractTrialPhase(text, publicationTypes = []) {
    const typeMatch = publicationTypes.find(type => /phase/i.test(String(type)));
    const raw = typeMatch || text;
    if (!raw) return null;

    const phasePattern = /\bphase\s*(i{1,3}|iv|1|2|3|4|i\/ii|ii\/iii|i-ii|ii-iii|ii-iv|iii-iv)\b/i;
    const match = String(raw).match(phasePattern);
    if (!match) return null;

    const normalized = match[1].toLowerCase().replace(/\s+/g, '');
    const map = {
      '1': 'I',
      '2': 'II',
      '3': 'III',
      '4': 'IV',
      'i': 'I',
      'ii': 'II',
      'iii': 'III',
      'iv': 'IV',
      'i/ii': 'I/II',
      'ii/iii': 'II/III',
      'i-ii': 'I/II',
      'ii-iii': 'II/III',
      'ii-iv': 'II/IV',
      'iii-iv': 'III/IV'
    };

    return map[normalized] || normalized.toUpperCase();
  }

  extractStudySignals(text, publicationTypes = [], isReview = false) {
    const content = String(text || '').toLowerCase();
    const types = publicationTypes.map(type => String(type || '').toLowerCase());
    const hasMeta = types.some(type => type.includes('meta-analysis')) || content.includes('meta-analysis');
    const hasReview = isReview || types.some(type => type.includes('review'));
    const clinicalTypeHit = types.some(type =>
      type.includes('clinical trial') ||
      type.includes('randomized controlled trial') ||
      type.includes('controlled clinical trial') ||
      type.includes('phase')
    );

    const clinicalSignals = [
      'randomized', 'randomised', 'double-blind', 'placebo', 'phase i', 'phase ii', 'phase iii', 'phase iv',
      'clinical trial', 'trial', 'patients', 'patient', 'participants', 'participant', 'subjects', 'subject',
      'cohort', 'case-control', 'case series', 'registry', 'prospective', 'retrospective'
    ];
    const preclinicalSignals = [
      'mouse', 'mice', 'murine', 'rat', 'rats', 'zebrafish', 'drosophila',
      'xenograft', 'organoid', 'cell line', 'cell culture', 'in vitro', 'in vivo',
      'knockout', 'transgenic', 'primary cells'
    ];

    const clinicalHit = clinicalTypeHit || clinicalSignals.some(term => content.includes(term));
    const preclinicalHit = preclinicalSignals.some(term => content.includes(term));

    let studyType = 'unknown';
    if (hasMeta) {
      studyType = 'meta-analysis';
    } else if (hasReview) {
      studyType = 'review';
    } else if (clinicalHit && preclinicalHit) {
      studyType = 'mixed';
    } else if (clinicalHit) {
      studyType = 'clinical';
    } else if (preclinicalHit) {
      studyType = 'preclinical';
    }

    let studyDesign = null;
    if (hasMeta) {
      studyDesign = 'meta-analysis';
    } else if (content.includes('randomized') || content.includes('randomised')) {
      studyDesign = 'randomized';
    } else if (content.includes('double-blind')) {
      studyDesign = 'double-blind';
    } else if (content.includes('cohort')) {
      studyDesign = 'cohort';
    } else if (content.includes('case-control')) {
      studyDesign = 'case-control';
    } else if (content.includes('case series')) {
      studyDesign = 'case series';
    } else if (content.includes('in vivo')) {
      studyDesign = 'in vivo';
    } else if (content.includes('in vitro')) {
      studyDesign = 'in vitro';
    }

    const { sampleSize, sampleSizeText } = this.extractSampleSize(content);

    return {
      studyType,
      studyDesign,
      sampleSize,
      sampleSizeText
    };
  }

  extractSampleSize(text) {
    if (!text) {
      return { sampleSize: null, sampleSizeText: null };
    }

    const candidates = [];
    const contextKeywords = [
      'patient', 'patients', 'participant', 'participants', 'subject', 'subjects', 'case', 'cases',
      'cohort', 'trial', 'study', 'registry', 'sample', 'samples', 'mouse', 'mice', 'rat', 'rats',
      'animal', 'animals', 'tumor', 'tumors'
    ];

    const nMatches = text.matchAll(/\b[nN]\s*=\s*(\d{2,6})\b/g);
    for (const match of nMatches) {
      const value = parseInt(match[1], 10);
      if (!Number.isFinite(value)) {
        continue;
      }
      const index = typeof match.index === 'number' ? match.index : 0;
      const start = Math.max(0, index - 40);
      const end = Math.min(text.length, index + match[0].length + 40);
      const window = text.slice(start, end);
      const hasContext = contextKeywords.some(keyword => window.includes(keyword));
      if (!hasContext) {
        continue;
      }
      candidates.push({ value, label: `n=${value}` });
    }

    const labeledMatches = text.matchAll(/\b(\d{2,6})\s+(patients|subjects|participants|cases|samples|mice|rats|animals|tumors|individuals|volunteers)\b/gi);
    for (const match of labeledMatches) {
      const value = parseInt(match[1], 10);
      const label = `${match[1]} ${match[2].toLowerCase()}`;
      if (Number.isFinite(value)) {
        candidates.push({ value, label });
      }
    }

    const filtered = candidates.filter(candidate => candidate.value >= 5 && candidate.value <= 200000);
    if (filtered.length === 0) {
      return { sampleSize: null, sampleSizeText: null };
    }

    filtered.sort((a, b) => b.value - a.value);
    return {
      sampleSize: filtered[0].value,
      sampleSizeText: filtered[0].label
    };
  }

  countPatternHits(text, patterns) {
    if (!text) return 0;
    return patterns.reduce((count, pattern) => {
      if (pattern.test(text)) {
        return count + 1;
      }
      return count;
    }, 0);
  }

  /**
   * Tokenize disease context for scoring
   * @private
   */
  tokenizeContext(diseaseContext) {
    const raw = String(diseaseContext || '').toLowerCase().trim();
    if (!raw) return [];

    const stopwords = new Set([
      'and', 'or', 'the', 'of', 'in', 'with', 'without', 'type', 'disease',
      'syndrome', 'disorder', 'condition', 'patients'
    ]);

    return raw
      .split(/[^a-z0-9]+/g)
      .map(token => token.trim())
      .filter(token => token.length > 2 && !stopwords.has(token));
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

  /**
   * Extract leading researchers from literature corpus
   * Identifies prolific authors with high-impact contributions
   * @param {Array<Object>} papers - Papers with Semantic Scholar author data
   * @returns {Array} Top researchers with metrics
   */
  extractLeadingResearchers(papers) {
    if (!papers || papers.length === 0) {
      return [];
    }

    // Map to track author contributions
    const authorMap = new Map();

    for (const paper of papers) {
      // Use Semantic Scholar author data if available, fallback to PubMed authors string
      const authors = paper.semanticAuthors || [];
      const citationCount = paper.citationCount || 0;

      if (authors.length === 0) continue;

      // Process each author (prioritize first/last authors = typically PI/senior author)
      authors.forEach((author, index) => {
        const authorId = author.authorId || author.name;
        const name = author.name;

        if (!name || !authorId) return;

        if (!authorMap.has(authorId)) {
          authorMap.set(authorId, {
            authorId,
            name,
            paperCount: 0,
            totalCitations: 0,
            papers: [],
            isFirstAuthor: 0,
            isLastAuthor: 0
          });
        }

        const authorData = authorMap.get(authorId);
        authorData.paperCount++;
        authorData.totalCitations += citationCount;
        authorData.papers.push({
          pmid: paper.pmid,
          title: paper.title,
          year: paper.year,
          citationCount
        });

        // Track authorship position (first = early career/did work, last = PI/senior)
        if (index === 0) authorData.isFirstAuthor++;
        if (index === authors.length - 1) authorData.isLastAuthor++;
      });
    }

    // Convert to array and calculate impact score
    const researchers = Array.from(authorMap.values()).map(author => {
      // Impact score: weighted by papers, citations, and senior authorship
      const avgCitations = author.totalCitations / author.paperCount;
      const seniorAuthorBonus = author.isLastAuthor * 1.5; // Last author = PI
      const impactScore = (author.paperCount * 10) + (avgCitations * 2) + seniorAuthorBonus;

      return {
        ...author,
        avgCitations: Math.round(avgCitations),
        impactScore: Math.round(impactScore),
        topPaper: author.papers.sort((a, b) => b.citationCount - a.citationCount)[0]
      };
    });

    // Sort by impact score and return top 10
    return researchers
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 10)
      .map(r => ({
        name: r.name,
        paperCount: r.paperCount,
        totalCitations: r.totalCitations,
        avgCitations: r.avgCitations,
        topPaper: r.topPaper,
        role: r.isLastAuthor > r.isFirstAuthor ? 'Senior Researcher' : 'Active Contributor'
      }));
  }

  /**
   * Get recommended papers based on current literature set
   * Uses Semantic Scholar recommendations for the most relevant papers
   * @param {Array<Object>} papers - Base papers to get recommendations from
   * @param {number} limit - Number of recommendations to return
   * @returns {Promise<Array>} Recommended papers
   */
  async getRecommendedPapers(papers, limit = 5) {
    if (!papers || papers.length === 0) {
      return [];
    }

    // Check if Semantic Scholar is configured
    if (!this.semanticScholar.isConfigured()) {
      console.log('[Recommendations] Semantic Scholar not configured - skipping');
      return [];
    }

    try {
      // Get top papers with Semantic Scholar IDs (needed for recommendations)
      const eligiblePapers = papers
        .filter(p => p.citationCount > 0 && p.semanticScholarId)
        .sort((a, b) => b.citationCount - a.citationCount);

      if (eligiblePapers.length === 0) {
        console.log('[Recommendations] No papers with Semantic Scholar IDs available');
        return [];
      }

      // Try top 3 papers first, expand to 5 if needed
      const batchSize = Math.min(3, eligiblePapers.length);
      let topPapers = eligiblePapers.slice(0, batchSize);

      console.log(`[Recommendations] Fetching recommendations from ${topPapers.length} top papers...`);

      // Fetch recommendations in parallel (using S2 paper ID for better success rate)
      let recommendationPromises = topPapers.map(paper =>
        this.semanticScholar.getRecommendations(paper.semanticScholarId, 3)
      );

      let allRecommendations = await Promise.all(recommendationPromises);

      // If no recommendations from first batch and more papers available, try 2 more
      const totalRecs = allRecommendations.reduce((sum, recs) => sum + recs.length, 0);
      if (totalRecs === 0 && eligiblePapers.length > batchSize) {
        console.log('[Recommendations] First batch empty, trying additional papers...');
        const nextBatch = eligiblePapers.slice(batchSize, batchSize + 2);
        const nextPromises = nextBatch.map(paper =>
          this.semanticScholar.getRecommendations(paper.semanticScholarId, 3)
        );
        const nextRecs = await Promise.all(nextPromises);
        allRecommendations = [...allRecommendations, ...nextRecs];
      }

      // Flatten and deduplicate recommendations
      const seenPapers = new Set(papers.map(p => p.pmid));
      const uniqueRecs = [];

      for (const recs of allRecommendations) {
        for (const rec of recs) {
          const pmid = rec.externalIds?.PubMed;
          if (!pmid || seenPapers.has(pmid)) continue;

          seenPapers.add(pmid);
          uniqueRecs.push({
            pmid,
            title: rec.title,
            year: rec.year,
            citationCount: rec.citationCount,
            authors: rec.authors?.slice(0, 3).map(a => a.name).join(', ') || 'Unknown',
            openAccessUrl: rec.openAccessPdf?.url || null
          });
        }
      }

      console.log(`[Recommendations] Found ${uniqueRecs.length} unique recommendations`);

      // Sort by citation count and return top N
      return uniqueRecs
        .sort((a, b) => b.citationCount - a.citationCount)
        .slice(0, limit);
    } catch (error) {
      console.error('[Recommendations] Error fetching recommendations:', error.message);
      return [];
    }
  }
}

// Export singleton instance
export const literatureAggregator = new LiteratureAggregator();

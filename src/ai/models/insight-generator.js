import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * AI Insight Generator with Multi-Model Failover
 * PRIMARY: DeepSeek V3 (Fastest, cheapest, excellent quality)
 * Fallback 1: GPT-4o-mini (Fast, cost-effective OpenAI)
 * Fallback 2: Gemini 2.0 Flash (Latest Google model)
 * Fallback 3: Claude 3.5 Sonnet (Premium quality, slower)
 * Synthesizes biological data into actionable insights with citations
 */
export class InsightGenerator {
  constructor() {
    // Initialize all available AI models
    this.models = [];

    // DeepSeek V3 (PRIMARY - Fastest & cheapest, excellent quality)
    if (process.env.DEEPSEEK_API_KEY) {
      this.deepseek = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1'
      });
      this.models.push({
        name: 'DeepSeek V3',
        id: 'deepseek-chat',
        provider: 'deepseek'
      });
    }

    // GPT-4o-mini (Fallback 1 - Fast & cost-effective)
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.models.push({
        name: 'GPT-4o-mini',
        id: 'gpt-4o-mini',
        provider: 'openai'
      });
    }

    // Google Gemini 2.0 Flash (Fallback 2 - Latest Google model)
    if (process.env.GOOGLE_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      this.models.push({
        name: 'Gemini 2.0 Flash',
        id: 'gemini-2.0-flash-exp',
        provider: 'google'
      });
    }

    // Claude 3.5 Sonnet (Fallback 3 - Premium quality, but slower)
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY
      });
      this.models.push({
        name: 'Claude 3.5 Sonnet',
        id: 'claude-3-5-sonnet-latest',
        provider: 'anthropic'
      });
    }

    if (this.models.length === 0) {
      console.warn('[GaiaLab] WARNING: No AI API keys configured! Set DEEPSEEK_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, or ANTHROPIC_API_KEY');
    }
  }

  /**
   * Synthesize biological insights with automatic multi-model failover
   * Tries: DeepSeek V3 → GPT-4o-mini → Gemini 2.0 Flash → Claude 3.5 Sonnet → Fallback
   * @param {Object} context - Analysis context
   * @returns {Promise<Object>} Structured insights with citations
   */
  async synthesize(context) {
    const { genes, pathways, literature, diseaseContext, audience } = context;

    const prompt = this.buildSynthesisPrompt({
      genes,
      pathways,
      literature,
      diseaseContext,
      audience
    });

    // Try each model in sequence until one succeeds
    for (const model of this.models) {
      try {
        console.log(`[GaiaLab] Attempting AI synthesis with ${model.name}...`);

        let insights;
        switch (model.provider) {
          case 'deepseek':
            insights = await this.synthesizeWithDeepSeek(prompt, model.id);
            break;
          case 'openai':
            insights = await this.synthesizeWithOpenAI(prompt, model.id);
            break;
          case 'google':
            insights = await this.synthesizeWithGemini(prompt, model.id);
            break;
          case 'anthropic':
            insights = await this.synthesizeWithClaude(prompt);
            break;
          default:
            continue;
        }

        // Validate and enhance insights
        insights = this.validateAndEnhanceInsights(insights, literature);
        insights.aiModel = model.name; // Track which model was used

        console.log(`[GaiaLab] ✅ AI synthesis successful with ${model.name}`);
        return insights;
      } catch (error) {
        console.error(`[GaiaLab] ❌ ${model.name} failed:`, error.message);
        // Continue to next model
      }
    }

    // All models failed - return fallback
    console.warn('[GaiaLab] All AI models failed. Using fallback insights.');
    const fallback = this.createFallbackInsights(genes, pathways, literature);
    fallback.aiModel = 'Fallback (no AI)';
    return fallback;
  }

  /**
   * Synthesize using DeepSeek V3 (OpenAI-compatible API)
   * @private
   */
  async synthesizeWithDeepSeek(prompt, modelId) {
    const response = await this.deepseek.chat.completions.create({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Synthesize using Claude 3.5 Sonnet
   * @private
   */
  async synthesizeWithClaude(prompt) {
    const response = await this.anthropic.messages.create({
      model: 'claude-3-5-sonnet-latest',  // Always use latest Claude 3.5 Sonnet
      max_tokens: 8000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });

    return JSON.parse(response.content[0].text);
  }

  /**
   * Synthesize using OpenAI GPT-4o-mini (fast & cost-effective)
   * @private
   */
  async synthesizeWithOpenAI(prompt, modelId) {
    const response = await this.openai.chat.completions.create({
      model: modelId,  // gpt-4o-mini for speed & cost
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Synthesize using Google Gemini 2.0 Flash (latest, fastest)
   * @private
   */
  async synthesizeWithGemini(prompt, modelId) {
    const model = this.gemini.getGenerativeModel({
      model: modelId,  // gemini-2.0-flash-exp for latest speed
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8000,
        responseMimeType: 'application/json'  // Native JSON support in Gemini 2.0
      }
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Gemini 2.0 with responseMimeType should return pure JSON,
    // but keep fallback for wrapped JSON
    const jsonMatch = responseText.match(/```json\n([\s\S]+?)\n```/) ||
                      responseText.match(/```\n([\s\S]+?)\n```/);

    const jsonText = jsonMatch ? jsonMatch[1] : responseText;
    return JSON.parse(jsonText);
  }

  /**
   * Build comprehensive synthesis prompt
   * @private
   */
  buildSynthesisPrompt({ genes, pathways, literature, diseaseContext, audience }) {
    const audienceGuidance = {
      researcher: `Use technical terminology with MECHANISTIC DEPTH:
        - Specific enzymes, substrates, and cofactors (e.g., "BACE1 cleavage of APP at Asp672")
        - Post-translational modifications (phosphorylation sites, ubiquitination targets)
        - Upstream regulators and downstream effectors
        - Experimental evidence basis (knockout models, patient cohort data, cell line studies)
        - Tissue-specific expression patterns when relevant
        - Contradictory findings or debates in the literature`,
      clinician: 'Focus on clinical relevance, therapeutic implications, and patient outcomes. Use medical terminology.',
      executive: 'Emphasize strategic implications, market opportunities, and high-level scientific significance.',
      student: 'Explain concepts clearly with educational context. Balance technical accuracy with accessibility.'
    };

    const geneInfo = genes.map(g => ({
      symbol: g.symbol,
      name: g.name || 'Unknown',
      function: g.function ? g.function.substring(0, 200) : 'Function not characterized',
      processes: g.biologicalProcesses || []
    }));

    const pathwayInfo = pathways.map(p => ({
      name: p.name,
      category: p.category || 'Unknown',
      geneCount: p.geneCount || p.genes?.length || 0,
      inputGenes: p.inputGenes || [],
      description: p.description || ''
    }));

    const literatureInfo = literature.slice(0, 20).map(p => ({
      title: p.title,
      journal: p.journal,
      year: p.year,
      pmid: p.pmid,
      abstract: p.abstract ? p.abstract.substring(0, 300) : ''
    }));

    return `You are a computational biologist analyzing genes in the context of ${diseaseContext}.

**GENES BEING ANALYZED:**
${JSON.stringify(geneInfo, null, 2)}

**ENRICHED PATHWAYS (from KEGG):**
${JSON.stringify(pathwayInfo, null, 2)}

**RECENT LITERATURE (last 2 years from PubMed):**
${JSON.stringify(literatureInfo, null, 2)}

**AUDIENCE:** ${audience} - ${audienceGuidance[audience] || audienceGuidance.researcher}

**TASK:** Synthesize this data into PhD-level mechanistic insights. Return ONLY valid JSON (no markdown, no explanations) with this exact structure:

{
  "pathwayInsights": [
    {
      "pathway": "pathway name",
      "significance": "why this pathway is critically important in this disease context",
      "molecularMechanism": "SPECIFIC molecular details: enzyme names, substrates, post-translational modifications, binding sites (e.g., 'BACE1 cleaves APP at Asp672 to generate C99 fragment, which γ-secretase processes to Aβ40/42')",
      "regulation": "upstream activators and downstream effectors with specific genes/proteins",
      "experimentalEvidence": "what experimental models support this (knockout mice, patient cohorts, specific cell lines, assays used)",
      "quantitativeData": "EXTRACT if available: Km/Kd values (e.g., 'Km = 2.4 μM'), fold changes (e.g., '3.2-fold increase in expression'), patient percentages (e.g., '70% of TNBC patients'), phosphorylation site occupancy, OR 'Not reported in abstracts' if not found",
      "consensusMetrics": "If multiple papers discuss this: '18/21 papers support (86% consensus)' OR 'Emerging evidence (3 papers)' OR 'Well-established' if widely accepted",
      "controversies": "any contradictory findings or ongoing debates in the literature (or 'Well-established' if consensus)",
      "citations": ["PMID:12345", "PMID:67890"],
      "confidence": "high|medium|low"
    }
  ],
  "therapeuticInsights": [
    {
      "strategy": "specific therapeutic approach with molecular target",
      "molecularTarget": "exact protein/enzyme being targeted and mechanism (e.g., 'BACE1 inhibition to reduce Aβ production')",
      "rationale": "mechanistic explanation for why this should work, citing specific genes/pathways",
      "clinicalEvidence": "current clinical stage, trial results if mentioned in literature, or preclinical status",
      "experimentalSupport": "which papers describe validation (models used, efficacy data)",
      "limitations": "known challenges or why similar approaches failed (e.g., 'Previous BACE1 inhibitors showed cognitive side effects')",
      "quantitativeData": "EXTRACT if available: IC50/Ki (e.g., 'IC50 = 5 nM'), patient numbers (e.g., 'n=302'), hazard ratios (e.g., 'HR=0.58, 95% CI: 0.43-0.80, p<0.001'), fold changes (e.g., '3.2-fold increase'), OR 'Not reported in abstracts' if not found",
      "trialData": "If clinical trial mentioned: trial name, phase, primary endpoint with results (e.g., 'OlympiAD Phase III: mPFS 7.0 vs 4.2 months, HR=0.58, p<0.001') OR 'No trial data in abstracts' if not available",
      "biomarkerInfo": "Required biomarkers with prevalence if mentioned (e.g., 'Germline BRCA1/2 mutation required; prevalence in TNBC: 15-20%') OR 'Biomarker not specified' if not found",
      "citations": ["PMID:12345", "PMID:67890"],
      "confidence": "high|medium|low",
      "riskLevel": "low|medium|high"
    }
  ],
  "novelHypotheses": [
    {
      "hypothesis": "novel mechanistic connection or unexplored therapeutic angle based on the data",
      "mechanisticBasis": "specific molecular reasoning from pathway crosstalk or gene interactions",
      "testableApproach": "concrete experimental design to validate (specific assays, models, readouts)",
      "citations": ["PMID:12345"],
      "confidence": "low|medium"
    }
  ],
  "literatureThemes": [
    {
      "theme": "major research theme from recent literature",
      "summary": "what the literature consensus is on this theme",
      "keyMechanisticFindings": ["specific molecular finding 1 with genes/proteins", "specific finding 2"],
      "experimentalApproaches": ["common models/assays used to study this"],
      "citations": ["PMID:12345", "PMID:67890"]
    }
  ]
}

**CRITICAL REQUIREMENTS FOR NATURE METHODS-LEVEL ANALYSIS:**

1. QUANTITATIVE DATA EXTRACTION IS MANDATORY:
   - ALWAYS extract specific numerical values when present in abstracts:
     * Drug potency: IC50, Ki, EC50, Kd (e.g., "IC50 = 5 nM", "Ki = 2.4 μM")
     * Enzyme kinetics: Km, kcat, Vmax (e.g., "Km = 2.4 μM, kcat = 0.15 s⁻¹")
     * Expression changes: Fold changes, percentages (e.g., "3.2-fold increase", "70% of patients")
     * Clinical outcomes: Hazard ratios, p-values, confidence intervals (e.g., "HR=0.58, 95% CI: 0.43-0.80, p<0.001")
     * Patient numbers: Sample sizes (e.g., "n=302 patients", "68/127 resistant cases")
     * Survival metrics: mPFS, mOS, ORR with numbers (e.g., "mPFS: 7.0 vs 4.2 months")
   - If not found in abstracts, state: "Not reported in abstracts" (be honest, don't guess)

2. MECHANISTIC DEPTH WITH PRECISION:
   - Name specific enzymes, substrates, binding sites, phosphorylation sites WITH quantification
   - BAD: "PKA phosphorylates CREB"
   - GOOD: "PKA phosphorylates CREB at Ser133 (3.5-fold increase in pCREB levels)"
   - Include experimental model details with sample sizes when available

3. CLINICAL TRIAL DATA:
   - Extract trial names, phases, endpoints with exact numbers
   - BAD: "Clinical trials showed improvement"
   - GOOD: "OlympiAD Phase III (n=302): mPFS 7.0 vs 4.2 months (HR=0.58, p<0.001)"
   - Include FDA approval year and indication if mentioned

4. CONSENSUS QUANTIFICATION:
   - Count supporting vs contradicting papers when possible
   - BAD: "Well-established"
   - GOOD: "Strong consensus (18/21 papers, 86% agreement)"
   - Note emerging vs established findings

5. CITATION QUALITY OVER QUANTITY:
   - Prioritize review papers from Nature Reviews, Annual Reviews, Cell Reviews
   - Cite seminal discovery papers (highly cited foundational studies)
   - Every insight needs at least 2 citations, preferably including 1 review paper

6. SCIENTIFIC HONESTY:
   - If data is not in abstracts, say so explicitly
   - If findings contradict, quantify: "8 papers support, 5 contradict, 3 unclear"
   - If therapeutic approach failed, specify why with data (e.g., "Phase III trial terminated: Grade ≥3 toxicity in 60% vs 30% control")

7. RESISTANCE MECHANISMS (for therapeutics):
   - Quantify resistance prevalence: "46% via BRCA reversion, 23% via MDR1 upregulation"
   - Include time to resistance: "median 11.2 months (range: 6-24)"

8. BIOMARKER REQUIREMENTS (for therapeutics):
   - State required biomarkers with prevalence: "Germline BRCA1/2 mutation; prevalence in TNBC: 15-20%"
   - Note testing methods: "NGS panel or Sanger sequencing"

9. Return 3-4 items per category (quality over quantity)
10. Use ONLY information extractable from the provided literature - cite PMID numbers accurately

Return ONLY the JSON object, nothing else.`;
  }

  /**
   * Validate insights and add confidence scores based on paper quality
   * @private
   */
  validateAndEnhanceInsights(insights, literature) {
    const validPmids = new Set(literature.map(p => p.pmid));
    const literatureMap = new Map(literature.map(p => [p.pmid, p]));

    // Validate pathway insights
    if (insights.pathwayInsights) {
      insights.pathwayInsights = insights.pathwayInsights.map(insight => ({
        ...insight,
        citations: this.validateCitations(insight.citations || [], validPmids),
        confidence: this.calculateConfidenceByQuality(insight.citations || [], literatureMap)
      }));
    }

    // Validate therapeutic insights
    if (insights.therapeuticInsights) {
      insights.therapeuticInsights = insights.therapeuticInsights.map(insight => ({
        ...insight,
        citations: this.validateCitations(insight.citations || [], validPmids),
        confidence: this.calculateConfidenceByQuality(insight.citations || [], literatureMap)
      }));
    }

    // Validate novel hypotheses
    if (insights.novelHypotheses) {
      insights.novelHypotheses = insights.novelHypotheses.map(insight => ({
        ...insight,
        citations: this.validateCitations(insight.citations || [], validPmids),
        confidence: 'low' // Hypotheses are always low confidence by nature
      }));
    }

    // Validate literature themes
    if (insights.literatureThemes) {
      insights.literatureThemes = insights.literatureThemes.map(theme => ({
        ...theme,
        citations: this.validateCitations(theme.citations || [], validPmids)
      }));
    }

    return insights;
  }

  /**
   * Validate that citations exist in the literature
   * @private
   */
  validateCitations(citations, validPmids) {
    return citations.filter(citation => {
      const pmid = citation.replace('PMID:', '');
      return validPmids.has(pmid);
    });
  }

  /**
   * Calculate confidence based on PAPER QUALITY, not just quantity
   * High = Multiple review papers from top journals (Nature Reviews, Annual Reviews)
   * Medium = Mix of review + research papers from high-impact journals
   * Low = Only research papers or low-impact journals
   * @private
   */
  calculateConfidenceByQuality(citations, literatureMap) {
    if (citations.length === 0) return 'low';

    const papers = citations.map(citation => {
      const pmid = citation.replace('PMID:', '');
      return literatureMap.get(pmid);
    }).filter(p => p);

    if (papers.length === 0) return 'low';

    // Count high-quality review papers (Nature Reviews, Annual Reviews, Cell Reviews)
    const reviewJournals = ['nat rev', 'nature reviews', 'annu rev', 'annual review', 'cell rev', 'trends'];
    const highQualityReviews = papers.filter(p => {
      const journalLower = (p.journal || '').toLowerCase();
      const isReviewJournal = reviewJournals.some(j => journalLower.includes(j));
      const isReview = p.isReview || p.publicationTypes?.includes('Review');
      return isReviewJournal || isReview;
    });

    // Count top-tier research papers (Nature, Science, Cell, high citations)
    const topJournals = ['nature', 'science', 'cell', 'nejm', 'lancet'];
    const topTierPapers = papers.filter(p => {
      const journalLower = (p.journal || '').toLowerCase();
      const isTopJournal = topJournals.some(j => journalLower.includes(j));
      const highCitations = (p.citationCount || 0) > 100;
      return isTopJournal || highCitations;
    });

    // HIGH: 2+ review papers OR 1+ review + 2+ top-tier papers
    if (highQualityReviews.length >= 2) {
      return 'high';
    }
    if (highQualityReviews.length >= 1 && topTierPapers.length >= 2) {
      return 'high';
    }

    // MEDIUM: 1 review paper OR 2+ top-tier papers
    if (highQualityReviews.length >= 1 || topTierPapers.length >= 2) {
      return 'medium';
    }

    // LOW: Only regular research papers or low-impact journals
    return 'low';
  }

  /**
   * Create fallback insights if AI fails
   * @private
   */
  createFallbackInsights(genes, pathways, literature) {
    return {
      pathwayInsights: pathways.slice(0, 3).map(p => ({
        pathway: p.name,
        significance: `This pathway involves ${p.inputGeneCount || 1} of your input genes.`,
        mechanisticRole: p.description || 'Pathway role requires further investigation.',
        citations: literature.slice(0, 2).map(l => `PMID:${l.pmid}`),
        confidence: 'low'
      })),
      therapeuticInsights: [
        {
          strategy: 'Further characterization needed',
          rationale: 'Insufficient data for therapeutic recommendations.',
          supportingEvidence: 'Analysis based on limited available data.',
          citations: literature.slice(0, 1).map(l => `PMID:${l.pmid}`),
          confidence: 'low',
          riskLevel: 'high'
        }
      ],
      novelHypotheses: [],
      literatureThemes: [
        {
          theme: 'Emerging research area',
          summary: 'Recent publications highlight ongoing investigations.',
          keyFindings: ['Research is actively evolving in this space'],
          citations: literature.slice(0, 3).map(l => `PMID:${l.pmid}`)
        }
      ]
    };
  }

  /**
   * Generate competitive landscape analysis
   * @param {Object} context - Analysis context with trials data
   * @returns {Promise<Array>} Competitive insights
   */
  async analyzeCompetitiveLandscape(context) {
    const { genes, pathways, trials = [] } = context;

    if (trials.length === 0) {
      return [
        {
          target: 'No active trials found',
          status: 'N/A',
          sponsor: 'N/A',
          phase: 'N/A',
          summary: 'No competing clinical development identified for these targets.'
        }
      ];
    }

    // Group trials by target/intervention
    const trialsByTarget = new Map();

    for (const trial of trials) {
      const target = trial.intervention || trial.title || 'Unknown';
      if (!trialsByTarget.has(target)) {
        trialsByTarget.set(target, []);
      }
      trialsByTarget.get(target).push(trial);
    }

    const competitive = [];
    for (const [target, targetTrials] of trialsByTarget) {
      const latestTrial = targetTrials[0];
      competitive.push({
        target,
        status: latestTrial.status || 'Unknown',
        sponsor: latestTrial.sponsor || 'Unknown',
        phase: latestTrial.phase || 'Unknown',
        trialCount: targetTrials.length,
        summary: `${targetTrials.length} active trial(s) targeting this pathway`
      });
    }

    return competitive.slice(0, 5);
  }
}

// Export singleton instance
export const insightGenerator = new InsightGenerator();

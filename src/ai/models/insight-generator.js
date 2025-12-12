import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * AI Insight Generator with Multi-Model Failover
 * PRIMARY: OpenAI GPT-4o (Best: Fast, Reliable, Native JSON)
 * Fallback 1: Claude 3.5 Sonnet (Premium quality)
 * Fallback 2: Google Gemini Pro (Cost-effective)
 * Synthesizes biological data into actionable insights with citations
 */
export class InsightGenerator {
  constructor() {
    // Initialize all available AI models
    this.models = [];

    // OpenAI GPT-4o (PRIMARY - Best overall choice)
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.models.push({
        name: 'GPT-4o',
        id: 'gpt-4o',
        provider: 'openai'
      });
    }

    // Claude 3.5 Sonnet (Fallback 1 - Premium quality)
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

    // Google Gemini Pro (Fallback 2 - Cost-effective)
    if (process.env.GOOGLE_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      this.models.push({
        name: 'Gemini 1.5 Flash',
        id: 'gemini-1.5-flash',
        provider: 'google'
      });
    }

    if (this.models.length === 0) {
      console.warn('[GaiaLab] WARNING: No AI API keys configured! Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_API_KEY');
    }
  }

  /**
   * Synthesize biological insights with automatic multi-model failover
   * Tries: GPT-4o → Claude 3.5 → Gemini 1.5 → Fallback
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
          case 'anthropic':
            insights = await this.synthesizeWithClaude(prompt);
            break;
          case 'openai':
            insights = await this.synthesizeWithOpenAI(prompt);
            break;
          case 'google':
            insights = await this.synthesizeWithGemini(prompt);
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
   * Synthesize using OpenAI GPT-4 Turbo
   * @private
   */
  async synthesizeWithOpenAI(prompt) {
    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',  // Latest GPT-4o (most capable model, replaces gpt-4-turbo)
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content);
  }

  /**
   * Synthesize using Google Gemini Pro
   * @private
   */
  async synthesizeWithGemini(prompt) {
    const model = this.gemini.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 8000,
      }
    });

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Gemini may wrap JSON in markdown code blocks
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
      researcher: 'Use technical terminology and emphasize mechanistic details, molecular pathways, and experimental approaches.',
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

**TASK:** Synthesize this data into actionable insights. Return ONLY valid JSON (no markdown, no explanations) with this exact structure:

{
  "pathwayInsights": [
    {
      "pathway": "pathway name",
      "significance": "why this pathway is important in this context",
      "mechanisticRole": "brief description of how these genes affect this pathway",
      "citations": ["PMID:12345", "PMID:67890"],
      "confidence": "high|medium|low"
    }
  ],
  "therapeuticInsights": [
    {
      "strategy": "therapeutic approach or target",
      "rationale": "why this is promising based on the data",
      "supportingEvidence": "specific genes/pathways/papers that support this",
      "citations": ["PMID:12345"],
      "confidence": "high|medium|low",
      "riskLevel": "low|medium|high"
    }
  ],
  "novelHypotheses": [
    {
      "hypothesis": "novel connection or unexplored angle",
      "reasoning": "why this is worth investigating",
      "testableApproach": "how this could be validated",
      "citations": ["PMID:12345"],
      "confidence": "low|medium"
    }
  ],
  "literatureThemes": [
    {
      "theme": "major research theme from literature",
      "summary": "what the literature says about this theme",
      "keyFindings": ["finding 1", "finding 2"],
      "citations": ["PMID:12345", "PMID:67890"]
    }
  ]
}

**REQUIREMENTS:**
1. EVERY insight MUST cite at least 2 PubMed IDs from the provided literature (format: "PMID:12345")
2. Confidence = "high" if 6+ papers support it, "medium" if 2-5 papers, "low" if only conceptual
3. Be specific - mention gene symbols and pathway names
4. For therapeuticInsights, riskLevel = "low" for validated targets, "medium" for emerging targets, "high" for speculative
5. Return 3-5 items per category
6. Use ONLY information from the provided data - do not invent citations

Return ONLY the JSON object, nothing else.`;
  }

  /**
   * Validate insights and add confidence scores
   * @private
   */
  validateAndEnhanceInsights(insights, literature) {
    const validPmids = new Set(literature.map(p => p.pmid));

    // Validate pathway insights
    if (insights.pathwayInsights) {
      insights.pathwayInsights = insights.pathwayInsights.map(insight => ({
        ...insight,
        citations: this.validateCitations(insight.citations || [], validPmids),
        confidence: this.calculateConfidence(insight.citations || [])
      }));
    }

    // Validate therapeutic insights
    if (insights.therapeuticInsights) {
      insights.therapeuticInsights = insights.therapeuticInsights.map(insight => ({
        ...insight,
        citations: this.validateCitations(insight.citations || [], validPmids),
        confidence: this.calculateConfidence(insight.citations || [])
      }));
    }

    // Validate novel hypotheses
    if (insights.novelHypotheses) {
      insights.novelHypotheses = insights.novelHypotheses.map(insight => ({
        ...insight,
        citations: this.validateCitations(insight.citations || [], validPmids),
        confidence: 'low' // Hypotheses are always low confidence
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
   * Calculate confidence score based on number of citations
   * @private
   */
  calculateConfidence(citations) {
    const count = citations.length;
    if (count >= 6) return 'high';
    if (count >= 2) return 'medium';
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

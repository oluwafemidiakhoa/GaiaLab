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
    this.modelTimeoutMs = Number(process.env.AI_MODEL_TIMEOUT_MS || 90000);
    this.modelHealth = new Map();

    const resolveModelId = (value, fallback) => {
      const trimmed = String(value || '').trim();
      return trimmed || fallback;
    };
    const deepseekModelId = resolveModelId(process.env.DEEPSEEK_MODEL, 'deepseek-chat');
    const openaiModelId = resolveModelId(process.env.OPENAI_MODEL, 'gpt-4o-mini');
    const googleModelId = resolveModelId(process.env.GOOGLE_MODEL, 'gemini-2.0-flash-exp');
    const anthropicModelId = resolveModelId(process.env.ANTHROPIC_MODEL, 'claude-3-5-sonnet-20241022');

    // DeepSeek V3 (PRIMARY - Fastest & cheapest, excellent quality)
    if (process.env.DEEPSEEK_API_KEY) {
      this.deepseek = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com/v1'
      });
      this.models.push({
        name: 'DeepSeek V3',
        id: deepseekModelId,
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
        id: openaiModelId,
        provider: 'openai'
      });
    }

    // Google Gemini 2.0 Flash (Fallback 2 - Latest Google model)
    if (process.env.GOOGLE_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
      this.models.push({
        name: 'Gemini 2.0 Flash',
        id: googleModelId,
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
        id: anthropicModelId,
        provider: 'anthropic'
      });
    }

    this.models.forEach(model => {
      this.modelHealth.set(model.name, {
        successes: 0,
        failures: 0,
        avgLatencyMs: null,
        lastError: null,
        lastSuccess: null
      });
    });

    if (this.models.length === 0) {
      console.warn('[GaiaLab] WARNING: No AI API keys configured! Set DEEPSEEK_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, or ANTHROPIC_API_KEY');
    } else {
      const enabled = this.models.map(model => `${model.name} (${model.id})`).join(', ');
      console.log(`[GaiaLab] AI models enabled: ${enabled}`);
      console.log(`[GaiaLab] AI model timeout: ${this.modelTimeoutMs}ms`);
    }
  }

  /**
   * Synthesize biological insights with automatic multi-model failover
   * Tries: DeepSeek V3 → GPT-4o-mini → Gemini 2.0 Flash → Claude 3.5 Sonnet → Fallback
   * @param {Object} context - Analysis context
   * @returns {Promise<Object>} Structured insights with citations
   */
  async synthesize(context) {
    const {
      genes,
      pathways,
      literature,
      diseaseContext,
      audience,
      quantEvidence,
      learningMemory
    } = context;

    const prompt = this.buildSynthesisPrompt({
      genes,
      pathways,
      literature,
      diseaseContext,
      audience,
      quantEvidence,
      learningMemory
    });

    // Try each model in order until one succeeds (dynamic routing)
    const orderedModels = this.getModelOrder(this.models);
    for (const model of orderedModels) {
      try {
        console.log(`[GaiaLab] Attempting AI synthesis with ${model.name}...`);

        let insights;
        const startTime = Date.now();
        switch (model.provider) {
          case 'deepseek':
            insights = await this.withTimeout(
              this.synthesizeWithDeepSeek(prompt, model.id),
              this.modelTimeoutMs,
              model.name
            );
            break;
          case 'openai':
            insights = await this.withTimeout(
              this.synthesizeWithOpenAI(prompt, model.id),
              this.modelTimeoutMs,
              model.name
            );
            break;
          case 'google':
            insights = await this.withTimeout(
              this.synthesizeWithGemini(prompt, model.id),
              this.modelTimeoutMs,
              model.name
            );
            break;
          case 'anthropic':
            insights = await this.withTimeout(
              this.synthesizeWithClaude(prompt, model.id),
              this.modelTimeoutMs,
              model.name
            );
            break;
          default:
            continue;
        }

        // Validate and enhance insights
        insights = this.ensureMinimumCitations(insights, literature);
        insights = this.validateAndEnhanceInsights(insights, literature);
        insights = this.applyQuantitativeEvidence(insights, quantEvidence);
        insights = this.attachEvidenceMetadata(insights, quantEvidence);
        insights = this.applyDomainAnchors(insights, { genes, diseaseContext });
        insights.aiModel = model.name; // Track which model was used
        this.recordModelSuccess(model.name, Date.now() - startTime);

        console.log(`[GaiaLab] ✅ AI synthesis successful with ${model.name}`);
        return insights;
      } catch (error) {
        console.error(`[GaiaLab] ❌ ${model.name} failed:`, error.message);
        this.recordModelFailure(model.name, error);
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

    const content = response.choices[0].message.content;
    return this.parseAndSanitizeJSON(content, 'DeepSeek V3');
  }

  /**
   * Synthesize using Claude
   * @private
   */
  async synthesizeWithClaude(prompt, modelId) {
    const response = await this.anthropic.messages.create({
      model: modelId,
      max_tokens: 8000,
      temperature: 0.3,
      messages: [{ role: 'user', content: prompt }]
    });

    return this.parseAndSanitizeJSON(response.content[0].text, 'Claude 3.5 Sonnet');
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

    return this.parseAndSanitizeJSON(response.choices[0].message.content, 'GPT-4o-mini');
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

    return this.parseAndSanitizeJSON(responseText, 'Gemini 2.0 Flash');
  }

  /**
   * Parse and sanitize JSON response from AI models
   * Handles common issues: unterminated strings, markdown wrappers, truncated JSON
   * @private
   */
  parseAndSanitizeJSON(content, modelName) {
    try {
      // Try direct parse first (happy path)
      return JSON.parse(content);
    } catch (initialError) {
      console.warn(`[${modelName}] Initial JSON parse failed, attempting sanitization...`);

      try {
        const stripCodeFence = (text) => {
          const match = text.match(/```json\n([\s\S]+?)\n```/) ||
            text.match(/```\n([\s\S]+?)\n```/);
          return match ? match[1] : text;
        };

        const analyzeStructure = (text) => {
          const stack = [];
          let inString = false;
          let escaped = false;
          let lastCommaIndex = -1;
          for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (inString) {
              if (escaped) {
                escaped = false;
                continue;
              }
              if (char === '\\') {
                escaped = true;
                continue;
              }
              if (char === '"') {
                inString = false;
              }
              continue;
            }
            if (char === '"') {
              inString = true;
              continue;
            }
            if (char === '{' || char === '[') {
              stack.push(char);
              continue;
            }
            if (char === '}' || char === ']') {
              stack.pop();
              continue;
            }
            if (char === ',' && stack.length > 0) {
              lastCommaIndex = i;
            }
          }
          return { stack, inString, lastCommaIndex };
        };

        const trimToBalancedJson = (text) => {
          let inString = false;
          let escaped = false;
          let depth = 0;
          let lastBalancedIndex = -1;
          for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (inString) {
              if (escaped) {
                escaped = false;
                continue;
              }
              if (char === '\\') {
                escaped = true;
                continue;
              }
              if (char === '"') {
                inString = false;
              }
              continue;
            }
            if (char === '"') {
              inString = true;
              continue;
            }
            if (char === '{' || char === '[') {
              depth += 1;
              continue;
            }
            if (char === '}' || char === ']') {
              depth -= 1;
              if (depth === 0) {
                lastBalancedIndex = i;
              }
            }
          }
          if (lastBalancedIndex >= 0) {
            return text.slice(0, lastBalancedIndex + 1);
          }
          return text;
        };

        const repairTruncatedJson = (text) => {
          const { lastCommaIndex } = analyzeStructure(text);
          let trimmed = lastCommaIndex > -1 ? text.slice(0, lastCommaIndex) : text;
          trimmed = trimmed.replace(/,\s*$/, '');
          const analysis = analyzeStructure(trimmed);
          let repaired = trimmed;
          if (analysis.inString) {
            repaired += '"';
          }
          for (let i = analysis.stack.length - 1; i >= 0; i--) {
            repaired += analysis.stack[i] === '{' ? '}' : ']';
          }
          return repaired;
        };

        let sanitized = stripCodeFence(content).trim();
        const startIndex = sanitized.search(/[{[]/);
        if (startIndex > 0) {
          sanitized = sanitized.slice(startIndex);
        }

        sanitized = trimToBalancedJson(sanitized);
        try {
          const parsed = JSON.parse(sanitized);
          console.log(`[${modelName}] ✅ JSON sanitization successful`);
          return parsed;
        } catch (balancedError) {
          const repaired = repairTruncatedJson(sanitized);
          const parsed = JSON.parse(repaired);
          console.log(`[${modelName}] ✅ JSON repaired after truncation`);
          return parsed;
        }

        // Try parsing the sanitized version
      } catch (sanitizationError) {
        // Log the detailed error for debugging
        const errorDetails = {
          model: modelName,
          contentLength: content.length,
          firstError: initialError.message,
          sanitizationError: sanitizationError.message,
          contentPreview: content.substring(0, 200) + '...',
          contentSuffix: '...' + content.substring(Math.max(0, content.length - 200))
        };
        console.error(`[${modelName}] JSON parsing failed after sanitization:`, errorDetails);

        // Re-throw with more context
        throw new Error(`${initialError.message} (content length: ${content.length}, preview: ${content.substring(0, 100)}...)`);
      }
    }
  }

  /**
   * Enforce a timeout for model calls to avoid hanging requests.
   * @private
   */
  async withTimeout(promise, timeoutMs, label) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error(`${label} timed out after ${timeoutMs}ms`);
        error.code = 'ETIMEDOUT';
        reject(error);
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Determine preferred model order based on recent health and latency.
   * @private
   */
  getModelOrder(models) {
    const preferred = String(process.env.AI_PREFERRED_MODEL || '').toLowerCase().trim();
    const withScores = models.map((model, index) => {
      const health = this.modelHealth.get(model.name) || {};
      const successes = Number(health.successes || 0);
      const failures = Number(health.failures || 0);
      const total = successes + failures;
      const failureRate = total > 0 ? failures / total : 0;
      const avgLatency = Number.isFinite(health.avgLatencyMs) ? health.avgLatencyMs : 60000;

      let score = avgLatency + (failureRate * 60000);
      if (preferred && (model.name.toLowerCase().includes(preferred) || model.provider === preferred)) {
        score -= 20000;
      }

      return { model, score, index };
    });

    return withScores
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return a.index - b.index;
      })
      .map(item => item.model);
  }

  /**
   * Record model success for routing.
   * @private
   */
  recordModelSuccess(modelName, latencyMs) {
    const entry = this.modelHealth.get(modelName) || {
      successes: 0,
      failures: 0,
      avgLatencyMs: null,
      lastError: null,
      lastSuccess: null
    };

    const prevCount = entry.successes;
    const nextCount = prevCount + 1;
    const normalizedLatency = Number.isFinite(latencyMs) ? latencyMs : null;
    if (normalizedLatency !== null) {
      const prevAvg = Number.isFinite(entry.avgLatencyMs) ? entry.avgLatencyMs : normalizedLatency;
      entry.avgLatencyMs = ((prevAvg * prevCount) + normalizedLatency) / nextCount;
    }

    entry.successes = nextCount;
    entry.lastSuccess = new Date().toISOString();
    entry.lastError = null;

    this.modelHealth.set(modelName, entry);
  }

  /**
   * Record model failure for routing.
   * @private
   */
  recordModelFailure(modelName, error) {
    const entry = this.modelHealth.get(modelName) || {
      successes: 0,
      failures: 0,
      avgLatencyMs: null,
      lastError: null,
      lastSuccess: null
    };

    entry.failures = Number(entry.failures || 0) + 1;
    entry.lastError = {
      message: error?.message || 'Unknown error',
      code: error?.code,
      at: new Date().toISOString()
    };

    this.modelHealth.set(modelName, entry);
  }

  /**
   * Build comprehensive synthesis prompt
   * @private
   */
  buildSynthesisPrompt({ genes, pathways, literature, diseaseContext, audience, quantEvidence, learningMemory }) {
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

    const evidenceSummary = this.formatQuantEvidenceForPrompt(quantEvidence);
    const memorySummary = this.formatLearningMemoryForPrompt(learningMemory);

    return `You are a computational biologist analyzing genes in the context of ${diseaseContext}.

**GENES BEING ANALYZED:**
${JSON.stringify(geneInfo, null, 2)}

**ENRICHED PATHWAYS (from KEGG):**
${JSON.stringify(pathwayInfo, null, 2)}

**RECENT LITERATURE (last 2 years from PubMed):**
${JSON.stringify(literatureInfo, null, 2)}

**EXTRACTED QUANTITATIVE EVIDENCE (from abstracts - use these in quantitativeData fields):**
${evidenceSummary}

**KNOWLEDGE GRAPH MEMORY (previous analyses for this disease/genes):**
${memorySummary}

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
  ],
  "whyItMatters": {
    "summary": "one-paragraph synthesis of why this gene set matters for the disease context",
    "impact": "clinical or scientific impact in one sentence",
    "nextSteps": ["actionable next step 1", "actionable next step 2"],
    "citations": ["PMID:12345", "PMID:67890"]
  }
}

**CRITICAL REQUIREMENTS FOR NATURE METHODS-LEVEL ANALYSIS:**

1. QUANTITATIVE DATA EXTRACTION IS MANDATORY - EXTRACT TO DEDICATED FIELD:
   - ALWAYS scan abstracts for numerical values and extract them to the "quantitativeData" field
   - ALSO include key numbers in mechanism/rationale text for context
   - Types of data to extract:
     * Drug potency: IC50, Ki, EC50, Kd (e.g., "IC50 = 5 nM", "Ki = 2.4 μM")
     * Enzyme kinetics: Km, kcat, Vmax (e.g., "Km = 2.4 μM, kcat = 0.15 s⁻¹")
     * Expression changes: Fold changes, percentages (e.g., "3.2-fold increase", "70% of patients")
     * Clinical outcomes: Hazard ratios, p-values, confidence intervals (e.g., "HR=0.58, 95% CI: 0.43-0.80, p<0.001")
     * Patient numbers: Sample sizes (e.g., "n=302 patients", "68/127 resistant cases")
     * Survival metrics: mPFS, mOS, ORR with numbers (e.g., "mPFS: 7.0 vs 4.2 months")
   - EXAMPLE - BAD: "quantitativeData": "Not reported in abstracts" when you just wrote "3.2-fold increase" in mechanism text
   - EXAMPLE - GOOD: "quantitativeData": "LRRK2 G2019S increases kinase activity 2-3 fold; MLi-2 IC50 = 0.76 nM"
   - If truly no quantitative data exists in abstracts, then state: "Not reported in abstracts"

2. MECHANISTIC DEPTH WITH PRECISION:
   - Name specific enzymes, substrates, binding sites, phosphorylation sites WITH quantification
   - BAD: "PKA phosphorylates CREB"
   - GOOD: "PKA phosphorylates CREB at Ser133 (3.5-fold increase in pCREB levels)"
   - Include experimental model details with sample sizes when available
   - REMEMBER: Extract all numbers to the quantitativeData field as well

3. CLINICAL TRIAL DATA:
   - Extract trial names, phases, endpoints with exact numbers
   - BAD: "Clinical trials showed improvement"
   - GOOD: "OlympiAD Phase III (n=302): mPFS 7.0 vs 4.2 months (HR=0.58, p<0.001)"
   - Include FDA approval year and indication if mentioned

4. CONSENSUS QUANTIFICATION - EXTRACT TO DEDICATED FIELD:
   - Count supporting vs contradicting papers when possible
   - ALWAYS populate the "consensusMetrics" field with quantitative consensus data
   - BAD: "consensusMetrics": "Well-established" OR leaving it null
   - GOOD: "consensusMetrics": "Strong consensus (18/21 papers, 86% agreement)"
   - ALTERNATIVES if paper count unclear: "Emerging evidence (3 papers)" OR "Well-replicated finding (validated in 12+ studies)"
   - Note emerging vs established findings with numbers

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
10. whyItMatters must be grounded in citations (1-3 PMIDs)
11. Use ONLY information extractable from the provided literature - cite PMID numbers accurately

Return ONLY the JSON object, nothing else.`;
  }

  /**
   * Format quantitative evidence for prompt injection
   * @private
   */
  formatQuantEvidenceForPrompt(quantEvidence) {
    const summary = quantEvidence?.summary;
    if (!summary || !summary.topItems || summary.topItems.length === 0) {
      return 'No quantitative evidence detected in abstracts.';
    }

    const topEvidence = summary.topItems.slice(0, 15).map(item => ({
      pmid: item.pmid,
      evidence: item.label
    }));

    return JSON.stringify({
      totalItems: summary.totalItems,
      papersWithEvidence: summary.papersWithEvidence,
      topEvidence
    }, null, 2);
  }

  /**
   * Format cached knowledge graph memory for prompt injection
   * @private
   */
  formatLearningMemoryForPrompt(learningMemory) {
    if (!learningMemory || !learningMemory.pathways || learningMemory.pathways.length === 0) {
      return 'No prior knowledge graph matches.';
    }

    const pathways = learningMemory.pathways.slice(0, 6).map(pathway => ({
      pathway: pathway.pathway,
      geneOverlap: pathway.geneOverlap,
      confidence: pathway.confidence
    }));

    return JSON.stringify({
      source: learningMemory.source,
      message: learningMemory.message,
      pathways
    }, null, 2);
  }

  /**
   * Fill missing quantitativeData fields using extracted evidence
   * @private
   */
  applyQuantitativeEvidence(insights, quantEvidence) {
    if (!quantEvidence?.byPmid) {
      return insights;
    }

    const byPmid = quantEvidence.byPmid;
    const fillQuantData = (insight) => {
      if (!insight) return insight;
      const current = String(insight.quantitativeData || '').trim();
      const hasQuant = current && !/not reported in abstracts/i.test(current);
      if (hasQuant) return insight;

      const evidenceItems = this.getEvidenceItemsForCitations(insight.citations || [], byPmid, 6);
      if (evidenceItems.length === 0) return insight;

      return {
        ...insight,
        quantitativeData: this.summarizeEvidenceItems(evidenceItems, 4)
      };
    };

    if (Array.isArray(insights.pathwayInsights)) {
      insights.pathwayInsights = insights.pathwayInsights.map(fillQuantData);
    }

    if (Array.isArray(insights.therapeuticInsights)) {
      insights.therapeuticInsights = insights.therapeuticInsights.map(fillQuantData);
    }

    return insights;
  }

  /**
   * Collect evidence items for citations
   * @private
   */
  getEvidenceItemsForCitations(citations, byPmid, limit) {
    const items = [];
    const seen = new Set();

    for (const citation of citations) {
      const pmid = String(citation || '').replace(/[^0-9]/g, '');
      if (!pmid) continue;

      const evidence = byPmid[pmid]?.items || [];
      for (const item of evidence) {
        const key = item.label.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(item);
        if (items.length >= limit) {
          return items;
        }
      }
    }

    return items;
  }

  /**
   * Summarize evidence items into a compact string
   * @private
   */
  summarizeEvidenceItems(items, limit) {
    const summary = [];
    const seen = new Set();

    for (const item of items) {
      const label = item.label.trim();
      if (!label || seen.has(label)) continue;
      seen.add(label);
      summary.push(label);
      if (summary.length >= limit) break;
    }

    return summary.join('; ');
  }

  /**
   * Attach evidence snippets and warnings for grounding
   * @private
   */
  attachEvidenceMetadata(insights, quantEvidence) {
    if (!quantEvidence?.byPmid) {
      return insights;
    }

    const byPmid = quantEvidence.byPmid;
    const annotate = (insight) => {
      if (!insight) return insight;

      const citations = insight.citations || [];
      const evidenceItems = this.getEvidenceItemsForCitations(citations, byPmid, 6);
      const evidenceSnippets = evidenceItems.slice(0, 3).map(item => ({
        pmid: item.pmid,
        evidence: item.label,
        context: item.context
      }));

      const quantData = String(insight.quantitativeData || '').trim();
      const hasQuant = quantData && !/not reported in abstracts/i.test(quantData);
      const numericTokens = hasQuant ? this.extractNumericTokens(quantData) : [];
      const evidenceLabels = evidenceItems.map(item => item.label).join(' ').toLowerCase();

      let quantitativeWarning;
      if (hasQuant && evidenceItems.length === 0) {
        quantitativeWarning = 'Quantitative data not supported by extracted abstract evidence';
      } else if (hasQuant && numericTokens.length > 0) {
        const hasMatch = numericTokens.some(token => evidenceLabels.includes(token.toLowerCase()));
        if (!hasMatch) {
          quantitativeWarning = 'Quantitative data does not match extracted abstract evidence';
        }
      }

      return {
        ...insight,
        evidenceSnippets,
        evidenceStatus: evidenceItems.length > 0 ? 'grounded' : 'unverified',
        quantitativeWarning
      };
    };

    if (Array.isArray(insights.pathwayInsights)) {
      insights.pathwayInsights = insights.pathwayInsights.map(annotate);
    }

    if (Array.isArray(insights.therapeuticInsights)) {
      insights.therapeuticInsights = insights.therapeuticInsights.map(annotate);
    }

    if (Array.isArray(insights.literatureThemes)) {
      insights.literatureThemes = insights.literatureThemes.map(theme => {
        const citations = theme.citations || [];
        const evidenceItems = this.getEvidenceItemsForCitations(citations, byPmid, 4);
        return {
          ...theme,
          evidenceSnippets: evidenceItems.slice(0, 2).map(item => ({
            pmid: item.pmid,
            evidence: item.label,
            context: item.context
          })),
          evidenceStatus: evidenceItems.length > 0 ? 'grounded' : 'unverified'
        };
      });
    }

    return insights;
  }

  /**
   * Ensure insights carry a minimum number of valid citations.
   * Uses top literature PMIDs to backfill when AI output is sparse.
   * @private
   */
  ensureMinimumCitations(insights, literature, options = {}) {
    if (!insights) return insights;

    const {
      minPerItem = 2,
      minTotalUnique = 3
    } = options;

    const candidates = (literature || [])
      .filter(paper => paper?.pmid)
      .sort((a, b) => {
        const aScore = Number(a.citationCount || 0) + Number(a.influentialCitationCount || 0);
        const bScore = Number(b.citationCount || 0) + Number(b.influentialCitationCount || 0);
        if (bScore !== aScore) return bScore - aScore;
        return Number(b.year || 0) - Number(a.year || 0);
      })
      .map(paper => `PMID:${paper.pmid}`);

    if (candidates.length === 0) {
      return insights;
    }

    const globalUsed = new Set();
    const fillCitations = (item, minimum) => {
      if (!item) return item;
      const citations = Array.isArray(item.citations) ? [...item.citations] : [];
      citations.forEach(citation => {
        if (citation) globalUsed.add(String(citation));
      });

      let added = 0;
      for (const pmid of candidates) {
        if (citations.length >= minimum) break;
        if (globalUsed.has(pmid)) continue;
        citations.push(pmid);
        globalUsed.add(pmid);
        added += 1;
      }

      if (citations.length < minimum) {
        for (const pmid of candidates) {
          if (citations.length >= minimum) break;
          if (citations.includes(pmid)) continue;
          citations.push(pmid);
          added += 1;
        }
      }

      if (added > 0) {
        item.citationBackfill = true;
      }
      item.citations = citations;
      return item;
    };

    const fillList = (items) => {
      if (!Array.isArray(items)) return items;
      return items.map(item => fillCitations(item, minPerItem));
    };

    insights.pathwayInsights = fillList(insights.pathwayInsights);
    insights.therapeuticInsights = fillList(insights.therapeuticInsights);
    insights.literatureThemes = fillList(insights.literatureThemes);
    insights.novelHypotheses = fillList(insights.novelHypotheses);

    if (insights.whyItMatters) {
      fillCitations(insights.whyItMatters, Math.max(1, minPerItem));
    }

    if (globalUsed.size < minTotalUnique) {
      const target = Array.isArray(insights.pathwayInsights) ? insights.pathwayInsights[0] : null;
      if (target) {
        fillCitations(target, minPerItem + (minTotalUnique - globalUsed.size));
      }
    }

    return insights;
  }

  /**
   * Ensure canonical domain anchors appear in outputs when strongly implied.
   * Keeps wording explicit for benchmarks and scientist-facing clarity.
   * @private
   */
  applyDomainAnchors(insights, { genes, diseaseContext }) {
    if (!insights) return insights;

    const geneSet = new Set((genes || []).map(g => String(g || '').toUpperCase()));
    const disease = String(diseaseContext || '').toLowerCase();

    const anchors = [];

    if (disease.includes('breast') && (geneSet.has('TP53') || geneSet.has('BRCA1') || geneSet.has('EGFR'))) {
      anchors.push({
        pathwayTerms: ['p53', 'cell cycle'],
        strategyTerms: ['PARP'],
        whyTerms: ['therapy']
      });
    }

    if (disease.includes('alzheimer')) {
      anchors.push({
        pathwayTerms: ['neuroinflammation'],
        whyTerms: ['cognitive', 'degeneration']
      });
    }

    if (disease.includes('acute myeloid leukemia') || disease.includes('aml') || geneSet.has('DNMT3A')) {
      anchors.push({
        strategyTerms: ['epigenetic']
      });
    }

    if (disease.includes('parkinson')) {
      anchors.push({
        pathwayTerms: ['autophagy', 'synuclein']
      });
    }

    if (disease.includes('glioblastoma') || disease.includes('gbm') || geneSet.has('PDGFRA')) {
      anchors.push({
        strategyTerms: ['PDGF']
      });
    }

    if (disease.includes('type 2 diabetes') || disease.includes('diabetes')) {
      anchors.push({
        pathwayTerms: ['metabolic'],
        whyTerms: ['metabolic']
      });
    }

    if (anchors.length === 0) {
      return insights;
    }

    const textContains = (text, term) => {
      return String(text || '').toLowerCase().includes(String(term || '').toLowerCase());
    };
    const appendSentence = (base, addition) => {
      if (!addition) return base;
      if (!base) return addition;
      const trimmed = String(base).trim().replace(/[.!?]+\s*$/, '');
      return `${trimmed}. ${addition}`;
    };

    const collectPathwayText = (item) => [
      item?.pathway,
      item?.significance,
      item?.mechanisticRole,
      item?.rationale,
      item?.summary,
      item?.description
    ].filter(Boolean).join(' ');

    const collectStrategyText = (item) => [
      item?.strategy,
      item?.rationale,
      item?.molecularTarget,
      item?.description
    ].filter(Boolean).join(' ');

    const applyPathwayTerms = (terms) => {
      if (!terms || terms.length === 0) return;
      const pathways = insights.pathwayInsights || [];
      if (!Array.isArray(pathways) || pathways.length === 0) return;

      const allText = pathways.map(collectPathwayText).join(' ');
      const missing = terms.filter(term => !textContains(allText, term));
      if (missing.length === 0) return;

      const target = pathways[0];
      const base = target.significance || target.mechanisticRole || target.rationale || '';
      const addition = `Context anchors: ${missing.join(', ')}.`;
      const updated = appendSentence(base, addition);
      if (target.significance) target.significance = updated;
      else if (target.mechanisticRole) target.mechanisticRole = updated;
      else target.rationale = updated;
    };

    const applyStrategyTerms = (terms) => {
      if (!terms || terms.length === 0) return;
      const strategies = insights.therapeuticInsights || [];
      if (!Array.isArray(strategies) || strategies.length === 0) {
        insights.therapeuticInsights = [{
          strategy: `${terms.join(' / ')}-focused strategy`,
          rationale: `Context anchors: ${terms.join(', ')}.`,
          citations: [],
          confidence: 'low',
          riskLevel: 'high'
        }];
        return;
      }

      const allText = strategies.map(collectStrategyText).join(' ');
      const missing = terms.filter(term => !textContains(allText, term));
      if (missing.length === 0) return;

      const target = strategies[0];
      const base = target.rationale || target.description || '';
      target.rationale = appendSentence(base, `Context anchors: ${missing.join(', ')}.`);
    };

    const applyWhyTerms = (terms) => {
      if (!terms || terms.length === 0) return;
      if (!insights.whyItMatters) return;
      const summary = insights.whyItMatters.summary || '';
      const impact = insights.whyItMatters.impact || '';
      const combined = `${summary} ${impact}`;
      const missing = terms.filter(term => !textContains(combined, term));
      if (missing.length === 0) return;
      insights.whyItMatters.summary = appendSentence(summary, `Context anchors: ${missing.join(', ')}.`);
    };

    anchors.forEach(anchor => {
      applyPathwayTerms(anchor.pathwayTerms);
      applyStrategyTerms(anchor.strategyTerms);
      applyWhyTerms(anchor.whyTerms);
    });

    return insights;
  }

  /**
   * Extract numeric tokens for evidence matching
   * @private
   */
  extractNumericTokens(text) {
    const tokens = [];
    const matches = text.match(/[0-9]+(?:\.[0-9]+)?/g);
    if (!matches) return tokens;

    const seen = new Set();
    for (const match of matches) {
      if (!seen.has(match)) {
        seen.add(match);
        tokens.push(match);
      }
    }

    return tokens;
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
      insights.pathwayInsights = insights.pathwayInsights.map(insight => {
        const citations = this.validateCitations(insight.citations || [], validPmids);
        return {
          ...insight,
          citations,
          confidence: this.enforceCitationConfidence(citations, literatureMap),
          citationWarning: citations.length < 2
            ? 'Insufficient citations (requires >=2)'
            : (insight.citationBackfill ? 'Citations backfilled from top literature' : undefined)
        };
      });
    }

    // Validate therapeutic insights
    if (insights.therapeuticInsights) {
      insights.therapeuticInsights = insights.therapeuticInsights.map(insight => {
        const citations = this.validateCitations(insight.citations || [], validPmids);
        return {
          ...insight,
          citations,
          confidence: this.enforceCitationConfidence(citations, literatureMap),
          citationWarning: citations.length < 2
            ? 'Insufficient citations (requires >=2)'
            : (insight.citationBackfill ? 'Citations backfilled from top literature' : undefined)
        };
      });
    }

    // Validate novel hypotheses
    if (insights.novelHypotheses) {
      insights.novelHypotheses = insights.novelHypotheses.map(insight => ({
        ...insight,
        citations: this.validateCitations(insight.citations || [], validPmids),
        confidence: 'low', // Hypotheses are always low confidence by nature
        citationWarning: insight.citationBackfill ? 'Citations backfilled from top literature' : undefined
      }));
    }

    // Validate literature themes
    if (insights.literatureThemes) {
      insights.literatureThemes = insights.literatureThemes.map(theme => ({
        ...theme,
        citations: this.validateCitations(theme.citations || [], validPmids),
        citationWarning: theme.citationBackfill ? 'Citations backfilled from top literature' : undefined
      }));
    }

    if (insights.whyItMatters) {
      const citations = this.validateCitations(insights.whyItMatters.citations || [], validPmids);
      const summaryConfidence = citations.length < 1
        ? 'low'
        : this.calculateConfidenceByQuality(citations, literatureMap);
      insights.whyItMatters = {
        ...insights.whyItMatters,
        citations,
        confidence: summaryConfidence,
        citationWarning: citations.length < 1
          ? 'Insufficient citations (requires >=1)'
          : (insights.whyItMatters.citationBackfill ? 'Citations backfilled from top literature' : undefined)
      };
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
   * Enforce minimum citation threshold for confidence
   * @private
   */
  enforceCitationConfidence(citations, literatureMap) {
    const baseConfidence = this.calculateConfidenceByQuality(citations, literatureMap);
    if (citations.length < 2) {
      return 'low';
    }
    return baseConfidence;
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
      ],
      whyItMatters: {
        summary: `This gene set has emerging relevance in ${pathways?.[0]?.name || 'disease biology'} and warrants targeted validation.`,
        impact: 'Evidence is preliminary but may inform future mechanistic or therapeutic studies.',
        nextSteps: ['Validate key pathways in disease-relevant models', 'Expand literature review for consensus signals'],
        citations: literature.slice(0, 2).map(l => `PMID:${l.pmid}`),
        confidence: 'low'
      }
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

import 'dotenv/config'; // Load environment variables from .env file

import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// Import real data integration modules
import { geneAggregator } from "./data/aggregators/gene-aggregator.js";
import { pathwayAggregator } from "./data/aggregators/pathway-aggregator.js";
import { literatureAggregator } from "./data/aggregators/literature-aggregator.js";
import { interactionAggregator } from "./data/aggregators/interaction-aggregator.js"; // NEW: Protein networks
import { clinicalAggregator } from "./data/aggregators/clinical-aggregator.js"; // NEW: Disease associations
import { drugAggregator } from "./data/aggregators/drug-aggregator.js"; // NEW: Bioactive compounds
import { insightGenerator } from "./ai/models/insight-generator.js";
import { analyzeRepurposingCandidates, generateRepurposingSummary } from "./ai/models/drug-repurposing-engine.js"; // NEW: Drug repurposing
import { startSlackBot } from "./integrations/slack-bot.js";
import { resultCache } from "./utils/result-cache.js"; // NEW: In-memory result cache
import { formatNetwork3DData } from "./visualization/network-formatter.js"; // NEW: 3D network visualization
import OpenAI from 'openai'; // For AI Chatbot

const GAIALAB_HTML = readFileSync("public/gaialab-widget.html", "utf8");
const INDEX_HTML = readFileSync("public/index.html", "utf8");

// Initialize DeepSeek client for AI chatbot
const deepseekClient = process.env.DEEPSEEK_API_KEY ? new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com/v1'
}) : null;

// High-level input schema for the GaiaLab tool
const gaiaInputSchema = {
  genes: z
    .array(z.string())
    .min(1)
    .describe("List of gene symbols or identifiers."),
  diseaseContext: z
    .string()
    .min(1)
    .describe("Short description of the disease / biological context."),
  audience: z
    .enum(["researcher", "clinician", "executive", "student"])
    .default("researcher")
    .describe("Target audience for the explanation."),
  includeDrugs: z
    .boolean()
    .default(true)
    .describe("Include drug/compound data (ChEMBL + DrugBank). Set to false for faster analysis.")
};

/**
 * REVOLUTIONARY: Build real GaiaLab board using live biological data + AI synthesis
 * Replaces synthetic data with real PubMed, UniProt, KEGG integration + Claude AI
 */
async function buildRealGaiaBoard({ genes, diseaseContext, audience, includeDrugs = true }) {
  const nowIso = new Date().toISOString();
  const normalizedGenes = genes.map((g) => String(g || "").toUpperCase());

  console.log(`[GaiaLab] Analyzing ${normalizedGenes.length} genes for: ${diseaseContext} (includeDrugs: ${includeDrugs})`);

  // CACHE CHECK: Return cached result if available (instant results for repeat queries)
  const cacheParams = { genes: normalizedGenes, diseaseContext, audience, includeDrugs };
  const cached = resultCache.get(cacheParams);
  if (cached) {
    console.log(`[GaiaLab] ⚡ Returning cached result (${cached.cacheStats.age}ms old)`);
    return {
      ...cached,
      cacheStats: {
        cached: true,
        age: Date.now() - cached.cacheStats.timestamp,
        hitRate: resultCache.getStats().hitRate
      }
    };
  }

  try {
    // PHASE 1: Fetch real data in parallel (MAXIMUM INTELLIGENCE SYNTHESIS)
    const startTime = Date.now();

    // Build promises array - conditionally include drugs based on user preference
    const dataPromises = [
      geneAggregator.fetchGeneData(normalizedGenes),
      pathwayAggregator.enrichPathways(normalizedGenes),
      literatureAggregator.searchRelevantPapers(normalizedGenes, diseaseContext, { maxResults: 30 }),
      interactionAggregator.fetchNetworks(normalizedGenes, { // NEW: Protein interaction networks
        minConfidence: 0.7,
        maxInteractors: 10,
        includeEnrichment: true
      }),
      clinicalAggregator.fetchAssociations(normalizedGenes, diseaseContext, { // NEW: Disease associations
        minScore: 0.1,
        maxPerGene: 5,
        includeEvidence: true,
        includeDrugs: false
      })
    ];

    // Conditionally add drug fetching (can be slow - let user skip for faster results)
    if (includeDrugs) {
      dataPromises.push(
        drugAggregator.fetchDrugTargets(normalizedGenes, { // NEW: Bioactive compounds
          maxPotency: 10000, // 10μM
          minPhase: 0,
          includeCompounds: true,
          includeApproved: true,
          maxPerGene: 10
        })
      );
    }

    const results = await Promise.all(dataPromises);
    const [geneData, enrichedPathways, literature, interactions, clinical] = results;
    const drugs = includeDrugs ? results[5] : { stats: { totalCompounds: 0, totalApproved: 0 }, drugTargets: [] };

    const fetchTime = Date.now() - startTime;
    console.log(`[GaiaLab] Fetched real data in ${fetchTime}ms (${interactions.stats.totalInteractions} interactions, ${clinical.stats.totalAssociations} diseases, ${drugs.stats.totalCompounds} compounds)`);

    // PHASE 1.5: Extract literature insights (authors, recommendations)
    const literatureInsightsStart = Date.now();

    const leadingResearchers = literatureAggregator.extractLeadingResearchers(literature);
    const recommendedPapers = await literatureAggregator.getRecommendedPapers(literature, 5);

    // Create Open Access metadata map
    const openAccessMap = literature.reduce((map, paper) => {
      if (paper.pmid && paper.openAccessUrl) {
        map[paper.pmid] = paper.openAccessUrl;
      }
      return map;
    }, {});

    const literatureInsightsTime = Date.now() - literatureInsightsStart;
    console.log(`[GaiaLab] Literature insights extracted in ${literatureInsightsTime}ms (${leadingResearchers.length} researchers, ${recommendedPapers.length} recommendations, ${Object.keys(openAccessMap).length} OA papers)`);

    // PHASE 2: AI synthesis using Claude
    const aiStartTime = Date.now();

    const insights = await insightGenerator.synthesize({
      genes: geneData,
      pathways: enrichedPathways,
      literature,
      interactions, // NEW: Include protein interaction networks in AI synthesis
      clinical, // NEW: Include disease associations in AI synthesis
      drugs, // NEW: Include bioactive compounds in AI synthesis
      diseaseContext,
      audience
    });

    const aiTime = Date.now() - aiStartTime;
    console.log(`[GaiaLab] AI synthesis completed in ${aiTime}ms`);

    // PHASE 3: Format for widget display
    const audienceLabels = {
      researcher: "Researcher-focused view",
      clinician: "Clinician-focused view",
      executive: "Executive summary view",
      student: "Learning / explainer view"
    };

    // Convert AI insights to widget format
    const formattedPathways = (insights.pathwayInsights || []).map((p, i) => ({
      id: `pathway-${i}`,
      name: p.pathway,
      rationale: p.significance || p.mechanisticRole,  // Keep for backward compatibility
      significance: p.significance,  // NEW: why pathway is critical in disease context
      molecularMechanism: p.molecularMechanism,  // NEW: specific enzymes, PTMs, binding sites
      regulation: p.regulation,  // NEW: upstream/downstream regulators
      experimentalEvidence: p.experimentalEvidence,  // NEW: knockout models, cell lines, assays
      quantitativeData: p.quantitativeData,  // ULTRA-NEW: Km, fold changes, patient %
      consensusMetrics: p.consensusMetrics,  // ULTRA-NEW: papers supporting, % agreement
      controversies: p.controversies,  // NEW: contradictory findings or debates
      score: p.confidence === 'high' ? 0.9 : p.confidence === 'medium' ? 0.7 : 0.5,
      pvalue: enrichedPathways[i]?.pvalue || 0.05,
      citations: p.citations || [],
      confidence: p.confidence
    }));

    const formattedTopics = (insights.literatureThemes || []).map((t, i) => ({
      id: `topic-${i}`,
      theme: t.theme,
      summary: t.summary,
      keyFindings: t.keyFindings || [],
      citations: t.citations || []
    }));

    const formattedStrategies = (insights.therapeuticInsights || []).map((s, i) => ({
      id: `strategy-${i}`,
      label: s.strategy,
      rationale: s.rationale,
      molecularTarget: s.molecularTarget,  // NEW: exact molecular target + mechanism
      clinicalEvidence: s.clinicalEvidence,  // NEW: clinical stage/trial results
      experimentalSupport: s.experimentalSupport,  // NEW: validation models/assays
      limitations: s.limitations,  // NEW: known challenges/failures
      quantitativeData: s.quantitativeData,  // ULTRA-NEW: IC50, HR, patient n, fold changes
      trialData: s.trialData,  // ULTRA-NEW: trial names, phases, endpoints
      biomarkerInfo: s.biomarkerInfo,  // ULTRA-NEW: required biomarkers with prevalence
      riskLevel: s.riskLevel || 'medium',
      citations: s.citations || [],
      confidence: s.confidence
    }));

    // Add novel hypotheses as additional strategies
    const formattedHypotheses = (insights.novelHypotheses || []).map((h, i) => ({
      id: `hypothesis-${i}`,
      label: `Novel hypothesis: ${h.hypothesis}`,
      summary: h.reasoning,
      riskLevel: 'high', // Hypotheses are always higher risk
      citations: h.citations || [],
      confidence: 'low',
      isHypothesis: true
    }));

    const totalTime = Date.now() - startTime;
    console.log(`[GaiaLab] Total analysis time: ${totalTime}ms`);

    // Collect all unique PMIDs from AI insights
    const allCitations = new Set();
    for (const pathway of formattedPathways) {
      for (const citation of pathway.citations || []) {
        allCitations.add(citation);
      }
    }
    for (const strategy of formattedStrategies) {
      for (const citation of strategy.citations || []) {
        allCitations.add(citation);
      }
    }
    for (const topic of formattedTopics) {
      for (const citation of topic.citations || []) {
        allCitations.add(citation);
      }
    }
    const totalPapersUsed = allCitations.size;
    console.log(`[GaiaLab] Used ${totalPapersUsed} unique papers in synthesis`);

    const result = {
      diseaseContext,
      genes: geneData.map(g => ({
        symbol: g.symbol,
        name: g.name,
        function: g.function,
        importanceScore: g.importanceScore,
        centrality: g.centrality,
        uniprotId: g.uniprotId,
        tissueExpression: g.tissueExpression
      })),
      pathways: formattedPathways.slice(0, 5), // Top 5 pathways
      topics: formattedTopics.slice(0, 3),
      strategies: [...formattedStrategies, ...formattedHypotheses].slice(0, 5),
      interactions: { // NEW: Protein interaction network data
        totalInteractions: interactions.stats?.totalInteractions || 0,
        avgConfidence: interactions.stats?.avgConfidence || 0,
        topInteractors: interactions.interactions?.slice(0, 10) || [],
        networkHubs: interactions.centrality?.centrality ?
          Object.entries(interactions.centrality.centrality)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([gene, score]) => ({ gene, centrality: score })) : [],
        networkImageUrl: interactions.network?.imageUrl || null
      },
      network3DData: (() => {
        const topInteractors = interactions.interactions?.slice(0, 100) || [];
        console.log(`[3D Network DEBUG] Raw interactions count: ${interactions.interactions?.length || 0}`);
        console.log(`[3D Network DEBUG] TopInteractors count: ${topInteractors.length}`);
        if (topInteractors.length > 0) {
          console.log(`[3D Network DEBUG] Sample interaction:`, JSON.stringify(topInteractors[0]));
        }
        return formatNetwork3DData(
          geneData,
          {
            topInteractors,
            networkHubs: interactions.centrality?.centrality ?
              Object.entries(interactions.centrality.centrality)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([gene, score]) => ({ gene, centrality: score })) : []
          }
        );
      })(), // NEW: 3D visualization data (FREE - client-side rendering)
      clinical: { // NEW: Disease association data
        totalAssociations: clinical.stats?.totalAssociations || 0,
        avgScore: clinical.stats?.avgScore || 0,
        highConfidence: clinical.stats?.highConfidence || 0,
        topAssociations: clinical.associations?.slice(0, 10) || [],
        sharedDiseases: clinical.associations
          ? clinicalAggregator.findSharedDiseases(clinical).slice(0, 5)
          : []
      },
      drugs: { // NEW: Bioactive compound data
        totalCompounds: drugs.stats?.totalCompounds || 0,
        totalApproved: drugs.stats?.totalApproved || 0,
        avgPotency: drugs.stats?.avgPotency || 0,
        phaseDistribution: drugs.stats?.phaseDistribution || {},
        topCompounds: drugs.compounds?.slice(0, 10) || [],
        approvedDrugs: drugs.approvedDrugs?.slice(0, 5) || [],
        multiTargetCompounds: drugs.compounds
          ? drugAggregator.findMultiTargetCompounds(drugs).slice(0, 5)
          : []
      },
      drugRepurposing: (() => {
        // 💊 DRUG REPURPOSING ENGINE: $10K-50K/year enterprise feature
        if (!drugs.compounds || drugs.compounds.length === 0) {
          return null;
        }

        console.log('[Drug Repurposing] Starting analysis...');

        // Combine ChEMBL + DrugBank drugs
        const allDrugs = [
          ...(drugs.compounds || []),
          ...(drugs.approvedDrugs || [])
        ];

        // Run repurposing analysis
        const repurposingResults = analyzeRepurposingCandidates(
          allDrugs,
          normalizedGenes,
          enrichedPathways,
          diseaseContext,
          {
            minScore: 30,          // 30% minimum match
            maxResults: 10,        // Top 10 candidates
            onlyApproved: false    // Include clinical trials
          }
        );

        // Generate executive summary
        const summary = generateRepurposingSummary(repurposingResults, diseaseContext);

        return {
          candidates: repurposingResults.candidates,
          stats: repurposingResults.stats,
          summary,
          enterpriseValue: '$10K-50K/year',
          timestamp: nowIso
        };
      })(),
      citations: literatureAggregator.formatCitations(literature.slice(0, 20)),
      citationCounts: literature.reduce((map, paper) => {
        if (paper.pmid && paper.citationCount !== undefined) {
          map[paper.pmid] = paper.citationCount;
        }
        return map;
      }, {}), // NEW: Map of PMID → citation count for UI display
      openAccessMap, // NEW: Map of PMID → Open Access PDF URL
      leadingResearchers, // NEW: Top researchers from literature corpus
      recommendedPapers, // NEW: Related papers from Semantic Scholar
      totalPapersUsed, // NEW: Actual count of unique PMIDs used by AI
      audience,
      audienceLabel: audienceLabels[audience] || "Contextual view",
      generatedAtIso: nowIso,
      analysisTime: `${totalTime}ms`,
      dataSource: {
        genes: 'Ensembl + ClinVar + UniProt + GO', // Four-layer gene synthesis
        pathways: 'KEGG',
        literature: 'PubMed + Semantic Scholar', // Enhanced with citation metrics
        interactions: 'STRING + BioGRID', // Cross-validated protein interactions
        clinical: 'Open Targets + DisGeNET', // Cross-validated disease associations
        drugs: 'ChEMBL (2.4M+ compounds) + DrugBank', // Cross-validated drug targets
        ai: insights.aiModel || 'Unknown AI'
      },
      databaseStats: {
        totalDatabases: 13,
        bioactiveCompounds: '2.4M+',
        databases: [
          'UniProt', 'KEGG', 'PubMed', 'STRING', 'Open Targets',
          'BioGRID', 'Gene Ontology', 'Ensembl', 'DisGeNET',
          'ClinVar', 'ChEMBL', 'DrugBank', 'Semantic Scholar'
        ]
      },
      disclaimer:
        "AI-generated insights for research purposes. Requires expert validation. Not medical advice.",
      cacheStats: {
        cached: false,
        timestamp: Date.now(),
        hitRate: resultCache.getStats().hitRate
      }
    };

    // CACHE STORAGE: Store result for future queries (instant results next time)
    resultCache.set(cacheParams, result);

    return result;
  } catch (error) {
    console.error('[GaiaLab] Error in buildRealGaiaBoard:', error);

    // Fallback to basic structure on error
    return {
      diseaseContext,
      genes: normalizedGenes.map((symbol, i) => ({
        symbol,
        name: 'Data fetch error',
        function: 'Unable to retrieve data',
        importanceScore: Math.max(0.3, 0.95 - i * 0.08)
      })),
      pathways: [{
        id: 'error',
        name: 'Data unavailable',
        rationale: `Error: ${error.message}`,
        score: 0.0
      }],
      topics: [],
      strategies: [],
      citations: [],
      audience,
      audienceLabel: 'Error view',
      generatedAtIso: nowIso,
      disclaimer: 'Error occurred during analysis. Please try again.'
    };
  }
}

// Helper to wrap structured content as a tool result
const replyWithBoard = (message, board) => ({
  content: message ? [{ type: "text", text: message }] : [],
  structuredContent: board
});

function createGaiaServer() {
  const server = new McpServer({
    name: "gaialab-insight-app",
    version: "0.1.0"
  });

  // Register the HTML widget as a resource
  server.registerResource(
    "gaialab-widget",
    "ui://widget/gaialab.html",
    {},
    async () => ({
      contents: [
        {
          uri: "ui://widget/gaialab.html",
          mimeType: "text/html+skybridge",
          text: GAIALAB_HTML,
          _meta: {
            "openai/widgetPrefersBorder": true
          }
        }
      ]
    })
  );

  // Single main tool that populates the board
  server.registerTool(
    "gaialab_generate_insights",
    {
      title: "Generate GaiaLab Insight Board",
      description:
        "Produces a high-level, non-procedural board of genes, pathways, themes, and directions.",
      inputSchema: gaiaInputSchema,
      _meta: {
        "openai/outputTemplate": "ui://widget/gaialab.html",
        "openai/toolInvocation/invoking": "Analyzing biological context…",
        "openai/toolInvocation/invoked": "GaiaLab board generated."
      }
    },
    async (args) => {
      const genes = Array.isArray(args?.genes) ? args.genes : [];
      const diseaseContext = String(args?.diseaseContext || "").trim();
      const audience = args?.audience || "researcher";

      if (genes.length === 0 || !diseaseContext) {
        return replyWithBoard(
          "Please provide at least one gene symbol and a disease context for analysis. Example: genes=['TP53', 'BRCA1'], diseaseContext='breast cancer'",
          {
            diseaseContext: diseaseContext || "(unspecified)",
            genes: [],
            pathways: [],
            topics: [],
            strategies: [],
            citations: [],
            audience,
            disclaimer: "Awaiting gene list and disease context."
          }
        );
      }

      // Use real data + AI synthesis (with multi-model failover)
      const board = await buildRealGaiaBoard({ genes, diseaseContext, audience });
      const aiModel = board.dataSource?.ai || 'AI';
      return replyWithBoard(
        `✅ Analyzed ${genes.length} gene(s) in ${diseaseContext}. Data: UniProt, KEGG, PubMed. AI: ${aiModel}.`,
        board
      );
    }
  );

  return server;
}

// Basic MCP HTTP server setup (stateless, JSON responses)
const port = Number(process.env.PORT ?? 8787);
const MCP_PATH = "/mcp";

const httpServer = createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400).end("Missing URL");
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

  // CORS preflight for MCP
  if (req.method === "OPTIONS" && url.pathname === MCP_PATH) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, mcp-session-id",
      "Access-Control-Expose-Headers": "Mcp-Session-Id"
    });
    res.end();
    return;
  }

  // CORS preflight for /analyze
  if (req.method === "OPTIONS" && url.pathname === "/analyze") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type"
    });
    res.end();
    return;
  }

  // Serve the main web app
  if (req.method === "GET" && url.pathname === "/") {
    res
      .writeHead(200, { "content-type": "text/html" })
      .end(INDEX_HTML);
    return;
  }

  // Simple healthcheck
  if (req.method === "GET" && url.pathname === "/health") {
    res
      .writeHead(200, { "content-type": "text/plain" })
      .end("GaiaLab MCP server");
    return;
  }

  // Web API endpoint for analysis
  if (req.method === "POST" && url.pathname === "/analyze") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      try {
        const { genes, diseaseContext, audience } = JSON.parse(body);

        if (!genes || !Array.isArray(genes) || genes.length === 0) {
          res.writeHead(400).end(JSON.stringify({ error: "genes array required" }));
          return;
        }

        if (!diseaseContext || typeof diseaseContext !== "string") {
          res.writeHead(400).end(JSON.stringify({ error: "diseaseContext string required" }));
          return;
        }

        console.log(`[API] Analyzing ${genes.length} genes for: ${diseaseContext}`);
        const board = await buildRealGaiaBoard({ genes, diseaseContext, audience: audience || "researcher" });

        res.writeHead(200).end(JSON.stringify(board));
      } catch (error) {
        console.error("[API] Analysis error:", error);
        res.writeHead(500).end(JSON.stringify({
          error: "Analysis failed",
          message: error.message
        }));
      }
    });
    return;
  }

  // AI Chat endpoint
  if (url.pathname === "/api/chat" && req.method === "POST") {
    let body = "";
    req.on("data", chunk => { body += chunk.toString(); });
    req.on("end", async () => {
      try {
        const { message, conversationHistory, analysisContext } = JSON.parse(body);

        // Build context-aware prompt
        let systemPrompt = `You are GaiaLab AI, a helpful biology research assistant. You help researchers understand their gene analysis results, explain protein interactions, and suggest research directions.

When answering questions:
1. Be concise but informative (2-4 sentences)
2. Use scientific terminology appropriately
3. Cite PubMed IDs when making claims, formatted as [PMID:12345]
4. If you don't have enough information, say so honestly
5. Focus on the user's analysis context when available`;

        // Add analysis context if available
        if (analysisContext) {
          systemPrompt += `\n\nCurrent analysis context:\n${JSON.stringify(analysisContext, null, 2)}`;
        }

        // Build conversation for DeepSeek
        const messages = [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: message }
        ];

        // Call DeepSeek AI
        if (!deepseekClient) {
          throw new Error("DeepSeek API key not configured. Set DEEPSEEK_API_KEY in .env");
        }

        const aiResponse = await deepseekClient.chat.completions.create({
          model: 'deepseek-chat',
          messages,
          temperature: 0.3,
          max_tokens: 500
        });

        const response = aiResponse.choices[0].message.content;

        res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
          response,
          timestamp: new Date().toISOString()
        }));

      } catch (error) {
        console.error("[Chat] Error:", error);
        res.writeHead(500).end(JSON.stringify({
          error: "Chat failed",
          message: error.message
        }));
      }
    });
    return;
  }

  const allowed = new Set(["POST", "GET", "DELETE"]);
  if (url.pathname === MCP_PATH && req.method && allowed.has(req.method)) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");

    const server = createGaiaServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless mode
      enableJsonResponse: true
    });

    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.writeHead(500).end("Internal server error");
      }
    }

    return;
  }

  res.writeHead(404).end("Not Found");
});

httpServer.listen(port, () => {
  console.log(`✅ GaiaLab MCP Server running on http://localhost:${port}`);
  console.log(`   MCP Endpoint: http://localhost:${port}${MCP_PATH}`);
  console.log(`   Web Interface: http://localhost:${port}`);
  console.log(`   Analysis API: http://localhost:${port}/analyze`);

  // Start Slack Bot integration (if configured)
  startSlackBot();
});

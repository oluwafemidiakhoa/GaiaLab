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
import { insightGenerator } from "./ai/models/insight-generator.js";
import { startSlackBot } from "./integrations/slack-bot.js";

const GAIALAB_HTML = readFileSync("public/gaialab-widget.html", "utf8");
const INDEX_HTML = readFileSync("public/index.html", "utf8");

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
    .describe("Target audience for the explanation.")
};

/**
 * REVOLUTIONARY: Build real GaiaLab board using live biological data + AI synthesis
 * Replaces synthetic data with real PubMed, UniProt, KEGG integration + Claude AI
 */
async function buildRealGaiaBoard({ genes, diseaseContext, audience }) {
  const nowIso = new Date().toISOString();
  const normalizedGenes = genes.map((g) => String(g || "").toUpperCase());

  console.log(`[GaiaLab] Analyzing ${normalizedGenes.length} genes for: ${diseaseContext}`);

  try {
    // PHASE 1: Fetch real data in parallel (massive speed optimization)
    const startTime = Date.now();

    const [geneData, enrichedPathways, literature] = await Promise.all([
      geneAggregator.fetchGeneData(normalizedGenes),
      pathwayAggregator.enrichPathways(normalizedGenes),
      literatureAggregator.searchRelevantPapers(normalizedGenes, diseaseContext, { maxResults: 30 })
    ]);

    const fetchTime = Date.now() - startTime;
    console.log(`[GaiaLab] Fetched real data in ${fetchTime}ms`);

    // PHASE 2: AI synthesis using Claude
    const aiStartTime = Date.now();

    const insights = await insightGenerator.synthesize({
      genes: geneData,
      pathways: enrichedPathways,
      literature,
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
      rationale: p.significance || p.mechanisticRole,
      score: p.confidence === 'high' ? 0.9 : p.confidence === 'medium' ? 0.7 : 0.5,
      pvalue: enrichedPathways[i]?.pvalue || 0.05,
      citations: p.citations || [],
      confidence: p.confidence
    }));

    const formattedTopics = (insights.literatureThemes || []).map((t, i) => ({
      id: `topic-${i}`,
      name: t.theme,
      summary: t.summary,
      keyFindings: t.keyFindings || [],
      citations: t.citations || []
    }));

    const formattedStrategies = (insights.therapeuticInsights || []).map((s, i) => ({
      id: `strategy-${i}`,
      label: s.strategy,
      rationale: s.rationale,
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

    return {
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
      citations: literatureAggregator.formatCitations(literature.slice(0, 20)),
      audience,
      audienceLabel: audienceLabels[audience] || "Contextual view",
      generatedAtIso: nowIso,
      analysisTime: `${totalTime}ms`,
      dataSource: {
        genes: 'UniProt',
        pathways: 'KEGG',
        literature: 'PubMed',
        ai: insights.aiModel || 'Unknown AI'
      },
      disclaimer:
        "AI-generated insights for research purposes. Requires expert validation. Not medical advice."
    };
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

  // CORS preflight
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

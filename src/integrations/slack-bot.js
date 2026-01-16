/**
 * GaiaLab Slack Bot
 * Usage: /gaialab TP53, BRCA1, EGFR in breast cancer
 */

import 'dotenv/config'; // Load environment variables
import { App } from '@slack/bolt';
import { geneAggregator } from '../data/aggregators/gene-aggregator.js';
import { pathwayAggregator } from '../data/aggregators/pathway-aggregator.js';
import { literatureAggregator } from '../data/aggregators/literature-aggregator.js';
import { insightGenerator } from '../ai/models/insight-generator.js';

// Initialize Slack app (only if tokens are configured)
let slackApp = null;

if (process.env.SLACK_BOT_TOKEN && process.env.SLACK_APP_TOKEN && process.env.SLACK_SIGNING_SECRET) {
  slackApp = new App({
    token: process.env.SLACK_BOT_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    socketMode: true,
    appToken: process.env.SLACK_APP_TOKEN
  });

  /**
   * Slash command: /gaialab
   * Examples:
   * /gaialab TP53, BRCA1 in breast cancer
   * /gaialab KRAS, NRAS, BRAF for colorectal cancer
   */
  slackApp.command('/gaialab', async ({ command, ack, say, client }) => {
    await ack();

    const channelId = command.channel_id;
    const text = command.text.trim();

    // Parse input
    const parsed = parseSlackQuery(text);

    if (!parsed) {
      await say({
        text: `⚠️ Invalid format! Use: \`/gaialab TP53, BRCA1 in breast cancer\``,
        response_type: 'ephemeral'
      });
      return;
    }

    const { genes, diseaseContext } = parsed;

    // Send "analyzing" message
    const loadingMsg = await say({
      text: `🧬 Analyzing ${genes.join(', ')} in *${diseaseContext}*...\n_This will take 60-90 seconds. Fetching data from UniProt, KEGG, PubMed + AI synthesis..._`
    });

    try {
      // Perform analysis
      const startTime = Date.now();

      const [geneData, enrichedPathways, literature] = await Promise.all([
        geneAggregator.fetchGeneData(genes),
        pathwayAggregator.enrichPathways(genes),
        literatureAggregator.searchRelevantPapers(genes, diseaseContext, { maxResults: 30 })
      ]);

      const insights = await insightGenerator.synthesize({
        genes: geneData,
        pathways: enrichedPathways,
        literature,
        diseaseContext,
        audience: 'researcher'
      });

      const analysisTime = ((Date.now() - startTime) / 1000).toFixed(1);

      // Format results for Slack
      const blocks = formatSlackResults({
        genes: geneData,
        pathways: enrichedPathways,
        insights,
        diseaseContext,
        analysisTime
      });

      // Update message with results
      await client.chat.update({
        channel: channelId,
        ts: loadingMsg.ts,
        text: `✅ Analysis complete for ${genes.join(', ')} in ${diseaseContext}`,
        blocks
      });

    } catch (error) {
      console.error('[Slack Bot] Analysis error:', error);
      await say({
        text: `❌ Analysis failed: ${error.message}`,
        response_type: 'ephemeral'
      });
    }
  });

  /**
   * App mention: @gaialab
   */
  slackApp.event('app_mention', async ({ event, say }) => {
    try {
      const text = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();

      const parsed = parseSlackQuery(text);

      if (!parsed) {
        await say({
          text: `Hi! I'm GaiaLab 🧬\n\nAnalyze genes with:\n\`/gaialab TP53, BRCA1 in breast cancer\`\n\nOr mention me:\n\`@gaialab analyze KRAS in colorectal cancer\``
        });
        return;
      }

      // Trigger analysis (same as slash command)
      await say(`🧬 Analyzing ${parsed.genes.join(', ')} in *${parsed.diseaseContext}*...`);
    } catch (error) {
      console.error('[Slack Bot] App mention error:', error);
      await say(`❌ Error: ${error.message}`);
    }
  });
}

/**
 * Parse Slack query text
 * Formats: "TP53, BRCA1 in breast cancer" or "TP53, BRCA1 for breast cancer"
 */
function parseSlackQuery(text) {
  // Try pattern: "GENE1, GENE2 in/for DISEASE"
  const match = text.match(/^([A-Z0-9,\s]+)\s+(in|for)\s+(.+)$/i);

  if (!match) {
    return null;
  }

  const genes = match[1]
    .split(',')
    .map(g => g.trim().toUpperCase())
    .filter(g => g.length > 0);

  const diseaseContext = match[3].trim();

  if (genes.length === 0 || !diseaseContext) {
    return null;
  }

  return { genes, diseaseContext };
}

/**
 * Format results as Slack blocks
 */
function formatSlackResults({ genes, pathways, insights, diseaseContext, analysisTime }) {
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🧬 GaiaLab Analysis: ${diseaseContext}`,
        emoji: true
      }
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `✅ Analyzed ${genes.length} genes in ${analysisTime}s | AI: ${insights.aiModel || 'GPT-4o'}`
        }
      ]
    },
    {
      type: 'divider'
    }
  ];

  // Genes section
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*🧬 Genes Analyzed:*\n${genes.slice(0, 5).map(g =>
        `• *${g.symbol}*: ${g.name}\n  _Importance: ${Math.round(g.importanceScore * 100)}%_`
      ).join('\n')}`
    }
  });

  blocks.push({ type: 'divider' });

  // Top pathways
  const topPathways = pathways
    .filter(p => p.significance === 'significant')
    .slice(0, 3);

  if (topPathways.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🔬 Significant Pathways (p < 0.05):*\n${topPathways.map((p, i) =>
          `${i + 1}. *${p.name}*\n   p-value: \`${p.pvalue.toExponential(2)}\` | ${p.genesInPathway?.length || 0} genes`
        ).join('\n\n')}`
      }
    });

    blocks.push({ type: 'divider' });
  }

  // Therapeutic insights
  if (insights.therapeuticInsights?.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*💊 Therapeutic Insights:*\n${insights.therapeuticInsights.slice(0, 3).map((t, i) =>
          `${i + 1}. *${t.strategy}*\n   Risk: ${t.riskLevel?.toUpperCase()} | Confidence: ${t.confidence?.toUpperCase()}\n   ${t.rationale?.substring(0, 150)}...`
        ).join('\n\n')}`
      }
    });
  }

  // View full report button
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: {
          type: 'plain_text',
          text: '📊 View Full Report',
          emoji: true
        },
        url: `${process.env.GAIALAB_URL || 'http://localhost:8787'}/?genes=${genes.map(g => g.symbol).join(',')}&disease=${encodeURIComponent(diseaseContext)}`,
        action_id: 'view_full_report'
      }
    ]
  });

  // Footer
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Powered by UniProt, KEGG, PubMed & AI | ⚠️ Research use only`
      }
    ]
  });

  return blocks;
}

/**
 * Start Slack bot
 */
export async function startSlackBot() {
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN || !process.env.SLACK_SIGNING_SECRET) {
    console.log('\n[Slack Bot] ⚠️  Not configured (optional)');
    console.log('   To enable: Add SLACK_BOT_TOKEN, SLACK_APP_TOKEN, SLACK_SIGNING_SECRET to .env');
    console.log('   See: SLACK-BOT-SETUP.md\n');
    return;
  }

  if (!slackApp) {
    console.log('[Slack Bot] ⚠️  Failed to initialize');
    return;
  }

  try {
    await slackApp.start();
    console.log('\n⚡ GaiaLab Slack Bot is running!');
    console.log('   Use: /gaialab TP53, BRCA1 in breast cancer\n');
  } catch (error) {
    console.error('[Slack Bot] ❌ Failed to start:', error.message);
  }
}

export { slackApp };

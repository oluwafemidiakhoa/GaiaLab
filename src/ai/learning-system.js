/**
 * GaiaLab Learning System
 * Collects successful analyses to improve future performance
 * Prepares data for:
 * 1. Prompt optimization (via Claude)
 * 2. Fine-tuning (via OpenAI)
 * 3. Knowledge graph building
 * 4. RAG system
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export class LearningSystem {
  constructor() {
    this.dataDir = join(process.cwd(), 'data', 'learning');
    this.analysesFile = join(this.dataDir, 'successful-analyses.jsonl');
    this.promptHistoryFile = join(this.dataDir, 'prompt-history.json');

    // Create data directory if it doesn't exist
    if (!existsSync(this.dataDir)) {
      mkdirSync(this.dataDir, { recursive: true });
    }
  }

  /**
   * Record a successful analysis for future learning
   * @param {Object} analysis - Complete analysis result
   * @param {Object} metadata - Analysis metadata
   */
  async recordSuccessfulAnalysis({ analysis, metadata }) {
    const record = {
      timestamp: new Date().toISOString(),
      genes: metadata.genes,
      diseaseContext: metadata.diseaseContext,
      audience: metadata.audience,

      // What worked well
      insights: {
        pathwayInsights: analysis.pathways?.filter(p => p.confidence === 'high'),
        therapeuticInsights: analysis.strategies?.filter(s => s.confidence === 'high'),
        citationCount: analysis.citations?.length || 0
      },

      // Performance metrics
      metrics: {
        analysisTime: metadata.analysisTime,
        aiModel: analysis.dataSource?.ai,
        pathwayCount: analysis.pathways?.length || 0,
        significantPathways: analysis.pathways?.filter(p => p.significance === 'significant').length || 0
      },

      // User feedback (if available)
      feedback: metadata.userFeedback || null
    };

    // Append to JSONL file (each line is a JSON object)
    const line = JSON.stringify(record) + '\n';

    try {
      const fs = await import('fs/promises');
      await fs.appendFile(this.analysesFile, line);
      console.log('[Learning] Recorded successful analysis');
    } catch (error) {
      console.error('[Learning] Failed to record analysis:', error.message);
    }
  }

  /**
   * Get all successful analyses (for prompt optimization)
   * @returns {Promise<Array>} Array of analysis records
   */
  async getSuccessfulAnalyses() {
    if (!existsSync(this.analysesFile)) {
      return [];
    }

    const fs = await import('fs/promises');
    const content = await fs.readFile(this.analysesFile, 'utf8');

    return content
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  /**
   * Analyze what prompts/strategies work best
   * Uses Claude to suggest improvements
   * @returns {Promise<Object>} Analysis insights
   */
  async analyzeSuccessPatterns() {
    const analyses = await this.getSuccessfulAnalyses();

    if (analyses.length < 10) {
      return {
        message: 'Need at least 10 analyses to identify patterns',
        count: analyses.length
      };
    }

    // Group by disease context
    const byDisease = analyses.reduce((acc, a) => {
      if (!acc[a.diseaseContext]) acc[a.diseaseContext] = [];
      acc[a.diseaseContext].push(a);
      return acc;
    }, {});

    // Find patterns
    const patterns = {
      mostSuccessfulDiseases: Object.entries(byDisease)
        .map(([disease, analyses]) => ({
          disease,
          count: analyses.length,
          avgConfidence: analyses.reduce((sum, a) =>
            sum + (a.insights.pathwayInsights?.length || 0), 0) / analyses.length
        }))
        .sort((a, b) => b.avgConfidence - a.avgConfidence)
        .slice(0, 5),

      avgAnalysisTime: analyses.reduce((sum, a) =>
        sum + parseFloat(a.metrics.analysisTime || 0), 0) / analyses.length,

      mostUsedModel: this.getMostFrequent(analyses.map(a => a.metrics.aiModel)),

      totalAnalyses: analyses.length
    };

    return patterns;
  }

  /**
   * Export training data for OpenAI fine-tuning
   * Format: JSONL with {messages: [{role, content}]}
   * @returns {Promise<string>} Path to training file
   */
  async exportFineTuningData() {
    const analyses = await this.getSuccessfulAnalyses();

    if (analyses.length < 100) {
      throw new Error('Need at least 100 analyses for fine-tuning');
    }

    // Convert to OpenAI fine-tuning format
    const trainingData = analyses
      .filter(a => a.insights.pathwayInsights?.length > 0)
      .map(a => ({
        messages: [
          {
            role: 'system',
            content: 'You are GaiaLab, an expert biological intelligence system. Analyze gene sets and provide high-confidence, citation-backed insights.'
          },
          {
            role: 'user',
            content: `Analyze genes: ${a.genes.join(', ')} in context: ${a.diseaseContext}`
          },
          {
            role: 'assistant',
            content: JSON.stringify({
              pathwayInsights: a.insights.pathwayInsights,
              therapeuticInsights: a.insights.therapeuticInsights,
              confidence: 'high',
              citations: a.insights.citationCount
            })
          }
        ]
      }));

    // Write to file
    const outputPath = join(this.dataDir, 'openai-finetuning-data.jsonl');
    const fs = await import('fs/promises');

    await fs.writeFile(
      outputPath,
      trainingData.map(d => JSON.stringify(d)).join('\n')
    );

    console.log(`[Learning] Exported ${trainingData.length} training examples to ${outputPath}`);
    return outputPath;
  }

  /**
   * Build a knowledge graph from all analyses
   * @returns {Promise<Object>} Knowledge graph
   */
  async buildKnowledgeGraph() {
    const analyses = await this.getSuccessfulAnalyses();

    const graph = {
      genes: {},
      diseases: {},
      pathways: {},
      therapeutics: {}
    };

    analyses.forEach(analysis => {
      // Track gene-disease associations
      analysis.genes.forEach(gene => {
        if (!graph.genes[gene]) {
          graph.genes[gene] = { diseases: new Set(), pathways: new Set() };
        }
        graph.genes[gene].diseases.add(analysis.diseaseContext);
      });

      // Track disease info
      if (!graph.diseases[analysis.diseaseContext]) {
        graph.diseases[analysis.diseaseContext] = {
          genes: new Set(),
          pathways: new Set(),
          therapeutics: new Set()
        };
      }
      analysis.genes.forEach(gene => {
        graph.diseases[analysis.diseaseContext].genes.add(gene);
      });

      // Track pathways
      analysis.insights.pathwayInsights?.forEach(pathway => {
        if (!graph.pathways[pathway.pathway]) {
          graph.pathways[pathway.pathway] = {
            genes: new Set(),
            diseases: new Set()
          };
        }
        analysis.genes.forEach(gene => {
          graph.pathways[pathway.pathway].genes.add(gene);
        });
        graph.pathways[pathway.pathway].diseases.add(analysis.diseaseContext);
      });
    });

    // Convert Sets to Arrays
    const serializableGraph = {
      genes: Object.fromEntries(
        Object.entries(graph.genes).map(([gene, data]) => [
          gene,
          { diseases: Array.from(data.diseases), pathways: Array.from(data.pathways) }
        ])
      ),
      diseases: Object.fromEntries(
        Object.entries(graph.diseases).map(([disease, data]) => [
          disease,
          {
            genes: Array.from(data.genes),
            pathways: Array.from(data.pathways),
            therapeutics: Array.from(data.therapeutics)
          }
        ])
      ),
      pathways: Object.fromEntries(
        Object.entries(graph.pathways).map(([pathway, data]) => [
          pathway,
          { genes: Array.from(data.genes), diseases: Array.from(data.diseases) }
        ])
      )
    };

    // Save knowledge graph
    const outputPath = join(this.dataDir, 'knowledge-graph.json');
    const fs = await import('fs/promises');
    await fs.writeFile(outputPath, JSON.stringify(serializableGraph, null, 2));

    console.log('[Learning] Built knowledge graph:', {
      genes: Object.keys(serializableGraph.genes).length,
      diseases: Object.keys(serializableGraph.diseases).length,
      pathways: Object.keys(serializableGraph.pathways).length
    });

    return serializableGraph;
  }

  /**
   * Query knowledge graph for instant insights (no API calls needed!)
   * @param {Array<string>} genes - Gene symbols
   * @param {string} diseaseContext - Disease context
   * @returns {Object} Cached insights if available
   */
  async queryKnowledgeGraph(genes, diseaseContext) {
    const graphPath = join(this.dataDir, 'knowledge-graph.json');

    if (!existsSync(graphPath)) {
      return null; // No cached knowledge yet
    }

    const normalizedGenes = new Set(genes.map(gene => String(gene || '').toUpperCase()));
    const normalizedDisease = String(diseaseContext || '').trim().toLowerCase();

    const fs = await import('fs/promises');
    const graph = JSON.parse(await fs.readFile(graphPath, 'utf8'));

    // Find relevant pathways
    const relevantPathways = Object.entries(graph.pathways)
      .filter(([pathway, data]) =>
        data.genes?.some(gene => normalizedGenes.has(String(gene || '').toUpperCase())) &&
        data.diseases?.some(disease => String(disease || '').toLowerCase() === normalizedDisease)
      )
      .map(([pathway, data]) => ({
        pathway,
        geneOverlap: genes.filter(g => data.genes.includes(g)),
        confidence: 'cached'
      }));

    if (relevantPathways.length > 0) {
      return {
        source: 'knowledge-graph-cache',
        pathways: relevantPathways,
        message: 'Instant results from previous analyses! (No API calls needed)'
      };
    }

    return null;
  }

  // Helper methods
  getMostFrequent(arr) {
    const counts = arr.reduce((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  }
}

// Singleton instance
export const learningSystem = new LearningSystem();

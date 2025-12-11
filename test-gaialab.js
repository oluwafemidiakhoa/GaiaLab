import 'dotenv/config';
import { geneAggregator } from './src/data/aggregators/gene-aggregator.js';
import { pathwayAggregator } from './src/data/aggregators/pathway-aggregator.js';
import { literatureAggregator } from './src/data/aggregators/literature-aggregator.js';
import { insightGenerator } from './src/ai/models/insight-generator.js';

/**
 * Test GaiaLab with real genes: TP53, BRCA1, EGFR in breast cancer context
 * This simulates what happens when ChatGPT/Claude calls the MCP tool
 */

console.log('\n🧬 GAIALAB TEST: Analyzing TP53, BRCA1, EGFR in breast cancer\n');
console.log('=' .repeat(70));

const genes = ['TP53', 'BRCA1', 'EGFR'];
const diseaseContext = 'breast cancer';
const audience = 'researcher';

async function testGaiaLab() {
  const startTime = Date.now();

  try {
    console.log(`\n📊 PHASE 1: Fetching real biological data...`);
    console.log(`   Genes: ${genes.join(', ')}`);
    console.log(`   Context: ${diseaseContext}\n`);

    // Parallel data fetch (just like buildRealGaiaBoard does)
    const [geneData, enrichedPathways, literature] = await Promise.all([
      geneAggregator.fetchGeneData(genes),
      pathwayAggregator.enrichPathways(genes),
      literatureAggregator.searchRelevantPapers(genes, diseaseContext, { maxResults: 30 })
    ]);

    const fetchTime = Date.now() - startTime;
    console.log(`✅ Data fetch complete in ${fetchTime}ms\n`);

    // Display results
    console.log('🧬 GENE DATA FROM UNIPROT:');
    console.log('-'.repeat(70));
    geneData.forEach(gene => {
      console.log(`\n${gene.symbol} (${gene.uniprotId || 'N/A'})`);
      console.log(`  Name: ${gene.name}`);
      console.log(`  Function: ${gene.function?.substring(0, 100)}...`);
      console.log(`  Importance: ${(gene.importanceScore * 100).toFixed(0)}%`);
    });

    console.log('\n\n🔬 ENRICHED PATHWAYS FROM KEGG:');
    console.log('-'.repeat(70));
    enrichedPathways.slice(0, 5).forEach((pathway, i) => {
      console.log(`\n${i + 1}. ${pathway.name}`);
      console.log(`   P-value: ${pathway.pvalue.toExponential(2)}`);
      console.log(`   Genes in pathway: ${pathway.genesInPathway?.join(', ') || 'N/A'}`);
      console.log(`   Significance: ${pathway.significance}`);
    });

    console.log('\n\n📚 RECENT LITERATURE FROM PUBMED:');
    console.log('-'.repeat(70));
    literature.slice(0, 5).forEach((paper, i) => {
      console.log(`\n${i + 1}. ${paper.title}`);
      console.log(`   Journal: ${paper.journal} (${paper.year})`);
      console.log(`   PMID: ${paper.pmid}`);
      console.log(`   Authors: ${paper.authors}`);
    });

    // AI Synthesis
    console.log('\n\n🤖 PHASE 2: AI Synthesis...');
    console.log('-'.repeat(70));

    const aiStartTime = Date.now();
    const insights = await insightGenerator.synthesize({
      genes: geneData,
      pathways: enrichedPathways,
      literature,
      diseaseContext,
      audience
    });

    const aiTime = Date.now() - aiStartTime;
    console.log(`✅ AI synthesis complete in ${aiTime}ms using ${insights.aiModel}\n`);

    console.log('💡 PATHWAY INSIGHTS:');
    console.log('-'.repeat(70));
    (insights.pathwayInsights || []).forEach((insight, i) => {
      console.log(`\n${i + 1}. ${insight.pathway}`);
      console.log(`   Significance: ${insight.significance}`);
      console.log(`   Confidence: ${insight.confidence?.toUpperCase() || 'N/A'}`);
      console.log(`   Citations: ${insight.citations?.join(', ') || 'None'}`);
    });

    console.log('\n\n💊 THERAPEUTIC INSIGHTS:');
    console.log('-'.repeat(70));
    (insights.therapeuticInsights || []).forEach((insight, i) => {
      console.log(`\n${i + 1}. ${insight.strategy}`);
      console.log(`   Rationale: ${insight.rationale?.substring(0, 150)}...`);
      console.log(`   Risk Level: ${insight.riskLevel?.toUpperCase() || 'N/A'}`);
      console.log(`   Confidence: ${insight.confidence?.toUpperCase() || 'N/A'}`);
      console.log(`   Citations: ${insight.citations?.join(', ') || 'None'}`);
    });

    console.log('\n\n🔬 LITERATURE THEMES:');
    console.log('-'.repeat(70));
    (insights.literatureThemes || []).forEach((theme, i) => {
      console.log(`\n${i + 1}. ${theme.theme}`);
      console.log(`   Summary: ${theme.summary}`);
      console.log(`   Citations: ${theme.citations?.join(', ') || 'None'}`);
    });

    const totalTime = Date.now() - startTime;
    console.log('\n\n' + '='.repeat(70));
    console.log(`🎉 ANALYSIS COMPLETE!`);
    console.log(`   Total time: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);
    console.log(`   Data sources: UniProt, KEGG, PubMed`);
    console.log(`   AI model: ${insights.aiModel}`);
    console.log(`   Genes analyzed: ${genes.length}`);
    console.log(`   Pathways found: ${enrichedPathways.length}`);
    console.log(`   Papers retrieved: ${literature.length}`);
    console.log(`   Insights generated: ${(insights.pathwayInsights?.length || 0) + (insights.therapeuticInsights?.length || 0)}`);
    console.log('='.repeat(70) + '\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testGaiaLab();

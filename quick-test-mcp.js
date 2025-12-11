/**
 * Quick MCP Test - Simulates what ChatGPT/Claude does when calling GaiaLab
 * Tests the MCP server without needing ChatGPT/Claude configured
 */

import fetch from 'node-fetch';

const MCP_URL = 'http://localhost:8787/mcp';

async function testMCPServer() {
  console.log('🧪 Testing GaiaLab MCP Server...\n');
  console.log('Server URL:', MCP_URL);
  console.log('='.repeat(70));

  // Test 1: Health check
  try {
    console.log('\n📡 Test 1: Health check...');
    const healthResponse = await fetch('http://localhost:8787/');
    const healthText = await healthResponse.text();
    console.log('✅ Server is running:', healthText);
  } catch (error) {
    console.error('❌ Server is not running!', error.message);
    console.log('\n💡 Start the server with: npm start');
    process.exit(1);
  }

  // Test 2: MCP Tool Call (simulating ChatGPT/Claude)
  try {
    console.log('\n📡 Test 2: Calling gaialab_generate_insights tool...');
    console.log('   Analyzing: TP53, BRCA1, EGFR');
    console.log('   Context: breast cancer\n');

    const startTime = Date.now();

    const mcpRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: 'gaialab_generate_insights',
        arguments: {
          genes: ['TP53', 'BRCA1', 'EGFR'],
          diseaseContext: 'breast cancer',
          audience: 'researcher'
        }
      }
    };

    const response = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mcpRequest)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    const elapsed = Date.now() - startTime;

    console.log('✅ MCP call successful in', elapsed, 'ms\n');

    // Display results
    if (result.result && result.result.structuredContent) {
      const board = result.result.structuredContent;

      console.log('📊 RESULTS:');
      console.log('='.repeat(70));

      console.log(`\n🧬 Genes Analyzed: ${board.genes?.length || 0}`);
      board.genes?.slice(0, 3).forEach(gene => {
        console.log(`   - ${gene.symbol}: ${gene.name}`);
      });

      console.log(`\n🔬 Pathways Found: ${board.pathways?.length || 0}`);
      board.pathways?.slice(0, 3).forEach(p => {
        console.log(`   - ${p.name} (confidence: ${p.confidence || 'N/A'})`);
      });

      console.log(`\n📚 Literature: ${board.citations?.length || 0} papers`);
      board.citations?.slice(0, 3).forEach(c => {
        console.log(`   - ${c.citation?.substring(0, 80)}...`);
      });

      console.log(`\n💡 Insights Generated: ${board.strategies?.length || 0}`);
      board.strategies?.forEach((s, i) => {
        console.log(`   ${i + 1}. ${s.label}`);
        console.log(`      Risk: ${s.riskLevel?.toUpperCase()}, Confidence: ${s.confidence?.toUpperCase() || 'N/A'}`);
      });

      console.log(`\n🤖 AI Model Used: ${board.dataSource?.ai || 'Unknown'}`);
      console.log(`⏱️  Analysis Time: ${board.analysisTime || 'N/A'}`);

      console.log('\n' + '='.repeat(70));
      console.log('🎉 MCP SERVER IS FULLY OPERATIONAL!');
      console.log('='.repeat(70));

      console.log('\n📝 Next Steps:');
      console.log('   1. Configure ChatGPT or Claude Desktop to use this MCP server');
      console.log('   2. See MCP-SETUP-GUIDE.md for configuration instructions');
      console.log('   3. Start analyzing genes with AI assistance!\n');

    } else {
      console.log('⚠️  Unexpected response format:', JSON.stringify(result, null, 2).substring(0, 500));
    }

  } catch (error) {
    console.error('❌ MCP call failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
testMCPServer();

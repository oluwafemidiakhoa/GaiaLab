/**
 * Network 3D Data Formatter
 *
 * Formats protein interaction network data for client-side 3D visualization
 * using Three.js + 3d-force-graph library (browser-based rendering)
 *
 * Cost: $0 - All rendering happens client-side, no API calls
 */

/**
 * Format protein interaction network data for 3D force-graph visualization
 *
 * @param {Array} genes - Array of gene objects with symbols and metadata
 * @param {Object} interactions - Interaction data from STRING/BioGRID
 * @returns {Object} - Formatted network data { nodes, links }
 */
export function formatNetwork3DData(genes, interactions) {
  // Create nodes from input genes - mark as primary nodes
  const nodes = genes.map((gene, index) => ({
    id: gene.symbol,
    name: gene.name || gene.symbol,
    group: 0, // Primary genes
    importance: gene.importanceScore || 0.5,
    val: (gene.importanceScore || 0.5) * 15, // Larger size for input genes
    isPrimary: true
  }));

  // Create links from interactions and ADD interacting proteins as nodes
  const links = [];
  const processedPairs = new Set();
  const addedNodes = new Set(nodes.map(n => n.id)); // Track which nodes we've added

  if (interactions && interactions.topInteractors && interactions.topInteractors.length > 0) {
    interactions.topInteractors.forEach(interaction => {
      const source = interaction.gene1 || interaction.protein1 || interaction.source || interaction.gene;
      const target = interaction.gene2 || interaction.protein2 || interaction.target || interaction.partner;
      const confidence = interaction.confidence || interaction.score || 0.5;

      // Skip if we don't have valid source and target
      if (!source || !target) {
        console.warn('[Network3D] Skipping interaction with missing source/target:', interaction);
        return;
      }

      // Add source node if it doesn't exist (it's an interacting protein)
      if (!addedNodes.has(source)) {
        nodes.push({
          id: source,
          name: source,
          group: 1, // Secondary (interacting) proteins
          importance: 0.3,
          val: 5, // Smaller than primary genes
          isPrimary: false
        });
        addedNodes.add(source);
      }

      // Add target node if it doesn't exist (it's an interacting protein)
      if (!addedNodes.has(target)) {
        nodes.push({
          id: target,
          name: target,
          group: 1, // Secondary (interacting) proteins
          importance: 0.3,
          val: 5, // Smaller than primary genes
          isPrimary: false
        });
        addedNodes.add(target);
      }

      // Add the link
      const pairKey = [source, target].sort().join('-');
      if (!processedPairs.has(pairKey)) {
        processedPairs.add(pairKey);

        links.push({
          source,
          target,
          value: confidence, // Link strength/width
          label: `${(confidence * 100).toFixed(0)}% confidence`
        });
      }
    });
  }

  // If no links, create a simple circular layout by connecting genes in a ring
  if (links.length === 0 && nodes.length > 1) {
    for (let i = 0; i < nodes.length; i++) {
      links.push({
        source: nodes[i].id,
        target: nodes[(i + 1) % nodes.length].id,
        value: 0.3,
        label: 'Same gene set'
      });
    }
  }

  // Add network hub nodes if they exist
  if (interactions && interactions.networkHubs) {
    interactions.networkHubs.forEach(hub => {
      const existingNode = nodes.find(n => n.id === hub.gene);
      if (existingNode) {
        existingNode.isHub = true;
        existingNode.centrality = hub.centrality;
        existingNode.val = (hub.centrality || 0.5) * 15; // Larger size for hubs
      }
    });
  }

  console.log(`[Network3D] Generated ${nodes.length} nodes, ${links.length} links`);

  return {
    nodes,
    links,
    stats: {
      totalNodes: nodes.length,
      totalLinks: links.length,
      avgConfidence: links.length > 0
        ? (links.reduce((sum, l) => sum + l.value, 0) / links.length).toFixed(2)
        : 0,
      hubCount: nodes.filter(n => n.isHub).length
    }
  };
}

/**
 * Generate network layout configuration for client-side rendering
 *
 * @param {string} layoutType - Layout algorithm: 'force-directed', 'circular', 'hierarchical'
 * @returns {Object} - Layout configuration
 */
export function getNetworkLayoutConfig(layoutType = 'force-directed') {
  const configs = {
    'force-directed': {
      d3AlphaDecay: 0.02,
      d3VelocityDecay: 0.3,
      warmupTicks: 100,
      cooldownTicks: 1000,
      cooldownTime: 15000
    },
    'circular': {
      d3AlphaDecay: 0,
      d3VelocityDecay: 0,
      warmupTicks: 0,
      cooldownTicks: 0
    },
    'hierarchical': {
      d3AlphaDecay: 0.01,
      d3VelocityDecay: 0.4,
      warmupTicks: 50,
      cooldownTicks: 500
    }
  };

  return configs[layoutType] || configs['force-directed'];
}

/**
 * Generate node color scheme based on importance/centrality
 *
 * @param {number} importance - Node importance score (0-1)
 * @param {boolean} isHub - Whether node is a network hub
 * @returns {string} - Hex color code
 */
export function getNodeColor(importance, isHub = false) {
  if (isHub) {
    return '#ff6b6b'; // Red for hubs
  }

  // Gradient from blue (low importance) to green (high importance)
  const hue = 200 + (importance * 80); // 200 (blue) to 280 (green)
  return `hsl(${hue}, 70%, 50%)`;
}

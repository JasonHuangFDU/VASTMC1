<template>
  <div ref="containerRef" class="influence-network-container">
    <div v-if="isLoading" class="loading-indicator">正在计算布局...</div>
    <div v-if="!isLoading && (!graphData || graphData.nodes.length === 0)" class="empty-state">
      没有匹配当前筛选条件的数据。
    </div>
    <div ref="tooltipRef" class="tooltip" style="opacity: 0;"></div>
    <button @click="toggleNodeEdgeLegend" class="legend-toggle-button node-edge-toggle-button">{{ showNodeEdgeLegend ? '隐藏节点/边图例' : '显示节点/边图例' }}</button>
    <div v-if="showNodeEdgeLegend" class="legend-container node-edge-legend-container">
      <h3>节点与边图例</h3>
      <div class="legend-section">
        <h4>节点类型</h4>
        <div v-for="nodeType in nodeLegend" :key="nodeType.name" class="legend-item">
          <svg width="30" height="30"><path :d="nodeType.symbol" :fill="nodeType.color" stroke="#333" stroke-width="1.5" transform="translate(15,15)"></path></svg>
          <span>{{ nodeType.name }}</span>
        </div>
      </div>
      <div class="legend-section">
        <h4>边类型</h4>
        <div v-for="edgeType in edgeLegend" :key="edgeType.name" class="legend-item">
          <svg width="30" height="30"><line x1="0" y1="15" x2="30" y2="15" :stroke="edgeType.color" :stroke-dasharray="edgeType.dasharray" stroke-width="2"></line></svg>
          <span>{{ edgeType.name }}</span>
        </div>
      </div>
    </div>

    <button @click="toggleGenreLegend" class="legend-toggle-button genre-toggle-button">{{ showGenreLegend ? '隐藏流派图例' : '显示流派图例' }}</button>
    <div v-if="showGenreLegend" class="legend-container genre-legend-container">
      <h3>流派颜色图例</h3>
      <div class="legend-section">
        <div v-for="genre in genreLegend" :key="genre.name" class="legend-item">
          <svg width="30" height="30"><rect x="5" y="5" width="20" height="20" :fill="genre.color" stroke="#333" stroke-width="1.5"></rect></svg>
          <span>{{ genre.name }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue';
import * as d3 from 'd3';
import { useGraphStore } from '@/stores/graphStore';

const store = useGraphStore();
const containerRef = ref(null);
const tooltipRef = ref(null);
const isLoading = ref(false);
const showNodeEdgeLegend = ref(true); // 控制节点/边图例显示/隐藏的状态
const showGenreLegend = ref(true); // 控制流派图例显示/隐藏的状态

const graphData = computed(() => store.filteredGraph);
const selectedNodeId = computed(() => store.selectedNodeId);

// Define color scale at a higher scope
const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

// Legend data
const nodeLegend = computed(() => [
  { name: '人', type: 'Person', symbol: d3.symbol().type(d3.symbolCircle).size(100)(), color: '#999999' },
  { name: '乐队', type: 'MusicalGroup', symbol: d3.symbol().type(d3.symbolDiamond).size(100)(), color: '#999999' },
  { name: '歌曲', type: 'Song', symbol: d3.symbol().type(d3.symbolTriangle).size(100)(), color: '#999999' },
  { name: '专辑', type: 'Album', symbol: d3.symbol().type(d3.symbolSquare).size(100)(), color: '#999999' },
  { name: '唱片公司', type: 'RecordLabel', symbol: d3.symbol().type(d3.symbolWye).size(100)(), color: '#999999' },
]);

const edgeLegend = computed(() => [
  { name: '影响力', class: 'link-influence', color: '#007bff', dasharray: '6, 3' },
  { name: '合作', class: 'link-collaboration', color: '#28a745', dasharray: '0' },
  { name: '成员关系', class: 'link-membership', color: '#6c757d', dasharray: '2, 2' },
]);

const genreLegend = computed(() => {
  // Ensure filterOptions.genres is populated before using it
  if (!store.filterOptions.genres || store.filterOptions.genres.length === 0) {
    return [];
  }
  // Update the color scale domain here, as filterOptions.genres is reactive
  colorScale.domain(store.filterOptions.genres);
  return store.filterOptions.genres.map(genre => ({
    name: genre,
    color: colorScale(genre)
  }));
});

let simulation;
let svg;
let zoom;
let zoomGroup;
let nodeElements;
let linkElements;

  const setupVisualization = () => {
    console.log('setupVisualization called');
    const container = containerRef.value;
    if (!container || !graphData.value || graphData.value.nodes.length === 0) {
      if (svg) {
        console.log('Removing existing SVG...');
        svg.remove();
        svg = null; // Clear the reference
      }
      return;
    }

    isLoading.value = true;

    nextTick(() => {
      const nodes = JSON.parse(JSON.stringify(graphData.value.nodes));
      const links = JSON.parse(JSON.stringify(graphData.value.links));

      // Ensure old SVG is removed before appending a new one
      if (svg) {
        console.log('Removing SVG before new append...');
        svg.remove();
      }

      const width = container.clientWidth;
      const height = container.clientHeight;

      svg = d3.select(container).append('svg')
        .attr('width', width)
        .attr('height', height)
        .attr('viewBox', [-width / 2, -height / 2, width, height])
        .style('background-color', '#f8f9fa');

    zoomGroup = svg.append('g');

    // --- 1. Visual Encodings ---
    const sizeScale = d3.scaleSqrt()
      .domain([0, d3.max(nodes, d => d?.influence_score || 0)])
      .range([8, 30]);

    // Ensure colorScale domain is set based on current nodes' genres
    colorScale.domain([...new Set(nodes.map(d => d.genre).filter(Boolean))]);

    
    
    const symbolGenerator = (node) => {
      const typeMap = {
        'Person': d3.symbolCircle,
        'MusicalGroup': d3.symbolDiamond,
        'Song': d3.symbolTriangle,
        'Album': d3.symbolSquare,
        'RecordLabel': d3.symbolWye,
      };
      const symbolType = typeMap[node?.['Node Type']] || d3.symbolCircle;
      const radius = sizeScale(node?.influence_score || 0);
      const area = Math.PI * Math.pow(radius, 2);
      return d3.symbol().type(symbolType).size(area)();
    };

    const getLinkClass = (edgeType) => {
      const influenceTypes = ['InStyleOf', 'CoverOf', 'DirectlySamples', 'InterpolatesFrom', 'LyricalReferenceTo'];
      const collaborationTypes = ['MemberOf', 'PerformerOf', 'ComposerOf', 'ProducerOf', 'LyricistOf'];
      if (influenceTypes.includes(edgeType)) return 'link-influence';
      if (collaborationTypes.includes(edgeType)) return 'link-collaboration';
      return 'link-membership';
    };

    // --- Arrowheads ---
    const defs = svg.append('defs');
    ['link-influence', 'link-collaboration', 'link-membership'].forEach(cls => {
      defs.append('marker')
          .attr('id', `arrow-${cls}`)
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 15)
          .attr('refY', 0)
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M0,-5L10,0L0,5')
          .attr('class', `arrow-head ${cls}`);
    });

    // --- Simulation ---
    simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(120).strength(0.6))
        .force('charge', d3.forceManyBody().strength(-200))
        .force('collide', d3.forceCollide().radius(d => sizeScale(d?.influence_score || 0) + 10))
        .force('center', d3.forceCenter(0, 0));

    // --- Render Links ---
    linkElements = zoomGroup.append('g').selectAll('path')
      .data(links).join('path')
      .attr('class', d => `link ${getLinkClass(d['Edge Type'])}`)
      .attr('marker-end', d => `url(#arrow-${getLinkClass(d['Edge Type'])})`);

    // --- Render Nodes ---
    nodeElements = zoomGroup.append('g').selectAll('path')
      .data(nodes, d => d.id).join('path')
      .attr('d', d => symbolGenerator(d)) // Correctly pass data object 'd'
      .attr('fill', d => d.genre ? colorScale(d.genre) : '#cccccc')
      .attr('class', 'node')
      .attr('stroke', d => d.notable ? 'gold' : '#fff')
      .attr('stroke-width', d => d.notable ? 3 : 1.5);

    // --- Interactivity ---
    const tooltip = d3.select(tooltipRef.value);
    nodeElements
      .on('mouseover', function(event, d) {
        console.log('Node data on hover:', d); // Add this line for debugging
        d3.select(this).attr('stroke', 'black').attr('stroke-width', 3);
        tooltip.transition().duration(200).style('opacity', .9);
        let tooltipContent = `<strong>${d.name}</strong><br/>Type: ${d['Node Type']}<br/>`;
        if (d.genre) {
          tooltipContent += `Genre: ${d.genre}<br/>`;
        }
        if (d['Node Type'] === 'Song' || d['Node Type'] === 'Album') {
          tooltipContent += `Notable: ${d.notable ? '是' : '否'}<br/>`;
        } else {
          tooltipContent += `Influence: ${d.influence_score ? d.influence_score.toFixed(2) : 'N/A'}<br/>`;
        }
        tooltip.html(tooltipContent)
               .style('left', (event.pageX + 15) + 'px')
               .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function(event, d) {
        const isSelected = d.id === selectedNodeId.value;
        d3.select(this)
          .attr('stroke', isSelected ? 'red' : (d.notable ? 'gold' : '#fff'))
          .attr('stroke-width', isSelected || d.notable ? 3 : 1.5);
        tooltip.transition().duration(500).style('opacity', 0);
      })
      .on('click', (_event, d) => { 
        void _event; // Mark as used to satisfy ESLint
        void d; // Mark as used to satisfy ESLint
        store.selectNode(d.id);
      });

    // --- Link Interactivity ---
    linkElements
      .on('mouseover', function(event, d) {
        tooltip.transition().duration(200).style('opacity', .9);
        tooltip.html(`<strong>边类型:</strong> ${d['Edge Type']}<br/><strong>源节点:</strong> ${d.source.name}<br/><strong>目标节点:</strong> ${d.target.name}`)
               .style('left', (event.pageX + 15) + 'px')
               .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function(event, d) {
        tooltip.transition().duration(500).style('opacity', 0);
      });

    const drag = d3.drag()
      .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; });
    nodeElements.call(drag);

    // --- Zoom ---
    zoom = d3.zoom().scaleExtent([0.1, 8]).on('zoom', (event) => { zoomGroup.attr('transform', event.transform); });
    svg.call(zoom);

    // --- Ticker ---
    simulation.on('tick', () => {
      linkElements.attr('d', d => `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`);
      nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
    });
    
    isLoading.value = false;
  });
};

const highlightSelectedNode = () => {
  if (!nodeElements) return;
  nodeElements
    .attr('stroke', d => d.id === selectedNodeId.value ? 'red' : (d.notable ? 'gold' : '#fff'))
    .attr('stroke-width', d => d.id === selectedNodeId.value || d.notable ? 3 : 1.5);
};

const toggleNodeEdgeLegend = () => {
  showNodeEdgeLegend.value = !showNodeEdgeLegend.value;
};

const toggleGenreLegend = () => {
  showGenreLegend.value = !showGenreLegend.value;
};

watch(graphData, () => {
  setupVisualization();
}, { deep: true });

watch(selectedNodeId, () => {
  highlightSelectedNode();
});

onMounted(() => {
  setupVisualization();
  const resizeObserver = new ResizeObserver(setupVisualization);
  if (containerRef.value) resizeObserver.observe(containerRef.value);
  onUnmounted(() => {
    if (simulation) simulation.stop();
    resizeObserver.disconnect();
  });
});
</script>

<style>
.influence-network-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}
.loading-indicator, .empty-state {
  font-size: 1.2em;
  color: #6c757d;
}
.tooltip {
  position: absolute;
  text-align: left;
  padding: 8px;
  font: 12px sans-serif;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: 0px;
  border-radius: 8px;
  pointer-events: none;
  z-index: 10;
}

/* --- Link Styles --- */
.link {
  fill: none;
  stroke-opacity: 0.5;
}
.link.link-influence {
  stroke: #007bff;
  stroke-dasharray: 6, 3;
}
.link.link-collaboration {
  stroke: #28a745;
  stroke-width: 2px;
}
.link.link-membership {
  stroke: #6c757d;
  stroke-dasharray: 2, 2;
}

/* Arrowhead colors must match link colors */
.arrow-head.link-influence { fill: #007bff; }
.arrow-head.link-collaboration { fill: #28a745; }
.arrow-head.link-membership { fill: #6c757d; }

/* --- Node Styles --- */
.node {
  cursor: pointer;
  transition: stroke 0.2s ease-in-out, stroke-width 0.2s ease-in-out;
}

.legend-container {
  position: absolute;
  background-color: rgba(255, 255, 255, 0.9);
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  font-family: sans-serif;
  z-index: 10;
  /* padding-top: 50px; Remove padding as buttons are outside */
}

.legend-container h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.4em;
  color: #333;
  text-align: center;
}

.legend-section {
  margin-bottom: 15px;
}

.legend-section h4 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 1.2em;
  color: #555;
}

.legend-item {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.legend-item svg {
  margin-right: 10px;
  flex-shrink: 0;
}

.legend-item span {
  font-size: 1em;
  color: #333;
}

.legend-toggle-button {
  position: absolute;
  /* top: 10px; */ /* Position relative to container */
  /* right: 10px; */ /* Position relative to container */
  z-index: 11; /* 确保在图例之上 */
  padding: 5px 10px; /* Smaller padding for the button */
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 0.9em;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
}

.legend-toggle-button:hover {
  background-color: #0056b3;
}

.node-edge-legend-container {
  top: 60px; /* Position below the button */
  left: 20px;
}

.genre-legend-container {
  top: 60px; /* Position below the button */
  right: 20px;
}

.node-edge-toggle-button {
  top: 20px;
  left: 20px;
}

.genre-toggle-button {
  top: 20px;
  right: 20px;
}
</style>
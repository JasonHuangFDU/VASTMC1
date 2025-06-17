<template>
  <div class="network-container" ref="containerRef">
    <svg ref="svgRef"></svg>
    <div v-if="tooltip.visible"
         class="network-tooltip"
         :style="{ top: `${tooltip.y}px`, left: `${tooltip.x}px` }"
         v-html="tooltip.content">
    </div>
  </div>
</template>


<script setup>
import { ref, reactive, onMounted, watch, computed, onUnmounted } from 'vue';
import { useGraphStore } from '../../stores/graphStore';
import * as d3 from 'd3';

// --- 1. Refs and Store Initialization ---
const containerRef = ref(null);
const svgRef = ref(null);
const store = useGraphStore();

const tooltip = reactive({
  visible: false,
  content: '',
  x: 0,
  y: 0,
});

const graphData = computed(() => ({
  nodes: store.filteredNodes,
  links: store.filteredLinks,
}));

let simulation;

// --- 2. Visual Encoding and Helper Functions ---

// **FIXED**: Define edge type categories for clarity and reuse [1]
const INFLUENCE_EDGES = ['InStyleOf', 'InterpolatesFrom', 'CoverOf', 'LyricalReferenceTo', 'DirectlySamples', 'MemberOf'];
const COLLABORATION_EDGES = ['MemberOf', 'PerformerOf', 'ComposerOf', 'ProducerOf', 'LyricistOf'];
// Business edges are everything else, like 'RecordedBy', 'DistributedBy'

const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

// **FIXED**: Properly define the domain and range for the symbol scale [1]
const symbolScale = d3.scaleOrdinal()
 .domain()
 .range();

const radiusScale = (influenceScore) => 5 + Math.log2(influenceScore || 1) * 2;

// --- 3. Main D3 Rendering Function ---
function renderNetwork(data) {
  if (!containerRef.value ||!data ||!data.nodes || data.nodes.length === 0) return;

  const { width, height } = containerRef.value.getBoundingClientRect();
  const svg = d3.select(svgRef.value)
   .attr('width', width)
   .attr('height', height)
   .attr('viewBox', [-width / 2, -height / 2, width, height]);

  svg.selectAll('*').remove();

  simulation = d3.forceSimulation(data.nodes)
   .force('link', d3.forceLink(data.links).id(d => d.id).distance(70))
   .force('charge', d3.forceManyBody().strength(-200))
   .force('collide', d3.forceCollide().radius(d => radiusScale(d.influenceScore) + 3))
   .force('center', d3.forceCenter(0, 0));

  svg.append('defs').selectAll('marker')
   .data(['influence', 'collaboration', 'business'])
   .join('marker')
     .attr('id', d => `arrow-${d}`)
     .attr('viewBox', '0 -5 10 10')
     .attr('refX', 15)
     .attr('refY', -0.5)
     .attr('markerWidth', 6)
     .attr('markerHeight', 6)
     .attr('orient', 'auto')
   .append('path')
     .attr('d', 'M0,-5L10,0L0,5')
     .attr('fill', d => ({ influence: '#66f', collaboration: '#3c6', business: '#999' }[d]));

  const link = svg.append('g')
   .attr('stroke-opacity', 0.6)
   .selectAll('path')
   .data(data.links)
   .join('path')
     .attr('stroke-width', 1.5)
     .attr('stroke', d => {
        // **FIXED**: Use the predefined arrays for checking
        if (INFLUENCE_EDGES.includes(d.EdgeType)) return '#66f';
        if (COLLABORATION_EDGES.includes(d.EdgeType)) return '#3c6';
        return '#999';
      })
     .attr('stroke-dasharray', d => INFLUENCE_EDGES.includes(d.EdgeType)? '5,5' : null)
     .attr('marker-end', d => {
        if (INFLUENCE_EDGES.includes(d.EdgeType)) return 'url(#arrow-influence)';
        if (COLLABORATION_EDGES.includes(d.EdgeType)) return 'url(#arrow-collaboration)';
        return 'url(#arrow-business)';
      });

  const node = svg.append('g')
   .selectAll('g')
   .data(data.nodes)
   .join('g')
     .call(drag(simulation));

  node.append('path')
   .attr('d', d3.symbol().type(d => symbolScale(d.NodeType)).size(d => Math.pow(radiusScale(d.influenceScore), 2) * Math.PI))
   .attr('fill', d => colorScale(d.genre))
   .attr('stroke', d => d.notable? 'gold' : '#fff')
   .attr('stroke-width', d => d.notable? 3 : 1.5);

  node.append('text')
   .text(d => d.name || d.Name)
   .attr('x', 12)
   .attr('y', 4)
   .attr('font-size', '10px')
   .attr('fill', '#333');

  node.on('mouseover', (event, d) => {
    tooltip.visible = true;
    tooltip.content = `<strong>${d.name || d.Name}</strong><br/>Type: ${d.NodeType}<br/>Genre: ${d.genre || 'N/A'}`;
    tooltip.x = event.pageX + 15;
    tooltip.y = event.pageY;
  }).on('mouseout', () => {
    tooltip.visible = false;
  }).on('click', (event, d) => {
    store.selectNode(d.id);
  });

  const zoom = d3.zoom().scaleExtent([0.1, 8]).on('zoom', (event) => {
    svg.selectAll('g').attr('transform', event.transform);
  });
  svg.call(zoom);

  simulation.on('tick', () => {
    link.attr('d', d => `M${d.source.x},<span class="math-inline">\{d\.source\.y\} L</span>{d.target.x},${d.target.y}`);
    node.attr('transform', d => `translate(<span class="math-inline">\{d\.x\},</span>{d.y})`);
  });
}

// --- 4. Dragging Logic ---
function drag(simulation) {
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }
  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }
  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
  return d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended);
}

// --- 5. Vue Lifecycle and Watchers ---
watch(graphData, (newData) => {
  if (newData && newData.nodes && newData.nodes.length > 0 && containerRef.value) {
    if (simulation) simulation.stop();
    renderNetwork(newData);
  }
}, { deep: true });

onMounted(() => {
  // Initial render if data is already available
  if (store.nodes && store.nodes.length > 0) {
    renderNetwork(graphData.value);
  }
});

onUnmounted(() => {
  if (simulation) {
    simulation.stop();
  }
});
</script>

<style>
.network-container {
  width: 100%;
  height: 100%;
  border: 1px solid #ccc;
  border-radius: 4px;
  position: relative;
  background-color: #f9f9f9;
}

.network-container svg {
  display: block;
}

.network-tooltip {
  position: fixed; /* Use fixed positioning to escape SVG container */
  background-color: rgba(255, 255, 255, 0.95);
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 8px;
  font-size: 12px;
  pointer-events: none;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
  white-space: nowrap;
}

.node text {
  pointer-events: none;
  text-shadow: 0 1px 0 #fff, 1px 0 0 #fff, 0 -1px 0 #fff, -1px 0 0 #fff;
}
</style>
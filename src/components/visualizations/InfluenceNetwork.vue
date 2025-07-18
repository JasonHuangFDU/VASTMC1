<template>
  <div ref="containerRef" class="influence-network-container">
    <!-- 修改：分段式跳数切换按钮 -->
    <div class="hop-toggle-container">
      <div class="hop-toggle-group">
        <button 
          @click="setHopLevel(1)" 
          :class="['hop-toggle-button', 'left-button', { active: store.hopLevel === 1 }]"
        >
          One Hop
        </button>
        <button 
          @click="setHopLevel(2)" 
          :class="['hop-toggle-button', 'right-button', { active: store.hopLevel === 2 }]"
        >
          Two Hops
        </button>
      </div>
    </div>

    <div v-if="store.isLoading" class="loading-indicator">Calculating layout...</div>
    <div v-if="!store.isLoading && (!store.graphData || store.graphData.nodes.length === 0)" class="empty-state">
      No data matches the current filter criteria.
    </div>
    <div ref="tooltipRef" class="tooltip" style="opacity: 0;"></div>
    
    <!-- 图例部分 -->
    <button @click="toggleNodeEdgeLegend" class="legend-toggle-button node-edge-toggle-button">{{ showNodeEdgeLegend ? 'Hide Node/Edge Legend' : 'Show Node/Edge Legend' }}</button>
    <div v-if="showNodeEdgeLegend" :key="`node-edge-${legendKey}`" class="legend-container node-edge-legend-container">
      <h3>Node & Edge Legend</h3>
      <div class="legend-section">
        <h4>Node Types</h4>
        <div v-for="nodeType in displayedNodeTypes" :key="nodeType.name" class="legend-item">
          <svg width="30" height="30"><path :d="getSymbolPath(nodeType.symbol)" :fill="nodeType.color" :stroke="nodeType.stroke" :stroke-width="nodeType.strokeWidth" transform="translate(15,15)"></path></svg>
          <span>{{ nodeType.name }}</span>
        </div>
      </div>
      <div class="legend-section">
        <h4>Edge Types</h4>
        <div v-for="edgeType in displayedEdgeTypes" :key="edgeType.name" class="legend-item">
          <svg width="30" height="30"><line x1="0" y1="15" x2="30" y2="15" :stroke="edgeType.color" :stroke-dasharray="edgeType.dasharray" stroke-width="2"></line></svg>
          <span>{{ edgeType.name }}</span>
        </div>
      </div>
    </div>

    <button @click="toggleGenreLegend" class="legend-toggle-button genre-toggle-button">{{ showGenreLegend ? 'Hide Genre Legend' : 'Show Genre Legend' }}</button>
    <div v-if="showGenreLegend" :key="`genre-${legendKey}`" class="legend-container genre-legend-container">
      <h3>Genre Color Legend</h3>
      <div class="legend-section">
        <div v-for="genre in displayedGenres" :key="genre.name" class="legend-item">
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
import { getGenreColor } from '@/utils/colors';
import { debounce } from 'lodash-es';
import { storeToRefs } from 'pinia';

const store = useGraphStore();
const { selectedTimeRange } = storeToRefs(store); // 引入 selectedTimeRange
const containerRef = ref(null);
const tooltipRef = ref(null);
const legendKey = ref(0);

const showNodeEdgeLegend = ref(false);
const showGenreLegend = ref(false);

const toggleNodeEdgeLegend = () => showNodeEdgeLegend.value = !showNodeEdgeLegend.value;
const toggleGenreLegend = () => showGenreLegend.value = !showGenreLegend.value;

const setHopLevel = (level) => {
  store.setHopLevel(level);
};

let simulation;
let svg;
let zoomGroup;
let sizeScale = d3.scaleSqrt();
const linkWidthScale = d3.scaleSqrt().domain([1, 10]).range([2, 10]);

function getNodeRadius(node) {
  if (!node) return 8;
  const nodeType = node['Node Type'];
  if (nodeType === 'Person' || nodeType === 'MusicalGroup' || nodeType === 'RecordLabel') {
    const score = node.influence_score;
    const numericScore = (typeof score === 'number' && isFinite(score)) ? score : 0;
    return sizeScale(numericScore);
  }
  if (nodeType === 'Song' || nodeType === 'Album') return 12;
  return 15;
}

const displayedNodeTypes = ref([]);
const displayedEdgeTypes = ref([]);
const displayedGenres = ref([]);

const ALL_NODE_LEGEND_INFO = {
  'Person': { name: 'Person', symbol: d3.symbolCircle, color: '#999999', stroke: '#333', strokeWidth: 1.5 },
  'MusicalGroup': { name: 'Musical Group', symbol: d3.symbolDiamond, color: '#999999', stroke: '#333', strokeWidth: 1.5 },
  'Song': { name: 'Song', symbol: d3.symbolTriangle, color: '#999999', stroke: '#333', strokeWidth: 1.5 },
  'Album': { name: 'Album', symbol: d3.symbolSquare, color: '#999999', stroke: '#333', strokeWidth: 1.5 },
  'RecordLabel': { name: 'RecordLabel', symbol: d3.symbolWye, color: '#999999', stroke: '#333', strokeWidth: 1.5 },
  'Notable': { name: 'Notable Node', symbol: d3.symbolCircle, color: '#cccccc', stroke: 'gold', strokeWidth: 3 },
  'SailorShift': { name: 'Sailor Shift', symbol: d3.symbolCircle, color: '#FF6F61', stroke: '#333', strokeWidth: 1.5 },
};

const getSymbolPath = (symbolType, size = 100) => d3.symbol().type(symbolType).size(size)();

const ALL_EDGE_LEGEND_INFO = {
  'influence': { name: 'Influence', color: '#9FC1E8', dasharray: '6, 3' },
  'collaboration': { name: 'Collaboration', color: '#B7D962', dasharray: '0' },
  'membership': { name: 'Commercial', color: '#6c757d', dasharray: '2, 2' },
};

const getPrimaryLinkClass = (relations) => {
  const influenceTypes = ['InStyleOf', 'CoverOf', 'DirectlySamples', 'InterpolatesFrom', 'LyricalReferenceTo'];
  const collaborationTypes = ['PerformerOf', 'ComposerOf', 'ProducerOf', 'LyricistOf', 'MemberOf'];
  if (relations.some(r => influenceTypes.includes(r))) return 'influence';
  if (relations.some(r => collaborationTypes.includes(r))) return 'collaboration';
  return 'membership';
};

const handleResize = () => {
  if (!svg || !containerRef.value) return;
  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;
  svg.attr('width', width).attr('height', height).attr('viewBox', [-width / 2, -height / 2, width, height]);
  if (simulation) {
    simulation.force('center', d3.forceCenter(0, 0));
    simulation.alpha(0.3).restart();
  }
};

function clearPreviousRender() {
  if (simulation) simulation.stop();
  simulation = null;
  if (containerRef.value) d3.select(containerRef.value).selectAll('svg').remove();
  svg = null;
  zoomGroup = null;
  if (tooltipRef.value) d3.select(tooltipRef.value).style('opacity', 0);
}

function renderGraph(data) {
  clearPreviousRender();
  const container = containerRef.value;
  if (!container || !data || !data.nodes || data.nodes.length === 0) return;

  const nodes = JSON.parse(JSON.stringify(data.nodes));
  const links = JSON.parse(JSON.stringify(data.links));

  const nodeTypesInGraph = new Set(nodes.map(n => n.id === 17255 ? 'SailorShift' : n['Node Type']));
  const edgeClassesInGraph = new Set(links.map(l => getPrimaryLinkClass(l.relations)));
  const genresInGraph = new Set(nodes.map(n => n.genre).filter(Boolean));
  const hasNotableNode = nodes.some(n => n.notable);

  displayedNodeTypes.value = Array.from(nodeTypesInGraph).map(type => ALL_NODE_LEGEND_INFO[type]).filter(Boolean);
  if (hasNotableNode && !nodeTypesInGraph.has('Notable')) {
    displayedNodeTypes.value.push(ALL_NODE_LEGEND_INFO['Notable']);
  }
  displayedEdgeTypes.value = Array.from(edgeClassesInGraph).map(cls => ALL_EDGE_LEGEND_INFO[cls]).filter(Boolean);
  displayedGenres.value = Array.from(genresInGraph).map(genre => ({ name: genre, color: getGenreColor(genre) }));

  const width = container.clientWidth;
  const height = container.clientHeight;

  svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [-width / 2, -height / 2, width, height]);

  zoomGroup = svg.append('g');

  const maxInfluence = d3.max(nodes, d => d.influence_score);
  sizeScale.domain([0, maxInfluence > 0 ? maxInfluence : 1]).range(store.hopLevel === 2 ? [6, 25] : [8, 30]);
  const getSymbol = d3.scaleOrdinal().domain(['Person', 'MusicalGroup', 'Song', 'Album', 'RecordLabel']).range([d3.symbolCircle, d3.symbolDiamond, d3.symbolTriangle, d3.symbolSquare, d3.symbolWye]);

  const defs = svg.append('defs');
  Object.entries(ALL_EDGE_LEGEND_INFO).forEach(([cls, info]) => {
    defs.append('marker').attr('id', `arrow-${cls}`)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 10)
      .attr('refY', 0)
      .attr('markerWidth', 4)
      .attr('markerHeight', 4)
      .attr('orient', 'auto')
      .append('path').attr('d', 'M0,-5L10,0L0,5').attr('class', `arrow-head ${cls}`);
  });

  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120).strength(0.5))
    .force('charge', d3.forceManyBody().strength(-250))
    .force('collide', d3.forceCollide().radius(d => getNodeRadius(d) + 10))
    .force('center', d3.forceCenter(0, 0));

  const linkElements = zoomGroup.append('g').selectAll('path').data(links).join('path')
    .attr('class', d => `link link-${getPrimaryLinkClass(d.relations)}`)
    .style('stroke-width', d => linkWidthScale(d.count))
    .style('stroke-dasharray', d => {
        const primaryClass = getPrimaryLinkClass(d.relations);
        return ALL_EDGE_LEGEND_INFO[primaryClass]?.dasharray || '0';
    });

  const nodeElements = zoomGroup.append('g').selectAll('path.node').data(nodes, d => d.id).join('path')
    .attr('class', 'node')
    .attr('d', d => getSymbolPath(getSymbol(d['Node Type']), Math.PI * Math.pow(getNodeRadius(d), 2)))
    .attr('fill', d => {
      if (d.id === 17255) return '#FF6F61';
      return d.highlight ? '#ffc107' : (d.genre ? getGenreColor(d.genre) : '#cccccc');
    })
    .attr('stroke', d => d.highlight ? '#e85a19' : (d.notable ? 'gold' : '#fff'))
    .attr('stroke-width', d => d.highlight || d.notable ? 3 : 1.5);

  const tooltip = d3.select(tooltipRef.value);

  linkElements.on('mouseover', function(event, d) {
    d3.select(this).classed('hovered', true);
    nodeElements.classed('dimmed', n => n.id !== d.source.id && n.id !== d.target.id);
    linkElements.classed('dimmed', l => l !== d);

    let content = `<strong>${d.source.name} -> ${d.target.name}</strong><br/>Relations (${d.count}):<br/>` + d.relations.join('<br/>');
    const containerRect = containerRef.value.getBoundingClientRect();
    const tooltipX = event.clientX - containerRect.left + 10;
    const tooltipY = event.clientY - containerRect.top - 28;
    tooltip.html(content).style('opacity', 1).style('left', `${tooltipX}px`).style('top', `${tooltipY}px`);
  }).on('mouseout', function() {
    d3.select(this).classed('hovered', false);
    nodeElements.classed('dimmed', false);
    linkElements.classed('dimmed', false);
    tooltip.style('opacity', 0);
  });

  nodeElements.on('mouseover', function(event, d) {
    //console.log("Node hovered:", d);
    const connectedIds = new Set([d.id]);
    links.forEach(link => {
      if (link.source.id === d.id) connectedIds.add(link.target.id);
      if (link.target.id === d.id) connectedIds.add(link.source.id);
    });

    nodeElements.classed('dimmed', n => !connectedIds.has(n.id));
    linkElements.classed('dimmed', l => !(connectedIds.has(l.source.id) && connectedIds.has(l.target.id)));
    d3.select(this).classed('dimmed', false);

    let content = `<strong>${d.name}</strong><br/>Type: ${d['Node Type']}`;
    if (d['Node Type'] === 'Person' || d['Node Type'] === 'MusicalGroup' || d['Node Type'] === 'RecordLabel') {
      if (d.influence_score !== undefined) {
        content += `<br/>Notability Score: ${d.influence_score.toFixed(2)}`;
      }
    }
    if (d['Node Type'] === 'Song' || d['Node Type'] === 'Album') {
      if (d.genre) content += `<br/>Genre: ${d.genre}`;
      if (d.contributors) {
        for (const [role, artists] of Object.entries(d.contributors)) {
          if (artists.length > 0) {
            const roleName = role.charAt(0).toUpperCase() + role.slice(1, -1);
            const artistLinks = artists.map(a => `${a.name} (${a.id})`).join(', ');
            content += `<br/>${roleName}: ${artistLinks}`;
          }
        }
      }
    }
    
    const containerRect = containerRef.value.getBoundingClientRect();
    const tooltipX = event.clientX - containerRect.left + 10;
    const tooltipY = event.clientY - containerRect.top - 28;
    tooltip.html(content).style('opacity', 1).style('left', `${tooltipX}px`).style('top', `${tooltipY}px`);
  }).on('mouseout', function() {
    nodeElements.classed('dimmed', false);
    linkElements.classed('dimmed', false);
    tooltip.style('opacity', 0);
  }).on('click', (event, d) => {
    store.selectCenterNode(d.id);
  });

  nodeElements.call(d3.drag().on('start', (e, d) => {
    if (!e.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x; d.fy = d.y;
  }).on('drag', (e, d) => {
    d.fx = e.x; d.fy = e.y;
  }).on('end', (e, d) => {
    if (!e.active) simulation.alphaTarget(0);
    d.fx = null; d.fy = null;
  }));

  svg.call(d3.zoom().scaleExtent([0.1, 8]).on('zoom', e => {
    if (zoomGroup) zoomGroup.attr('transform', e.transform);
  }));

  simulation.on('tick', () => {
    linkElements.attr('d', d => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return '';

        const sourceRadius = getNodeRadius(d.source);
        const targetRadius = getNodeRadius(d.target);

        const sourceTrimmedX = d.source.x + (dx / dist) * sourceRadius;
        const sourceTrimmedY = d.source.y + (dy / dist) * sourceRadius;

        const targetTrimmedX = d.target.x - (dx / dist) * targetRadius;
        const targetTrimmedY = d.target.y - (dy / dist) * targetRadius;
        
        if (d.count > 1) {
            const dr = dist * 1.5;
            return `M${sourceTrimmedX},${sourceTrimmedY}A${dr},${dr} 0 0,1 ${targetTrimmedX},${targetTrimmedY}`;
        }
        return `M${sourceTrimmedX},${sourceTrimmedY}L${targetTrimmedX},${targetTrimmedY}`;
    }).attr('marker-end', d => {
      const dx = d.target.x - d.source.x;
      const dy = d.target.y - d.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist > 30 ? `url(#arrow-${getPrimaryLinkClass(d.relations)})` : null;
    });
    nodeElements.attr('transform', d => `translate(${d.x},${d.y})`);
  });
}

watch(() => store.graphData, (newGraphData) => {
  renderGraph(newGraphData);
  if (newGraphData && newGraphData.nodes.length > 0) {
    nextTick(() => {
      showNodeEdgeLegend.value = true;
      showGenreLegend.value = true;
      legendKey.value += 1;
    });
  }
}, { deep: true });

onMounted(() => {
  const debouncedResize = debounce(handleResize, 300);
  const resizeObserver = new ResizeObserver(debouncedResize);
  if (containerRef.value) resizeObserver.observe(containerRef.value);
  onUnmounted(() => {
    clearPreviousRender();
    resizeObserver.disconnect();
  });
});
</script>

<style>
.influence-network-container { width: 100%; height: 80vh; min-height: 480px; border: 1px solid #dee2e6; border-radius: 4px; overflow: hidden; position: relative; display: flex; justify-content: center; align-items: center; background-color: #f8f9fa; }
.loading-indicator, .empty-state { font-size: 1.5em; color: #6c757d; }
.tooltip { position: absolute; text-align: left; padding: 8px; font: 12px sans-serif; background: rgba(0, 0, 0, 0.7); color: white; border-radius: 8px; pointer-events: none; z-index: 10; max-width: 300px; }

.link {
  fill: none;
  stroke-opacity: 0.6;
  transition: stroke-opacity 0.3s ease, opacity 0.3s ease;
}
.link.hovered {
  stroke-opacity: 1;
}
.link.dimmed {
  opacity: 0.1 !important;
}
.link.link-influence { stroke: #9FC1E8; }
.link.link-collaboration { stroke: #B7D962; }
.link.link-membership { stroke: #aaaaaa; }

.arrow-head { transition: fill-opacity 0.3s ease; }
.arrow-head.link-influence { fill: #9FC1E8; }
.arrow-head.link-collaboration { fill: #B7D962; }
.arrow-head.link-membership { fill: #aaaaaa; }

.node {
  cursor: pointer;
  transition: opacity 0.3s ease;
}
.node.dimmed {
  opacity: 0.2;
}

.legend-container { position: absolute; background-color: rgba(255, 255, 255, 0.95); border: 1px solid #ccc; border-radius: 8px; padding: 15px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); font-family: sans-serif; z-index: 10; }
.legend-container h3 { margin-top: 0; margin-bottom: 15px; font-size: 1.2em; text-align: center; }
.legend-section { margin-bottom: 10px; }
.legend-section h4 { margin-top: 0; margin-bottom: 8px; font-size: 1em; }
.legend-item { display: flex; align-items: center; margin-bottom: 5px; }
.legend-item svg { margin-right: 8px; flex-shrink: 0; }
.legend-toggle-button { position: absolute; z-index: 11; padding: 5px 10px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 0.9em; }
.node-edge-legend-container { top: 60px; left: 20px; }
.genre-legend-container { top: 60px; right: 20px; }
.node-edge-toggle-button { top: 20px; left: 20px; }
.genre-toggle-button { top: 20px; right: 20px; }

.hop-toggle-container { position: absolute; top: 20px; left: 50%; transform: translateX(-50%); z-index: 11; }
.hop-toggle-group { display: flex; border: 1px solid #ccc; border-radius: 6px; overflow: hidden; background-color: white; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.hop-toggle-button { padding: 8px 16px; background-color: #f8f9fa; color: #6c757d; border: none; cursor: pointer; font-size: 0.9em; transition: all 0.3s ease; position: relative; }
.hop-toggle-button.active { background-color: #007bff; color: white; }
.hop-toggle-button:hover:not(.active) { background-color: #e9ecef; }
.hop-toggle-button.left-button { border-right: 1px solid #ccc; }
.hop-toggle-button.right-button { border-left: none; }
.hop-toggle-button.active.left-button { border-right: 1px solid #007bff; }
.hop-toggle-button.active.right-button { border-left: none; }
</style>
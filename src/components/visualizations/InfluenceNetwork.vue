<template>
  <div ref="containerRef" class="influence-network-container">
    <!-- 修改：分段式跳数切换按钮 -->
    <div class="hop-toggle-container">
      <div class="hop-toggle-group">
        <button 
          @click="setHopLevel(1)" 
          :class="['hop-toggle-button', { active: store.hopLevel === 1 && !store.isSankeyFiltered && !store.isCollaborationFocusActive && !store.isInfluenceFocusActive }]"
          :disabled="store.isSankeyFiltered || store.isCollaborationFocusActive || store.isInfluenceFocusActive"
        >
          One Hop
        </button>
        <button 
          @click="setHopLevel(2)" 
          :class="['hop-toggle-button', { active: (store.hopLevel === 2 || store.isCollaborationFocusActive || store.isInfluenceFocusActive) && !store.isSankeyFiltered }]"
          :disabled="store.isSankeyFiltered"
        >
          Two Hops
        </button>
        <button 
          @click="setHopLevel(3)" 
          :class="['hop-toggle-button', { active: store.hopLevel === 3 && !store.isSankeyFiltered && !store.isCollaborationFocusActive && !store.isInfluenceFocusActive }]"
          :disabled="store.isSankeyFiltered || store.isCollaborationFocusActive || store.isInfluenceFocusActive"
        >
          Three Hops
        </button>
        <button 
          @click="store.toggleCollaborationFocus()" 
          :class="['hop-toggle-button', { active: store.isCollaborationFocusActive }]"
          :disabled="store.isSankeyFiltered || store.isInfluenceFocusActive"
        >
          Focus on Collaboration
        </button>
        <button 
          @click="store.toggleInfluenceFocus()" 
          :class="['hop-toggle-button', { active: store.isInfluenceFocusActive }]"
          :disabled="store.isSankeyFiltered || store.isCollaborationFocusActive"
        >
          Focus on Influence
        </button>
        <!-- 新增：Sankey筛选重置按钮 -->
        <button
          v-if="store.isSankeyFiltered"
          @click="store.resetSankeyFilter()"
          class="hop-toggle-button reset-button"
        >
          Reset View
        </button>
      </div>
    </div>

    <div v-if="store.isLoading" class="loading-indicator">Calculating layout...</div>
    <div v-if="!store.isLoading && (!displayedGraphData || displayedGraphData.nodes.length === 0)" class="empty-state">
      <span v-if="store.isSankeyFiltered">No influence path found for this selection.</span>
      <span v-else>No data matches the current filter criteria.</span>
    </div>
    <div ref="tooltipRef" class="tooltip" style="opacity: 0;"></div>
    
    <!-- 图例部分 -->
    <button 
      @click="toggleNodeEdgeLegend" 
      :class="['legend-toggle-button', 'node-edge-toggle-button', { active: showNodeEdgeLegend }]"
    >
      {{ showNodeEdgeLegend ? 'Hide Node/Edge Legend' : 'Show Node/Edge Legend' }}
    </button>
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

    <button 
      @click="toggleGenreLegend" 
      :class="['legend-toggle-button', 'genre-toggle-button', { active: showGenreLegend }]"
    >
      {{ showGenreLegend ? 'Hide Genre Legend' : 'Show Genre Legend' }}
    </button>
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

// 新增：计算属性，用于决定显示哪个图数据
const displayedGraphData = computed(() => {
  if (store.isSankeyFiltered) {
    return store.sankeyFilteredData;
  }
  return store.graphData;
});

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
  let baseRadius;
  const nodeType = node['Node Type'];
  if (nodeType === 'Person' || nodeType === 'MusicalGroup' || nodeType === 'RecordLabel') {
    const score = node.influence_score;
    const numericScore = (typeof score === 'number' && isFinite(score)) ? score : 0;
    baseRadius = sizeScale(numericScore);
  } else if (nodeType === 'Song' || nodeType === 'Album') {
    baseRadius = 12;
  } else {
    baseRadius = 15;
  }
  // 如果节点被高亮，则���其半径增加50%
  return node.highlight ? baseRadius * 1.5 : baseRadius;
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

  // 检查是否存在任何高亮节点，以确定是否激活高亮模式
  const isHighlightActive = nodes.some(n => n.highlight);

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
    .style('stroke-width', d => d.highlight ? 5 : linkWidthScale(d.count)) // 高亮时宽度为5，否则按比例
    .style('opacity', d => {
      if (!isHighlightActive) return 0.7; // 默认状态设为0.7
      return d.highlight ? 1 : 0.15; // 交互状态下高亮为1，非高亮为0.15
    })
    .style('stroke', d => {
        const primaryClass = getPrimaryLinkClass(d.relations);
        if (d.highlight) {
            // 为高亮状态定义更深的颜色
            const highlightColors = {
                'influence': '#3d5a80', // 深蓝
                'collaboration': '#8a9a5b', // 暗橄榄绿
                'membership': '#505050'  // 深灰
            };
            return highlightColors[primaryClass] || '#333';
        }
        return ALL_EDGE_LEGEND_INFO[primaryClass]?.color || '#ccc';
    })
    .style('stroke-dasharray', d => {
        const primaryClass = getPrimaryLinkClass(d.relations);
        return ALL_EDGE_LEGEND_INFO[primaryClass]?.dasharray || '0';
    });

  const nodeElements = zoomGroup.append('g').selectAll('path.node').data(nodes, d => d.id).join('path')
    .attr('class', 'node')
    .attr('d', d => getSymbolPath(getSymbol(d['Node Type']), Math.PI * Math.pow(getNodeRadius(d), 2)))
    .attr('fill', d => {
      if (d.id === 17255) return '#FF6F61';
      return d.genre ? getGenreColor(d.genre) : '#cccccc';
    })
    .attr('stroke', d => d.notable ? 'gold' : '#fff')
    .attr('stroke-width', d => d.highlight ? 4 : (d.notable ? 3 : 1.5))
    .style('opacity', d => {
      if (!isHighlightActive) return 1; // 默认状态完全不透明
      return d.highlight ? 1 : 0.2; // 交互状态下应用高亮逻辑
    });

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
      if (d.release_date) content += `<br/>Release Date: ${d.release_date}`;
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

// 修改：监听 displayedGraphData 而不是 store.graphData
watch(() => displayedGraphData.value, (newGraphData) => {
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
.influence-network-container { 
  width: 100%; 
  height: 100%; 
  min-height: 0; /* 允许flex item收缩 */
  border: 1px solid #dee2e6; 
  border-radius: 4px; 
  overflow: hidden; 
  position: relative; 
  display: flex; 
  justify-content: center; 
  align-items: center; 
  background-color: transparent; 
}

.loading-indicator, .empty-state { 
  font-size: 0.9rem; 
  color: #6c757d; 
  text-align: center;
  padding: 20px;
}

.tooltip { 
  position: absolute; 
  text-align: left; 
  padding: 10px 14px; 
  font: 12px 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
  background-color: rgba(255, 255, 255, 0.7); /* White background with 90% opacity */
  color: #333333; 
  border-radius: 6px; 
  pointer-events: none; 
  z-index: 10; 
  max-width: 300px; 
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  border: 1px solid #E0E0E0;
  line-height: 1.4;
  backdrop-filter: blur(2px); /* Optional: Adds a blur effect to the background */
}

.link {
  fill: none;
  stroke-opacity: 0.8;
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

.legend-container { 
  position: absolute; 
  background-color: rgba(255, 255, 255, 0.95); 
  border: 1px solid #ccc; 
  border-radius: 8px; 
  padding: 15px; 
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1); 
  font-family: sans-serif; 
  z-index: 10; 
  line-height: 1.4; 
}

.legend-container h3 { 
  margin-top: 0; 
  margin-bottom: 15px; 
  font-size: 0.9rem; 
  text-align: center; 
  color: var(--color-text-primary);
}

.legend-section { 
  margin-bottom: 10px; 
}

.legend-section h4 { 
  margin-top: 0; 
  margin-bottom: 8px; 
  font-size: 0.9rem; 
  color: var(--color-text-primary);
}

.legend-item { 
  display: flex; 
  align-items: center; 
  margin-bottom: 0px; 
  line-height: 1.2;
}

.legend-item svg { 
  margin-right: 8px; 
  flex-shrink: 0; 
}

.legend-item span {
  color: var(--color-text-secondary);
}

.legend-item span {
  color: var(--color-text-secondary, #6c757d);
}

.legend-toggle-button { 
  position: absolute; 
  z-index: 11; 
  padding: 6px 14px; 
  font-size: 14px;
  font-weight: 500; 
  color: var(--color-text-secondary);
  background-color: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer; 
  transition: all 0.2s ease-in-out; 
}

.legend-toggle-button.active { 
  color: var(--color-surface);
  background-color: var(--color-primary-accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.hop-toggle-container { 
  position: absolute; 
  top: 16px; 
  left: 50%; 
  transform: translateX(-50%); 
  z-index: 11; 
}

.hop-toggle-group { 
  display: flex; 
  gap: 12px;
  background-color: var(--color-background);
  border-radius: 8px;
  padding: 4px;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
}

.button-subgroup {
  display: flex;
}

.hop-toggle-button { 
  padding: 6px 14px; 
  font-size: 14px;
  font-weight: 500; 
  color: var(--color-text-secondary);
  background-color: transparent;
  border: none;
  cursor: pointer; 
  border-radius: 6px;
  transition: all 0.2s ease-in-out; 
  position: relative; 
}

.hop-toggle-button:disabled {
  color: #adb5bd;
  cursor: not-allowed;
  background-color: #f8f9fa;
}

.hop-toggle-button.active { 
  color: var(--color-surface);
  background-color: var(--color-primary-accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.hop-toggle-button:hover:not(.active):not(:disabled) { 
  background-color: var(--color-background); 
}

.hop-toggle-button.reset-button {
  background-color: #e74c3c;
  color: white;
  font-weight: bold;
}
.hop-toggle-button.reset-button:hover {
  background-color: #c0392b;
}


.node-edge-legend-container { 
  top: 60px; 
  left: 20px; 
}

.genre-legend-container { 
  top: 60px; 
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
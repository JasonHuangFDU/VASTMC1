<template>
  <div ref="containerRef" class="influence-network-container">
    <!-- 修改：分段式跳数切换按钮 -->
    <div class="hop-toggle-container">
      <div class="hop-toggle-group">
        <button 
          @click="setHopLevel(1)" 
          :class="['hop-toggle-button', 'left-button', { active: store.hopLevel === 1 }]"
        >
          一跳连接
        </button>
        <button 
          @click="setHopLevel(2)" 
          :class="['hop-toggle-button', 'right-button', { active: store.hopLevel === 2 }]"
        >
          二跳连接
        </button>
      </div>
    </div>

    <div v-if="store.isLoading" class="loading-indicator">正在计算布局...</div>
    <div v-if="!store.isLoading && (!store.graphData || store.graphData.nodes.length === 0)" class="empty-state">
      没有匹配当前筛选条件的数据。
    </div>
    <div ref="tooltipRef" class="tooltip" style="opacity: 0;"></div>
    
    <!-- 图例部分 -->
    <button @click="toggleNodeEdgeLegend" class="legend-toggle-button node-edge-toggle-button">{{ showNodeEdgeLegend ? '隐藏节点/边图例' : '显示节点/边图例' }}</button>
    <div v-if="showNodeEdgeLegend" class="legend-container node-edge-legend-container">
      <h3>节点与边图例</h3>
      <div class="legend-section">
        <h4>节点类型</h4>
        <!-- 修改：使用动态的 displayedNodeTypes -->
        <div v-for="nodeType in displayedNodeTypes" :key="nodeType.name" class="legend-item">
          <svg width="30" height="30"><path :d="nodeType.symbol" :fill="nodeType.color" :stroke="nodeType.stroke" :stroke-width="nodeType.strokeWidth" transform="translate(15,15)"></path></svg>
          <span>{{ nodeType.name }}</span>
        </div>
      </div>
      <div class="legend-section">
        <h4>边类型</h4>
        <!-- 修改：使用动态的 displayedEdgeTypes -->
        <div v-for="edgeType in displayedEdgeTypes" :key="edgeType.name" class="legend-item">
          <svg width="30" height="30"><line x1="0" y1="15" x2="30" y2="15" :stroke="edgeType.color" :stroke-dasharray="edgeType.dasharray" stroke-width="2"></line></svg>
          <span>{{ edgeType.name }}</span>
        </div>
      </div>
    </div>

    <button @click="toggleGenreLegend" class="legend-toggle-button genre-toggle-button">{{ showGenreLegend ? '隐藏流派图例' : '显示流派图例' }}</button>
    <div v-if="showGenreLegend" class="legend-container genre-legend-container">
      <h3>流派颜色图例</h3>
      <div class="legend-section">
        <!-- 修改：使用动态的 displayedGenres -->
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
import { getGenreColor } from '@/utils/colors'; // 导入颜色函数
import { debounce } from 'lodash-es';

const store = useGraphStore();
const containerRef = ref(null);
const tooltipRef = ref(null);

// --- 图例控制 ---
const showNodeEdgeLegend = ref(false);
const showGenreLegend = ref(false);

const toggleNodeEdgeLegend = () => showNodeEdgeLegend.value = !showNodeEdgeLegend.value;
const toggleGenreLegend = () => showGenreLegend.value = !showGenreLegend.value;

// --- 修改：跳数切换逻辑 ---
const setHopLevel = (level) => {
  store.setHopLevel(level);
};

// --- D3 全局变量 ---
let simulation;
let svg;
let zoomGroup;
let sizeScale = d3.scaleSqrt();

function getNodeRadius(node) {
  if (!node) return 8; // 安全回退
  const nodeType = node['Node Type'];

  // 根据后端逻辑，这些类型有 influence_score
  if (nodeType === 'Person' || nodeType === 'MusicalGroup' || nodeType === 'RecordLabel') {
    const score = node.influence_score;
    // 确保 score 是一个有效数字，否则默认为0
    const numericScore = (typeof score === 'number' && isFinite(score)) ? score : 0;
    
    // 使用sizeScale计算基础半径，sizeScale本身就是根号缩放
    return sizeScale(numericScore);
  }

  // 对于没有 influence_score 的类型，返回固定大小
  if (nodeType === 'Song' || nodeType === 'Album') {
    return 12;
  }

  // 为其他任何未预料到的类型提供一个默认大小
  return 15;
}

// --- 动态图例数据 ---
const displayedNodeTypes = ref([]);
const displayedEdgeTypes = ref([]);
const displayedGenres = ref([]);

// --- 静态图例定义 (作为查找表) ---
const ALL_NODE_LEGEND_INFO = {
  'Person': { name: '人', symbol: d3.symbol().type(d3.symbolCircle).size(100)(), color: '#999999', stroke: '#333', strokeWidth: 1.5 },
  'MusicalGroup': { name: '乐队', symbol: d3.symbol().type(d3.symbolDiamond).size(100)(), color: '#999999', stroke: '#333', strokeWidth: 1.5 },
  'Song': { name: '歌曲', symbol: d3.symbol().type(d3.symbolTriangle).size(100)(), color: '#999999', stroke: '#333', strokeWidth: 1.5 },
  'Album': { name: '专辑', symbol: d3.symbol().type(d3.symbolSquare).size(100)(), color: '#999999', stroke: '#333', strokeWidth: 1.5 },
  'RecordLabel': { name: '唱片公司', symbol: d3.symbol().type(d3.symbolWye).size(100)(), color: '#999999', stroke: '#333', strokeWidth: 1.5 },
  'Notable': { name: '知名节点', symbol: d3.symbol().type(d3.symbolCircle).size(100)(), color: '#cccccc', stroke: 'gold', strokeWidth: 3 },
};

const ALL_EDGE_LEGEND_INFO = {
  'influence': { name: '影响力', color: '#007bff', dasharray: '6, 3' },
  'collaboration': { name: '合作', color: '#28a745', dasharray: '0' },
  'membership': { name: '商业', color: '#6c757d', dasharray: '2, 2' },
};

const getLinkClass = (edgeType) => {
  const influenceTypes = ['InStyleOf', 'CoverOf', 'DirectlySamples', 'InterpolatesFrom', 'LyricalReferenceTo'];
  const collaborationTypes = ['MemberOf', 'PerformerOf', 'ComposerOf', 'ProducerOf', 'LyricistOf'];
  if (influenceTypes.includes(edgeType)) return 'influence';
  if (collaborationTypes.includes(edgeType)) return 'collaboration';
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
  if (simulation) {
    simulation.stop();
    simulation = null;
  }
  if (containerRef.value) {
    d3.select(containerRef.value).selectAll('svg').remove();
  }
  svg = null;
  zoomGroup = null;
  if (tooltipRef.value) {
    d3.select(tooltipRef.value).style('opacity', 0);
  }
}

// --- D3 渲染核心函数 ---
function renderGraph(data) {
  clearPreviousRender();
  const container = containerRef.value;
  if (!container || !data || !data.nodes || data.nodes.length === 0) {
    return;
  }

  const nodes = JSON.parse(JSON.stringify(data.nodes));
  const links = JSON.parse(JSON.stringify(data.links));

  // --- 动态更新图例 ---
  const nodeTypesInGraph = new Set(nodes.map(n => n['Node Type']));
  const edgeClassesInGraph = new Set(links.map(l => getLinkClass(l['Edge Type'])));
  const genresInGraph = new Set(nodes.map(n => n.genre).filter(Boolean));
  const hasNotableNode = nodes.some(n => n.notable);

  displayedNodeTypes.value = Array.from(nodeTypesInGraph).map(type => ALL_NODE_LEGEND_INFO[type]).filter(Boolean);
  if (hasNotableNode) {
    displayedNodeTypes.value.push(ALL_NODE_LEGEND_INFO['Notable']);
  }

  displayedEdgeTypes.value = Array.from(edgeClassesInGraph).map(cls => ALL_EDGE_LEGEND_INFO[cls]).filter(Boolean);
  
  displayedGenres.value = Array.from(genresInGraph).map(genre => ({
    name: genre,
    color: getGenreColor(genre)
  }));
  // --- 结束动态更新图例 ---

  const width = container.clientWidth;
  const height = container.clientHeight;

  svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [-width / 2, -height / 2, width, height]);

  zoomGroup = svg.append('g');

  const maxInfluence = d3.max(nodes, d => d.influence_score);
  // 根据跳数级别调整缩放范围，但保持根号等比关系
  if (store.hopLevel === 2) {
    // 二跳连接模式下，适当调整大小范围以适应更多节点
    sizeScale.domain([0, maxInfluence > 0 ? maxInfluence : 1]).range([6, 25]);
  } else {
    // 一跳连接模式下，保持原有范围
    sizeScale.domain([0, maxInfluence > 0 ? maxInfluence : 1]).range([8, 30]);
  }
  const getSymbol = d3.scaleOrdinal().domain(['Person', 'MusicalGroup', 'Song', 'Album', 'RecordLabel']).range([d3.symbolCircle, d3.symbolDiamond, d3.symbolTriangle, d3.symbolSquare, d3.symbolWye]);
  
  const defs = svg.append('defs');
  Object.entries(ALL_EDGE_LEGEND_INFO).forEach(([cls, info]) => {
    defs.append('marker').attr('id', `arrow-${cls}`).attr('viewBox', '0 -5 10 10').attr('refX', 10).attr('refY', 0).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto').append('path').attr('d', 'M0,-5L10,0L0,5').attr('class', `arrow-head ${cls}`);
  });

  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120).strength(0.5))
    .force('charge', d3.forceManyBody().strength(-250))
    .force('collide', d3.forceCollide().radius(d => getNodeRadius(d) + 10))
    .force('center', d3.forceCenter(0, 0));

  const linkElements = zoomGroup.append('g').selectAll('path').data(links).join('path')
    .attr('class', d => `link link-${getLinkClass(d['Edge Type'])}`)
    .attr('marker-end', d => `url(#arrow-${getLinkClass(d['Edge Type'])}`);
  
  const nodeElements = zoomGroup.append('g').selectAll('path').data(nodes, d => d.id).join('path')
    .attr('d', d => {
      const radius = getNodeRadius(d);
      const symbolSize = Math.PI * Math.pow(radius, 2);
      return d3.symbol().type(getSymbol(d['Node Type'])).size(symbolSize)();
    })
    .attr('fill', d => d.highlight ? '#ffc107' : (d.genre ? getGenreColor(d.genre) : '#cccccc'))
    .attr('stroke', d => d.highlight ? '#e85a19' : (d.notable ? 'gold' : '#fff'))
    .attr('stroke-width', d => d.highlight || d.notable ? 3 : 1.5)
    .attr('class', 'node');

  const tooltip = d3.select(tooltipRef.value);

  linkElements.on('mouseover', function(event, d) {
    d3.select(this)
      .style('stroke-opacity', 1)
      .style('stroke-width', '4px'); // 加粗高亮
    const content = `<strong>边信息</strong><br/>源: ${d.source.name}<br/>目标: ${d.target.name}<br/>类型: ${d['Edge Type']}`;
    const containerRect = containerRef.value.getBoundingClientRect();
    const tooltipX = event.clientX - containerRect.left + 10;
    const tooltipY = event.clientY - containerRect.top - 28;
    tooltip.html(content).style('opacity', 1).style('left', `${tooltipX}px`).style('top', `${tooltipY}px`);
  }).on('mouseout', function() {
    d3.select(this)
      .style('stroke-opacity', 0.6)
      .style('stroke-width', '2px'); // 恢复默认宽度
    tooltip.style('opacity', 0);
  });

  nodeElements.on('mouseover', function(event, d) { 
    d3.select(this).attr('stroke', 'black').attr('stroke-width', 3); 
    let content = `<strong>${d.name}</strong><br/>类型: ${d['Node Type']}`;
    if (d['Node Type'] === 'Person' || d['Node Type'] === 'MusicalGroup') {
      if (d.max_genre) content += `<br/>主导流派: ${d.max_genre}`;
      if (typeof d.influence_score === 'number') content += `<br/>影响力: ${d.influence_score.toFixed(2)}`;
      if (d.notable !== undefined) content += `<br/>是否出名: ${d.notable ? '是' : '否'}`;
    } else if (d['Node Type'] === 'RecordLabel') {
      if (typeof d.influence_score === 'number') content += `<br/>影响力: ${d.influence_score.toFixed(2)}`;
    } else if (d.genre) {
      content += `<br/>流派: ${d.genre}`;
    }
    const containerRect = containerRef.value.getBoundingClientRect();
    const tooltipX = event.clientX - containerRect.left + 10;
    const tooltipY = event.clientY - containerRect.top - 28;
    tooltip.html(content).style('opacity', 1).style('left', `${tooltipX}px`).style('top', `${tooltipY}px`);
  }).on('mouseout', function(event, d) { 
    d3.select(this).attr('stroke', d.notable ? 'gold' : '#fff').attr('stroke-width', d.notable ? 3 : 1.5); 
    tooltip.style('opacity', 0); 
  }).on('click', (event, d) => {
    store.selectCenterNode(d.id); // Use ID for selection
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
      const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y, distance = Math.sqrt(dx * dx + dy * dy);
      if (distance === 0) return `M ${d.source.x} ${d.source.y}`;
      const sourceRadius = getNodeRadius(d.source), targetRadius = getNodeRadius(d.target);
      const newSourceX = d.source.x + (dx / distance) * sourceRadius, newSourceY = d.source.y + (dy / distance) * sourceRadius;
      const newTargetX = d.target.x - (dx / distance) * targetRadius, newTargetY = d.target.y - (dy / distance) * targetRadius;
      return `M${newSourceX},${newSourceY} L${newTargetX},${newTargetY}`;
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
    });
  }
}, { deep: true });

onMounted(() => {
  const debouncedResize = debounce(handleResize, 300);
  const resizeObserver = new ResizeObserver(debouncedResize);
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value);
  }
  onUnmounted(() => {
    clearPreviousRender();
    resizeObserver.disconnect();
  });
});
</script>

<style>
/* 样式保持不变 */
.influence-network-container { width: 100%; height: 100%; min-height: 600px; border: 1px solid #dee2e6; border-radius: 4px; overflow: hidden; position: relative; display: flex; justify-content: center; align-items: center; background-color: #f8f9fa; }
.loading-indicator, .empty-state { font-size: 1.5em; color: #6c757d; }
.tooltip { position: absolute; text-align: left; padding: 8px; font: 12px sans-serif; background: rgba(0, 0, 0, 0.8); color: white; border-radius: 8px; pointer-events: none; z-index: 10; }
.link { fill: none; stroke-opacity: 0.6; stroke-width: 2px; /* 新增：设置默认边宽度 */ }
.link.link-influence { stroke: #007bff; }
.link.link-collaboration { stroke: #28a745; }
.link.link-membership { stroke: #6c757d; }
.arrow-head { fill: #333; }
.arrow-head.link-influence { fill: #007bff; }
.arrow-head.link-collaboration { fill: #28a745; }
.arrow-head.link-membership { fill: #6c757d; }
.node { cursor: pointer; transition: all 0.2s ease-in-out; }
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

/* 修改：分段式跳数切换按钮样式 */
.hop-toggle-container {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 11;
}

.hop-toggle-group {
  display: flex;
  border: 1px solid #ccc;
  border-radius: 6px;
  overflow: hidden;
  background-color: white;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.hop-toggle-button {
  padding: 8px 16px;
  background-color: #f8f9fa;
  color: #6c757d;
  border: none;
  cursor: pointer;
  font-size: 0.9em;
  transition: all 0.3s ease;
  position: relative;
}

.hop-toggle-button.active {
  background-color: #007bff;
  color: white;
}

.hop-toggle-button:hover:not(.active) {
  background-color: #e9ecef;
}

.hop-toggle-button.left-button {
  border-right: 1px solid #ccc;
}

.hop-toggle-button.right-button {
  border-left: none;
}

.hop-toggle-button.active.left-button {
  border-right: 1px solid #007bff;
}

.hop-toggle-button.active.right-button {
  border-left: none;
}
</style>
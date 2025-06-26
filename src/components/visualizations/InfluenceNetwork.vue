<template>
  <div ref="containerRef" class="influence-network-container">
    <div v-if="isLoading" class="loading-indicator">正在加载并预计算布局...</div>
    <div ref="tooltipRef" class="tooltip" style="opacity: 0;"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import * as d3 from 'd3';

// 定义响应式引用
const containerRef = ref(null);
const tooltipRef = ref(null);
const isLoading = ref(true);
let simulation;
let graphData = null;

// --- D3 可视化设置函数 ---
const setupVisualization = () => {
  const container = containerRef.value;
  if (!container || !graphData) return;

  d3.select(container).select('svg').remove();

  const nodes = JSON.parse(JSON.stringify(graphData.nodes));
  const links = JSON.parse(JSON.stringify(graphData.links));

  const width = container.clientWidth;
  const height = container.clientHeight;

  const svg = d3.select(container).append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [-width / 2, -height / 2, width, height])
      .style('background-color', '#f8f9fa');

  const zoomGroup = svg.append('g');

  // --- 视觉编码 ---
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain([...new Set(nodes.map(d => d.genre).filter(g => g))]);
  const sizeScale = d3.scaleSqrt().domain([0, d3.max(nodes, d => d.influence_score || 1)]).range([5, 25]);
  const symbolGenerator = (node) => {
    const typeMap = { 'Person': d3.symbolCircle, 'MusicalGroup': d3.symbolDiamond, 'Song': d3.symbolTriangle, 'Album': d3.symbolSquare, 'Record Label': d3.symbolWye };
    return d3.symbol().type(typeMap[node.type] || d3.symbolCircle)();
  };
  const getLinkClass = (edgeType) => {
    const influenceTypes = ['InStyleOf', 'CoverOf', 'DirectlySamples', 'InterpolatesFrom', 'LyricalReferenceTo'];
    const collaborationTypes = ['MemberOf', 'PerformerOf', 'ComposerOf', 'ProducerOf', 'LyricistOf'];
    if (influenceTypes.includes(edgeType)) return 'link-influence';
    if (collaborationTypes.includes(edgeType)) return 'link-collaboration';
    return 'link-commercial';
  };

  // --- 定义箭头 ---
  const defs = svg.append('defs');
  const markerConfigs = {
    'link-influence': { id: 'arrow-influence', color: '#007bff' },
    'link-collaboration': { id: 'arrow-collaboration', color: '#28a745' },
    'link-commercial': { id: 'arrow-commercial', color: '#6c757d' },
  };
  Object.values(markerConfigs).forEach(config => {
    defs.append('marker').attr('id', config.id).attr('viewBox', '0 -5 10 10').attr('refX', 10).attr('refY', 0).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto').append('path').attr('d', 'M0,-5L10,0L0,5').attr('fill', config.color);
  });

  // --- 力模拟 (优化后) ---
  simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-100)) // 减弱排斥力
      .force('collide', d3.forceCollide().radius(d => sizeScale(d.influence_score || 1) + 5))
      .force('center', d3.forceCenter(0, 0).strength(0.1));

  // --- 模拟“预热”以获得初始稳定布局 ---
  const numTicks = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));
  for (let i = 0; i < numTicks * 1.5; ++i) {
      simulation.tick();
  }
  isLoading.value = false; // 预热完成，隐藏加载提示

  // --- 绘制元素 (在预热后) ---
  const link = zoomGroup.append('g').selectAll('path').data(links).join('path').attr('class', d => getLinkClass(d.type)).attr('marker-end', d => `url(#${markerConfigs[getLinkClass(d.type)].id})`);
  const node = zoomGroup.append('g').selectAll('path').data(nodes).join('path').attr('d', symbolGenerator).attr('transform', d => `scale(${sizeScale(d.influence_score || 1) / 10})`).attr('fill', d => d.genre ? colorScale(d.genre) : '#ccc').attr('stroke', d => d.notable ? 'gold' : '#fff').attr('stroke-width', d => d.notable ? 3 : 1.5);

  // --- 交互 ---
  const tooltip = d3.select(tooltipRef.value);
  node.on('mouseover', (event, d) => {
    tooltip.transition().duration(200).style('opacity', .9);
    tooltip.html(`<strong>${d.name}</strong><br/>Type: ${d.type}<br/>${d.genre ? `Genre: ${d.genre}<br/>` : ''}Influence: ${d.influence_score ? d.influence_score.toFixed(2) : 'N/A'}`).style('left', (event.pageX + 15) + 'px').style('top', (event.pageY - 28) + 'px');
  }).on('mouseout', () => {
    tooltip.transition().duration(500).style('opacity', 0);
  }).on('click', (event, d) => { console.log('Clicked node:', d.id, d); });

  const drag = d3.drag().on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; }).on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; }).on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; });
  node.call(drag);

  const zoom = d3.zoom().scaleExtent([0.1, 8]).on('zoom', (event) => { zoomGroup.attr('transform', event.transform); });
  svg.call(zoom);

  // --- 模拟更新 ---
  simulation.on('tick', () => {
    link.attr('d', d => `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`);
    node.attr('transform', d => `translate(${d.x},${d.y}) scale(${sizeScale(d.influence_score || 1) / 10})`);
  });

  // 定时停止模拟
  setTimeout(() => {
    simulation.stop();
  }, 8000);
};

// --- Vue 生命周期钩子 ---
onMounted(async () => {
  try {
    const response = await fetch('/graph_processed.json');
    if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
    graphData = await response.json();
    
    await nextTick();
    setupVisualization();

  } catch (error) {
    console.error("Failed to load or process graph data:", error);
    isLoading.value = false;
  }

  const resizeObserver = new ResizeObserver(() => {
    if (graphData) setupVisualization();
  });
  if (containerRef.value) resizeObserver.observe(containerRef.value);

  onUnmounted(() => {
    if (simulation) simulation.stop();
    resizeObserver.disconnect();
  });
});

</script>

<style>
.influence-network-container { width: 100%; height: 100%; min-height: 500px; border: 1px solid #dee2e6; border-radius: 4px; overflow: hidden; position: relative; display: flex; justify-content: center; align-items: center; }
.loading-indicator { font-size: 1.2em; color: #6c757d; }
.links path { stroke-opacity: 0.6; fill: none; }
.link-influence { stroke: #007bff; stroke-dasharray: 5, 5; stroke-width: 1.5px; }
.link-collaboration { stroke: #28a745; stroke-width: 2px; }
.link-commercial { stroke: #6c757d; stroke-width: 1px; }
.nodes path { cursor: pointer; transition: transform 0.1s ease-in-out; }
.nodes path:hover { transform-origin: center; transform-box: fill-box; }
.tooltip { position: absolute; text-align: left; padding: 8px; font: 12px sans-serif; background: lightsteelblue; border: 0px; border-radius: 8px; pointer-events: none; z-index: 10; }
</style>

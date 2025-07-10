<template>
  <div ref="containerRef" class="influence-network-container">
    <div v-if="store.isLoading" class="loading-indicator">正在计算布局...</div>
    <div v-if="!store.isLoading && (!store.graphData || store.graphData.nodes.length === 0)" class="empty-state">
      没有匹配当前筛选条件的数据。
    </div>
    <div ref="tooltipRef" class="tooltip" style="opacity: 0;"></div>
    
    <!-- 图例部分保持不变 -->
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
import { ref, onMounted, onUnmounted, watch, computed } from 'vue';
import * as d3 from 'd3';
import { useGraphStore } from '@/stores/graphStore';
import { debounce } from 'lodash-es';

const store = useGraphStore();
const containerRef = ref(null);
const tooltipRef = ref(null);

// --- 图例控制 ---
const showNodeEdgeLegend = ref(true);
const showGenreLegend = ref(true);

const toggleNodeEdgeLegend = () => showNodeEdgeLegend.value = !showNodeEdgeLegend.value;
const toggleGenreLegend = () => showGenreLegend.value = !showGenreLegend.value;

// --- D3 全局变量 ---
let simulation;
let svg;
let zoomGroup;

// --- 图例数据 ---
const colorScale = d3.scaleOrdinal(d3.schemeTableau10);

const nodeLegend = computed(() => [
  { name: '人', type: 'Person', symbol: d3.symbol().type(d3.symbolCircle).size(100)(), color: '#999999' },
  { name: '乐队', type: 'MusicalGroup', symbol: d3.symbol().type(d3.symbolDiamond).size(100)(), color: '#999999' },
  { name: '歌曲', type: 'Song', symbol: d3.symbol().type(d3.symbolTriangle).size(100)(), color: '#999999' },
  { name: '专辑', type: 'Album', symbol: d3.symbol().type(d3.symbolSquare).size(100)(), color: '#999999' },
  { name: '唱片公司', type: 'RecordLabel', symbol: d3.symbol().type(d3.symbolWye).size(100)(), color: '#999999' },
]);

const edgeLegend = computed(() => [
  { name: '影响力', color: '#007bff', dasharray: '6, 3' },
  { name: '合作', color: '#28a745', dasharray: '0' },
  { name: '成员关系', color: '#6c757d', dasharray: '2, 2' },
]);

const genreLegend = computed(() => {
  const genres = store.filterOptions.genres || [];
  colorScale.domain(genres);
  return genres.map(genre => ({
    name: genre,
    color: colorScale(genre)
  }));
});

// ================================================================= //
//                            【核心修正 #1】                          //
//      创建 handleResize 函数，专门处理尺寸变化，不重绘节点。         //
// ================================================================= //
const handleResize = () => {
  if (!svg || !containerRef.value) return;

  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;

  svg.attr('width', width)
     .attr('height', height)
     .attr('viewBox', [-width / 2, -height / 2, width, height]);

  // 更新力模拟的中心点
  if (simulation) {
    simulation.force('center', d3.forceCenter(0, 0));
    simulation.alpha(0.3).restart();
  }
};

// ================================================================= //
//                            【核心修正 #2】                          //
//      新增清理函数，确保彻底清理之前的渲染内容                        //
// ================================================================= //
function clearPreviousRender() {
  // 停止之前的模拟
  if (simulation) {
    simulation.stop();
    simulation = null;
  }

  // 清理所有SVG内容
  if (containerRef.value) {
    d3.select(containerRef.value).selectAll('svg').remove();
  }

  // 重置全局变量
  svg = null;
  zoomGroup = null;
  
  // 隐藏tooltip
  if (tooltipRef.value) {
    d3.select(tooltipRef.value).style('opacity', 0);
  }
}

// --- D3 渲染核心函数 ---
function renderGraph(data) {
  console.log('开始渲染图表，数据:', data);
  
  // ================================================================= //
  //                            【核心修正 #3】                          //
  //      在每次渲染前先彻底清理之前的内容                              //
  // ================================================================= //
  clearPreviousRender();

  const container = containerRef.value;
  if (!container) {
    console.log('容器不存在，跳过渲染');
    return;
  }

  if (!data || !data.nodes || data.nodes.length === 0) {
    console.log('没有数据，跳过渲染');
    return;
  }

  const nodes = JSON.parse(JSON.stringify(data.nodes));
  const links = JSON.parse(JSON.stringify(data.links));

  console.log('渲染节点数:', nodes.length, '边数:', links.length);

  const width = container.clientWidth;
  const height = container.clientHeight;

  // 创建新的SVG
  svg = d3.select(container).append('svg')
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', [-width / 2, -height / 2, width, height]);

  zoomGroup = svg.append('g');

  // --- 视觉编码 ---
  const sizeScale = d3.scaleSqrt().domain([0, d3.max(nodes, d => d?.influence_score || 0) || 1]).range([8, 30]);
  colorScale.domain([...new Set(nodes.map(d => d.genre).filter(Boolean))]);
  const getSymbol = d3.scaleOrdinal().domain(['Person', 'MusicalGroup', 'Song', 'Album', 'RecordLabel']).range([d3.symbolCircle, d3.symbolDiamond, d3.symbolTriangle, d3.symbolSquare, d3.symbolWye]);
  const getLinkClass = (edgeType) => {
    const influenceTypes = ['InStyleOf', 'CoverOf', 'DirectlySamples', 'InterpolatesFrom', 'LyricalReferenceTo'];
    const collaborationTypes = ['MemberOf', 'PerformerOf', 'ComposerOf', 'ProducerOf', 'LyricistOf'];
    if (influenceTypes.includes(edgeType)) return 'link-influence';
    if (collaborationTypes.includes(edgeType)) return 'link-collaboration';
    return 'link-membership';
  };

  // --- 箭头定义 ---
  const defs = svg.append('defs');
  ['link-influence', 'link-collaboration', 'link-membership'].forEach(cls => {
    defs.append('marker').attr('id', `arrow-${cls}`).attr('viewBox', '0 -5 10 10').attr('refX', 15).attr('refY', 0).attr('markerWidth', 6).attr('markerHeight', 6).attr('orient', 'auto').append('path').attr('d', 'M0,-5L10,0L0,5').attr('class', `arrow-head ${cls}`);
  });

  // --- 力模拟 ---
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(120).strength(0.5))
    .force('charge', d3.forceManyBody().strength(-250))
    .force('collide', d3.forceCollide().radius(d => sizeScale(d?.influence_score || 0) + 10))
    .force('center', d3.forceCenter(0, 0));

  // --- 渲染 ---
  const linkElements = zoomGroup.append('g').selectAll('path').data(links).join('path').attr('class', d => `link ${getLinkClass(d['Edge Type'])}`).attr('marker-end', d => `url(#arrow-${getLinkClass(d['Edge Type'])}`);
  const nodeElements = zoomGroup.append('g').selectAll('path').data(nodes, d => d.id).join('path').attr('d', d => d3.symbol().type(getSymbol(d['Node Type'])).size(Math.PI * Math.pow(sizeScale(d?.influence_score || 0), 2))()).attr('fill', d => d.genre ? colorScale(d.genre) : '#cccccc').attr('stroke', d => d.notable ? 'gold' : '#fff').attr('stroke-width', d => d.notable ? 3 : 1.5).attr('class', 'node');

  // --- 交互 ---
  const tooltip = d3.select(tooltipRef.value);
  nodeElements.on('mouseover', function(event, d) { 
    d3.select(this).attr('stroke', 'black').attr('stroke-width', 3); 
    let content = `<strong>${d.name}</strong><br/>类型: ${d['Node Type']}`; 
    if(d.genre) content += `<br/>流派: ${d.genre}`; 
    tooltip.html(content).style('opacity', 1).style('left', (event.pageX + 10) + 'px').style('top', (event.pageY - 28) + 'px'); 
  }).on('mouseout', function(event, d) { 
    d3.select(this).attr('stroke', d.notable ? 'gold' : '#fff').attr('stroke-width', d.notable ? 3 : 1.5); 
    tooltip.style('opacity', 0); 
  }).on('click', (event, d) => {
    console.log('点击节点:', d.name);
    store.selectCenterNode(d.name);
  });

  nodeElements.call(d3.drag().on('start', (e, d) => { 
    if (!e.active) simulation.alphaTarget(0.3).restart(); 
    d.fx = d.x; 
    d.fy = d.y; 
  }).on('drag', (e, d) => { 
    d.fx = e.x; 
    d.fy = e.y; 
  }).on('end', (e, d) => { 
    if (!e.active) simulation.alphaTarget(0); 
    d.fx = null; 
    d.fy = null; 
  }));

  // --- 缩放 ---
  svg.call(d3.zoom().scaleExtent([0.1, 8]).on('zoom', e => {
    if (zoomGroup) {
      zoomGroup.attr('transform', e.transform);
    }
  }));

  // --- Tick 更新 ---
  simulation.on('tick', () => { 
    if (linkElements) {
      linkElements.attr('d', d => `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`); 
    }
    if (nodeElements) {
      nodeElements.attr('transform', d => `translate(${d.x},${d.y})`); 
    }
  });

  console.log('图表渲染完成');
}

// ================================================================= //
//                            【核心修正 #4】                          //
//     这个 watcher 是渲染的唯一入口。所有数据更新都通过这里触发重绘。   //
// ================================================================= //
watch(() => store.graphData, (newGraphData) => {
  console.log('检测到数据变化，触发重渲染');
  renderGraph(newGraphData);
}, { deep: true });

// --- 生命周期钩子 ---
onMounted(() => {
  console.log('组件挂载完成');
  
  const debouncedResize = debounce(handleResize, 300);
  const resizeObserver = new ResizeObserver(debouncedResize);
  
  if (containerRef.value) {
    resizeObserver.observe(containerRef.value);
  }
  
  onUnmounted(() => {
    console.log('组件即将卸载，清理资源');
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
.link { fill: none; stroke-opacity: 0.6; }
.link.link-influence { stroke: #007bff; stroke-dasharray: 6, 3; }
.link.link-collaboration { stroke: #28a745; stroke-width: 2px; }
.link.link-membership { stroke: #6c757d; stroke-dasharray: 2, 2; }
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
</style>
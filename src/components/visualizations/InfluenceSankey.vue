<template>
  <div class="sankey-container" ref="containerRef">
    <svg ref="svgRef"></svg>
    <div ref="tooltipRef" class="tooltip" style="opacity: 0;"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted, defineEmits, computed } from 'vue';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, sankeyLeft, sankeyRight } from 'd3-sankey'; 
import { appColors, getSankeyNodeColor } from '@/utils/colors'; // Import color definitions

// --- Define events that the component can emit ---
const emit = defineEmits(['link-clicked']);

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
  currentView: { // 新增 prop，用于判断当前视图模式
    type: String,
    required: true,
  },
});

const svgRef = ref(null);
const tooltipRef = ref(null);
const containerRef = ref(null);

// 用于存储当前高亮的链接信息，以便在mouseout时恢复
const hoveredLink = ref(null);

const drawChart = () => {
  if (!props.data || !svgRef.value || props.data.nodes.length === 0) {
    d3.select(svgRef.value).selectAll('*').remove();
    return;
  }
  
  const containerWidth = containerRef.value.clientWidth;
  const containerHeight = containerRef.value.clientHeight;

  // --- 桑基图尺寸计算：充分利用宽度，纵向紧凑且美观 ---
  // 目标：横纵比 1:2，横向无滚动，纵向紧凑但文字不挤压
  const nodeCount = props.data.nodes.length;
  const minNodeHeight = 16; // 每个节点的最小显示高度，确保文字可读
  const paddingPerNode = 4; // 每个节点之间的最小间距

  // 1. 根据节点数量计算一个“内容所需”的最小高度
  // 增加一个系数，确保即使在紧凑模式下，文字也有空间
  const contentRequiredHeight = nodeCount * (minNodeHeight + paddingPerNode) + 80; // 增加额外边距

  // 2. 根据容器宽度计算 1:2 比例的理想高度
  const idealHeightFromWidth = containerWidth * 2;

  // 3. 最终高度取三者中的最大值：内容所需高度、1:2 理想高度、容器实际高度（确保不溢出）
  // 这样既能保证内容有空间展开，又能尽量满足 1:2 比例，并且不会超出容器
  let height = Math.max(contentRequiredHeight, idealHeightFromWidth);
  // 如果计算出的高度仍然超过容器高度，则以容器高度为准，并允许内部滚动
  if (height > containerHeight) {
      height = containerHeight;
  }

  // 4. 根据最终确定的高度，反向计算宽度以维持 1:2 比例
  let width = height / 2;
  const minDisplayWidth = 250; // 最小宽度
  if (width < minDisplayWidth) {
      width = minDisplayWidth;
      height = minDisplayWidth * 2; // 重新调整高度以保持比例
  }
  // 确保宽度不超过容器宽度
  if (width > containerWidth) {
      width = containerWidth;
      height = containerWidth * 2; // 重新调整高度以保持比例
  }

  d3.select(svgRef.value).selectAll('*').remove();

  const svg = d3.select(svgRef.value)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  const sankeyLayout = sankey()
    .nodeId(d => d.id)
    // 对于 Outward Influence (Q2.2)，数据流通常是从左到右，sankeyLeft 更合适
    // 对于 Inward Inspirations (Q2.3)，数据流是从右到左，sankeyRight 可能更合适
    // 这里根据 currentView 动态选择 nodeAlign 策略
    .nodeAlign(props.currentView === 'q2_2' ? sankeyLeft : sankeyRight) 
    .nodeWidth(15)
    .nodePadding(paddingPerNode) // 使用计算中的 paddingPerNode
    .extent([[10, 10], [width - 10, height - 10]])
    .iterations(100); 

  const graph = JSON.parse(JSON.stringify(props.data));
  const { nodes, links } = sankeyLayout(graph);
  
  // 用于存储当前高亮的节点ID
  let highlightedNodeIds = new Set(); 
  // 用于存储当前高亮的链接ID
  let highlightedLinkIds = new Set();

  // --- 链接渲染 ---
  const linkPaths = svg.append('g')
    .attr('fill', 'none')
    .attr('stroke-opacity', 0.55)
    .selectAll('path')
    .data(links)
    .join('path')
    .attr('class', 'sankey-link') // 添加类名方便选择
    .style('cursor', 'pointer')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', appColors.sankeyLinkBase) 
    .attr('stroke-width', d => Math.max(1.5, d.width));

  // --- 鼠标悬停事件处理 ---
  linkPaths
    .on('mouseover', function(event, d) {
        // 高亮当前悬停的链接
        d3.select(this).attr('stroke', appColors.sankeyLinkHighlight).attr('stroke-opacity', 0.8);
        
        // 清除之前的高亮状态
        highlightedNodeIds.clear();
        highlightedLinkIds.clear();

        // 如果是 Outward Influence (q2_2) 并且是 Oceanus Folk 到 Genre 的链接
        if (props.currentView === 'q2_2' && d.source.name === 'Oceanus Folk' && d.target.type === 'Genre') {
            // 高亮从该流派出发的所有链接
            highlightedLinkIds.add(d.index); // 添加当前链接
            links.forEach(link => {
                if (link.source.id === d.target.id && link.target.type === 'Artist') {
                    highlightedLinkIds.add(link.index);
                    highlightedNodeIds.add(link.target.id); // 收集目标艺术家节点ID
                }
            });
            highlightedNodeIds.add(d.source.id); // Oceanus Folk
            highlightedNodeIds.add(d.target.id); // Genre
        } else {
            // 默认高亮当前链接及其源/目标节点
            highlightedLinkIds.add(d.index);
            highlightedNodeIds.add(d.source.id);
            highlightedNodeIds.add(d.target.id);
        }

        // 更新所有链接的透明度
        linkPaths.attr('stroke-opacity', linkD => highlightedLinkIds.has(linkD.index) ? 0.8 : 0.1);
        linkPaths.attr('stroke', linkD => highlightedLinkIds.has(linkD.index) ? appColors.sankeyLinkHighlight : appColors.sankeyLinkBase);

        // 更新所有节点的文本透明度
        svg.selectAll('.node-text')
           .attr('opacity', nodeD => {
               // 如果是 Outward Influence 且是第三列艺术家，根据高亮状态决定
               if (props.currentView === 'q2_2' && nodeD.layer === 2 && nodeD.type === 'Artist') {
                   return highlightedNodeIds.has(nodeD.id) ? 1 : 0; // 仅显示高亮艺术家
               }
               return 1; // 其他节点始终显示
           });
        
        // 更新所有节点的矩形透明度
        svg.selectAll('.sankey-node-rect')
           .attr('fill-opacity', nodeD => highlightedNodeIds.has(nodeD.id) ? 1 : 0.5); // 高亮节点更实，非高亮半透明

        // 显示 Tooltip
        const tooltip = d3.select(tooltipRef.value);
        console.log("value", d.value);
        console.log(typeof d.value);
        tooltip.style('opacity', 1)
            .html(`
                <div class="tooltip-path">
                    <span class="tooltip-source">${d.source.name}</span>
                    <span class="tooltip-arrow">→</span>
                    <span class="tooltip-target">${d.target.name}</span>
                </div>
                <div class="tooltip-value">
                    <span class="label">Influence:</span>
                    <span class="value">${d.value}</span>
                </div>
            `)
            .style('left', `${event.pageX + 15}px`)
            .style('top', `${event.pageY}px`);
    })
    .on('mouseout', function() {
        // 恢复所有链接和节点的默认状态
        linkPaths.attr('stroke-opacity', 0.55).attr('stroke', appColors.sankeyLinkBase);
        svg.selectAll('.node-text')
           .attr('opacity', nodeD => {
               // Outward Influence 模式下，第三列艺术家默认隐藏
               if (props.currentView === 'q2_2' && nodeD.layer === 2 && nodeD.type === 'Artist') {
                   return 0;
               }
               return 1; // 其他节点默认显示
           });
        svg.selectAll('.sankey-node-rect').attr('fill-opacity', 1); // 恢复节点矩形不透明度
        d3.select(tooltipRef.value).style('opacity', 0);
        
        highlightedNodeIds.clear();
        highlightedLinkIds.clear();
    })
    .on('click', (event, d) => {
      emit('link-clicked', { source: d.source, target: d.target });
    });

  // --- 节点渲染 ---
  const nodeGroups = svg.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g');

  nodeGroups.append('rect')
    .attr('class', 'sankey-node-rect') // 添加类名方便选择
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('height', d => Math.max(1, d.y1 - d.y0))
    .attr('width', d => d.x1 - d.x0)
    .attr('fill', d => getSankeyNodeColor(d)) 
    .attr('stroke', appColors.textSecondary)
    .attr('stroke-width', 0.5);

  nodeGroups.append('text')
    .attr('class', 'node-text') // 添加类名方便选择
    .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
    .attr('y', d => (d.y1 + d.y0) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
    .attr('font-family', 'Inter, sans-serif')
    .attr('font-size', '12px')
    .attr('font-weight', '500')
    .attr('fill', appColors.textPrimary)
    .attr('opacity', d => {
        // Outward Influence 模式下，第三列艺术家默认隐藏
        if (props.currentView === 'q2_2' && d.layer === 2 && d.type === 'Artist') {
            return 0;
        }
        return 1; // 其他节点默认显示
    })
    .text(d => {
        // --- 文本截断逻辑 ---
        // 只有当文本可见时才进行截断判断
        if (d.name === 'Oceanus Folk') return d.name; // Oceanus Folk 不截断
        if (d.type === 'Genre') return d.name; // 流派名称不截断

        const maxTextWidth = (d.x0 < width / 2 ? width - d.x1 - 10 : d.x0 - 10); // 预留一些边距
        const text = d.name;
        const estimatedCharWidth = 7; // 估算每个字符的宽度
        
        // 确保节点高度足够显示文字，否则直接返回空字符串或截断
        if ((d.y1 - d.y0) < minNodeHeight) { // 如果节点太窄，文字可能无法显示
            return ''; // 或者返回 '...'
        }

        if (text.length * estimatedCharWidth > maxTextWidth && text.length > 5) {
            return text.substring(0, Math.floor(maxTextWidth / estimatedCharWidth) - 3) + '...';
        }
        return text;
    });
};

let resizeObserver;
onMounted(() => {
    if (containerRef.value) {
        drawChart();
        resizeObserver = new ResizeObserver(drawChart);
        resizeObserver.observe(containerRef.value);
    }
});

onUnmounted(() => {
    if (resizeObserver) {
        resizeObserver.disconnect();
    }
});

// 监听 data 和 currentView 变化时重新绘制图表
watch([() => props.data, () => props.currentView], () => {
    drawChart();
}, { deep: true });
</script>

<style scoped>
.sankey-container {
  position: relative;
  width: 100%;
  height: 100%; /* 确保容器填满父级 */
  background-color: var(--color-surface);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  overflow-y: auto; /* 允许纵向滚动，如果内容超出 */
  overflow-x: hidden; /* 禁止横向滚动 */
}
/* Tooltip styles remain unchanged */
.tooltip {
  position: fixed;
  background-color: rgba(44, 62, 80, 0.9);
  color: white;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-family: 'Inter', sans-serif;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  white-space: nowrap;
}
.tooltip-path {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.tooltip-source, .tooltip-target {
  font-weight: 600;
}
.tooltip-arrow {
  margin: 0 8px;
  opacity: 0.8;
}
.tooltip-value .label {
  opacity: 0.8;
  margin-right: 6px;
}
.tooltip-value .value {
  font-weight: 700;
  color: var(--color-primary-accent);
}
</style>

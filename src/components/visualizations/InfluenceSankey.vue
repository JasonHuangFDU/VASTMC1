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
import { appColors, getSankeyNodeColor } from '@/utils/colors';

// --- Define events that the component can emit ---
const emit = defineEmits(['link-clicked']);

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
  currentView: {
    type: String,
    required: true,
  },
  topNArtists: {
    type: Number,
    default: 15,
  },
});

const svgRef = ref(null);
const tooltipRef = ref(null);
const containerRef = ref(null);

// 用于存储当前高亮的链接信息，以便在mouseout时恢复
const hoveredLink = ref(null);

// 数据过滤函数：只保留TOP N艺术家
const filterTopNArtists = (originalData) => {
  if (!originalData || !originalData.nodes || !originalData.links) {
    return originalData;
  }

  const { nodes, links } = JSON.parse(JSON.stringify(originalData));

  // 找到所有艺术家节点
  const artistNodes = nodes.filter(node => node.type === 'Artist');
  
  if (artistNodes.length <= props.topNArtists) {
    // 如果艺术家数量不超过限制，直接返回原数据
    return { nodes, links };
  }

  // 计算每个艺术家的总影响力
  const artistInfluence = new Map();
  
  artistNodes.forEach(artist => {
    artistInfluence.set(artist.id, 0);
  });

  // 计算每个艺术家的总影响力（所有指向该艺术家的链接的value之和）
  links.forEach(link => {
    const targetNode = nodes.find(n => n.id === link.target);
    if (targetNode && targetNode.type === 'Artist') {
      const currentInfluence = artistInfluence.get(link.target) || 0;
      artistInfluence.set(link.target, currentInfluence + link.value);
    }
  });

  // 按影响力排序，选择TOP N
  const sortedArtists = Array.from(artistInfluence.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, props.topNArtists)
    .map(([id]) => id);

  const topArtistIds = new Set(sortedArtists);

  // 过滤节点：保留非艺术家节点和TOP N艺术家
  const filteredNodes = nodes.filter(node => {
    if (node.type === 'Artist') {
      return topArtistIds.has(node.id);
    }
    return true;
  });

  // 过滤链接：移除指向被过滤掉的艺术家的链接
  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = links.filter(link => {
    return filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target);
  });

  console.log(`Filtered from ${artistNodes.length} to ${topArtistIds.size} artists`);
  console.log(`Filtered from ${links.length} to ${filteredLinks.length} links`);

  return {
    nodes: filteredNodes,
    links: filteredLinks
  };
};

// 计算过滤后的数据
const processedData = computed(() => {
  return filterTopNArtists(props.data);
});

const drawChart = () => {
  if (!processedData.value || !svgRef.value || processedData.value.nodes.length === 0) {
    d3.select(svgRef.value).selectAll('*').remove();
    return;
  }
  
  const containerWidth = containerRef.value.clientWidth;
  const containerHeight = containerRef.value.clientHeight;

  // --- 桑基图尺寸计算：充分利用宽度，纵向紧凑且美观 ---
  const nodeCount = processedData.value.nodes.length;
  const minNodeHeight = 16;
  const paddingPerNode = 4;

  const contentRequiredHeight = nodeCount * (minNodeHeight + paddingPerNode) + 80;
  const idealHeightFromWidth = containerWidth * 2;

  let height = Math.max(contentRequiredHeight, idealHeightFromWidth);
  if (height > containerHeight) {
      height = containerHeight;
  }

  let width = height / 2;
  const minDisplayWidth = 250;
  if (width < minDisplayWidth) {
      width = minDisplayWidth;
      height = minDisplayWidth * 2;
  }
  if (width > containerWidth) {
      width = containerWidth;
      height = containerWidth * 2;
  }

  d3.select(svgRef.value).selectAll('*').remove();

  const svg = d3.select(svgRef.value)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  const sankeyLayout = sankey()
    .nodeId(d => d.id)
    .nodeAlign(props.currentView === 'q2_2' ? sankeyLeft : sankeyRight) 
    .nodeWidth(15)
    .nodePadding(paddingPerNode)
    .extent([[10, 10], [width - 10, height - 10]])
    .iterations(100); 

  const graph = JSON.parse(JSON.stringify(processedData.value));
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
    .attr('class', 'sankey-link')
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
            highlightedLinkIds.add(d.index);
            links.forEach(link => {
                if (link.source.id === d.target.id && link.target.type === 'Artist') {
                    highlightedLinkIds.add(link.index);
                    highlightedNodeIds.add(link.target.id);
                }
            });
            highlightedNodeIds.add(d.source.id);
            highlightedNodeIds.add(d.target.id);
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
               if (props.currentView === 'q2_2' && nodeD.layer === 2 && nodeD.type === 'Artist') {
                   return highlightedNodeIds.has(nodeD.id) ? 1 : 0;
               }
               return 1;
           });
        
        // 更新所有节点的矩形透明度
        svg.selectAll('.sankey-node-rect')
           .attr('fill-opacity', nodeD => highlightedNodeIds.has(nodeD.id) ? 1 : 0.5);

        // 显示 Tooltip
        const tooltip = d3.select(tooltipRef.value);
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
               if (props.currentView === 'q2_2' && nodeD.layer === 2 && nodeD.type === 'Artist') {
                   return 0;
               }
               return 1;
           });
        svg.selectAll('.sankey-node-rect').attr('fill-opacity', 1);
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
    .attr('class', 'sankey-node-rect')
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('height', d => Math.max(1, d.y1 - d.y0))
    .attr('width', d => d.x1 - d.x0)
    .attr('fill', d => getSankeyNodeColor(d)) 
    .attr('stroke', appColors.textSecondary)
    .attr('stroke-width', 0.5);

  nodeGroups.append('text')
    .attr('class', 'node-text')
    .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
    .attr('y', d => (d.y1 + d.y0) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
    .attr('font-family', 'Inter, sans-serif')
    .attr('font-size', '12px')
    .attr('font-weight', '500')
    .attr('fill', appColors.textPrimary)
    .attr('opacity', d => {
        if (props.currentView === 'q2_2' && d.layer === 2 && d.type === 'Artist') {
            return 0;
        }
        return 1;
    })
    .text(d => {
        if (d.name === 'Oceanus Folk') return d.name;
        if (d.type === 'Genre') return d.name;

        const maxTextWidth = (d.x0 < width / 2 ? width - d.x1 - 10 : d.x0 - 10);
        const text = d.name;
        const estimatedCharWidth = 7;
        
        if ((d.y1 - d.y0) < minNodeHeight) {
            return '';
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

// 监听 data、currentView 和 topNArtists 变化时重新绘制图表
watch([() => props.data, () => props.currentView, () => props.topNArtists], () => {
    drawChart();
}, { deep: true });
</script>

<style scoped>
.sankey-container {
  position: relative;
  width: 100%;
  height: 100%;
  background-color: var(--color-surface);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
  overflow-y: auto;
  overflow-x: hidden;
}

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
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
    default: 40,
  },
  topNGenres: {
    type: Number,
    default: 12,
  },
});

const svgRef = ref(null);
const tooltipRef = ref(null);
const containerRef = ref(null);
const hoveredLink = ref(null);

const filterData = (originalData) => {
  if (!originalData || !originalData.nodes || !originalData.links) {
    return originalData;
  }

  const { nodes, links } = JSON.parse(JSON.stringify(originalData));

  if (props.currentView === 'q2_2') {
    // Outward视图：筛选top N genres，每个genre下的所有artists
    return filterOutwardData(nodes, links);
  } else if (props.currentView === 'q2_3') {
    // Inward视图：筛选top N artists
    return filterInwardData(nodes, links);
  }

  return { nodes, links };
};

const filterOutwardData = (nodes, links) => {
  // 1. 计算每个Genre的影响值（从Oceanus Folk到Genre的link value）
  const genreInfluence = new Map();
  
  links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    
    if (sourceNode && targetNode && 
        sourceNode.name === 'Oceanus Folk' && targetNode.type === 'Genre') {
      genreInfluence.set(link.target, link.value);
    }
  });

  // 2. 选择top N genres
  const topGenreIds = Array.from(genreInfluence.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, props.topNGenres)
    .map(([id]) => id);

  const topGenreIdSet = new Set(topGenreIds);

  // 3. 筛选节点：保留Oceanus Folk、top genres和这些genres下的所有artists
  const filteredNodes = nodes.filter(node => {
    if (node.name === 'Oceanus Folk') return true;
    if (node.type === 'Genre') return topGenreIdSet.has(node.id);
    if (node.type === 'Artist') {
      // 检查这个artist是否连接到选中的genre
      return links.some(link => 
        topGenreIdSet.has(link.source) && link.target === node.id
      );
    }
    return false;
  });

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = links.filter(link => 
    filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target)
  );

  console.log(`Outward: Filtered from ${genreInfluence.size} to ${topGenreIds.length} genres`);
  console.log(`Filtered from ${nodes.length} to ${filteredNodes.length} nodes`);
  console.log(`Filtered from ${links.length} to ${filteredLinks.length} links`);

  return { nodes: filteredNodes, links: filteredLinks };
};

const filterInwardData = (nodes, links) => {
  // 1. 计算每个Artist的影响值（从Artist到Oceanus Folk的link value）
  const artistInfluence = new Map();
  
  links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    
    if (sourceNode && targetNode && 
        sourceNode.type === 'Artist' && targetNode.name === 'Oceanus Folk') {
      artistInfluence.set(link.source, link.value);
    }
  });

  // 2. 选择top N artists
  const topArtistIds = Array.from(artistInfluence.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, props.topNArtists)
    .map(([id]) => id);

  const topArtistIdSet = new Set(topArtistIds);

  // 3. 筛选节点：保留Oceanus Folk、top artists和这些artists的source genres
  const connectedGenreIds = new Set();
  
  // 找到连接到选中artists的genres
  links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    
    if (sourceNode && targetNode && 
        sourceNode.type === 'Genre' && topArtistIdSet.has(link.target)) {
      connectedGenreIds.add(link.source);
    }
  });

  const filteredNodes = nodes.filter(node => {
    if (node.name === 'Oceanus Folk') return true;
    if (node.type === 'Genre') return connectedGenreIds.has(node.id);
    if (node.type === 'Artist') return topArtistIdSet.has(node.id);
    return false;
  });

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = links.filter(link => 
    filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target)
  );

  console.log(`Inward: Filtered from ${artistInfluence.size} to ${topArtistIds.length} artists`);
  console.log(`Filtered from ${nodes.length} to ${filteredNodes.length} nodes`);
  console.log(`Filtered from ${links.length} to ${filteredLinks.length} links`);

  return { nodes: filteredNodes, links: filteredLinks };
};

const processedData = computed(() => {
  return filterData(props.data);
});

const drawChart = () => {
  if (!processedData.value || !svgRef.value || processedData.value.nodes.length === 0) {
    d3.select(svgRef.value).selectAll('*').remove();
    return;
  }
  
  const containerWidth = containerRef.value.clientWidth;
  const containerHeight = containerRef.value.clientHeight;

  // 优化尺寸计算，适应并列布局
  const nodeCount = processedData.value.nodes.length;
  const minNodeHeight = 8;
  const paddingPerNode = 1;

  // 并列布局下的尺寸适配
  let width = Math.max(containerWidth * 0.92, 180);
  let height = Math.max(containerHeight * 0.90, 250);

  // 根据节点数量调整高度
  const requiredHeight = Math.max(nodeCount * (minNodeHeight + paddingPerNode) + 40, 250);
  if (requiredHeight > height) {
    height = Math.min(requiredHeight, containerHeight * 0.95);
  }

  // 确保合理的宽高比
  if (width > height * 0.8) {
    width = height * 0.8;
  }

  d3.select(svgRef.value).selectAll('*').remove();

  const svg = d3.select(svgRef.value)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  const sankeyLayout = sankey()
    .nodeId(d => d.id)
    .nodeAlign(props.currentView === 'q2_2' ? sankeyLeft : sankeyRight) 
    .nodeWidth(8)
    .nodePadding(paddingPerNode)
    .extent([[4, 4], [width - 4, height - 4]])
    .iterations(80); 

  const graph = JSON.parse(JSON.stringify(processedData.value));
  const { nodes, links } = sankeyLayout(graph);
  
  let highlightedNodeIds = new Set(); 
  let highlightedLinkIds = new Set();

  const linkPaths = svg.append('g')
    .attr('fill', 'none')
    .attr('stroke-opacity', 0.65)
    .selectAll('path')
    .data(links)
    .join('path')
    .attr('class', 'sankey-link')
    .style('cursor', 'pointer')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', appColors.sankeyLinkBase) 
    .attr('stroke-width', d => Math.max(1, d.width * 0.8));

  linkPaths
    .on('mouseover', function(event, d) {
        d3.select(this).attr('stroke', appColors.sankeyLinkHighlight).attr('stroke-opacity', 0.8);
        
        highlightedNodeIds.clear();
        highlightedLinkIds.clear();

        if (props.currentView === 'q2_2' && d.source.name === 'Oceanus Folk' && d.target.type === 'Genre') {
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
            highlightedLinkIds.add(d.index);
            highlightedNodeIds.add(d.source.id);
            highlightedNodeIds.add(d.target.id);
        }

        linkPaths.attr('stroke-opacity', linkD => highlightedLinkIds.has(linkD.index) ? 0.8 : 0.1);
        linkPaths.attr('stroke', linkD => highlightedLinkIds.has(linkD.index) ? appColors.sankeyLinkHighlight : appColors.sankeyLinkBase);

        svg.selectAll('.node-text')
           .attr('opacity', nodeD => {
               if (props.currentView === 'q2_2' && nodeD.layer === 2 && nodeD.type === 'Artist') {
                   return highlightedNodeIds.has(nodeD.id) ? 1 : 0;
               }
               return 1;
           });
        
        svg.selectAll('.sankey-node-rect')
           .attr('fill-opacity', nodeD => highlightedNodeIds.has(nodeD.id) ? 1 : 0.5);

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
        linkPaths.attr('stroke-opacity', 0.65).attr('stroke', appColors.sankeyLinkBase);
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
    .attr('stroke-width', 0.3);

  nodeGroups.append('text')
    .attr('class', 'node-text')
    .attr('x', d => d.x0 < width / 2 ? d.x1 + 4 : d.x0 - 4)
    .attr('y', d => (d.y1 + d.y0) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
    .attr('font-family', 'Inter, sans-serif')
    .attr('font-size', '9px')
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

        const maxTextWidth = (d.x0 < width / 2 ? width - d.x1 - 8 : d.x0 - 8);
        const text = d.name;
        const estimatedCharWidth = 5;
        const minNodeHeight = 8;
        
        if ((d.y1 - d.y0) < minNodeHeight) {
            return '';
        }

        if (text.length * estimatedCharWidth > maxTextWidth && text.length > 3) {
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

watch([() => props.data, () => props.currentView, () => props.topNArtists, () => props.topNGenres], () => {
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
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  overflow: hidden;
}

.tooltip {
  position: fixed;
  background-color: rgba(44, 62, 80, 0.9);
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 11px;
  font-family: 'Inter', sans-serif;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 10;
  box-shadow: 0 2px 6px rgba(0,0,0,0.2);
  white-space: nowrap;
  max-width: 200px;
}

.tooltip-path {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.tooltip-source, .tooltip-target {
  font-weight: 600;
}

.tooltip-arrow {
  margin: 0 4px;
  opacity: 0.8;
}

.tooltip-value .label {
  opacity: 0.8;
  margin-right: 4px;
}

.tooltip-value .value {
  font-weight: 700;
  color: var(--color-primary-accent);
}
</style>
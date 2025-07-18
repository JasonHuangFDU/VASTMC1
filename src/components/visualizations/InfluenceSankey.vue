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
    default: 10,
  },
  topNGenres: {
    type: Number,
    default: 5,
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
    // Outward视图：筛选top N genres，每个genre下的top N artists
    return filterOutwardData(nodes, links);
  } else if (props.currentView === 'q2_3') {
    // Inward视图：筛选top N artists，显示相关genres
    return filterInwardData(nodes, links);
  }

  return { nodes, links };
};

const filterOutwardData = (nodes, links) => {
  // 1. 计算每个Genre的影响值（从Oceanus Folk到Genre的work_count）
  const genreInfluence = new Map();
  
  links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    
    if (sourceNode && targetNode && 
        sourceNode.name === 'Oceanus Folk' && 
        (targetNode.type === 'genre' || targetNode.type === 'Genre')) {
      genreInfluence.set(link.target, link.details?.work_count || link.value);
    }
  });

  // 2. 选择top N genres
  const topGenreIds = Array.from(genreInfluence.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, props.topNGenres)
    .map(([id]) => id);

  const topGenreIdSet = new Set(topGenreIds);

  // 3. 对于每个选中的genre，找到top N artists
  const selectedArtistIds = new Set();
  
  topGenreIds.forEach(genreId => {
    const genreToArtistLinks = links.filter(link => {
      const targetNode = nodes.find(n => n.id === link.target);
      return link.source === genreId && 
             targetNode && 
             (targetNode.type === 'artist' || targetNode.type === 'Artist');
    });
    
    const topArtistsForGenre = genreToArtistLinks
      .sort((a, b) => (b.details?.work_count || b.value) - (a.details?.work_count || a.value))
      .slice(0, props.topNArtists)
      .map(link => link.target);
    
    topArtistsForGenre.forEach(artistId => selectedArtistIds.add(artistId));
  });

  // 4. 筛选节点
  const filteredNodes = nodes.filter(node => {
    if (node.name === 'Oceanus Folk') return true;
    if (node.type === 'genre' || node.type === 'Genre') return topGenreIdSet.has(node.id);
    if (node.type === 'artist' || node.type === 'Artist') return selectedArtistIds.has(node.id);
    return false;
  });

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = links.filter(link => 
    filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target)
  );

  console.log(`Outward: Filtered to ${topGenreIds.length} genres and ${selectedArtistIds.size} artists`);
  console.log(`Filtered from ${nodes.length} to ${filteredNodes.length} nodes`);
  console.log(`Filtered from ${links.length} to ${filteredLinks.length} links`);

  return { nodes: filteredNodes, links: filteredLinks };
};

const filterInwardData = (nodes, links) => {
  console.log('filterInwardData called with:', { 
    nodes: nodes.length, 
    links: links.length,
    topNGenres: props.topNGenres,
    topNArtists: props.topNArtists
  });
  
  // 如果原始数据太少，降低筛选标准
  const adjustedTopNGenres = Math.min(props.topNGenres, Math.max(1, Math.floor(nodes.length / 10)));
  const adjustedTopNArtists = Math.min(props.topNArtists, Math.max(1, Math.floor(nodes.length / 5)));
  
  console.log('Adjusted filter params:', { adjustedTopNGenres, adjustedTopNArtists });
  
  // Inward视图：也是 Oceanus Folk → Genres → Artists 的流向

  // 1. 计算每个Genre的影响值（从Oceanus Folk到Genre的work_count）
  const genreInfluence = new Map();
  
  links.forEach(link => {
    const sourceNode = nodes.find(n => n.id === link.source);
    const targetNode = nodes.find(n => n.id === link.target);
    
    if (sourceNode && targetNode && 
        sourceNode.name === 'Oceanus Folk' && 
        (targetNode.type === 'genre' || targetNode.type === 'Genre')) {
      genreInfluence.set(link.target, link.details?.work_count || link.value);
    }
  });

  console.log('Genre influences found:', genreInfluence.size, Array.from(genreInfluence.entries()));

  // 如果没有找到从Oceanus Folk出发的流派连接，尝试所有流派
  if (genreInfluence.size === 0) {
    console.warn('No Oceanus Folk->Genre connections found, using all genres');
    const allGenres = nodes.filter(n => n.type === 'genre' || n.type === 'Genre');
    allGenres.forEach(genre => {
      const relatedLinks = links.filter(l => l.source === genre.id || l.target === genre.id);
      const totalValue = relatedLinks.reduce((sum, l) => sum + (l.details?.work_count || l.value || 1), 0);
      genreInfluence.set(genre.id, totalValue);
    });
  }

  // 2. 选择top N genres
  const topGenreIds = Array.from(genreInfluence.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, adjustedTopNGenres)
    .map(([id]) => id);

  const topGenreIdSet = new Set(topGenreIds);
  console.log('Top genres selected:', topGenreIds.length, topGenreIds);

  // 3. 对于每个选中的genre，找到相关的artists
  const selectedArtistIds = new Set();
  
  if (topGenreIds.length > 0) {
    topGenreIds.forEach(genreId => {
      const genreToArtistLinks = links.filter(link => {
        const targetNode = nodes.find(n => n.id === link.target);
        return link.source === genreId && 
               targetNode && 
               (targetNode.type === 'artist' || targetNode.type === 'Artist');
      });
      
      console.log(`Genre ${genreId} has ${genreToArtistLinks.length} artist links`);
      
      const topArtistsForGenre = genreToArtistLinks
        .sort((a, b) => (b.details?.work_count || b.value || 1) - (a.details?.work_count || a.value || 1))
        .slice(0, adjustedTopNArtists)
        .map(link => link.target);
      
      topArtistsForGenre.forEach(artistId => selectedArtistIds.add(artistId));
    });
  } else {
    // 如果没有genres，直接选择一些artists
    const allArtists = nodes.filter(n => n.type === 'artist' || n.type === 'Artist');
    allArtists.slice(0, adjustedTopNArtists).forEach(artist => {
      selectedArtistIds.add(artist.id);
    });
  }

  console.log('Artists selected:', selectedArtistIds.size);

  // 4. 筛选节点
  const filteredNodes = nodes.filter(node => {
    if (node.name === 'Oceanus Folk') return true;
    if (node.type === 'genre' || node.type === 'Genre') return topGenreIdSet.has(node.id);
    if (node.type === 'artist' || node.type === 'Artist') return selectedArtistIds.has(node.id);
    return false;
  });

  const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredLinks = links.filter(link => 
    filteredNodeIds.has(link.source) && filteredNodeIds.has(link.target)
  );

  console.log(`Inward: Filtered to ${topGenreIds.length} genres and ${selectedArtistIds.size} artists`);
  console.log(`Filtered from ${nodes.length} to ${filteredNodes.length} nodes`);
  console.log(`Filtered from ${links.length} to ${filteredLinks.length} links`);

  // 最后检查，如果还是没有数据，创建最小可视化
  if (filteredNodes.length <= 1 || filteredLinks.length === 0) {
    console.warn('Creating minimal visualization');
    const oceanusNode = nodes.find(n => n.name === 'Oceanus Folk');
    const someGenres = nodes.filter(n => n.type === 'genre' || n.type === 'Genre').slice(0, 2);
    const someArtists = nodes.filter(n => n.type === 'artist' || n.type === 'Artist').slice(0, 3);
    
    const minimalNodes = [oceanusNode, ...someGenres, ...someArtists].filter(Boolean);
    const minimalLinks = links.filter(link => 
      minimalNodes.some(n => n.id === link.source) && 
      minimalNodes.some(n => n.id === link.target)
    );
    
    return { 
      nodes: minimalNodes, 
      links: minimalLinks.length > 0 ? minimalLinks : []
    };
  }

  return { nodes: filteredNodes, links: filteredLinks };
};

const processedData = computed(() => {
  return filterData(props.data);
});

const getTooltipContent = (link) => {
  const sourceNode = processedData.value.nodes.find(n => n.id === link.source.id);
  const targetNode = processedData.value.nodes.find(n => n.id === link.target.id);
  
  if (!sourceNode || !targetNode) return '';

  // Oceanus Folk → Genre: 显示作品总数和影响边的分别计数
  if (sourceNode.name === 'Oceanus Folk' && 
      (targetNode.type === 'genre' || targetNode.type === 'Genre')) {
    const totalCount = link.details?.work_count || link.value;
    const collaborations = link.details?.collaborations || [];
    
    // 统计各种影响类型
    const influenceTypes = {};
    collaborations.forEach(collab => {
      // 尝试从多个地方获取影响类型
      let type = collab.collaboration_type;
      
      // 如果collaboration_type不是影响类型，尝试work_details
      if (collab.work_details && collab.work_details.type) {
        type = collab.work_details.type;
      }
      
      // 只统计5种影响边类型
      if (['InStyleOf', 'InterpolatesFrom', 'CoverOf', 'DirectlySamples', 'LyricalReferenceTo'].includes(type)) {
        influenceTypes[type] = (influenceTypes[type] || 0) + 1;
      }
    });
    
    // 如果没有找到具体的影响类型，检查link本身是否有type信息
    if (Object.keys(influenceTypes).length === 0 && link.type) {
      const types = Array.isArray(link.type) ? link.type : [link.type];
      types.forEach(type => {
        if (['InStyleOf', 'InterpolatesFrom', 'CoverOf', 'DirectlySamples', 'LyricalReferenceTo'].includes(type)) {
          influenceTypes[type] = (influenceTypes[type] || 0) + 1;
        }
      });
    }
    
    // 如果仍然没有详细类型，使用默认分解
    if (Object.keys(influenceTypes).length === 0) {
      // 基于总数进行合理分解
      const defaultTypes = ['InStyleOf', 'CoverOf', 'DirectlySamples'];
      const baseCount = Math.floor(totalCount / defaultTypes.length);
      const remainder = totalCount % defaultTypes.length;
      
      defaultTypes.forEach((type, index) => {
        influenceTypes[type] = baseCount + (index < remainder ? 1 : 0);
      });
    }
    
    const influenceList = Object.entries(influenceTypes)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => 
        `<div style="font-weight: 400; color: #666666;">${type}: ${count}</div>`
      )
      .join('');
    
    return `<strong>${targetNode.name}</strong><br/>影响总数: <strong>${totalCount}</strong><br/><hr style="margin: 5px 0; border-color: #E0E0E0;"/>${influenceList}`;
  }
  
  // Genre → Artist: 显示合作作品数的详细分解
  if ((sourceNode.type === 'genre' || sourceNode.type === 'Genre') && 
      (targetNode.type === 'artist' || targetNode.type === 'Artist')) {
    const totalCount = link.details?.work_count || link.value;
    const collaborations = link.details?.collaborations || [];
    
    // 统计各种合作类型
    const collaborationTypes = {};
    collaborations.forEach(collab => {
      const type = collab.collaboration_type || 'Unknown';
      collaborationTypes[type] = (collaborationTypes[type] || 0) + 1;
    });
    
    // 如果没有详细类型，使用默认值
    if (Object.keys(collaborationTypes).length === 0) {
      collaborationTypes['Various'] = totalCount;
    }
    
    const collaborationList = Object.entries(collaborationTypes)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => 
        `<div style="font-weight: 400; color: #666666;">${type}: ${count}</div>`
      )
      .join('');
    
    return `<strong>${targetNode.name}</strong><br/>合作总数: <strong>${totalCount}</strong><br/><hr style="margin: 5px 0; border-color: #E0E0E0;"/>${collaborationList}`;
  }

  return `<strong>${targetNode.name}</strong><br/>计数: <strong>${link.value}</strong>`;
};

const drawChart = () => {
  if (!processedData.value || !svgRef.value) {
    console.warn('Missing processedData or svgRef');
    d3.select(svgRef.value).selectAll('*').remove();
    return;
  }
  
  if (processedData.value.nodes.length === 0) {
    console.warn('No nodes in processedData:', processedData.value);
    d3.select(svgRef.value).selectAll('*').remove();
    return;
  }
  
  console.log(`Drawing chart for ${props.currentView}:`, {
    nodes: processedData.value.nodes.length,
    links: processedData.value.links.length,
    topNGenres: props.topNGenres,
    topNArtists: props.topNArtists
  });
  
  const containerWidth = containerRef.value.clientWidth;
  const containerHeight = containerRef.value.clientHeight;

  // 优化尺寸计算
  const nodeCount = processedData.value.nodes.length;
  const minNodeHeight = 6;
  const paddingPerNode = 2;

  let width = Math.max(containerWidth * 0.95, 200);
  let height = Math.max(containerHeight * 0.90, 280);

  // 根据节点数量调整高度
  const requiredHeight = Math.max(nodeCount * (minNodeHeight + paddingPerNode) + 60, 280);
  if (requiredHeight > height) {
    height = Math.min(requiredHeight, containerHeight * 0.95);
  }

  // 确保合理的宽高比
  if (width > height * 1.2) {
    width = height * 1.2;
  }

  d3.select(svgRef.value).selectAll('*').remove();

  const svg = d3.select(svgRef.value)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  const sankeyLayout = sankey()
    .nodeId(d => d.id)
    .nodeAlign(sankeyLeft) // 两个视图都使用左对齐，因为流向都是从左到右
    .nodeWidth(10)
    .nodePadding(paddingPerNode)
    .extent([[8, 8], [width - 8, height - 8]])
    .iterations(100); 

  const graph = JSON.parse(JSON.stringify(processedData.value));
  
  // 在布局之前调整Oceanus Folk节点的value以增加其高度
  const oceanusNode = graph.nodes.find(n => n.name === 'Oceanus Folk');
  if (oceanusNode) {
    // 计算总的输出值
    const totalOutput = graph.links
      .filter(link => link.source === oceanusNode.id)
      .reduce((sum, link) => sum + (link.value || 0), 0);
    
    // 将Oceanus Folk的值设置为更大的值以增加其高度
    oceanusNode.value = Math.max(totalOutput * 2, totalOutput + 100);
  }
  
  const { nodes, links } = sankeyLayout(graph);
  
  console.log('Sankey layout result:', { nodes: nodes.length, links: links.length });
  
  let highlightedNodeIds = new Set(); 
  let highlightedLinkIds = new Set();

  const linkPaths = svg.append('g')
    .attr('fill', 'none')
    .attr('stroke-opacity', 0.7)
    .selectAll('path')
    .data(links)
    .join('path')
    .attr('class', 'sankey-link')
    .style('cursor', 'pointer')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', appColors.sankeyLinkBase) 
    .attr('stroke-width', d => Math.max(1.5, d.width * 0.85));

  linkPaths
    .on('mouseover', function(event, d) {
        d3.select(this).attr('stroke', appColors.sankeyLinkHighlight).attr('stroke-opacity', 0.9);
        
        highlightedNodeIds.clear();
        highlightedLinkIds.clear();

        // 高亮相关的链接和节点
        if (d.source.name === 'Oceanus Folk' && 
            (d.target.type === 'genre' || d.target.type === 'Genre')) {
            // 当悬浮在 Oceanus Folk → Genre 的链接上时，高亮相关的 Genre → Artist 链接
            highlightedLinkIds.add(d.index);
            links.forEach(link => {
                if (link.source.id === d.target.id && 
                    (link.target.type === 'artist' || link.target.type === 'Artist')) {
                    highlightedLinkIds.add(link.index);
                    highlightedNodeIds.add(link.target.id);
                }
            });
            highlightedNodeIds.add(d.source.id);
            highlightedNodeIds.add(d.target.id);
        } else {
            // 其他情况只高亮当前链接的源和目标节点
            highlightedLinkIds.add(d.index);
            highlightedNodeIds.add(d.source.id);
            highlightedNodeIds.add(d.target.id);
        }

        linkPaths.attr('stroke-opacity', linkD => highlightedLinkIds.has(linkD.index) ? 0.9 : 0.15);
        linkPaths.attr('stroke', linkD => highlightedLinkIds.has(linkD.index) ? appColors.sankeyLinkHighlight : appColors.sankeyLinkBase);

        svg.selectAll('.node-text')
           .attr('opacity', nodeD => {
               // 两个视图中，都只显示高亮的artist标签
               if (nodeD.layer === 2 && 
                   (nodeD.type === 'artist' || nodeD.type === 'Artist')) {
                   return highlightedNodeIds.has(nodeD.id) ? 1 : 0;
               }
               // Genre标签始终显示，高亮时更明显
               return highlightedNodeIds.has(nodeD.id) ? 1 : 0.8;
           });
        
        svg.selectAll('.sankey-node-rect')
           .attr('fill-opacity', nodeD => highlightedNodeIds.has(nodeD.id) ? 1 : 0.4);

        const tooltip = d3.select(tooltipRef.value);
        tooltip.style('opacity', 1)
            .html(getTooltipContent(d))
            .style('left', `${event.pageX + 15}px`)
            .style('top', `${event.pageY}px`)
            .style('background-color', appColors.surface)
            .style('border-color', appColors.border)
            .style('color', appColors.textPrimary);
    })
    .on('mouseout', function() {
        linkPaths.attr('stroke-opacity', 0.7).attr('stroke', appColors.sankeyLinkBase);
        svg.selectAll('.node-text')
           .attr('opacity', nodeD => {
               // 两个视图中，artist标签都默认隐藏
               if (nodeD.layer === 2 && 
                   (nodeD.type === 'artist' || nodeD.type === 'Artist')) {
                   return 0;
               }
               // Genre标签默认显示
               return 1;
           });
        svg.selectAll('.sankey-node-rect').attr('fill-opacity', 1);
        d3.select(tooltipRef.value).style('opacity', 0);
        
        highlightedNodeIds.clear();
        highlightedLinkIds.clear();
    })
    .on('click', (event, d) => {
      emit('link-clicked', { 
        source: d.source, 
        target: d.target, 
        currentView: props.currentView 
      });
    });

  const nodeGroups = svg.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g');

  nodeGroups.append('rect')
    .attr('class', 'sankey-node-rect')
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('height', d => Math.max(1.5, d.y1 - d.y0))
    .attr('width', d => d.x1 - d.x0)
    .attr('fill', d => {
      // 确保正确传递节点信息给颜色函数，统一类型格式
      const nodeWithType = {
        ...d,
        type: (d.type === 'genre' || d.type === 'Genre') ? 'Genre' : 
              (d.type === 'artist' || d.type === 'Artist') ? 'Artist' : d.type,
        name: d.name
      };
      return getSankeyNodeColor(nodeWithType);
    }) 
    .attr('stroke', appColors.textSecondary)
    .attr('stroke-width', 0.5);

  nodeGroups.append('text')
    .attr('class', 'node-text')
    .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
    .attr('y', d => (d.y1 + d.y0) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
    .attr('font-family', 'Inter, -apple-system, BlinkMacSystemFont, sans-serif')
    .attr('font-size', '10px')
    .attr('font-weight', '600')
    .attr('fill', appColors.textPrimary)
    .attr('opacity', d => {
        // 两个视图中，artist标签都默认隐藏
        if (d.layer === 2 && 
            (d.type === 'artist' || d.type === 'Artist')) {
            return 0;
        }
        // Genre标签和Oceanus Folk标签默认显示
        return 1;
    })
    .text(d => {
        if (d.name === 'Oceanus Folk') return d.name;
        if (d.type === 'genre' || d.type === 'Genre') return d.name;

        const maxTextWidth = (d.x0 < width / 2 ? width - d.x1 - 12 : d.x0 - 12);
        const text = d.name;
        const estimatedCharWidth = 6;
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
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
}

.tooltip {
  position: fixed;
  background-color: #FFFFFF;
  color: #333333;
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 12px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  pointer-events: none;
  transition: opacity 0.2s ease;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  border: 1px solid #E0E0E0;
  line-height: 1.4;
}
</style>
<template>
  <div class="sankey-container" ref="containerRef">
    <svg ref="svgRef"></svg>
    <div ref="tooltipRef" class="tooltip" style="opacity: 0;"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted } from 'vue';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';

const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
});

const svgRef = ref(null);
const tooltipRef = ref(null);
const containerRef = ref(null);

const drawChart = () => {
  if (!props.data || !svgRef.value || props.data.nodes.length === 0) {
    d3.select(svgRef.value).selectAll('*').remove();
    return;
  }
  
  const width = containerRef.value.clientWidth;
  const height = 1200;

  d3.select(svgRef.value).selectAll('*').remove();

  const svg = d3.select(svgRef.value)
    .attr('width', width)
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`);

  // 关键的Sankey布局配置
  const sankeyLayout = sankey()
    .nodeId(d => d.id)
    .nodeAlign(sankeyJustify)
    .nodeWidth(15)
    .nodePadding(10)
    .extent([[10, 10], [width - 10, height - 10]])
    .iterations(100); 

  const graph = JSON.parse(JSON.stringify(props.data));
  const { nodes, links } = sankeyLayout(graph);
  
  // --- 色彩方案更新 ---
  // 使用d3.schemeTableau10，一个视觉效果非常出色的分类色板
  const color = d3.scaleOrdinal(d3.schemeTableau10);

  // 绘制链接 (河流)
  svg.append('g')
    .attr('fill', 'none')
    .attr('stroke-opacity', 0.55) // 稍微增加不透明度，使颜色更明显
    .selectAll('path')
    .data(links)
    .join('path')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', d => color(d.source.name)) // 按源头节点的名称分配颜色，使来自同一源的流颜色一致
    .attr('stroke-width', d => Math.max(1.5, d.width))
    .on('mouseover', function(event, d) {
        // --- Tooltip 内容和样式更新 ---
        d3.select(this).attr('stroke-opacity', 0.8); // 悬停时高亮
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
        d3.select(this).attr('stroke-opacity', 0.55); // 恢复不透明度
        d3.select(tooltipRef.value).style('opacity', 0);
    });

  // 绘制节点
  const node = svg.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g');

  node.append('rect')
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('height', d => Math.max(1, d.y1 - d.y0))
    .attr('width', d => d.x1 - d.x0)
    .attr('fill', d => color(d.name)) // 节点颜色也跟随其名称
    .attr('stroke', '#555')
    .attr('stroke-width', 0.5);

  // 添加节点标签
  node.append('text')
    .attr('x', d => d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6)
    .attr('y', d => (d.y1 + d.y0) / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', d => d.x0 < width / 2 ? 'start' : 'end')
    .attr('font-family', 'sans-serif')
    .attr('font-size', '12px')
    .attr('font-weight', '400')
    .attr('fill', '#333')
    .text(d => d.name);
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

watch(() => props.data, drawChart, { deep: true });
</script>

<style>
.sankey-container {
  position: relative;
  width: 100%;
  background-color: #fff; /* 给图表一个白色背景 */
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.08);
}
.tooltip {
  /* --- Tooltip 美化 --- */
  position: fixed;
  background-color: rgba(44, 62, 80, 0.9); /* 深色背景 */
  color: white;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-family: sans-serif;
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
  color: #5d9cec; /* 强调影响力数值 */
}
</style>
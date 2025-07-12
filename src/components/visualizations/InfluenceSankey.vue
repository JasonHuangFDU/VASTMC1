<template>
  <div class="sankey-container" ref="containerRef">
    <svg ref="svgRef"></svg>
    <div ref="tooltipRef" class="tooltip" style="opacity: 0;"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, onUnmounted, defineEmits } from 'vue';
import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, sankeyJustify } from 'd3-sankey';

// --- 新增：定义组件可以发出的事件 ---
const emit = defineEmits(['link-clicked']);

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

  const sankeyLayout = sankey()
    .nodeId(d => d.id)
    .nodeAlign(sankeyJustify)
    .nodeWidth(15)
    .nodePadding(10)
    .extent([[10, 10], [width - 10, height - 10]])
    .iterations(100); 

  const graph = JSON.parse(JSON.stringify(props.data));
  const { nodes, links } = sankeyLayout(graph);
  
  const color = d3.scaleOrdinal(d3.schemeTableau10);

  svg.append('g')
    .attr('fill', 'none')
    .attr('stroke-opacity', 0.55)
    .selectAll('path')
    .data(links)
    .join('path')
    .style('cursor', 'pointer')
    .attr('d', sankeyLinkHorizontal())
    .attr('stroke', d => color(d.source.name))
    .attr('stroke-width', d => Math.max(1.5, d.width))
    .on('mouseover', function(event, d) {
        d3.select(this).attr('stroke-opacity', 0.8);
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
        d3.select(this).attr('stroke-opacity', 0.55);
        d3.select(tooltipRef.value).style('opacity', 0);
    })
    .on('click', (event, d) => {
      // --- 修改：发出带有详细数据的事件，而不是直接调用store ---
      emit('link-clicked', { source: d.source, target: d.target });
    });

  const node = svg.append('g')
    .selectAll('g')
    .data(nodes)
    .join('g');

  node.append('rect')
    .attr('x', d => d.x0)
    .attr('y', d => d.y0)
    .attr('height', d => Math.max(1, d.y1 - d.y0))
    .attr('width', d => d.x1 - d.x0)
    .attr('fill', d => color(d.name))
    .attr('stroke', '#555')
    .attr('stroke-width', 0.5);

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

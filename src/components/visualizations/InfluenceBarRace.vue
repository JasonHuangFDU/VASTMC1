<template>
  <div class="bubble-chart-container">
    <div ref="chartRef" class="chart"></div>
    <div ref="tooltipRef" class="tooltip"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick, onUnmounted } from 'vue';
import * as d3 from 'd3';
import { appColors } from '@/utils/colors.js';
import { useGraphStore } from '@/stores/graphStore';

// --- Props ---
const props = defineProps({
  data: {
    type: Object,
    required: true,
  },
});

// --- Store ---
const store = useGraphStore();

// --- DOM References ---
const chartRef = ref(null);
const tooltipRef = ref(null);

// --- D3 Simulation Reference ---
let simulation = null;

// --- Event Handlers ---
const handleBubbleClick = (event, d) => {
  console.log('Bubble clicked:', d);
  if (d && d.id) {
    
    console.log(`Bubble clicked for artist ID: ${d.node}, Name: ${d.name}`);
    store.showCollaborationWithSailor(d.id);
  } else {
    console.warn('Clicked bubble is missing an ID.', d);
  }
};

// --- Chart Logic ---
const drawChart = () => {
  if (!props.data || !chartRef.value) return;

  if (simulation) {
    simulation.stop();
  }

  // 1. --- Data Processing ---
  const rawData = props.data;
  const allPersons = new Set();
  const flatData = Object.entries(rawData)
    .filter(([key]) => !isNaN(key))
    .flatMap(([year, entries]) => {
      return entries.map(d => {
        allPersons.add(d.name);
        return {
          ...d,
          year: +year,
          'Influence score': +d['Influence score'],
        };
      });
    });

  if (flatData.length === 0) return;
  
  const nodes = flatData.map(d => ({...d}));
  const uniqueYears = [...new Set(nodes.map(d => d.year))].sort((a, b) => a - b);

  // Find top two nodes for highlighting
  const sortedNodes = [...nodes].sort((a, b) => b['Influence score'] - a['Influence score']);
  const topTwoIds = new Set(sortedNodes.slice(0, 2).map(d => d.id));

  // 2. --- Color Scale ---
  const personColor = d3.scaleOrdinal(appColors.categoryPalette).domain(Array.from(allPersons));

  // 3. --- Dimensions & SVG Setup ---
  d3.select(chartRef.value).select('svg').remove();

  const margin = { top: 40, right: 40, bottom: 80, left: 60 }; // Increased bottom margin
  const width = chartRef.value.clientWidth - margin.left - margin.right;
  const height = chartRef.value.clientHeight - margin.top - margin.bottom;

  const svg = d3.select(chartRef.value)
    .append('svg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // 4. --- Scales ---
  const [minYear, maxYear] = d3.extent(nodes, d => d.year);
  const maxInfluence = d3.max(nodes, d => d['Influence score']);

  const xScale = d3.scaleLinear()
    .domain([minYear - 1, maxYear + 1])
    .range([0, width]);

  const yScale = d3.scaleLinear()
    .domain([0, maxInfluence * 1.1])
    .range([height, 0]);

  const radiusScale = d3.scaleSqrt()
    .domain([0, maxInfluence])
    .range([4, 45]);

  // 5. --- Axes ---
  const xAxis = d3.axisBottom(xScale)
    .tickValues(uniqueYears)
    .tickFormat(d3.format('d'))
    .tickSize(-height) // Create grid lines
    .tickPadding(15); // Increased padding for ticks
    
  const yAxis = d3.axisLeft(yScale)
    .tickValues([3, 6])
    .tickSize(-width) // Create grid lines
    .tickPadding(10);

  const xAxisGroup = svg.append('g')
    .attr('class', 'x-axis axis-grid')
    .attr('transform', `translate(0,${height})`)
    .call(xAxis);

  const yAxisGroup = svg.append('g')
    .attr('class', 'y-axis axis-grid')
    .call(yAxis);

  // Hide domain lines for a cleaner look
  xAxisGroup.select('.domain').remove();
  yAxisGroup.select('.domain').remove();

  svg.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle').attr('x', width / 2).attr('y', height + margin.bottom - 25).text('Year');
  svg.append('text').attr('class', 'axis-label').attr('text-anchor', 'middle').attr('transform', 'rotate(-90)').attr('x', -height / 2).attr('y', -margin.left + 20).text('Influence Score');

  // 6. --- Tooltip & Hover Handlers ---
  const tooltip = d3.select(tooltipRef.value);

  const handleMouseOver = (event, d) => {
    tooltip.style('opacity', 1);
    d3.select(event.currentTarget).attr('stroke', 'black').attr('stroke-width', 2).style('opacity', 1);
    d.fx = d.x;
    d.fy = d.y;
  };

  const handleMouseMove = (event, d) => {
    tooltip.html(`<strong>${d.name}</strong><br>Year: ${d.year}<br>Influence: ${d['Influence score']}`)
      .style('left', `${event.pageX + 15}px`)
      .style('top', `${event.pageY - 10}px`);
  };

  const handleMouseOut = (event, d) => {
    tooltip.style('opacity', 0);
    d3.select(event.currentTarget)
      .attr('stroke', topTwoIds.has(d.id) ? 'gold' : 'none')
      .attr('stroke-width', topTwoIds.has(d.id) ? 3 : 0)
      .style('opacity', 0.8);
    d.fx = null;
    d.fy = null;
  };

  // 7. --- Draw Bubbles ---
  const bubbles = svg.append('g')
    .selectAll('circle')
    .data(nodes)
    .join('circle')
    .attr('class', 'bubble')
    .attr('r', d => radiusScale(d['Influence score']))
    .attr('fill', d => personColor(d.name))
    .style('opacity', 0.8)
    .attr('stroke', d => topTwoIds.has(d.id) ? 'gold' : 'none')
    .attr('stroke-width', d => topTwoIds.has(d.id) ? 3 : 0)
    .on('mouseover', handleMouseOver)
    .on('mousemove', handleMouseMove)
    .on('mouseout', handleMouseOut)
    .on('click', handleBubbleClick);

  // 8. --- Force Simulation ---
  simulation = d3.forceSimulation(nodes)
    .force('x', d3.forceX(d => xScale(d.year)).strength(0.8))
    .force('y', d3.forceY(d => yScale(d['Influence score'])).strength(0.8))
    .force('collide', d3.forceCollide(d => radiusScale(d['Influence score']) + 2).strength(0.9))
    .on('tick', () => {
      bubbles
        .each(d => {
          const radius = radiusScale(d['Influence score']);
          d.x = Math.max(radius, Math.min(width - radius, d.x));
          d.y = Math.max(radius, Math.min(height - radius, d.y));
        })
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);
    });
};

// --- Lifecycle Hooks ---
onMounted(() => {
  nextTick(() => {
    drawChart();
  });
});

onUnmounted(() => {
  if (simulation) {
    simulation.stop();
  }
});

// --- Watchers ---
watch(() => props.data, () => {
  nextTick(() => {
    drawChart();
  });
}, { deep: true });

// --- Responsive Chart ---
onMounted(() => {
  const resizeObserver = new ResizeObserver(() => {
    nextTick(() => {
      drawChart();
    });
  });
  if (chartRef.value) {
    resizeObserver.observe(chartRef.value);
  }
  onUnmounted(() => {
    if (chartRef.value) {
      resizeObserver.unobserve(chartRef.value);
    }
  });
});

</script>

<style scoped>
.bubble-chart-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #FFFFFF; /* Pure white background */
  font-family: 'Nunito', sans-serif;
}

.chart {
  width: 100%;
  height: 100%;
}

.tooltip {
  position: absolute;
  opacity: 0;
  background-color: rgba(0, 0, 0, 0.75);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 14px;
  pointer-events: none;
  transition: opacity 0.2s ease-in-out;
  white-space: nowrap;
  z-index: 10;
}

:deep(.axis-label) {
  font-size: 14px;
  fill: #666666; /* textSecondary */
  font-weight: 400; /* Normal weight */
}

:deep(.axis-grid .tick text) {
  font-size: 12px;
  fill: #666666; /* textSecondary */
}

:deep(.axis-grid .tick line) {
  stroke: #E0E0E0; /* border color */
  stroke-dasharray: 2,2; /* Dashed grid lines */
}

.bubble {
  cursor: pointer;
  transition: opacity 0.2s ease, stroke 0.2s ease;
}

.bubble:hover {
  opacity: 1;
}
</style>
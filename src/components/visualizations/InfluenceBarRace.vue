<template>
  <div class="bar-race-container">
    
    <!-- 1. Controls Area (Sidebar) -->
    <div class="controls">
      <button @click="togglePlay" class="control-btn">
        <svg v-if="isPlaying" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
        <span>{{ isPlaying ? 'Pause' : 'Play' }}</span>
      </button>

      <div class="slider-container">
        <div class="slider-header">
          <label for="year-slider">Year</label>
          <span class="year-display">{{ currentYear }}</span>
        </div>
        <input
          type="range"
          id="year-slider"
          :min="startYear"
          :max="endYear"
          v-model.number="currentYear"
          class="year-slider"
          @input="handleYearSliderChange"
        />
      </div>

      <div class="top-n-container">
        <label for="top-n-input">Top</label>
        <input type="number" id="top-n-input" v-model.number="n" min="3" max="20" class="top-n-input" @change="updateTopN" />
      </div>

      <button @click="jumpToMax" class="control-btn-text">
        Jump to Peak Year
      </button>
    </div>

    <!-- 2. Chart Area (Main Right Area) -->
    <div class="chart-wrapper">
      <div v-if="loading" class="loading-overlay">
        <div class="spinner"></div>
        <p>Chart loading...</p>
      </div>
      <div ref="chartDom" class="chart"></div>
      <div class="year-watermark">{{ currentYear }}</div>
    </div>
    
    <!-- Tooltip moved outside -->
    <div ref="tooltipRef" class="tooltip"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as d3 from 'd3';
import { useGraphStore } from '@/stores/graphStore'; // 新增：导入 store

// --- Store ---
const graphStore = useGraphStore(); // New: Initialize store

// --- Color Palette ---
const colors = {
  default: '#5DADE2',
  highlight: '#F1948A',
  hover: '#3498DB'
};

// --- Props ---
const props = defineProps({
  data: Object,
  maxInfluenceInfo: Object,
});

// --- Reactive State ---
const isPlaying = ref(false);
const wasPlayingBeforeHover = ref(false);
const currentYearIndex = ref(0);
const n = ref(5);
const years = ref([]);
const intervalId = ref(null);
const currentYear = ref(0);
const loading = ref(true);

const startYear = ref(1965);
const endYear = ref(2040);

// --- DOM References ---
const chartDom = ref(null);
const tooltipRef = ref(null);

// --- D3 Chart Variables ---
const margin = { top: 20, right: 30, bottom: 100, left: 60 };
let chartWidth;
let chartHeight;
let svg;
let xScale, yScale;

// --- Core Business Logic Functions ---

const processData = (rawData) => {
  if (!rawData) return;
  const yearKeys = Object.keys(rawData).filter(key => key !== 'max_info').sort();
  years.value = yearKeys;

  if (years.value.length > 0) {
    startYear.value = parseInt(years.value[0]);
    endYear.value = parseInt(years.value[years.value.length - 1]);
    if (currentYear.value < startYear.value || currentYear.value > endYear.value) {
        currentYear.value = startYear.value;
        currentYearIndex.value = 0;
    }
  }
};

const togglePlay = () => {
  isPlaying.value = !isPlaying.value;
};

const jumpToMax = () => {
  if (props.maxInfluenceInfo && years.value.length > 0) {
    const maxYear = String(props.maxInfluenceInfo.year);
    const index = years.value.indexOf(maxYear);
    if (index !== -1) {
      if (isPlaying.value) isPlaying.value = false;
      currentYear.value = parseInt(maxYear);
      currentYearIndex.value = index;
    }
  }
};

const handleYearSliderChange = () => {
  const index = years.value.indexOf(String(currentYear.value));
  if (index !== -1) currentYearIndex.value = index;
  if (isPlaying.value) isPlaying.value = false;
};

const updateTopN = () => {
  if (props.data && props.data[currentYear.value]) {
    updateChart(props.data[currentYear.value]);
  }
};

// --- 图表和播放控制 ---

const initChart = () => {
  if (!chartDom.value) return;
  d3.select(chartDom.value).select('svg').remove();

  const containerWidth = chartDom.value.clientWidth;
  const containerHeight = chartDom.value.clientHeight;
  chartWidth = containerWidth - margin.left - margin.right;
  chartHeight = containerHeight - margin.top - margin.bottom;

  svg = d3.select(chartDom.value)
    .append('svg')
    .attr('width', containerWidth)
    .attr('height', containerHeight)
    .append('g')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  xScale = d3.scaleBand().range([0, chartWidth]).padding(0.1);
  yScale = d3.scaleLinear().range([chartHeight, 0]);

  svg.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${chartHeight})`);
  svg.append('g').attr('class', 'y-axis');

  svg.append("text")
    .attr("class", "y-axis-label")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left + 20)
    .attr("x", 0 - (chartHeight / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .text("Influence Score");
};

const updateChart = (yearData) => {
  if (!yearData || !svg) return;

  const sortedData = yearData
    .sort((a, b) => b['Influence score'] - a['Influence score'])
    .slice(0, n.value);

  xScale.domain(sortedData.map(d => `${d.name} (${d['node id']})`));
  yScale.domain([0, 12]);

  svg.select('.x-axis').transition().duration(500).call(d3.axisBottom(xScale))
    .selectAll("text")
    .attr("transform", "rotate(0)")
    .style("text-anchor", "middle")
    .attr("dx", "0em")
    .attr("dy", "1em");

  svg.select('.y-axis').transition().duration(500).call(d3.axisLeft(yScale));

  const bars = svg.selectAll('.bar').data(sortedData, d => d['node id']);

  bars.enter().append('rect')
    .attr('class', 'bar')
    .attr('rx', 3) // Add rounded corners
    .attr('ry', 3) // Add rounded corners
    .merge(bars)
    .attr('x', d => xScale(`${d.name} (${d['node id']})`))
    .attr('width', xScale.bandwidth())
    .attr('y', d => yScale(d['Influence score']))
    .attr('height', d => chartHeight - yScale(d['Influence score']))
    .attr('fill', d => {
      const isPeakYearBar = props.maxInfluenceInfo &&
                    d['node id'] === props.maxInfluenceInfo.node_id &&
                    String(currentYear.value) === String(props.maxInfluenceInfo.year);
      const hasMaxScore = d['Influence score'] === 12;
      return isPeakYearBar || hasMaxScore ? colors.highlight : colors.default;
    })
    .on('mouseover', handleMouseOver)
    .on('mouseout', handleMouseOut)
    .on('click', handleClick); // 新增：点击事件

  bars.exit().transition().duration(500)
    .attr('height', 0)
    .attr('y', chartHeight)
    .remove();

  const labels = svg.selectAll('.bar-label').data(sortedData, d => d['node id']);

  labels.enter().append('text')
    .attr('class', 'bar-label')
    .merge(labels)
    .transition().duration(500)
    .attr('x', d => xScale(`${d.name} (${d['node id']})`) + xScale.bandwidth() / 2)
    .attr('y', d => yScale(d['Influence score']) - 5)
    .text(d => d['Influence score']);

  labels.exit().transition().duration(500)
    .attr('y', chartHeight)
    .remove();
};

// --- 事件处理器 ---
function handleMouseOver(event, d) {
  wasPlayingBeforeHover.value = isPlaying.value;
  if (isPlaying.value) isPlaying.value = false;

  d3.select(event.currentTarget).attr('fill', colors.hover);

  const yearIndex = currentYear.value - 1965;
  const cumulativeNotability = d.notability_score.slice(0, yearIndex + 1).reduce((a, b) => a + b, 0);

  const tooltip = tooltipRef.value;
  if (!tooltip) return;
  
  tooltip.innerHTML = `
    <strong>ID:</strong> ${d['node id']}<br>
    <strong>Name:</strong> ${d.name}<br>
    <strong>Influence Score:</strong> ${d['Influence score']}<br>
    <strong>Notability (${currentYear.value}):</strong> ${cumulativeNotability}
  `;
  tooltip.style.display = 'block';
  tooltip.style.opacity = 1;
  tooltip.style.left = `${event.pageX + 15}px`;
  tooltip.style.top = `${event.pageY - 28}px`;
}

function handleMouseOut(event, d) {
  if (wasPlayingBeforeHover.value) isPlaying.value = true;

  const isPeakYearBar = props.maxInfluenceInfo &&
                d['node id'] === props.maxInfluenceInfo.node_id &&
                String(currentYear.value) === String(props.maxInfluenceInfo.year);
  const hasMaxScore = d['Influence score'] === 12;
  d3.select(event.currentTarget).attr('fill', isPeakYearBar || hasMaxScore ? colors.highlight : colors.default);

  const tooltip = tooltipRef.value;
  if (!tooltip) return;

  tooltip.style.display = 'none';
  tooltip.style.opacity = 0;
}

// 新增：点击事件处理器
function handleClick(event, d) {
  console.log(`Bar clicked for node ID: ${d['node id']}`);
  graphStore.showArtistComparison(d['node id']);
  // 如果正在播放，则暂停
  if (isPlaying.value) {
    isPlaying.value = false;
  }
  // 关键：重置悬停前的播放状态，防止鼠标移出后自动播放
  wasPlayingBeforeHover.value = false;
}

const play = () => {
  if (intervalId.value) clearInterval(intervalId.value);
  intervalId.value = setInterval(() => {
    let nextIndex = currentYearIndex.value + 1;
    if (nextIndex >= years.value.length) nextIndex = 0;
    currentYearIndex.value = nextIndex;
    currentYear.value = parseInt(years.value[nextIndex]);
  }, 1500);
};

const pause = () => {
  clearInterval(intervalId.value);
  intervalId.value = null;
};

// --- 生命周期钩子和侦听器 ---

onMounted(() => {
  loading.value = true;
  initChart();
  processData(props.data);
  if (years.value.length > 0) {
    updateChart(props.data[currentYear.value]);
    togglePlay();
  }
  loading.value = false;

  const resizeObserver = new ResizeObserver(() => {
    initChart();
    if (props.data && props.data[currentYear.value]) {
      updateChart(props.data[currentYear.value]);
    }
  });
  if (chartDom.value) resizeObserver.observe(chartDom.value);

  onUnmounted(() => {
    pause();
    if (chartDom.value) resizeObserver.unobserve(chartDom.value);
  });
});

watch(() => props.data, (newData) => {
  processData(newData);
  if (years.value.length > 0) {
    updateChart(newData[currentYear.value]);
  }
});

watch(isPlaying, (newVal) => {
  if (newVal) play();
  else pause();
});

watch(currentYear, (newYear) => {
  if (props.data && props.data[newYear]) {
    updateChart(props.data[newYear]);
    const index = years.value.indexOf(String(newYear));
    if (index !== -1) currentYearIndex.value = index;
  }
});

watch(n, () => {
  if (props.data && props.data[currentYear.value]) {
    updateChart(props.data[currentYear.value]);
  }
});

</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap');

.bar-race-container {
  position: relative;
  font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f8f9fa;
  padding: 1.5rem;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: row;
  gap: 1.5rem;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.controls {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 1.5rem;
  flex-shrink: 0;
  width: 260px;
  padding: 1.5rem;
  background-color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.chart-wrapper {
  position: relative;
  background: #fff;
  border-radius: 12px;
  flex-grow: 1;
  min-width: 0;
}

.chart {
  width: 100%;
  height: 100%; 
}

.tooltip {
  position: absolute;
  display: none;
  opacity: 0;
  background-color: #ffffff;
  color: #374151;
  padding: 10px 15px;
  border-radius: 8px;
  font-size: 14px;
  font-family: 'Nunito', sans-serif;
  pointer-events: none;
  transition: opacity 0.2s ease-in-out, transform 0.2s ease-in-out;
  z-index: 20;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e7eb;
}

.slider-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.year-display {
  font-weight: 700;
  font-size: 1.2rem;
  color: #2c3e50;
  background-color: #e9ecef;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
}

.top-n-container {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 1rem;
}

@media (max-width: 860px) {
  .bar-race-container { 
    flex-direction: column; 
    height: auto;
  }
  
  .controls { 
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }
  
  .top-n-container {
    justify-content: space-between;
  }
}

.control-btn, .control-btn-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}
.control-btn {
  background: linear-gradient(45deg, #3498db, #2980b9);
  color: white;
  box-shadow: 0 4px 12px rgba(52, 152, 219, 0.3);
}
.control-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(52, 152, 219, 0.4);
}
.control-btn-text {
  background: none;
  color: #3498db;
}
.control-btn-text:hover {
  background-color: rgba(52, 152, 219, 0.1);
}

label {
  font-weight: 700;
  color: #555;
}

.year-slider {
  width: 100%;
  -webkit-appearance: none; appearance: none;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  outline: none;
  transition: background 0.2s;
}
.year-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 20px; height: 20px;
  background: #fff;
  border: 3px solid #3498db;
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s ease;
}
.year-slider:hover::-webkit-slider-thumb {
  transform: scale(1.1);
}

.top-n-input {
  width: 60px;
  padding: 0.5rem;
  border: 1px solid #ced4da;
  border-radius: 6px;
  text-align: center;
  font-size: 1rem;
  font-weight: 700;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.top-n-input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
}

.year-watermark {
  position: absolute;
  bottom: 5%; right: 5%;
  font-size: clamp(60px, 15vw, 150px);
  font-weight: 900;
  color: rgba(0, 0, 0, 0.07);
  z-index: 0;
  pointer-events: none;
  user-select: none;
}

.loading-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
}
.spinner {
  width: 50px; height: 50px;
  border: 5px solid #f3f3f3;
  border-top: 5px solid #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.loading-overlay p {
  margin-top: 1rem;
  font-size: 1rem;
  color: #555;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* === Axis Beautification === */
:deep(.x-axis .domain),
:deep(.y-axis .domain) {
  stroke: #d1d5db; /* A light grey for the main axis line */
  stroke-width: 1px;
}

:deep(.x-axis .tick line),
:deep(.y-axis .tick line) {
  stroke: #e5e7eb; /* An even lighter grey for tick lines */
}

:deep(.x-axis text),
:deep(.y-axis text) {
  font-family: 'Nunito', sans-serif;
  font-size: 12px;
  fill: #4b5563; /* A slightly darker, more saturated grey for better readability */
}

:deep(.y-axis-label) {
  font-family: 'Nunito', sans-serif;
  font-size: 14px;
  fill: #374151; /* Darker for the main label */
  font-weight: 700;
}


.bar-label {
  font-size: 11px;
  fill: #333;
  font-weight: bold;
}
.bar {
  transition: fill 0.2s ease;
  cursor: pointer; /* 新增：显示可点击光标 */
}
</style>
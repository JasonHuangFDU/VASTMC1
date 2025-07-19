<template>
  <div class="bar-race-container">
    
    <!-- 1. 控制器区域 (侧边栏) -->
    <div class="controls">
      <button @click="togglePlay" class="control-btn">
        <svg v-if="isPlaying" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
        <span>{{ isPlaying ? '暂停' : '播放' }}</span>
      </button>

      <div class="slider-container">
        <!-- MODIFIED: 新增一个header容器，用于将标签和年份数字放在同一行 -->
        <div class="slider-header">
          <label for="year-slider">年份</label>
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
        跳转到巅峰年份
      </button>
    </div>

    <!-- 2. 图表区域 (右侧主区域) -->
    <div class="chart-wrapper">
      <div v-if="loading" class="loading-overlay">
        <div class="spinner"></div>
        <p>图表加载中...</p>
      </div>
      <div ref="chartDom" class="chart"></div>
      <div class="year-watermark">{{ currentYear }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as d3 from 'd3'; // Keep D3 for visualization

const props = defineProps({
  data: Object,
  maxInfluenceInfo: Object,
});

// --- 响应式状态 (结合 me.vue 和 InfluenceBarRace.vue) ---
const isPlaying = ref(false);
const currentYearIndex = ref(0);
const n = ref(5); // Renamed from topN to n for consistency with me.vue template
const years = ref([]);
const intervalId = ref(null);
const currentYear = ref('');
const loading = ref(true); // From me.vue

// Data related variables (from me.vue, mapped to InfluenceBarRace.vue's data)
const startYear = ref(2015); // Will be set from years[0]
const endYear = ref(2025);   // Will be set from years[years.length - 1]

// --- D3 Chart Variables ---
const chartDom = ref(null); // Renamed from chartContainer to match me.vue template
const margin = { top: 20, right: 30, bottom: 100, left: 60 };
let chartWidth;
let chartHeight;
let svg;
let xScale, yScale;

// --- 核心业务逻辑函数 ---

// 播放/暂停切换
const togglePlay = () => {
  isPlaying.value = !isPlaying.value;
  console.log("InfluenceBarRace: 播放状态切换为:", isPlaying.value);
  if (isPlaying.value) {
    play();
  } else {
    pause();
  }
};

// 跳转到数据中影响力最大的年份 (renamed from jumpToMaxInfluence)
const jumpToMax = () => {
  console.log("InfluenceBarRace: 跳转到最大影响力年份。");
  if (props.maxInfluenceInfo && years.value.length > 0) {
    const maxYear = String(props.maxInfluenceInfo.year);
    const index = years.value.indexOf(maxYear);
    if (index !== -1) {
      currentYearIndex.value = index;
      currentYear.value = years.value[currentYearIndex.value];
      console.log("InfluenceBarRace: 跳转到年份:", currentYear.value);
      // Ensure chart updates immediately
      updateChart(props.data[currentYear.value]);
      if (isPlaying.value) {
        clearInterval(intervalId.value);
        isPlaying.value = false;
      }
    }
  }
};

// 处理��份滑块变化
const handleYearSliderChange = (event) => {
  const year = parseInt(event.target.value);
  const index = years.value.indexOf(String(year));
  if (index !== -1) {
    currentYearIndex.value = index;
    currentYear.value = years.value[currentYearIndex.value];
    // Pause playback when manually changing year
    if (isPlaying.value) {
      clearInterval(intervalId.value);
      isPlaying.value = false;
    }
  }
};

// 更新 Top N
const updateTopN = () => {
  console.log("InfluenceBarRace: TopN 切换为:", n.value);
  updateChart(props.data[currentYear.value]);
};

// --- 图表和播放控制 ---

const initChart = () => {
  console.log("InfluenceBarRace: 初始化图表。");
  if (!chartDom.value) return;

  // Clear existing SVG to prevent duplicates on re-initialization
  d3.select(chartDom.value).select('svg').remove();

  // Get parent container's actual dimensions
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

  // Invert axes: xScale for names, yScale for influence scores
  xScale = d3.scaleBand().range([0, chartWidth]).padding(0.1);
  yScale = d3.scaleLinear().range([chartHeight, 0]);

  svg.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${chartHeight})`);
  svg.append('g').attr('class', 'y-axis');

  // Add Y-axis label
  svg.append("text")
    .attr("class", "y-axis-label")
    .attr("transform", "rotate(-90)")
    .attr("y", 0 - margin.left + 20)
    .attr("x", 0 - (chartHeight / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .text("影响力分数");
};

const updateChart = (yearData) => {
  console.log("InfluenceBarRace: 更新图表，当前年份数据:", yearData);
  console.log("InfluenceBarRace: 当前年份 (currentYear):", currentYear.value);
  if (!yearData || !svg) { // Check if svg is initialized
    console.warn("InfluenceBarRace: yearData 或 SVG 为空，无法更新图表。");
    return;
  }

  const sortedData = yearData
    .sort((a, b) => b['Influence score'] - a['Influence score'])
    .slice(0, n.value); // Use n instead of topN
  console.log("InfluenceBarRace: 排序并截取后的数据:", sortedData);

  // Update axis domains
  xScale.domain(sortedData.map(d => `${d.name} (${d['node id']})`));
  yScale.domain([0, 9]); // Fixed Y-axis scale 0-9

  console.log("InfluenceBarRace: xScale domain:", xScale.domain());
  console.log("InfluenceBarRace: yScale domain:", yScale.domain());

  // Update X-axis
  svg.select('.x-axis')
    .transition()
    .duration(500)
    .call(d3.axisBottom(xScale))
    .selectAll("text")
      .attr("transform", "rotate(0)")
      .style("text-anchor", "middle")
      .attr("dx", "0em")
      .attr("dy", "1em");

  // Update Y-axis
  svg.select('.y-axis')
    .transition()
    .duration(500)
    .call(d3.axisLeft(yScale));

  // Draw bars
  const bars = svg.selectAll('.bar')
    .data(sortedData, d => d['node id']);

  bars.enter()
    .append('rect')
    .attr('class', 'bar')
    .attr('x', d => xScale(`${d.name} (${d['node id']})`))
    .attr('width', xScale.bandwidth())
    .attr('y', chartHeight)
    .attr('height', 0)
    .attr('fill', d => {
      const isMaxInfluenceNode = props.maxInfluenceInfo && d['node id'] === props.maxInfluenceInfo.node_id && currentYear.value === String(props.maxInfluenceInfo.year);
      return isMaxInfluenceNode ? 'red' : '#3498db'; // Use a color from me.vue's palette
    })
    .transition()
    .duration(500)
    .attr('y', d => yScale(d['Influence score']))
    .attr('height', d => chartHeight - yScale(d['Influence score']));

  bars.transition()
    .duration(500)
    .attr('x', d => xScale(`${d.name} (${d['node id']})`))
    .attr('width', xScale.bandwidth())
    .attr('y', d => yScale(d['Influence score']))
    .attr('height', d => chartHeight - yScale(d['Influence score']))
    .attr('fill', d => {
      const isMaxInfluenceNode = props.maxInfluenceInfo && d['node id'] === props.maxInfluenceInfo.node_id && currentYear.value === String(props.maxInfluenceInfo.year);
      return isMaxInfluenceNode ? 'red' : '#3498db';
    });

  bars.exit()
    .transition()
    .duration(500)
    .attr('height', 0)
    .attr('y', chartHeight)
    .remove();

  // Draw value labels
  const labels = svg.selectAll('.bar-label')
    .data(sortedData, d => d['node id']);

  labels.enter()
    .append('text')
    .attr('class', 'bar-label')
    .attr('x', d => xScale(`${d.name} (${d['node id']})`) + xScale.bandwidth() / 2)
    .attr('y', chartHeight)
    .attr('text-anchor', 'middle')
    .attr('fill', '#333')
    .text(d => d['Influence score'])
    .transition()
    .duration(500)
    .attr('y', d => yScale(d['Influence score']) - 5);

  labels.transition()
    .duration(500)
    .attr('x', d => xScale(`${d.name} (${d['node id']})`) + xScale.bandwidth() / 2)
    .attr('y', d => yScale(d['Influence score']) - 5)
    .text(d => d['Influence score']);

  labels.exit()
    .transition()
    .duration(500)
    .attr('y', chartHeight)
    .remove();
};

const play = () => {
  if (intervalId.value) clearInterval(intervalId.value);
  intervalId.value = setInterval(() => {
    currentYearIndex.value = (currentYearIndex.value + 1) % years.value.length;
    currentYear.value = years.value[currentYearIndex.value];
    console.log("InfluenceBarRace: 自动播放，当前年份:", currentYear.value);
    updateChart(props.data[currentYear.value]);
  }, 1000); // Update every 1 second
};

const pause = () => {
  clearInterval(intervalId.value);
  intervalId.value = null;
};

// --- 生命周期钩子和侦听器 ---

onMounted(() => {
  console.log("InfluenceBarRace: 组件已挂载。");
  loading.value = true; // Start loading state
  if (props.data) {
    years.value = Object.keys(props.data).sort();
    if (years.value.length > 0) {
      startYear.value = parseInt(years.value[0]);
      endYear.value = parseInt(years.value[years.value.length - 1]);
      currentYearIndex.value = 0;
      currentYear.value = years.value[currentYearIndex.value];
      initChart(); // Initialize D3 chart
      updateChart(props.data[currentYear.value]);
      togglePlay(); // Start playing by default
    }
  }
  loading.value = false; // End loading state
  window.addEventListener('resize', () => {
    if (chartDom.value) {
      initChart(); // Re-initialize chart on resize to adjust dimensions
      updateChart(props.data[currentYear.value]);
    }
  });
});

onUnmounted(() => {
  console.log("InfluenceBarRace: 组件已卸载。");
  pause(); // Ensure interval is cleared
  window.removeEventListener('resize', () => {
    if (chartDom.value) {
      initChart();
      updateChart(props.data[currentYear.value]);
    }
  });
  // D3 charts don't have a dispose method like ECharts, but clearing SVG is done in initChart
});

watch(() => props.data, (newData) => {
  console.log("InfluenceBarRace: props.data 发生变化:", newData);
  if (newData) {
    years.value = Object.keys(newData).sort();
    if (years.value.length > 0) {
      startYear.value = parseInt(years.value[0]);
      endYear.value = parseInt(years.value[years.value.length - 1]);
      currentYearIndex.value = 0; // Reset index when data changes
      currentYear.value = years.value[currentYearIndex.value];
      initChart(); // Re-initialize chart with new data
      updateChart(newData[currentYear.value]);
    }
  }
});

watch(isPlaying, (newVal) => (newVal ? play() : pause()));

watch([currentYear, n], () => { // Watch currentYear and n (formerly topN)
  if (!loading.value && props.data[currentYear.value]) {
    updateChart(props.data[currentYear.value]);
  }
});

// Watch currentYearIndex to update currentYear for slider
watch(currentYearIndex, (newIndex) => {
  if (years.value.length > 0 && newIndex >= 0 && newIndex < years.value.length) {
    currentYear.value = years.value[newIndex];
  }
});

</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap');

.bar-race-container {
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
  overflow: hidden;
  flex-grow: 1;
  min-width: 0;
}

.chart {
  width: 100%;
  height: 100%; 
}

/* --- 控件微调 --- */

.slider-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem; /* 减小标题和滑块的间距 */
}

/* MODIFIED: 新增样式，用于处理滑块的头部（标签+年份） */
.slider-header {
  display: flex;
  justify-content: space-between; /* 两端对齐，标签在左，年份在右 */
  align-items: center;
  width: 100%;
}

.year-display {
  /* REMOVED: 不再需要 align-self: center */
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
  /* MODIFIED: 将 space-between 改为 flex-start，让标签和输入框靠在一起 */
  justify-content: flex-start;
  gap: 1rem; /* 调整标签和输入框之间的距离 */
}

/* --- 响应式布局调整 --- */

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
  
  /* 在小屏幕上让Top N容器也恢复两端对齐，以更好地利用空间 */
  .top-n-container {
    justify-content: space-between;
  }
}

/* --- 其他样式保持不变 --- */
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

.x-axis text, .y-axis text {
  font-size: 12px;
  fill: #666;
}
.y-axis-label {
  font-size: 14px;
  fill: #333;
  font-weight: bold;
}
.bar-label {
  font-size: 11px;
  fill: #333;
  font-weight: bold;
}
.bar {
  transition: fill 0.3s ease;
}
</style>
<template>
  <div class="bar-race-container">
    <!-- 1. 标题区域 -->
    <header class="chart-header">
      <h1>影响力演变动态条形图</h1>
      <p>展示历年来最具影响力的项目排名变化</p>
    </header>

    <!-- 2. 控制器区域 -->
    <div class="controls">
      <button @click="togglePlay" class="control-btn">
        <svg v-if="isPlaying" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path></svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>
        <span>{{ isPlaying ? '暂停' : '播放' }}</span>
      </button>

      <div class="slider-container">
        <label for="year-slider">年份</label>
        <input 
          type="range" 
          id="year-slider" 
          :min="startYear" 
          :max="endYear" 
          v-model.number="currentYear" 
          class="year-slider"
        />
        <span class="year-display">{{ currentYear }}</span>
      </div>
      
      <div class="top-n-container">
        <label for="top-n-input">Top</label>
        <input type="number" id="top-n-input" v-model.number="n" min="3" max="20" class="top-n-input" />
      </div>

      <button @click="jumpToMax" class="control-btn-text">
        跳转到巅峰年份
      </button>
    </div>

    <!-- 3. 图表区域 -->
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
import * as echarts from 'echarts';

// ===================================================================
// START: 您需要填充或修改的区域
// ===================================================================

// --- 响应式状态 (请使用您自己的变量) ---
const isPlaying = ref(false);
const currentYear = ref(2020); // 默认/起始年份
const n = ref(10); // 默认 Top N
const loading = ref(true);

// --- 数据相关的变量 (请使用您自己的变量) ---
const startYear = ref(2015); // 数据的起始年份
const endYear = ref(2025); // 数据的结束年份
const allData = ref({}); // 用于存放您所有年份的数据，例如: { 2020: [ { name: 'A', value: 100 } ], 2021: [...] }

// --- 核心业务逻辑函数 (请实现您自己的逻辑) ---

// 播放/暂停切换
const togglePlay = () => {
  isPlaying.value = !isPlaying.value;
};

// 跳转到数据中影响力最大的年份
const jumpToMax = () => {
  // TODO: 在您的 allData 中查找最大值对应的年份
  // 示例: 
  // let maxVal = -1;
  // let maxYear = startYear.value;
  // for (const year in allData.value) { ... }
  // currentYear.value = maxYear;
  console.log("跳转逻辑需要您自己实现");
};

// 获取并处理数据
const fetchData = async () => {
  loading.value = true;
  // TODO: 在这里实现您的数据获取逻辑
  // 例如: const response = await fetch('/api/data');
  // allData.value = await response.json();
  // startYear.value = Object.keys(allData.value)[0];
  // endYear.value = Object.keys(allData.value).pop();
  // currentYear.value = startYear.value;
  
  // 模拟异步加载
  await new Promise(resolve => setTimeout(resolve, 500));
  
  loading.value = false;
  // 数据加载完毕后，初始化图表
  initChart();
};

// ===================================================================
// END: 您需要填充或修改的区域
// ===================================================================


// --- 图表和播放控制 (通常无需修改) ---
const chartDom = ref(null);
let chartInstance = null;
const timer = ref(null);

const softColors = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'];

const initChart = () => {
  if (!chartDom.value) return;
  chartInstance = echarts.init(chartDom.value);
  
  const option = {
    grid: { top: 20, right: 100, bottom: 20, left: 120, containLabel: false },
    xAxis: {
      type: 'value', max: 'dataMax',
      splitLine: { show: true, lineStyle: { type: 'dashed', color: '#e0e0e0' } },
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#999', fontSize: 12 },
    },
    yAxis: {
      type: 'category', inverse: true,
      animationDuration: 300, animationDurationUpdate: 300,
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#333', fontSize: 14, fontWeight: 'bold', align: 'left', padding: [0, 0, 0, -110] },
    },
    series: [{
      type: 'bar', realtimeSort: true, barMaxWidth: 25,
      label: { show: true, position: 'right', valueAnimation: true, color: '#555', fontSize: 14, fontWeight: 600, formatter: '{c}' },
      itemStyle: { color: (params) => softColors[params.dataIndex % softColors.length], borderRadius: [0, 8, 8, 0] },
      encode: { x: 'value', y: 'name' },
    }],
    animationDuration: 800, animationDurationUpdate: 800,
    animationEasing: 'cubicInOut', animationEasingUpdate: 'cubicInOut',
  };
  chartInstance.setOption(option);
};

const updateChart = (year) => {
  if (!chartInstance || !allData.value[year]) return;

  const yearData = [...allData.value[year]]
    .sort((a, b) => b.value - a.value)
    .slice(0, n.value);

  chartInstance.setOption({
    yAxis: { data: yearData.map(item => item.name) },
    series: [{ data: yearData }],
  });
};

const play = () => {
  if (timer.value) clearInterval(timer.value);
  timer.value = setInterval(() => {
    currentYear.value = currentYear.value < endYear.value ? currentYear.value + 1 : startYear.value;
  }, 1200);
};

const pause = () => {
  clearInterval(timer.value);
  timer.value = null;
};

watch(isPlaying, (newVal) => (newVal ? play() : pause()));
watch([currentYear, n], () => {
  if (!loading.value) {
    updateChart(currentYear.value);
  }
});

onMounted(() => {
  fetchData().then(() => {
    updateChart(currentYear.value);
  });
  window.addEventListener('resize', () => chartInstance?.resize());
});

onUnmounted(() => {
  pause();
  window.removeEventListener('resize', () => chartInstance?.resize());
  chartInstance?.dispose();
});
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;900&display=swap');

.bar-race-container {
  font-family: 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f8f9fa;
  padding: 2rem;
  border-radius: 16px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
  max-width: 1000px;
  margin: 2rem auto;
}

.chart-header {
  margin-bottom: 2rem;
  text-align: center;
}
.chart-header h1 {
  font-size: 2.25rem;
  font-weight: 900;
  color: #2c3e50;
  margin: 0;
}
.chart-header p {
  font-size: 1.1rem;
  color: #7f8c8d;
  margin-top: 0.5rem;
}

.controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem 2rem;
  padding: 1rem 1.5rem;
  background-color: #fff;
  border-radius: 12px;
  margin-bottom: 2rem;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.control-btn, .control-btn-text {
  display: flex;
  align-items: center;
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

.slider-container, .top-n-container {
  display: flex;
  align-items: center;
  gap: 0.8rem;
}
.slider-container {
  flex-grow: 1;
  min-width: 250px;
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
.year-display {
  font-weight: 700;
  font-size: 1.2rem;
  color: #2c3e50;
  min-width: 40px;
  background-color: #e9ecef;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
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

.chart-wrapper {
  position: relative;
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
}
.chart {
  width: 100%;
  height: 550px;
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

@media (max-width: 768px) {
  .bar-race-container { padding: 1rem; }
  .chart-header h1 { font-size: 1.8rem; }
  .chart-header p { font-size: 0.9rem; }
  .controls { flex-direction: column; align-items: stretch; }
}
</style>
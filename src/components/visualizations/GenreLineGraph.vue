<template>
  <div class="container-wrapper">
    <div class="chart-header">
      <h2 class="chart-title">Influence Trend of Oceanus Folk</h2>
      <div class="view-controls">
        <button 
          :class="{ active: viewMode === 'total' }" 
          @click="setViewMode('total')">
          总数趋势
        </button>
        <button 
          :class="{ active: viewMode === 'breakdown' }" 
          @click="setViewMode('breakdown')">
          分流派对比
        </button>
      </div>
    </div>
    
    <div class="chart-body">
      <div v-if="loading" class="loading-text">正在加载图表数据...</div>
      <VChart
        v-else
        class="chart"
        :option="chartOption"
        autoresize
        @mouseover="handleMouseOver"
        @mouseout="handleMouseOut"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent, GridComponent } from 'echarts/components';
import VChart from 'vue-echarts';

use([
  CanvasRenderer, BarChart, LineChart,
  TitleComponent, TooltipComponent, GridComponent,
]);

const loading = ref(true);
const processedData = ref(null);
const viewMode = ref('total');
const hoveredGenre = ref(null);

const getGenreColor = (genre) => {
  const palette = {
    'Dream Pop': '#8dd3c7', 'Indie Folk': '#fdb462', 'Desert Rock': '#b3de69',
    'Space Rock': '#fccde5', 'Synthwave': '#bebada', 'Americana': '#bc80bd',
    'Doom Metal': '#ccebc5', 'Jazz Surf Rock': '#ffed6f', 'Synthpop': '#80b1d3',
    'Post-Apocalyptic Folk': '#fb8072', 'default': '#d9d9d9'
  };
  return palette[genre] || palette['default'];
};

const processCompleteData = (data, startYear, endYear) => {
  if (!data || !data.years) return null;
  const fullYears = Array.from({ length: endYear - startYear + 1 }, (_, i) => String(startYear + i));
  const dataMap = new Map(data.years.map((year, index) => [
    String(year), { total: data.totalInfluenceByYear[index], breakdown: data.genreBreakdownByYear[index] }
  ]));
  const allGenres = new Set(data.genreBreakdownByYear.flatMap(yearGenres => Object.keys(yearGenres)));
  const newTotalInfluence = fullYears.map(year => dataMap.get(year)?.total || 0);
  const newGenreBreakdown = fullYears.map(year => dataMap.get(year)?.breakdown || {});
  return { years: fullYears, totalInfluenceByYear: newTotalInfluence, genreBreakdownByYear: newGenreBreakdown, allGenres: Array.from(allGenres) };
};

const chartOption = computed(() => {
  if (!processedData.value) return {};
  const data = processedData.value;
  
  const barSeries = data.allGenres.map(genre => ({
    name: genre, type: 'bar', stack: 'total',
    itemStyle: { color: getGenreColor(genre), opacity: 0.8 },
    data: data.years.map(year => data.genreBreakdownByYear[data.years.indexOf(year)]?.[genre] || 0)
  }));
  
  const lineSeries = {
    name: '影响总数', type: 'line', smooth: false, symbol: 'none', z: 10,
    lineStyle: { width: 2, color: '#005bea' },
    areaStyle: {
      color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(0, 91, 234, 0.3)' }, { offset: 1, color: 'rgba(0, 91, 234, 0)' }] },
      origin: 'start'
    },
    data: data.totalInfluenceByYear
  };

  let finalSeries = [];
  let tooltipConfig = {};

  if (viewMode.value === 'total') {
    finalSeries = [ ...barSeries, lineSeries ];
    tooltipConfig = {
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } },
      formatter: (params) => {
        const year = params[0].name;
        const total = data.totalInfluenceByYear[params[0].dataIndex];
        let breakdownHtml = params
            .filter(p => p.seriesType === 'bar' && p.value > 0)
            .sort((a, b) => b.value - a.value)
            .map(param => {
              const seriesName = param.seriesName;
              const isHovered = seriesName === hoveredGenre.value;
              const style = isHovered ? 'font-weight: 700; color: #000;' : 'font-weight: 400; color: #666;';
              return `<div style="${style}">${param.marker}${seriesName}: ${param.value}</div>`;
            })
            .join('');
        return `<strong>${year} 年</strong><br/>影响总数: <strong>${total}</strong><br/><hr style="margin: 5px 0; border-color: #eee;"/>${breakdownHtml}`;
      }
    };
  } else {
    finalSeries = barSeries.map(s => ({ ...s, emphasis: { focus: 'series' } }));
    tooltipConfig = {
      trigger: 'item',
      formatter: '{a}<br/>{b}年: {c}'
    };
  }

  return {
    // 【核心修改2】: 彻底移除 title 对象
    tooltip: tooltipConfig,
    legend: { show: false },
    // 【核心修改3】: grid 恢复默认，不再需要 top 偏移
    grid: { 
      top: '10%', // 保留一个小的百分比边距即可
      left: '3%', 
      right: '4%', 
      bottom: '3%', 
      containLabel: true 
    },
    xAxis: { type: 'category', boundaryGap: false, data: data.years },
    yAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed' } } },
    series: finalSeries,
    animationDurationUpdate: 200
  };
});

const setViewMode = (mode) => {
  viewMode.value = mode;
};

const handleMouseOver = (params) => {
  if (viewMode.value === 'total' && params.seriesType === 'bar') {
    hoveredGenre.value = params.seriesName;
  }
};

const handleMouseOut = () => {
  hoveredGenre.value = null;
};

onMounted(async () => {
  try {
    const response = await fetch('/mc1_q2_1_data.json');
    const rawData = await response.json();
    processedData.value = processCompleteData(rawData, 2017, 2034);
  } catch (error) {
    console.error('加载或处理图表数据时出错:', error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* 【核心修改4】: 新增的样式 */
.container-wrapper {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 20px;
  flex-shrink: 0; /* 防止头部被压缩 */
}

.chart-title {
  margin: 0;
  font-size: 1.2em;
  font-weight: 600;
  color: #333;
}

.chart-body {
  flex-grow: 1; /* 让图表主体填满剩余空间 */
  position: relative;
}

.chart {
  width: 100%;
  height: 100%;
}

.loading-text {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  color: #888;
}

.view-controls {
  display: flex;
  background-color: #f0f0f0;
  border-radius: 8px;
  padding: 4px;
}
.view-controls button {
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 500;
  color: #555;
  background-color: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}
.view-controls button.active {
  color: #fff;
  background-color: #005bea;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
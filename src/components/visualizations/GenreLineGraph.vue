<template>
  <div class="container-wrapper">
    <div class="chart-header">
      <h2 class="chart-title">Influence Over Time</h2> 
      <div class="view-controls">
        <button 
          :class="{ active: viewMode === 'total' }" 
          @click="setViewMode('total')">
          Total Amount
        </button>
        <button 
          :class="{ active: viewMode === 'breakdown' }" 
          @click="setViewMode('breakdown')">
          Genre Comparison
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
import { TitleComponent, TooltipComponent, GridComponent, LegendComponent } from 'echarts/components';
import VChart from 'vue-echarts';
import { appColors, getGenreColor } from '@/utils/colors'; // Import color definitions

use([
  CanvasRenderer, BarChart, LineChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
]);

const loading = ref(true);
const processedData = ref(null);
const viewMode = ref('total');
const hoveredGenre = ref(null);

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

// 修改：从原始数据动态确定年份范围，并扩展到2040年
const determineYearRange = (data) => {
  if (!data || !data.years || data.years.length === 0) {
    return { startYear: 2017, endYear: 2040 }; // 扩展默认范围到2040年
  }
  
  const years = data.years.map(year => parseInt(year));
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  
  // 确保至少显示到2040年，给用户看到完整的时间范围
  return {
    startYear: minYear,
    endYear: Math.max(maxYear, 2040)
  };
};

const chartOption = computed(() => {
  if (!processedData.value) return {};
  const data = processedData.value;
  
  const barSeries = data.allGenres.map(genre => ({
    name: genre, 
    type: 'bar', 
    stack: 'total',
    itemStyle: { 
      color: getGenreColor(genre),
      opacity: 0.9,
      borderColor: appColors.textSecondary, 
      borderWidth: 0.5, 
    },
    emphasis: {
      itemStyle: {
        opacity: 1,
        shadowBlur: 10,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowColor: 'rgba(0, 0, 0, 0.3)'
      }
    },
    data: data.years.map(year => data.genreBreakdownByYear[data.years.indexOf(year)]?.[genre] || 0)
  }));
  
  // 修改：调整折线图样式，使其更加美观
  const lineSeries = {
    name: '影响总数', 
    type: 'line', 
    smooth: true,  // 改为平滑曲线，更加美观
    symbol: 'circle',
    symbolSize: 6,  // 稍微减小点的大小
    z: 10,
    lineStyle: { 
      width: 2,  // 从3改为2，使折线更细更美观
      color: appColors.primaryAccent
    },
    itemStyle: {
      color: appColors.primaryAccent,
      borderColor: '#fff',
      borderWidth: 2
    },
    areaStyle: {
      color: { 
        type: 'linear', 
        x: 0, y: 0, x2: 0, y2: 1, 
        colorStops: [
          { offset: 0, color: appColors.primaryAccent + '40' }, // 降低透明度
          { offset: 1, color: appColors.primaryAccent + '00' }
        ] 
      },
      origin: 'start'
    },
    data: data.totalInfluenceByYear
  };

  let finalSeries = [];
  let tooltipConfig = {};
  let legendConfig = { show: false };

  if (viewMode.value === 'total') {
    finalSeries = [ ...barSeries, lineSeries ];
    tooltipConfig = {
      trigger: 'axis',
      axisPointer: { type: 'cross', label: { backgroundColor: appColors.textPrimary } },
      backgroundColor: appColors.surface,
      borderColor: appColors.border,
      borderWidth: 1,
      textStyle: {
        color: appColors.textPrimary
      },
      formatter: (params) => {
        const year = params[0].name;
        const total = data.totalInfluenceByYear[params[0].dataIndex];
        let breakdownHtml = params
            .filter(p => p.seriesType === 'bar' && p.value > 0)
            .sort((a, b) => b.value - a.value)
            .map(param => {
              const seriesName = param.seriesName;
              const isHovered = seriesName === hoveredGenre.value;
              const style = isHovered ? `font-weight: 700; color: ${appColors.textPrimary};` : `font-weight: 400; color: ${appColors.textSecondary};`;
              return `<div style="${style}">${param.marker}${seriesName}: ${param.value}</div>`;
            })
            .join('');
        return `<strong>${year} 年</strong><br/>影响总数: <strong>${total}</strong><br/><hr style="margin: 5px 0; border-color: ${appColors.border};"/>${breakdownHtml}`;
      }
    };
  } else {
    finalSeries = barSeries.map(s => ({ ...s, emphasis: { focus: 'series' } }));
    tooltipConfig = {
      trigger: 'item',
      backgroundColor: appColors.surface,
      borderColor: appColors.border,
      borderWidth: 1,
      textStyle: {
        color: appColors.textPrimary
      },
      formatter: '{a}<br/>{b}年: {c}'
    };
    legendConfig = {
      show: true,
      type: 'scroll',
      bottom: 10,
      left: 'center',
      textStyle: {
        color: appColors.textSecondary
      },
      itemGap: 15,
      itemWidth: 12,
      itemHeight: 12
    };
  }

  return {
    tooltip: tooltipConfig,
    legend: legendConfig,
    grid: { 
      top: viewMode.value === 'total' ? '10%' : '15%',
      left: '3%', 
      right: '4%', 
      bottom: viewMode.value === 'total' ? '3%' : '15%',
      containLabel: true 
    },
    xAxis: { 
      type: 'category', 
      boundaryGap: false, 
      data: data.years,
      axisLine: { lineStyle: { color: appColors.border } },
      axisLabel: { 
        color: appColors.textSecondary,
        interval: 'auto'  // 自动调整标签间隔，避免年份标签过于密集
      }
    },
    yAxis: { 
      type: 'value', 
      splitLine: { lineStyle: { type: 'dashed', color: appColors.border + '80' } },
      axisLine: { lineStyle: { color: appColors.border } },
      axisLabel: { color: appColors.textSecondary }
    },
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
    // 使用修正后的数据文件
    const response = await fetch('/mc1_q2_1_data_fixed.json');
    const rawData = await response.json();
    
    // 动态确定年份范围，并扩展到2040年
    const { startYear, endYear } = determineYearRange(rawData);
    console.log(`Using dynamic year range: ${startYear} - ${endYear}`);
    console.log('Raw data years:', rawData.years); // 打印原始数据年份，帮助调试
    
    processedData.value = processCompleteData(rawData, startYear, endYear);
  } catch (error) {
    console.error('Failed to load or process chart data:', error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
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
  flex-shrink: 0;
}

.chart-title {
  margin: 0;
  font-size: 1.2em;
  font-weight: 600;
  color: var(--color-text-primary);
}

.chart-body {
  flex-grow: 1;
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
  color: var(--color-text-light);
}

.view-controls {
  display: flex;
  background-color: var(--color-background);
  border-radius: 8px;
  padding: 4px;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
}
.view-controls button {
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  background-color: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
}
.view-controls button.active {
  color: var(--color-surface);
  background-color: var(--color-primary-accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}
</style>
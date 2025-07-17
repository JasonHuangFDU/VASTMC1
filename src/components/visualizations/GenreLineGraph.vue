<template>
  <div class="container-wrapper">
    <div class="chart-header">
      <h2 class="chart-title">Influence Over Time</h2> 
      <div class="header-controls">
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
        <div class="notable-filter">
          <label class="notable-checkbox">
            <input 
              type="checkbox" 
              v-model="showNotableOnly"
              @change="handleNotableFilterChange"
            />
            <span class="checkmark"></span>
            Notable Only
          </label>
        </div>
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
const rawDataRef = ref(null);
const processedData = ref(null);
const viewMode = ref('total');
const showNotableOnly = ref(false);
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

// 处理数据筛选
const processDataWithFilter = () => {
  if (!rawDataRef.value) return;
  
  const selectedData = showNotableOnly.value ? rawDataRef.value.notable_data : rawDataRef.value.all_data;
  const { startYear, endYear } = determineYearRange(selectedData);
  
  console.log(`Using dynamic year range: ${startYear} - ${endYear}`);
  console.log(`Filter mode: ${showNotableOnly.value ? 'Notable Only' : 'All Data'}`);
  console.log('Selected data years:', selectedData.years);
  
  processedData.value = processCompleteData(selectedData, startYear, endYear);
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
  
  // 调整折线图样式，使其更加美观
  const lineSeries = {
    name: showNotableOnly.value ? 'Notable影响总数' : '影响总数', 
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
        const filterText = showNotableOnly.value ? ' (Notable Only)' : '';
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
        return `<strong>${year} 年${filterText}</strong><br/>影响总数: <strong>${total}</strong><br/><hr style="margin: 5px 0; border-color: ${appColors.border};"/>${breakdownHtml}`;
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
      formatter: (params) => {
        const filterText = showNotableOnly.value ? ' (Notable Only)' : '';
        return `${params.seriesName}<br/>${params.name}年${filterText}: ${params.value}`;
      }
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

const handleNotableFilterChange = () => {
  processDataWithFilter();
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
    const response = await fetch('/mc1_q2_1_data_new.json');
    const rawData = await response.json();
    
    rawDataRef.value = rawData;
    
    // 初始处理数据（默认显示所有数据）
    processDataWithFilter();
    
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

.header-controls {
  display: flex;
  align-items: center;
  gap: 20px;
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

.notable-filter {
  display: flex;
  align-items: center;
}

.notable-checkbox {
  display: flex;
  align-items: center;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
  user-select: none;
  position: relative;
}

.notable-checkbox input[type="checkbox"] {
  position: absolute;
  opacity: 0;
  cursor: pointer;
}

.checkmark {
  position: relative;
  width: 16px;
  height: 16px;
  background-color: var(--color-surface);
  border: 2px solid var(--color-border);
  border-radius: 4px;
  margin-right: 8px;
  transition: all 0.2s ease;
}

.notable-checkbox input[type="checkbox"]:checked + .checkmark {
  background-color: var(--color-primary-accent);
  border-color: var(--color-primary-accent);
}

.notable-checkbox input[type="checkbox"]:checked + .checkmark::after {
  content: "";
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.notable-checkbox:hover .checkmark {
  border-color: var(--color-primary-accent);
}

.notable-checkbox:hover {
  color: var(--color-text-primary);
}
</style>
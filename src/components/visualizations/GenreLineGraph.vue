<template>
  <div class="container-wrapper">
    <div class="chart-header">
      <div class="header-controls">
        <div class="view-controls">
          <button 
            :class="{ active: viewMode === 'breakdown' }" 
            @click="toggleViewMode">
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
      <div v-if="loading" class="loading-text">Loading...</div>
      <VChart
        v-else
        class="chart"
        :option="chartOption"
        autoresize
        @mouseover="handleMouseOver"
        @mouseout="handleMouseOut"
        @legendselectchanged="handleLegendSelectChanged"
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
import { appColors, getGenreColor } from '@/utils/colors';

use([
  CanvasRenderer, BarChart, LineChart,
  TitleComponent, TooltipComponent, GridComponent, LegendComponent,
]);

const loading = ref(true);
const rawDataRef = ref(null);
const processedData = ref(null);
const viewMode = ref('total'); // 默认显示组合图
const showNotableOnly = ref(false);
const hoveredGenre = ref(null);
const selectedGenres = ref({}); // 存储图例选择状态
const activeGenre = ref(null); // 当前激活的流派

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

const determineYearRange = (data) => {
  if (!data || !data.years || data.years.length === 0) {
    return { startYear: 2017, endYear: 2040 };
  }
  
  const years = data.years.map(year => parseInt(year));
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  
  return {
    startYear: minYear,
    endYear: Math.max(maxYear, 2040)
  };
};

const processDataWithFilter = () => {
  if (!rawDataRef.value) return;
  
  const selectedData = showNotableOnly.value ? rawDataRef.value.notable_data : rawDataRef.value.all_data;
  const { startYear, endYear } = determineYearRange(selectedData);
  
  console.log(`Using dynamic year range: ${startYear} - ${endYear}`);
  console.log(`Filter mode: ${showNotableOnly.value ? 'Notable Only' : 'All Data'}`);
  console.log('Selected data years:', selectedData.years);
  
  processedData.value = processCompleteData(selectedData, startYear, endYear);
  
  // 初始化所有图例为选中状态
  if (processedData.value && processedData.value.allGenres) {
    selectedGenres.value = {};
    processedData.value.allGenres.forEach(genre => {
      selectedGenres.value[genre] = true;
    });
  }
};

// 计算Y轴最大值
const calculateYAxisMax = () => {
  if (!processedData.value || viewMode.value !== 'breakdown') return 'dataMax';
  
  const data = processedData.value;
  let maxValue = 0;
  
  // 如果有激活的流派，只计算该流派的最大值
  if (activeGenre.value && selectedGenres.value[activeGenre.value]) {
    data.years.forEach((year, index) => {
      const value = data.genreBreakdownByYear[index]?.[activeGenre.value] || 0;
      maxValue = Math.max(maxValue, value);
    });
    return Math.ceil(maxValue * 1.1); // 留10%的空间
  }
  
  // 否则计算所有选中流派的堆叠最大值
  data.years.forEach((year, index) => {
    let stackValue = 0;
    data.allGenres.forEach(genre => {
      if (selectedGenres.value[genre]) {
        stackValue += data.genreBreakdownByYear[index]?.[genre] || 0;
      }
    });
    maxValue = Math.max(maxValue, stackValue);
  });
  
  return Math.ceil(maxValue * 1.1);
};

const chartOption = computed(() => {
  if (!processedData.value) return {};
  const data = processedData.value;
  
  const barSeries = data.allGenres.map(genre => {
    const isActive = activeGenre.value === genre;
    const isSelected = selectedGenres.value[genre] !== false;
    
    return {
      name: genre, 
      type: 'bar', 
      stack: 'total',
      itemStyle: { 
        color: getGenreColor(genre),
        opacity: viewMode.value === 'breakdown' && activeGenre.value && !isActive ? 0.2 : 0.9,
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
      data: data.years.map(year => data.genreBreakdownByYear[data.years.indexOf(year)]?.[genre] || 0),
      animation: true,
      animationDuration: 300
    };
  });
  
  const lineSeries = {
    name: showNotableOnly.value ? 'Notable影响总数' : 'Influence', 
    type: 'line', 
    smooth: true,
    symbol: 'circle',
    symbolSize: 6,
    z: 10,
    lineStyle: { 
      width: 2,
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
          { offset: 0, color: appColors.primaryAccent + '40' },
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
      axisPointer: { 
        type: 'line',
        lineStyle: {
          color: appColors.border,
          width: 1,
          type: 'solid'
        },
        label: {
          show: false
        }
      },
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
      trigger: 'axis',
      axisPointer: {
        type: 'line',
        axis: 'x',
        lineStyle: {
          color: appColors.border,
          width: 1,
          type: 'solid'
        },
        label: {
          show: false
        }
      },
      backgroundColor: appColors.surface,
      borderColor: appColors.border,
      borderWidth: 1,
      textStyle: {
        color: appColors.textPrimary
      },
      formatter: (params) => {
        const year = params[0].name;
        const filterText = showNotableOnly.value ? ' (Notable Only)' : '';
        let breakdownHtml = params
            .filter(p => p.value > 0)
            .sort((a, b) => b.value - a.value)
            .map(param => {
              const style = `color: ${appColors.textSecondary};`;
              return `<div style="${style}">${param.marker}${param.seriesName}: ${param.value}</div>`;
            })
            .join('');
        return `<strong>${year} 年${filterText}</strong><br/>${breakdownHtml}`;
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
      itemHeight: 12,
      selected: selectedGenres.value,
      inactiveColor: appColors.textSecondary + '40',
      formatter: (name) => {
        return activeGenre.value === name ? `{active|${name}}` : name;
      },
      textStyle: {
        rich: {
          active: {
            color: appColors.primaryAccent,
            fontWeight: 'bold'
          }
        }
      }
    };
  }

  return {
    tooltip: tooltipConfig,
    legend: legendConfig,
    grid: { 
      top: viewMode.value === 'total' ? '5%' : '10%',
      left: '3%', 
      right: '4%', 
      bottom: viewMode.value === 'total' ? '3%' : '15%',
      containLabel: true 
    },
    axisPointer: {
      link: { xAxisIndex: 'all' },
      label: {
        backgroundColor: appColors.textPrimary
      }
    },
    xAxis: { 
      type: 'category', 
      boundaryGap: false, 
      data: data.years,
      axisLine: { lineStyle: { color: appColors.border } },
      axisLabel: { 
        color: appColors.textSecondary,
        interval: 'auto'
      },
      axisPointer: {
        show: true,
        type: 'line',
        lineStyle: {
          color: appColors.border,
          width: 1,
          type: 'solid'
        },
        label: {
          show: true,
          backgroundColor: appColors.textPrimary
        }
      }
    },
    yAxis: { 
      type: 'value',
      max: calculateYAxisMax(),
      splitLine: { lineStyle: { type: 'dashed', color: appColors.border + '80' } },
      axisLine: { lineStyle: { color: appColors.border } },
      axisLabel: { color: appColors.textSecondary },
      axisPointer: {
        show: false
      }
    },
    series: finalSeries,
    animationDurationUpdate: 300
  };
});

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'total' ? 'breakdown' : 'total';
  activeGenre.value = null; // 重置激活状态
};

const handleNotableFilterChange = () => {
  processDataWithFilter();
  activeGenre.value = null; // 重置激活状态
};

const handleMouseOver = (params) => {
  if (viewMode.value === 'total' && params.seriesType === 'bar') {
    hoveredGenre.value = params.seriesName;
  }
};

const handleMouseOut = () => {
  hoveredGenre.value = null;
};

// 处理图例选择变化
const handleLegendSelectChanged = (params) => {
  selectedGenres.value = params.selected;
  
  // 在 breakdown 模式下，处理单选逻辑
  if (viewMode.value === 'breakdown') {
    const changedGenre = Object.keys(params.selected).find(
      key => params.selected[key] !== (activeGenre.value === key)
    );
    
    if (changedGenre) {
      // 如果点击的是当前激活的流派，取消激活状态
      if (changedGenre === activeGenre.value) {
        activeGenre.value = null;
        // 恢复所有流派为选中状态
        Object.keys(selectedGenres.value).forEach(genre => {
          selectedGenres.value[genre] = true;
        });
      } else {
        // 激活新的流派
        activeGenre.value = changedGenre;
        // 只保留当前流派为选中状态
        Object.keys(selectedGenres.value).forEach(genre => {
          selectedGenres.value[genre] = genre === changedGenre;
        });
      }
    }
  }
};

onMounted(async () => {
  try {
    const response = await fetch('/mc1_q2_1_data_new.json');
    const rawData = await response.json();
    
    rawDataRef.value = rawData;
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
  justify-content: center;
  align-items: center;
  padding: 8px 16px;
  flex-shrink: 0;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 16px;
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
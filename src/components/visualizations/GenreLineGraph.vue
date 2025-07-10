<template>
  <div class="chart-container">
    <div v-if="loading" class="loading-text">正在加载图表数据...</div>
    <VChart v-else class="chart" :option="chartOption" autoresize />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { use } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { BarChart, LineChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  ToolboxComponent,
} from 'echarts/components';
import VChart from 'vue-echarts';

// 按需引入 ECharts 组件
use([
  CanvasRenderer,
  BarChart,
  LineChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  ToolboxComponent,
]);

// 定义响应式变量
const loading = ref(true);
const chartOption = ref({});

// 组件挂载后执行
onMounted(async () => {
  try {
    // 确保您使用的是正确的数据文件
    const response = await fetch('/mc1_q2_1_data.json'); 
    if (!response.ok) {
      throw new Error('网络请求失败');
    }
    const data = await response.json();

    // --- 数据转换逻辑 (保持不变) ---
    const allGenres = new Set();
    data.genreBreakdownByYear.forEach(yearGenres => {
      Object.keys(yearGenres).forEach(genre => {
        allGenres.add(genre);
      });
    });
    const genreList = Array.from(allGenres);

    // 在这里，我们不再需要为 genreSeries 指定 yAxisIndex，
    // 因为我们将在最后统一设置。
    const genreSeries = genreList.map(genre => {
      return {
        name: genre,
        type: 'bar',
        stack: 'GenreStack',
        emphasis: {
          focus: 'series'
        },
        data: data.genreBreakdownByYear.map(yearGenres => yearGenres[genre] || 0)
      };
    });

    // --- ECharts 配置项 (亮色主题) ---
    chartOption.value = {
      backgroundColor: '#ffffff',
      title: {
        text: data.title,
        subtext: data.description,
        left: 'center',
        textStyle: {
          color: '#333'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
          crossStyle: {
            color: '#999'
          }
        }
      },
      toolbox: {
        feature: {
          dataView: { show: true, readOnly: false, title: '数据视图' },
          magicType: { show: true, type: ['line', 'bar', 'stack'], title: {line: '切换为折线图', bar: '切换为柱状图', stack: '切换为堆叠'} },
          restore: { show: true, title: '还原' },
          saveAsImage: { show: true, title: '保存为图片' }
        },
        iconStyle: {
            borderColor: '#666'
        }
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',
        right: 10,
        top: '15%',
        bottom: 20,
        data: ['Annual Additions', ...genreList],
        textStyle: {
          color: '#333'
        }
      },
      grid: {
        left: '3%',
        right: '15%',
        bottom: '3%',
        containLabel: true
      },
      xAxis: [{
        type: 'category',
        data: data.years,
        axisPointer: {
          type: 'shadow'
        },
        axisLabel: {
            color: '#333'
        }
      }],
      yAxis: [
        {
          // 【修改 1】: 左侧 Y 轴，移除了 name 属性
          type: 'value',
          axisLine: { show: true, lineStyle: { color: '#ccc' } },
          axisLabel: { color: '#333' },
          splitLine: { lineStyle: { type: 'dashed', color: '#eee' } }
        },
        {
          // 【修改 2】: 右侧 Y 轴，直接隐藏
          show: false,
          type: 'value',
        }
      ],
      series: [
        {
          name: '影响总数',
          type: 'line',
          yAxisIndex: 0, // 确保关联到左侧可见轴
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            width: 3,
            color: '#005bea'
          },
          itemStyle: {
            color: '#005bea'
          },
          data: data.totalInfluenceByYear
        },
        // 【修改 3】: 确保所有柱状图系列也关联到左侧可见轴
        ...genreSeries.map(s => ({ ...s, yAxisIndex: 0 }))
      ]
    };

  } catch (error) {
    console.error('加载或处理图表数据时出错:', error);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.chart-container {
  position: relative;
  height: 70vh;
  width: 100%;
  background-color: #ffffff;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #eee;
}

.chart {
  height: 100%;
  width: 100%;
}

.loading-text {
  color: #333;
  text-align: center;
  padding-top: 40px;
}
</style>
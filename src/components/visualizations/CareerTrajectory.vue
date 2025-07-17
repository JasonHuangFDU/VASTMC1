<!-- /components/visualizations/CareerTrajectory.vue -->
<template>
  <div class="career-trajectory">
    <!-- 艺术家选择面板 -->
    <div class="artist-selection">
      <h3>选择三名艺术家进行生涯轨迹对比</h3>
      <div class="selectors">
        <div v-for="(artist, index) in selectedArtists" :key="index" class="selector">
          <label>艺术家 {{ index + 1 }}:</label>
          <select v-model="selectedArtists[index]">
            <option value="">请选择艺术家</option>
            <option
              v-for="person in artistList"
              :key="person.id"
              :value="person.id"
              :disabled="selectedArtists.includes(person.id) && selectedArtists[index] !== person.id"
            >
              {{ person.name }}
            </option>
          </select>
          <button
            v-if="selectedArtists[index]"
            class="clear-btn"
            @click="clearArtist(index)"
          >
            ×
          </button>
        </div>
      </div>
      <button
        class="compare-btn"
        :disabled="!canCompare"
        @click="loadComparisonData"
      >
        开始对比
      </button>
    </div>

    <!-- 主图表容器 -->
    <div v-if="comparisonData.length" class="chart-container">
      <div class="chart-wrapper" ref="chartWrapper">
        <canvas ref="mainChart" @mousemove="handleChartHover" @mouseleave="hideTooltip"></canvas>
      </div>
    </div>

    <!-- 自定义工具提示 -->
    <div v-if="showTooltip" class="custom-tooltip" :style="tooltipStyle">
      <div class="tooltip-header">
        <span class="year">{{ hoverYear }}</span> 年
      </div>
      <div class="tooltip-content">
        <div v-for="(artist, index) in hoverData" :key="index" class="artist-info">
          <div class="artist-color" :style="{ backgroundColor: getArtistColor(index) }"></div>
          <div class="artist-details">
            <div class="artist-name">{{ artist.name }}</div>
            <div class="artist-stats">
              <div class="stat-item">
                <span class="stat-label">累计影响力:</span>
                <span class="stat-value">{{ artist.cumulativeInfluence.toFixed(1) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">新作品:</span>
                <span class="stat-value">{{ artist.workCount }} 首</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">合作:</span>
                <span class="stat-value">{{ artist.collabCount }} 次</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据加载状态 -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>加载艺术家生涯数据中...</p>
    </div>

    <!-- 空状态提示 -->
    <div v-if="!loading && !comparisonData.length" class="empty-state">
      <div class="placeholder">
        <div class="icon">📊</div>
        <p>请选择三位艺术家进行生涯轨迹对比</p>
        <p>系统将展示他们的影响力、合作频率和受欢迎程度随时间的变化</p>
      </div>
    </div>

    <!-- 艺术家潜力预测组件 -->
    <ArtistPotentialPrediction @prediction-complete="handlePredictionComplete" />
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as d3 from 'd3';
import Chart from 'chart.js/auto';
import ArtistPotentialPrediction from './ArtistPotentialPrediction.vue';
import { processArtistData } from '@/services/dataService';

// 定义默认艺术家的ID
const DEFAULT_ARTIST_IDS = [17255, 17155, 17126];

export default {
  name: 'CareerTrajectory',
  components: {
    ArtistPotentialPrediction
  },
  setup() {
    const graphData = ref(null);
    const selectedArtists = ref([null, null, null]);
    const comparisonData = ref([]);
    const loading = ref(false);
    const mainChart = ref(null);
    let mainChartInstance = null;
    let sortedYears = [];

    // 悬停交互状态
    const showTooltip = ref(false);
    const tooltipStyle = ref({ left: '0px', top: '0px' });
    const hoverYear = ref('');
    const hoverData = ref([]);

    // 添加水平参考线状态
    const hoverLine = ref({
      show: false,
      year: null,
      position: 0
    });

    // 获取所有艺术家（Person节点）
    const artistList = computed(() => {
      if (!graphData.value || !graphData.value.nodes) return [];
      return graphData.value.nodes.filter(node =>
        node['Node Type'] === 'Person' && node.name
      ).sort((a, b) => a.name.localeCompare(b.name));
    });

    // 检查是否可以开始对比
    const canCompare = computed(() => {
      return selectedArtists.value.filter(id => id !== null).length === 3;
    });

    // 清除选中的艺术家
    const clearArtist = (index) => {
      selectedArtists.value[index] = null;
      comparisonData.value = [];
      destroyCharts();
      hideTooltip();
    };

    // 加载图数据
    const loadGraphData = async () => {
      if (graphData.value) return;

      try {
        loading.value = true;
        graphData.value = await d3.json('/MC1_graph.json');
        console.log('图数据加载完成', graphData.value);

        // 设置默认艺术家
        selectedArtists.value = [...DEFAULT_ARTIST_IDS];

        // 使用 nextTick 确保在设置默认艺术家后加载对比数据
        nextTick(() => {
          console.log("加载默认艺术家对比数据");
          loadComparisonData();
        });
      } catch (error) {
        console.error('加载图数据失败:', error);
      } finally {
        loading.value = false;
      }
    };

    // 加载对比数据
    const loadComparisonData = async () => {
      if (!graphData.value) {
        await loadGraphData();
      }

      if (!graphData.value) {
        console.error('图数据未加载');
        return;
      }

      loading.value = true;
      comparisonData.value = [];
      destroyCharts();
      hideTooltip();

      try {
        console.log("开始加载对比数据，艺术家ID:", selectedArtists.value);

        // 获取三位艺术家的生涯数据
        const artistIds = selectedArtists.value.filter(id => id !== null);
        const results = [];

        // 先收集所有年份
        const allYears = new Set();

        for (const id of artistIds) {
          const careerData = processArtistData(graphData.value, id);
          if (careerData && careerData.yearlyStats) {
            Object.keys(careerData.yearlyStats).forEach(year => allYears.add(parseInt(year)));
          }
        }

        // 转换为排序后的数组
        const sortedGlobalYears = Array.from(allYears).sort((a, b) => a - b);

        for (const id of artistIds) {
          const careerData = processArtistData(graphData.value, id);
          if (careerData) {
            const artistNode = graphData.value.nodes.find(n => n.id === id);

            // 计算累计影响力
            let cumulativeInfluence = 0;
            const cumulativeInfluenceByYear = {};

            // 按年份顺序计算累计影响力
            sortedGlobalYears.forEach(year => {
              if (careerData.yearlyStats && careerData.yearlyStats[year]) {
                cumulativeInfluence += careerData.yearlyStats[year].influence;
              }
              cumulativeInfluenceByYear[year] = cumulativeInfluence;
            });

            // 添加累计影响力数据
            careerData.cumulativeInfluenceByYear = cumulativeInfluenceByYear;

            results.push({
              id,
              data: careerData,
              name: artistNode?.name || `艺术家 ${id}`
            });
          }
        }

        comparisonData.value = results;
        console.log("对比数据加载完成", results);

        // 渲染图表
        setTimeout(renderCharts, 100);
      } catch (error) {
        console.error('加载对比数据失败:', error);
      } finally {
        loading.value = false;
      }
    };

    // 渲染所有图表
    const renderCharts = () => {
      if (!mainChart.value || !comparisonData.value.length) return;

      // 销毁旧图表实例
      destroyCharts();

      // 获取所有年份
      const allYears = new Set();
      comparisonData.value.forEach(artist => {
        if (artist.data.yearlyStats) {
          Object.keys(artist.data.yearlyStats).forEach(year => allYears.add(parseInt(year)));
        }
      });

      sortedYears = Array.from(allYears).sort((a, b) => a - b);

      // 计算图表高度 - 每1年50px
      const minHeight = 500;
      const height = Math.max(minHeight, sortedYears.length * 50);

      // 设置图表容器高度（不再设置固定宽度）
      const chartWrapper = document.querySelector('.chart-wrapper');
      if (chartWrapper) {
        chartWrapper.style.height = `${height}px`;
      }

      // 设置主图表尺寸（使用容器宽度）
      const containerWidth = chartWrapper.clientWidth;
      mainChart.value.width = containerWidth;
      mainChart.value.height = height;

      // 渲染主图表
      renderMainChart();
    };

    // 渲染主图表（影响力、作品发布、合作）
    const renderMainChart = () => {
      // 准备数据集
      const datasets = [];

      // 1. 影响力折线图（累计影响力）
      comparisonData.value.forEach((artist, index) => {
        const color = getArtistColor(index);

        // 使用累计影响力数据
        const cumulativeInfluenceData = sortedYears.map(year => {
          const influence = artist.data.cumulativeInfluenceByYear?.[year] || 0;
          return {
            y: year.toString(),
            x: influence
          };
        });

        // 添加折线数据集
        datasets.push({
          type: 'line',
          label: `${artist.name} - 累计影响力`,
          data: cumulativeInfluenceData,
          borderColor: color,
          backgroundColor: 'transparent',
          tension: 0.3,
          xAxisID: 'x',
          yAxisID: 'y',
          pointRadius: 0,
          borderWidth: 3,
        });

        // 2. 添加作品发布事件标记
        const eventPoints = [];
        if (artist.data.yearlyStats) {
          sortedYears.forEach(year => {
            if (artist.data.yearlyStats[year]) {
              const releaseCount = artist.data.yearlyStats[year].workCount || 0;
              const notableCount = artist.data.yearlyStats[year].notableCount || 0; // 获取重要作品数

              if (releaseCount > 0) {
                // 查找该年份的累计影响力值
                const influenceEntry = cumulativeInfluenceData.find(d => d.y === year.toString());

                eventPoints.push({
                  y: year.toString(),
                  x: influenceEntry ? influenceEntry.x : 0,
                  count: releaseCount,
                  notableCount: notableCount // 存储重要作品数
                });
              }
            }
          });
        }

        // 计算点半径范围
        const maxCount = Math.max(...eventPoints.map(p => p.count), 1);
        const minRadius = 4;
        const maxRadius = 12;

        datasets.push({
          type: 'scatter',
          label: `${artist.name} - 作品发布`,
          data: eventPoints,
          pointStyle: 'rectRot',
          pointRadius: eventPoints.map(p => minRadius + (p.count / maxCount) * (maxRadius - minRadius)),
          pointHoverRadius: eventPoints.map(p => minRadius + (p.count / maxCount) * (maxRadius - minRadius) + 5),
          backgroundColor: color,
          // 根据重要作品数设置样式
          borderColor: eventPoints.map(p =>
            p.notableCount > 0 ? '#00CED1' : 'white' // 重要作品
          ),
          borderWidth: eventPoints.map(p =>
            p.notableCount > 0 ? 3 : 2 // 重要作品边框加粗
          ),
          xAxisID: 'x',
          yAxisID: 'y'
        });
      });

      // 3. 合作频率条形图
      comparisonData.value.forEach((artist, index) => {
        const color = getArtistColor(index);

        const collabData = sortedYears.map(year => {
          let value = 0;
          if (artist.data.yearlyStats[year]) {
            const roles = artist.data.yearlyStats[year].collabRoles || {};
            value = Object.values(roles).reduce((sum, count) => sum + count, 0);
          }
          return {
            y: year.toString(),
            x: value
          };
        });

        datasets.push({
          type: 'bar',
          label: `${artist.name} - 合作`,
          data: collabData,
          backgroundColor: `${color}80`,
          borderColor: color,
          borderWidth: 1,
          xAxisID: 'x1',
          yAxisID: 'y',
          barPercentage: 0.6,
          categoryPercentage: 0.8
        });
      });

      // 创建主图表
      mainChartInstance = new Chart(mainChart.value, {
        data: {
          datasets: datasets
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          indexAxis: 'y', // 关键修改：设置为纵向图表
          interaction: {
            mode: 'index',
            intersect: false
          },
          onHover: () => {
            // 在Chart.js中禁用默认的tooltip
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                filter: item => {
                  return item.text.includes('影响力') || item.text.includes('作品发布');
                },
                font: {
                  size: 14
                },
                usePointStyle: true,
                padding: 20
              }
            },
            tooltip: {
              enabled: false // 禁用默认tooltip
            }
          },
          scales: {
            y: {
              title: {
                display: true,
                text: '年份',
                font: {
                  size: 14,
                  weight: 'bold'
                }
              },
              ticks: {
                font: {
                  size: 12
                }
              },
              grid: {
                display: false
              }
            },
            x: {
              position: 'top',
              title: {
                display: true,
                text: '累计影响力分数',
                font: {
                  size: 14,
                  weight: 'bold'
                }
              },
              ticks: {
                font: {
                  size: 12
                }
              },
              beginAtZero: true
            },
            x1: {
              position: 'bottom',
              title: {
                display: true,
                text: '合作次数',
                font: {
                  size: 14,
                  weight: 'bold'
                }
              },
              ticks: {
                font: {
                  size: 12
                }
              },
              beginAtZero: true,
              grid: {
                drawOnChartArea: false
              }
            }
          }
        },
        // 添加插件绘制水平参考线
        plugins: [{
          id: 'hoverLinePlugin',
          afterDraw: (chart) => {
            if (!hoverLine.value.show) return;

            const ctx = chart.ctx;
            const yPos = hoverLine.value.position;

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([5, 3]);
            ctx.moveTo(0, yPos);
            ctx.lineTo(chart.width, yPos);
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
          }
        }]
      });
    };

    // 为不同艺术家分配颜色
    const getArtistColor = (index) => {
      const colors = ['#4e79a7', '#f28e2c', '#e15759']; // 蓝、橙、红
      return colors[index % colors.length];
    };

    // 处理图表悬停事件 - 修改后版本
    const handleChartHover = (event) => {
      if (!mainChartInstance || !comparisonData.value.length) return;

      // 获取canvas位置和鼠标坐标
      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const mouseY = event.clientY - rect.top;

      // 获取Y轴比例尺
      const yAxis = mainChartInstance.scales.y;
      if (!yAxis) return;

      // 计算年份索引
      const yearIndex = Math.round(
        (mouseY - yAxis.top) / (yAxis.bottom - yAxis.top) * (sortedYears.length - 1)
      );

      // 确保索引在有效范围内
      if (yearIndex < 0 || yearIndex >= sortedYears.length) {
        hideTooltip();
        hoverLine.value.show = false;
        return;
      }

      const year = sortedYears[yearIndex];

      // 更新水平线位置
      const yPos = yAxis.getPixelForValue(year.toString());
      hoverLine.value = {
        show: true,
        year,
        position: yPos
      };

      // 收集该年份所有艺术家的数据
      const artistData = comparisonData.value.map(artist => {
        const yearStats = artist.data.yearlyStats[year] || {};
        return {
          id: artist.id,
          name: artist.name,
          cumulativeInfluence: artist.data.cumulativeInfluenceByYear?.[year] || 0, // 累计影响力
          workCount: yearStats.workCount || 0,
          collabCount: yearStats.collabRoles
            ? Object.values(yearStats.collabRoles).reduce((sum, count) => sum + count, 0)
            : 0
        };
      });

      // 更新悬停状态
      showTooltip.value = true;
      hoverYear.value = year;
      hoverData.value = artistData;

      // 定位工具提示 - 优化定位逻辑
      const tooltipWidth = 300;
      const tooltipHeight = artistData.length * 70 + 50;
      let left = event.clientX + 20;
      let top = event.clientY + 20;

      // 确保工具提示不会超出屏幕
      if (left + tooltipWidth > window.innerWidth) {
        left = event.clientX - tooltipWidth - 20;
      }

      if (top + tooltipHeight > window.innerHeight) {
        top = window.innerHeight - tooltipHeight - 10;
      }

      tooltipStyle.value = {
        left: `${left}px`,
        top: `${top}px`
      };
    };

    // 隐藏工具提示
    const hideTooltip = () => {
      showTooltip.value = false;
      hoverLine.value.show = false;
    };

    // 销毁所有图表实例
    const destroyCharts = () => {
      if (mainChartInstance) {
        mainChartInstance.destroy();
        mainChartInstance = null;
      }
    };

    // 处理预测完成事件
    const handlePredictionComplete = (artistIds) => {
      // 确保有3个艺术家ID
      if (artistIds.length === 3) {
        selectedArtists.value = artistIds;
        loadComparisonData();
      }
    };

    // 组件挂载时加载图数据
    onMounted(() => {
      loadGraphData();
      window.addEventListener('resize', handleResize);
    });

    // 组件卸载时清理
    onBeforeUnmount(() => {
      destroyCharts();
      window.removeEventListener('resize', handleResize);
    });

    // 窗口大小变化时重新渲染图表
    const handleResize = () => {
      if (comparisonData.value.length) {
        renderCharts();
      }
    };

    return {
      selectedArtists,
      comparisonData,
      loading,
      artistList,
      canCompare,
      mainChart,
      clearArtist,
      loadComparisonData,
      showTooltip,
      tooltipStyle,
      hoverYear,
      hoverData,
      handleChartHover,
      hideTooltip,
      getArtistColor,
      handlePredictionComplete
    };
  }
};
</script>

<style scoped>
.career-trajectory {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 5px;
  background-color: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  min-height: 600px;
  position: relative;
}

.artist-selection {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

.artist-selection h3 {
  margin-top: 0;
  color: #2c3e50;
  font-size: 18px;
  margin-bottom: 15px;
}

.selectors {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 20px 0;
}

.selector {
  position: relative;
  display: flex;
  flex-direction: column;
}

.selector label {
  margin-bottom: 8px;
  font-size: 14px;
  color: #555;
  font-weight: bold;
}

.selector select {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 14px;
  appearance: none;
  cursor: pointer;
  width: 100%;
}

.selector select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.clear-btn {
  position: absolute;
  top: 30px;
  right: 10px;
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #aaa;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-btn:hover {
  color: #e74c3c;
}

.compare-btn {
  padding: 12px 25px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  align-self: flex-end;
  font-weight: bold;
}

.compare-btn:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.compare-btn:not(:disabled):hover {
  background-color: #2980b9;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.chart-container {
  position: relative;
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  overflow: hidden;
}

.chart-wrapper {
  position: relative;
  height: 500px;
  width: 100%; /* 宽度设置为100%自适应 */
}

/* 自定义工具提示样式 */
.custom-tooltip {
  position: fixed;
  z-index: 1000;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 15px;
  width: 300px;
  pointer-events: none;
  opacity: 0.95;
  backdrop-filter: blur(4px);
  transform: translateY(-10px);
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.custom-tooltip::before {
  content: '';
  position: absolute;
  top: -10px;
  left: 20px;
  border-width: 0 10px 10px 10px;
  border-style: solid;
  border-color: transparent transparent white transparent;
}

.tooltip-header {
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: bold;
  color: #2c3e50;
}

.tooltip-header .year {
  color: #3498db;
  font-size: 18px;
}

.tooltip-content {
  max-height: 300px;
  overflow-y: auto;
}

.artist-info {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}

.artist-info:last-child {
  border-bottom: none;
}

.artist-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 12px;
  flex-shrink: 0;
}

.artist-details {
  flex: 1;
}

.artist-name {
  font-weight: bold;
  margin-bottom: 5px;
  color: #333;
}

.artist-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.stat-item {
  background-color: #f8f9fa;
  border-radius: 4px;
  padding: 5px 8px;
  text-align: center;
}

.stat-label {
  display: block;
  font-size: 12px;
  color: #7f8c8d;
}

.stat-value {
  display: block;
  font-weight: bold;
  font-size: 14px;
  color: #2c3e50;
}

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  min-height: 300px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 5px solid rgba(0, 0, 0, 0.1);
  border-left-color: #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

.placeholder {
  text-align: center;
  color: #7f8c8d;
  max-width: 500px;
}

.placeholder .icon {
  font-size: 80px;
  margin-bottom: 25px;
  opacity: 0.6;
}

.placeholder p {
  margin: 10px 0;
  font-size: 18px;
}

/* 响应式调整 */
@media (max-width: 1200px) {
  .selectors {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .selector select {
    padding: 12px;
  }

  .clear-btn {
    top: 35px;
  }

  .custom-tooltip {
    width: 260px;
  }

  .artist-stats {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 900px) {
  .chart-wrapper {
    min-width: 600px;
  }
}

@media (max-width: 700px) {
  .selectors {
    grid-template-columns: 1fr;
  }
}
</style>

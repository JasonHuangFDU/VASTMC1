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
      <div class="chart-wrapper">
        <canvas ref="mainChart"></canvas>
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
    <ArtistPotentialPrediction />
  </div>
</template>

<script>
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import * as d3 from 'd3';
import Chart from 'chart.js/auto';
import ArtistPotentialPrediction from './ArtistPotentialPrediction.vue';
import { processArtistData } from '@/services/dataService';

// 定义默认艺术家的ID
const DEFAULT_ARTIST_IDS = [17255, 2, 3];

export default {
  name: 'CareerTrajectory',
  components: {
    ArtistPotentialPrediction: ArtistPotentialPrediction
  },
  setup() {
    const graphData = ref(null);
    const selectedArtists = ref([null, null, null]);
    const comparisonData = ref([]);
    const loading = ref(false);
    const mainChart = ref(null);
    let mainChartInstance = null;
    let sortedYears = [];

    // 获取所有艺术家（Person节点）
    const artistList = computed(() => {
      if (!graphData.value || !graphData.value.nodes) return [];
      return graphData.value.nodes.filter(node =>
        node['Node Type'] === 'Person' && node.name
      ).sort((a, b) => a.name.localeCompare(b.name)); // 添加A-Z排序
    });

    // 获取默认艺术家名称
    const defaultArtistNames = computed(() => {
      if (!graphData.value || !graphData.value.nodes) return ["", "", ""];

      return DEFAULT_ARTIST_IDS.map(id => {
        const artist = graphData.value.nodes.find(n => n.id === id);
        return artist ? artist.name : "";
      });
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

      try {
        console.log("开始加载对比数据，艺术家ID:", selectedArtists.value);

        // 获取三位艺术家的生涯数据
        const artistIds = selectedArtists.value.filter(id => id !== null);
        const results = [];

        for (const id of artistIds) {
          const careerData = processArtistData(graphData.value, id);
          if (careerData) {
            const artistNode = graphData.value.nodes.find(n => n.id === id);
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

      // 计算图表宽度 - 每1年100px
      const minWidth = 1200;
      const width = Math.max(minWidth, sortedYears.length * 100);

      // 设置图表容器宽度
      const chartWrapper = document.querySelector('.chart-wrapper');
      if (chartWrapper) {
        chartWrapper.style.width = `${width}px`;
      }

      // 设置主图表尺寸
      mainChart.value.width = width;
      mainChart.value.height = 500;

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

    // 计算累计影响力
    let cumulativeInfluence = 0;
    const cumulativeInfluenceData = [];
    sortedYears.forEach(year => {
      if (artist.data.yearlyStats[year]) {
        cumulativeInfluence += artist.data.yearlyStats[year].influence;
      }
      cumulativeInfluenceData.push({
        x: year.toString(),  // 使用年份字符串作为x坐标
        y: cumulativeInfluence
      });
    });

    // 添加折线数据集
    datasets.push({
      type: 'line',
      label: `${artist.name} - 影响力`,
      data: cumulativeInfluenceData,  // 使用对象数组
      borderColor: color,
      backgroundColor: 'transparent',
      tension: 0,
      yAxisID: 'y',
      pointRadius: 0,
    });

    // 2. 添加作品发布事件标记
    const eventPoints = [];
    if (artist.data.yearlyStats) {
      sortedYears.forEach(year => {
        if (artist.data.yearlyStats[year]) {
          const releaseCount = artist.data.yearlyStats[year].workCount || 0;
          if (releaseCount > 0) {
            // 查找该年份的累计影响力值
            const influenceEntry = cumulativeInfluenceData.find(d => d.x === year.toString());
            eventPoints.push({
              x: year.toString(),  // 使用年份字符串作为x坐标
              y: influenceEntry ? influenceEntry.y : 0,
              count: releaseCount
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
      data: eventPoints,  // 使用对象数组
      pointStyle: 'rectRot',
      pointRadius: eventPoints.map(p => minRadius + (p.count / maxCount) * (maxRadius - minRadius)),
      pointHoverRadius: eventPoints.map(p => minRadius + (p.count / maxCount) * (maxRadius - minRadius) + 5),
      backgroundColor: color,
      borderColor: 'white',
      borderWidth: 2,
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
        x: year.toString(),  // 使用年份字符串作为x坐标
        y: value
      };
    });

    datasets.push({
      type: 'bar',
      label: `${artist.name} - 合作`,
      data: collabData,  // 使用对象数组
      backgroundColor: `${color}80`,
      borderColor: color,
      borderWidth: 1,
      yAxisID: 'y1',
      barPercentage: 0.6,
      categoryPercentage: 0.8
    });
  });

      // 创建主图表
      mainChartInstance = new Chart(mainChart.value, {
        data: {
          labels: sortedYears.map(year => year.toString()),
          datasets: datasets
        },
        options: {
          responsive: false, // 禁用响应式，使用固定宽度
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false
          },
          plugins: {
            legend: {
              position: 'top',
              labels: {
                filter: item => {
                  // 只显示影响力和作品发布的图例
                  return item.text.includes('影响力') || item.text.includes('作品发布');
                },
                font: {
                  size: 14
                }
              }
            },
            tooltip: {
              padding: 12,
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              titleFont: {
                size: 16
              },
              bodyFont: {
                size: 14
              },
              callbacks: {
                title: (items) => {
                  return `年份: ${sortedYears[items[0].dataIndex]}`;
                },
                beforeBody: (items) => {
                  const datasetLabel = items[0].dataset.label;
                  const artistName = datasetLabel.split(' - ')[0];
                  return `艺术家: ${artistName}`;
                },
                label: (context) => {
                  const label = context.dataset.label || '';
                  const value = context.parsed.y || 0;

                  if (label.includes('影响力')) {
                    return `影响力: ${value.toFixed(1)}`;
                  }
                  if (label.includes('合作')) {
                    return `合作次数: ${value}`;
                  }
                  if (label.includes('作品发布')) {
                    const pointData = context.dataset.data[context.dataIndex];
                    return `新作品发布: ${pointData.count} 首`;
                  }
                  return `${label}: ${value}`;
                }
              }
            }
          },
          scales: {
            x: {
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
            y: {
              position: 'left',
              title: {
                display: true,
                text: '影响力分数',
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
            y1: {
              position: 'right',
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
        }
      });
    };

    // 为不同艺术家分配颜色
    const getArtistColor = (index) => {
      const colors = ['#4e79a7', '#f28e2c', '#e15759']; // 蓝、橙、红
      return colors[index % colors.length];
    };

    // 销毁所有图表实例
    const destroyCharts = () => {
      if (mainChartInstance) {
        mainChartInstance.destroy();
        mainChartInstance = null;
      }
    };

    // 组件挂载时加载图数据
    onMounted(() => {
      loadGraphData();
    });

    // 组件卸载时清理
    onBeforeUnmount(() => {
      destroyCharts();
    });

    return {
      selectedArtists,
      comparisonData,
      loading,
      artistList,
      canCompare,
      mainChart,
      clearArtist,
      loadComparisonData,
      defaultArtistNames // 添加默认艺术家名称
    };
  }
};
</script>

<style scoped>
.career-trajectory {
  display: flex;
  flex-direction: column;
  gap: 25px;
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  min-height: 600px;
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
  gap: 15px;
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
  overflow-x: auto;
}

.chart-wrapper {
  position: relative;
  height: 500px;
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
}
</style>

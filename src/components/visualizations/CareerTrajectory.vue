/* 其他样式保持不变 */
.selection-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.selection-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #2c3e50;
}

.artist-selection h3 {
  margin-top: 0;
  color: #2c3e50;
  font-size: 16px;
  margin-bottom: 0px;
}<template>
  <div class="career-trajectory">
    <!-- 艺术家选择面板（占比 1） -->
    <div class="artist-selection">
      <!-- 将标题和按钮放在同一行 -->
      <div class="selection-header">
        <h3>Select Three Artists to Compare Their Career Trajectories</h3>
        <button
          class="compare-btn"
          :disabled="!canCompare"
          @click="loadComparisonData"
        >
          COMPARE
        </button>
      </div>

      <div class="selectors">
        <div v-for="(artist, index) in selectedArtists" :key="index" class="selector">
          <label>Artist {{ index + 1 }}:</label>
          <!-- 将select改为input，并添加搜索功能 -->
          <input
            type="text"
            v-model="artistSearchInputs[index]"
            @input="filterArtists(index)"
            @focus="showSuggestions[index] = true"
            @blur="handleBlur(index)"
            placeholder="Search artist..."
          />
          <!-- 搜索结果建议框 -->
          <div v-if="showSuggestions[index] && filteredArtistLists[index].length > 0" class="suggestions">
            <div
              v-for="person in filteredArtistLists[index]"
              :key="person.id"
              @mousedown="selectArtist(person, index)"
              class="suggestion-item"
            >
              {{ person.name }}
            </div>
          </div>
          <button
            v-if="selectedArtists[index]"
            class="clear-btn"
            @click="clearArtist(index)"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <!-- 生涯轨迹视图（图表部分 - 占比 3） -->
    <div class="career-view">
      <!-- 主图表容器 -->
      <div v-if="comparisonData.length" class="chart-container">
        <div class="chart-wrapper" ref="chartWrapper">
          <canvas ref="mainChart" @mousemove="handleChartHover" @mouseleave="hideTooltip"></canvas>
        </div>
      </div>

      <!-- 空状态提示 -->
      <div v-if="!loading && !comparisonData.length" class="empty-state">
        <div class="placeholder">
          <div class="icon">📊</div>
          <p>Please select three artists for career trajectory comparison.</p>
          <p>The system will display the changes in their influence, collaboration frequency, and popularity over time.</p>
        </div>
      </div>
    </div>

    <!-- 艺术家潜力预测视图（下半部分 - 占比 2） -->
    <div class="prediction-view">
      <ArtistPotentialPrediction @prediction-complete="handlePredictionComplete" />
    </div>

    <!-- 自定义工具提示 -->
    <div v-if="showTooltip" class="custom-tooltip" :style="tooltipStyle">
      <div class="tooltip-header">
        Year <span class="year">{{ hoverYear }}</span>
      </div>
      <div class="tooltip-content">
        <div v-for="(artist, index) in hoverData" :key="index" class="artist-info">
          <div class="artist-color" :style="{ backgroundColor: getArtistColor(index) }"></div>
          <div class="artist-details">
            <div class="artist-name">{{ artist.name }}</div>
            <div class="artist-stats">
              <div class="stat-item">
                <span class="stat-label">Influence:</span>
                <span class="stat-value">{{ artist.cumulativeInfluence.toFixed(1) }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">New Work:</span>
                <span class="stat-value">{{ artist.workCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">Collaboration:</span>
                <span class="stat-value">{{ artist.collabCount }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 数据加载状态 -->
    <div v-if="loading" class="loading">
      <div class="spinner"></div>
      <p>LOADING...</p>
    </div>
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
    const artistSearchInputs = ref(['', '', '']); // 新增：存储每个输入框的搜索词
    const filteredArtistLists = ref([[], [], []]); // 新增：存储每个输入框的过滤结果
    const showSuggestions = ref([false, false, false]); // 新增：控制建议框显示
    const comparisonData = ref([]);
    const loading = ref(false);
    const mainChart = ref(null);
    const chartWrapper = ref(null);
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

    // 过滤艺术家列表（前缀匹配）
    const filterArtists = (index) => {
      const searchTerm = artistSearchInputs.value[index].toLowerCase();
      if (!searchTerm) {
        filteredArtistLists.value[index] = [];
        return;
      }

      // 过滤以搜索词开头的艺术家（不区分大小写）
      filteredArtistLists.value[index] = artistList.value.filter(person =>
        person.name.toLowerCase().startsWith(searchTerm)
      );
    };

    // 选择艺术家
    const selectArtist = (person, index) => {
      selectedArtists.value[index] = person.id;
      artistSearchInputs.value[index] = person.name;
      filteredArtistLists.value[index] = [];
      showSuggestions.value[index] = false;
    };

    // 处理输入框失去焦点
    const handleBlur = (index) => {
      setTimeout(() => {
        showSuggestions.value[index] = false;
      }, 200);
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

    // 渲染所有图表 - 修改为弹性布局
    const renderCharts = () => {
      if (!mainChart.value || !comparisonData.value.length || !chartWrapper.value) return;

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

      // 使用容器的实际尺寸
      const containerWidth = chartWrapper.value.clientWidth;
      const containerHeight = chartWrapper.value.clientHeight;

      // 设置canvas尺寸
      mainChart.value.width = containerWidth;
      mainChart.value.height = containerHeight;

      // 渲染主图表
      renderMainChart();
    };

    // 渲染主图表（影响力、作品发布、合作）
    const renderMainChart = () => {
      // 准备数据集
      const datasets = [];

      // 定义垂直偏移量（防止点重合）
      const verticalOffsets = [0, 0.2, 0.4]; // 三位艺术家的垂直偏移量

      // 1. 影响力折线图（累计影响力）
      comparisonData.value.forEach((artist, index) => {
        const color = getArtistColor(index);
        const verticalOffset = verticalOffsets[index]; // 获取当前艺术家的垂直偏移量

        // 使用累计影响力数据
        const cumulativeInfluenceData = sortedYears.map(year => {
          const influence = artist.data.cumulativeInfluenceByYear?.[year] || 0;
          return {
            x: year.toString(),
            y: influence + verticalOffset
          };
        });

        // 添加折线数据集
        datasets.push({
          type: 'line',
          label: `${artist.name} - Influence`,
          data: cumulativeInfluenceData,
          borderColor: color,
          backgroundColor: 'transparent',
          tension: 0.1,
          xAxisID: 'x',
          yAxisID: 'y',
          pointRadius: 0,
          borderWidth: 2,
        });

        // 2. 添加作品发布事件标记
        const eventPoints = [];
        if (artist.data.yearlyStats) {
          sortedYears.forEach(year => {
            if (artist.data.yearlyStats[year]) {
              const releaseCount = artist.data.yearlyStats[year].workCount || 0;
              const notableCount = artist.data.yearlyStats[year].notableCount || 0;

              if (releaseCount > 0) {
                // 查找该年份的累计影响力值
                const influenceEntry = cumulativeInfluenceData.find(d => d.x === year.toString());

                eventPoints.push({
                  x: year.toString(),
                  y: influenceEntry ? influenceEntry.y : 0,
                  count: releaseCount,
                  notableCount: notableCount
                });
              }
            }
          });
        }

        // 计算点半径范围
        const maxCount = Math.max(...eventPoints.map(p => p.count), 1);
        const minRadius = 3;
        const maxRadius = 8;

        datasets.push({
          type: 'scatter',
          label: `${artist.name} - New Work`,
          data: eventPoints,
          pointStyle: 'rectRot',
          pointRadius: eventPoints.map(p => minRadius + (p.count / maxCount) * (maxRadius - minRadius)),
          pointHoverRadius: eventPoints.map(p => minRadius + (p.count / maxCount) * (maxRadius - minRadius) + 3),
          backgroundColor: color,
          // 根据重要作品数设置样式
          borderColor: eventPoints.map(p =>
            p.notableCount > 0 ? '#00CED1' : 'white'
          ),
          borderWidth: eventPoints.map(p =>
            p.notableCount > 0 ? 2 : 1
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
            x: year.toString(),
            y: value
          };
        });

        datasets.push({
          type: 'bar',
          label: `${artist.name} - 合作`,
          data: collabData,
          backgroundColor: `${color}80`,
          borderColor: color,
          borderWidth: 0.5,
          xAxisID: 'x',
          yAxisID: 'y1',
          barPercentage: 0.4,
          categoryPercentage: 0.6,
          barThickness: 8
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
          indexAxis: 'x',
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
                  return item.text.includes('Influence') || item.text.includes('New Work');
                },
                font: {
                  size: 10  // 缩小图例字体
                },
                usePointStyle: true,
                padding: 8,  // 减小图例间距
                boxWidth: 15,  // 缩小图例标记
                boxHeight: 10
              }
            },
            tooltip: {
              enabled: false // 禁用默认tooltip
            }
          },
          scales: {
            x: {
              title: {
                display: false  // 移除YEAR标签
              },
              ticks: {
                font: {
                  size: 10
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
                text: 'Influence Score',
                font: {
                  size: 10,
                  weight: 'normal'
                }
              },
              ticks: {
                font: {
                  size: 9
                }
              },
              beginAtZero: true
            },
            y1: {
              position: 'right',
              title: {
                display: true,
                text: 'Collaboration Frequency',
                font: {
                  size: 10,
                  weight: 'normal'
                }
              },
              ticks: {
                font: {
                  size: 9
                }
              },
              beginAtZero: true,
              grid: {
                drawOnChartArea: false
              }
            }
          }
        },
        // 添加插件绘制垂直参考线
        plugins: [{
          id: 'hoverLinePlugin',
          afterDraw: (chart) => {
            if (!hoverLine.value.show) return;

            const ctx = chart.ctx;
            const xPos = hoverLine.value.position;

            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([5, 3]);
            ctx.moveTo(xPos, 0);
            ctx.lineTo(xPos, chart.height);
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
      const colors = ['#90b6e2ff', '#ebc676ff', '#f5695cff']; // 蓝、橙、红
      return colors[index % colors.length];
    };

    // 处理图表悬停事件
    const handleChartHover = (event) => {
      if (!mainChartInstance || !comparisonData.value.length) return;

      // 获取canvas位置和鼠标坐标
      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;

      // 获取X轴比例尺
      const xAxis = mainChartInstance.scales.x;
      if (!xAxis) return;

      // 计算年份索引
      const yearIndex = Math.round(
        (mouseX - xAxis.left) / (xAxis.right - xAxis.left) * (sortedYears.length - 1)
      );

      // 确保索引在有效范围内
      if (yearIndex < 0 || yearIndex >= sortedYears.length) {
        hideTooltip();
        hoverLine.value.show = false;
        return;
      }

      const year = sortedYears[yearIndex];

      // 更新垂直线位置
      const xPos = xAxis.getPixelForValue(year.toString());
      hoverLine.value = {
        show: true,
        year,
        position: xPos
      };

      // 收集该年份所有艺术家的数据
      const artistData = comparisonData.value.map(artist => {
        const yearStats = artist.data.yearlyStats[year] || {};
        return {
          id: artist.id,
          name: artist.name,
          cumulativeInfluence: artist.data.cumulativeInfluenceByYear?.[year] || 0,
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
      const tooltipWidth = 260;
      const tooltipHeight = artistData.length * 60 + 40;
      let left = event.clientX + 20;
      let top = event.clientY - tooltipHeight / 2;

      // 判断鼠标位置是否在图表右半部分
      const isRightHalf = mouseX > rect.width / 2;

      if (isRightHalf) {
        // 如果在图表右半部分，则在光标左侧显示
        left = event.clientX - tooltipWidth - 20;
      }

      // 确保工具提示不会超出屏幕
      if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - 10;
      }
      // 确保工具提示不会超出屏幕左侧
      else if (left < 10) {
        left = 10;
      }

      // 确保工具提示不会超出屏幕顶部
      if (top < 10) {
        top = 10;
      }
      // 确保工具提示不会超出屏幕底部
      else if (top + tooltipHeight > window.innerHeight) {
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
      artistSearchInputs,
      filteredArtistLists,
      showSuggestions,
      comparisonData,
      loading,
      artistList,
      canCompare,
      mainChart,
      chartWrapper,
      clearArtist,
      filterArtists,
      selectArtist,
      handleBlur,
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
/* 主容器 - 弹性布局设置 */
.career-trajectory {
  display: flex;
  flex-direction: column;
  height: 100vh; /* 占满视口高度 */
  max-height: 100vh; /* 限制最大高度 */
  gap: 4px; /* 进一步减小间距 */
  padding: 2px; /* 进一步减小内边距 */
  background-color: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  position: relative;
  overflow: hidden; /* 防止内容溢出 */
  box-sizing: border-box; /* 包含内边距和边框在内 */
}

/* 艺术家选择面板 - 进一步减小高度 */
.artist-selection {
  flex: 0 0 auto; /* 改为固定高度，不占用flex比例 */
  height: 120px; /* 从140px减到120px */
  background-color: white;
  border-radius: 8px;
  padding: 8px; /* 从10px减到8px */
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

/* 生涯轨迹视图 - 占比 3 */
.career-view {
  flex: 3; /* 占 3 份 */
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 8px;
  padding: 8px; /* 从10px减到8px */
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  min-height: 0; /* 允许收缩 */
  overflow: hidden;
}

/* 艺术家潜力预测视图 - 保持占比 */
.prediction-view {
  flex: 2.5; /* 保持2.5的占比 */
  background-color: white;
  border-radius: 8px;
  padding: 8px; /* 从10px减到8px */
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  min-height: 0; /* 允许收缩 */
  overflow: hidden;
}

/* 艺术家选择面板 */
.artist-selection {
  background-color: white;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  flex-shrink: 0; /* 保持固定高度 */
}

/* 图表容器 - 占据剩余空间 */
.chart-container {
  flex: 1; /* 占据剩余空间 */
  position: relative;
  overflow: hidden; /* 去掉滚动条 */
  min-height: 0; /* 允许收缩 */
}

/* 图表包装器 - 填充父容器 */
.chart-wrapper {
  position: relative;
  width: 100%; /* 占满宽度 */
  height: 100%; /* 占满高度 */
}

/* Canvas 元素样式 */
.chart-wrapper canvas {
  position: absolute;
  top: 0;
  left: 0;
}

/* 空状态提示 - 填充剩余空间 */
.empty-state {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;
}

.selectors {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
}

.selector {
  position: relative;
  display: flex;
  flex-direction: column;
}

.selector label {
  margin-bottom: 4px;
  font-size: 0.8rem;
  color: #555;
  font-weight: 500;
}

.selector input {
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 0.8rem;
  width: 100%;
  box-sizing: border-box;
}

.selector input:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  max-height: 150px;
  overflow-y: auto;
  background-color: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  z-index: 100;
  margin-top: 2px;
}

.suggestion-item {
  padding: 6px 10px;
  cursor: pointer;
  font-size: 0.8rem;
}

.suggestion-item:hover {
  background-color: #f0f8ff;
}

.clear-btn {
  position: absolute;
  top: 20px; /* 从22px减到20px */
  right: 6px;
  background: none;
  border: none;
  font-size: 12px; /* 从14px减到12px */
  cursor: pointer;
  color: #aaa;
  width: 16px; /* 从18px减到16px */
  height: 16px; /* 从18px减到16px */
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-btn:hover {
  color: #e74c3c;
}

.compare-btn {
  padding: 4px 12px; /* 从6px 16px减到4px 12px */
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.75rem; /* 从0.8rem减到0.75rem */
  cursor: pointer;
  transition: background-color 0.2s;
  font-weight: 500;
}

.compare-btn:disabled {
  background-color: #bdc3c7;
  cursor: not-allowed;
}

.compare-btn:not(:disabled):hover {
  background-color: #2980b9;
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0,0,0,0.1);
}

/* 自定义工具提示样式 */
.custom-tooltip {
  position: fixed;
  z-index: 1000;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  padding: 12px;
  width: 260px;
  pointer-events: none;
  opacity: 0.95;
  backdrop-filter: blur(4px);
  transform: translateY(-10px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  font-size: 13px;
}

.custom-tooltip::before {
  content: '';
  position: absolute;
  left: -10px;
  top: 50%;
  transform: translateY(-50%);
  border-width: 10px 10px 10px 0;
  border-style: solid;
  border-color: transparent white transparent transparent;
}

.custom-tooltip[style*="left: calc(100%"]::before {
  left: auto;
  right: -10px;
  border-width: 10px 0 10px 10px;
  border-color: transparent transparent transparent white;
}

.tooltip-header {
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
  margin-bottom: 8px;
  font-size: 10px;
  font-weight: bold;
  color: #2c3e50;
}

.tooltip-header .year {
  color: #3498db;
  font-size: 16px;
}

.tooltip-content {
  max-height: 260px;
  overflow-y: auto;
}

.artist-info {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
}

.artist-info:last-child {
  border-bottom: none;
}

.artist-color {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 10px;
  flex-shrink: 0;
}

.artist-details {
  flex: 1;
}

.artist-name {
  font-weight: bold;
  margin-bottom: 4px;
  color: #333;
  font-size: 13px;
}

.artist-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.stat-item {
  background-color: #f8f9fa;
  border-radius: 4px;
  padding: 4px 6px;
  text-align: center;
  font-size: 12px;
}

.stat-label {
  display: block;
  font-size: 11px;
  color: #7f8c8d;
}

.stat-value {
  display: block;
  font-weight: bold;
  font-size: 12px;
  color: #2c3e50;
}

.loading {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(255, 255, 255, 0.9);
  z-index: 10;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid rgba(0, 0, 0, 0.1);
  border-left-color: #3498db;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.placeholder {
  text-align: center;
  color: #7f8c8d;
  max-width: 500px;
}

.placeholder .icon {
  font-size: 60px;
  margin-bottom: 20px;
  opacity: 0.6;
}

.placeholder p {
  margin: 8px 0;
  font-size: 16px;
}

/* 响应式调整 */
@media (max-width: 1200px) {
  .selectors {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .selector input {
    padding: 8px;
  }

  .clear-btn {
    top: 26px;
  }

  .custom-tooltip {
    width: 240px;
  }

  .artist-stats {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .selectors {
    grid-template-columns: 1fr;
  }
}
</style>
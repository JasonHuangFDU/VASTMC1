<template>
  <div class="career-trajectory">
    <!-- 艺术家选择面板 -->
    <div class="artist-selection">
      <div class="selection-header">
        <h3>Compare Career Trajectories</h3>
        <button
          class="compare-btn"
          :disabled="!canCompare"
          @click="loadComparisonData"
        >
          Compare
        </button>
      </div>

      <div class="selectors">
        <div v-for="(artist, index) in selectedArtists" :key="index" class="selector">
          <label>Artist {{ index + 1 }}:</label>
          <input
            type="text"
            v-model="artistSearchInputs[index]"
            @input="filterArtists(index)"
            @focus="showSuggestions[index] = true"
            @blur="handleBlur(index)"
            placeholder="Search artist..."
          />
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

    <!-- 生涯轨迹视图 -->
    <div class="career-view">
      <!-- 主图表容器 -->
      <div v-if="comparisonData.length" class="chart-container">
        <!-- 主图表区域 -->
        <div class="chart-wrapper" ref="chartWrapper">
          <canvas ref="mainChart" @mousemove="handleChartHover" @mouseleave="hideTooltip"></canvas>
        </div>

        <!-- 流派环形图区域 -->
        <div class="genre-charts-container">
          <div class="genre-charts">
            <div v-for="(artist, index) in comparisonData" :key="index" class="genre-chart-container">
              <div class="artist-label">Artist {{ index + 1 }}</div>
              <canvas :ref="el => genreChartRefs[index] = el"></canvas>
            </div>
          </div>
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

    <!-- 艺术家潜力预测视图 -->
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
import { getGenreColor } from '@/utils/colors';

// 定义默认艺术家的ID
const DEFAULT_ARTIST_IDS = [17255, 17349, 17355];

export default {
  name: 'CareerTrajectory',
  components: {
    ArtistPotentialPrediction
  },
  setup() {
    const graphData = ref(null);
    const selectedArtists = ref([null, null, null]);
    const artistSearchInputs = ref(['', '', '']);
    const filteredArtistLists = ref([[], [], []]);
    const showSuggestions = ref([false, false, false]);
    const comparisonData = ref([]);
    const loading = ref(false);
    const mainChart = ref(null);
    const chartWrapper = ref(null);
    let mainChartInstance = null;
    let sortedYears = [];

    // 流派环形图相关变量
    const genreChartRefs = ref([null, null, null]);
    let genreChartInstances = [null, null, null];

    const getArtistGenreData = (artist, year = null) => {
      if (year !== null && year !== '') {
        if (artist.data.yearlyStats[year]) {
          return artist.data.yearlyStats[year].genreDistribution || {};
        }
        return {};
      }

      const careerGenres = {};
      Object.values(artist.data.yearlyStats).forEach(yearStats => {
        Object.entries(yearStats.genreDistribution || {}).forEach(([genre, count]) => {
          careerGenres[genre] = (careerGenres[genre] || 0) + count;
        });
      });
      return careerGenres;
    };

    const renderGenreCharts = () => {
      destroyGenreCharts();

      comparisonData.value.forEach((artist, index) => {
        const canvas = genreChartRefs.value[index];
        if (!canvas) return;

        const genreData = getArtistGenreData(artist, hoverYear.value);
        const hasData = genreData && Object.keys(genreData).length > 0;

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';

        if (hoverYear.value) {
          if (hasData) {
            ctx.fillText(`Genres in ${hoverYear.value}`, canvas.width/2, 15);
          } else {
            ctx.fillText(`No genres in ${hoverYear.value}`, canvas.width/2, 15);
            ctx.font = '10px Arial';
            ctx.fillStyle = '#999';
            ctx.fillText('(Showing career distribution instead)', canvas.width/2, 30);
            const careerData = getArtistGenreData(artist, null);
            renderGenreChart(canvas, careerData);
            return;
          }
        } else {
          ctx.fillText('Career Genre Distribution', canvas.width/2, 15);
          if (!hasData) {
            ctx.font = '12px Arial';
            ctx.fillStyle = '#999';
            ctx.fillText('No genre data available', canvas.width/2, canvas.height/2 + 15);
            return;
          }
        }

        renderGenreChart(canvas, genreData);
      });
    };

    const renderGenreChart = (canvas, genreData) => {
      const labels = Object.keys(genreData);
      const data = Object.values(genreData);
      const backgroundColor = labels.map(genre => getGenreColor(genre));

      const chartData = {
        labels,
        datasets: [{
          data,
          backgroundColor,
          borderWidth: 1
        }]
      };

      const index = genreChartRefs.value.findIndex(ref => ref === canvas);
      if (index !== -1) {
        genreChartInstances[index] = new Chart(canvas, {
          type: 'doughnut',
          data: chartData,
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  font: {
                    size: 10
                  },
                  boxWidth: 12
                }
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const total = context.dataset.data.reduce((a, b) => a + b, 0);
                    const value = context.raw;
                    const percentage = Math.round((value / total) * 100);
                    return `${context.label}: ${value} (${percentage}%)`;
                  }
                }
              }
            },
            cutout: '60%'
          }
        });
      }
    };

    const destroyGenreCharts = () => {
      genreChartInstances.forEach((instance, index) => {
        if (instance) {
          instance.destroy();
          genreChartInstances[index] = null;
        }
      });
    };

    // 悬停交互状态
    const showTooltip = ref(false);
    const tooltipStyle = ref({ left: '0px', top: '0px' });
    const hoverYear = ref('');
    const hoverData = ref([]);

    // 水平参考线状态
    const hoverLine = ref({
      show: false,
      year: null,
      position: 0
    });

    // 获取所有艺术家
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

    // 过滤艺术家列表
    const filterArtists = (index) => {
      const searchTerm = artistSearchInputs.value[index].toLowerCase();
      if (!searchTerm) {
        filteredArtistLists.value[index] = [];
        return;
      }

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

        selectedArtists.value = [...DEFAULT_ARTIST_IDS];
        // +++ 新增代码：设置默认艺术家的名称到搜索输入框 +++
        selectedArtists.value.forEach((id, index) => {
          const artist = graphData.value.nodes.find(node => node.id === id);
          if (artist) {
            artistSearchInputs.value[index] = artist.name;
          }
        });

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
        const artistIds = selectedArtists.value.filter(id => id !== null);
        const results = [];
        const allYears = new Set();

        for (const id of artistIds) {
          const careerData = processArtistData(graphData.value, id);
          if (careerData && careerData.yearlyStats) {
            Object.keys(careerData.yearlyStats).forEach(year => allYears.add(parseInt(year)));
          }
        }

        const sortedGlobalYears = Array.from(allYears).sort((a, b) => a - b);

        for (const id of artistIds) {
          const careerData = processArtistData(graphData.value, id);
          if (careerData) {
            const artistNode = graphData.value.nodes.find(n => n.id === id);
            let cumulativeInfluence = 0;
            const cumulativeInfluenceByYear = {};

            sortedGlobalYears.forEach(year => {
              if (careerData.yearlyStats && careerData.yearlyStats[year]) {
                cumulativeInfluence += careerData.yearlyStats[year].influence;
              }
              cumulativeInfluenceByYear[year] = cumulativeInfluence;
            });

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

        hoverYear.value = '';

        setTimeout(() => {
          renderCharts();
          renderGenreCharts();
        }, 100);
      } catch (error) {
        console.error('加载对比数据失败:', error);
      } finally {
        loading.value = false;
      }
    };

    // 渲染所有图表
    const renderCharts = () => {
      if (!mainChart.value || !comparisonData.value.length || !chartWrapper.value) return;

      destroyCharts();

      const allYears = new Set();
      comparisonData.value.forEach(artist => {
        if (artist.data.yearlyStats) {
          Object.keys(artist.data.yearlyStats).forEach(year => allYears.add(parseInt(year)));
        }
      });

      sortedYears = Array.from(allYears).sort((a, b) => a - b);

      const containerWidth = chartWrapper.value.clientWidth;
      const containerHeight = chartWrapper.value.clientHeight;

      mainChart.value.width = containerWidth;
      mainChart.value.height = containerHeight;

      renderMainChart();
      renderGenreCharts();
    };

    // 渲染主图表
    const renderMainChart = () => {
      const datasets = [];
      const verticalOffsets = [0, 0.3, 0.6];

      comparisonData.value.forEach((artist, index) => {
        const color = getArtistColor(index);
        const verticalOffset = verticalOffsets[index];

        const cumulativeInfluenceData = sortedYears.map(year => {
          const influence = artist.data.cumulativeInfluenceByYear?.[year] || 0;
          return {
            x: year.toString(),
            y: influence + verticalOffset
          };
        });

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

        const eventPoints = [];
        if (artist.data.yearlyStats) {
          sortedYears.forEach(year => {
            if (artist.data.yearlyStats[year]) {
              const releaseCount = artist.data.yearlyStats[year].workCount || 0;
              const notableCount = artist.data.yearlyStats[year].notableCount || 0;

              if (releaseCount > 0) {
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
          onHover: () => {},
          plugins: {
            legend: {
              position: 'top',
              labels: {
                filter: item => {
                  return item.text.includes('Influence') || item.text.includes('New Work');
                },
                font: {
                  size: 10
                },
                usePointStyle: true,
                padding: 8,
                boxWidth: 15,
                boxHeight: 10
              }
            },
            tooltip: {
              enabled: false
            }
          },
          scales: {
            x: {
              title: {
                display: false
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
      const colors = ['#90b6e2ff', '#ebc676ff', '#f5695cff'];
      return colors[index % colors.length];
    };

    // 处理图表悬停事件
    const handleChartHover = (event) => {
      if (!mainChartInstance || !comparisonData.value.length) return;

      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;

      const xAxis = mainChartInstance.scales.x;
      if (!xAxis) return;

      const yearIndex = Math.round(
        (mouseX - xAxis.left) / (xAxis.right - xAxis.left) * (sortedYears.length - 1)
      );

      if (yearIndex < 0 || yearIndex >= sortedYears.length) {
        hideTooltip();
        hoverLine.value.show = false;
        return;
      }

      const year = sortedYears[yearIndex];

      const xPos = xAxis.getPixelForValue(year.toString());
      hoverLine.value = {
        show: true,
        year,
        position: xPos
      };

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

      showTooltip.value = true;
      hoverYear.value = year;
      hoverData.value = artistData;

      const tooltipWidth = 260;
      const tooltipHeight = artistData.length * 60 + 40;
      let left = event.clientX + 20;
      let top = event.clientY - tooltipHeight / 2;

      const isRightHalf = mouseX > rect.width / 2;

      if (isRightHalf) {
        left = event.clientX - tooltipWidth - 20;
      }

      if (left + tooltipWidth > window.innerWidth) {
        left = window.innerWidth - tooltipWidth - 10;
      }
      else if (left < 10) {
        left = 10;
      }

      if (top < 10) {
        top = 10;
      }
      else if (top + tooltipHeight > window.innerHeight) {
        top = window.innerHeight - tooltipHeight - 10;
      }

      tooltipStyle.value = {
        left: `${left}px`,
        top: `${top}px`
      };
      renderGenreCharts();
    };

    // 隐藏工具提示
    const hideTooltip = () => {
      showTooltip.value = false;
      hoverLine.value.show = false;
      hoverYear.value = '';
      renderGenreCharts();
    };

    // 销毁所有图表实例
    const destroyCharts = () => {
      if (mainChartInstance) {
        mainChartInstance.destroy();
        mainChartInstance = null;
        destroyGenreCharts();
      }
    };

    // 处理预测完成事件
    const handlePredictionComplete = (artistIds) => {
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
      handlePredictionComplete,
      genreChartRefs
    };
  }
};
</script>

<style scoped>
/* 主容器 */
.career-trajectory {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  gap: 4px;
  padding: 2px;
  background-color: #f8f9fa;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05);
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
}

/* 艺术家选择面板 */
.artist-selection {
  flex: 0 0 auto;
  height: 100px;
  background-color: white;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
}

/* 生涯轨迹视图 */
.career-view {
  flex: 3;
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  min-height: 0;
  overflow: hidden;
  height: 100%;
}

/* 图表容器 */
.chart-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

/* 主图表包装器 */
.chart-wrapper {
  flex: 1;
  position: relative;
  min-height: 0;
}

/* 流派图容器 */
.genre-charts-container {
  flex: 0 0 auto;
  height: 150px;
  margin-top: 0px;
  overflow: auto;
}

/* 流派图网格布局 */
.genre-charts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 5px;
  min-height: 140px;
}

/* 单个流派图容器 */
.genre-chart-container {
  position: relative;
  height: 130px;
  min-width: 130px;
  display: flex;
  flex-direction: column;
  background: #f8f9fa;
  border-radius: 6px;
  padding: 5px;
  box-sizing: border-box;
}

/* 艺术家潜力预测视图 */
.prediction-view {
  flex: 2.5;
  background-color: white;
  border-radius: 8px;
  padding: 8px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.05);
  min-height: 0;
  overflow: hidden;
}

/* 艺术家标签样式 */
.artist-label {
  text-align: center;
  font-weight: bold;
  font-size: 10px;
  color: #2c3e50;
  background-color: #f8f9fa;
  padding: 2px 0;
  border-radius: 4px 4px 0 0;
}

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
  top: 20px;
  right: 6px;
  background: none;
  border: none;
  font-size: 12px;
  cursor: pointer;
  color: #aaa;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-btn:hover {
  color: #e74c3c;
}

.compare-btn {
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

.compare-btn:not(:disabled) {
  color: var(--color-surface);
  background-color: var(--color-primary-accent);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.compare-btn:disabled {
  color: var(--color-text-secondary);
  background-color: transparent;
  cursor: not-allowed;
  opacity: 0.5;
}

.compare-btn:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0,0,0,0.2);
}

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

.empty-state {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 0;
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

  .genre-charts {
    grid-template-columns: 1fr;
    min-height: auto;
  }

  .genre-chart-container {
    height: 200px;
    margin-bottom: 5px;
  }
}

@media (max-width: 700px) {
  .selectors {
    grid-template-columns: 1fr;
  }
}
</style>

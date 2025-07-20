<template>
  <div class="artist-prediction">
    <div class="header">
      <h4>Oceanus Folk Stars Prediction</h4>
      <button v-if="report" @click="resetPrediction" class="re-predict-btn">
        Re-predict
      </button>
    </div>

    <!-- 权重评分区域 - 只在预测前显示 -->
    <div v-if="showWeightSelection" class="weight-selection-section">
      <div class="selection-header">
        <h4>Rate the importance of each factor (1-10)</h4>
        <p class="selection-subtitle">(Higher score means greater importance)</p>
      </div>

      <!-- 权重项目 - 改为3列2行网格布局 -->
      <div class="weight-items">
        <div v-for="weight in weightOrder" :key="weight.id" class="weight-item">
          <label class="weight-label">{{ weight.label }}:</label>
          <select v-model="weightScores[weight.id]" class="score-select">
            <option v-for="n in 10" :key="n" :value="n">{{ n }}</option>
          </select>
        </div>
      </div>

      <div class="selection-buttons">
        <button @click="resetScores" class="reset-btn">Reset</button>
        <button @click="runPrediction" :disabled="!allScoresSelected" class="primary-btn">
          {{ loading ? 'Analyzing...' : 'Start Analysis' }}
        </button>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="report" class="results-section">
      <div class="predicted-stars">
        <div class="stars-container">
          <div v-for="(star, index) in report.predicted_stars" :key="index" class="star-card">
            <div class="star-rank">{{ index + 1 }}</div>
            <div class="star-info">
              <div class="star-name">{{ star.name }}</div>
              <div class="star-strengths">
                <span v-for="(strength, sIndex) in star.strengths.slice(0, 2)" :key="sIndex" class="strength-tag">
                  {{ strength }}
                </span>
              </div>
            </div>
            <div class="star-radar">
              <!-- 直接嵌入雷达图容器 -->
              <div :ref="el => radarContainers[index] = el" class="radar-chart"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import * as d3 from 'd3';
import { useGraphStore } from '@/stores/graphStore';
import { loadOceanusDataAndPredict } from '@/services/dataService';

export default {
  name: 'ArtistPotentialPrediction',
  setup() {
    const graphStore = useGraphStore();
    return { graphStore };
  },
  data() {
    return {
      loading: false,
      error: null,
      report: null,
      showWeightSelection: true,
      weightOrder: [
        { id: 'influence_score', label: 'Influence' },
        { id: 'creative_depth', label: 'Creativity' },
        { id: 'label_weight', label: 'Record Company' },
        { id: 'producer_count', label: 'Producer Experience' },
        { id: 'oceanus', label: 'Oceanus Work' },
        { id: 'collab', label: 'Collaboration' }
      ],
      weightScores: {},
      radarContainers: [],  // 存储雷达图容器的引用
      resizeObservers: []  // 存储ResizeObserver实例
    };
  },
  created() {
    this.resetScores();
  },
  computed: {
    allScoresSelected() {
      return this.weightOrder.every(weight => {
        return this.weightScores[weight.id] > 0;
      });
    }
  },
  watch: {
    report(newVal) {
      if (newVal && newVal.radar_data) {
        this.$nextTick(() => {
          this.renderAllRadars();
        });
      }
    }
  },
  beforeUnmount() {
    // 组件销毁时清理所有雷达图
    this.cleanupAllRadars();
  },
  methods: {
    resetScores() {
      const defaultScores = {};
      this.weightOrder.forEach(weight => {
        defaultScores[weight.id] = 5;
      });
      this.weightScores = { ...defaultScores };
    },

    async runPrediction() {
      this.loading = true;
      this.error = null;
      this.report = null;
      this.cleanupAllRadars();  // 清除之前的雷达图

      try {
        const totalScore = this.weightOrder.reduce((sum, weight) => {
          return sum + this.weightScores[weight.id];
        }, 0);

        const normalizedWeights = this.weightOrder.map(weight => {
          return this.weightScores[weight.id] / totalScore;
        });

        const weightIds = this.weightOrder.map(weight => weight.id);

        const result = await loadOceanusDataAndPredict(weightIds, normalizedWeights);

        this.report = result;
        this.showWeightSelection = false;
        const predictedIds = result.predicted_stars.map(star => star.id);
        this.$emit('prediction-complete', predictedIds);
      } catch (error) {
        this.error = `Prediction failed: ${error.message}`;
        console.error('Prediction error:', error);
      } finally {
        this.loading = false;
      }
    },

    resetPrediction() {
      this.showWeightSelection = true;
      this.report = null;
      this.error = null;
      this.resetScores();
      this.cleanupAllRadars();
    },

    // 渲染所有雷达图
    renderAllRadars() {
      if (!this.report || !this.report.radar_data) return;

      this.report.radar_data.forEach((artistData, index) => {
        const container = this.radarContainers[index];
        if (container) {
          this.renderRadar(container, artistData);
        }
      });
    },

    // 设置ResizeObserver监听
    setupResizeObserver(container, artistData) {
      // 清理现有的observer
      const existingObserver = this.resizeObservers.find(ob => ob.container === container);
      if (existingObserver) {
        existingObserver.observer.disconnect();
        this.resizeObservers = this.resizeObservers.filter(ob => ob.container !== container);
      }

      // 创建新的observer
      const observer = new ResizeObserver(entries => {
        for (let entry of entries) {
          if (entry.target === container) {
            this.renderRadar(container, artistData);
          }
        }
      });

      observer.observe(container);
      this.resizeObservers.push({ container, observer });

      // 初始渲染
      this.renderRadar(container, artistData);
    },


    // 清理所有雷达图
    cleanupAllRadars() {
      // 断开所有ResizeObserver
      this.resizeObservers.forEach(ob => ob.observer.disconnect());
      this.resizeObservers = [];

      this.radarContainers.forEach(container => {
        if (container) {
          d3.select(container).selectAll("*").remove();
        }
      });
      this.radarContainers = [];
    },

    // 渲染单个雷达图
    renderRadar(container, artistData) {
      if (!artistData || Object.keys(artistData.data).length === 0) return;
      // 清除现有图表
      d3.select(container).selectAll("*").remove();
      // 获取容器实际尺寸
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;

      const margin = { top: 20, right: 20, bottom: 20, left: 20 };
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;
      const radius = Math.min(innerWidth, innerHeight) / 2;

      const svg = d3.select(container)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .append("g")
        .attr("transform", `translate(${margin.left + innerWidth/2},${margin.top + innerHeight/2})`);

      // 获取特征名称和数据
      const features = Object.keys(artistData.data);
      const values = Object.values(artistData.data);
      const levels = 4; // 减少层级数量以适应小尺寸

      // 角度比例尺
      const angleSlice = (Math.PI * 2) / features.length;

      // 半径比例尺 (数据已经是0-100范围)
      const rScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, radius]);

      // 创建雷达网格
      for (let level = 1; level <= levels; level++) {
        const levelFactor = radius * level / levels;

        // 绘制网格圆环
        svg.append("circle")
          .attr("r", levelFactor)
          .attr("fill", "none")
          .attr("stroke", "#e0e7ff")
          .attr("stroke-width", "0.5px");

        // 添加刻度标签（仅在最外层显示）
        if (level === levels) {
          svg.append("text")
            .attr("x", 0)
            .attr("y", -levelFactor + 5)
            .attr("font-size", "8px") // 减小字体
            .attr("fill", "#64748b")
            .text(100);
        }
      }

      // 绘制轴线
      features.forEach((feature, i) => {
        const angle = angleSlice * i + Math.PI / 3;

        // 绘制轴线
        svg.append("line")
          .attr("x1", 0)
          .attr("y1", 0)
          .attr("x2", radius * Math.cos(angle))
          .attr("y2", radius * Math.sin(angle))
          .attr("stroke", "#e0e7ff")
          .attr("stroke-width", "0.5px");

        // 添加特征标签
        const labelAngle = angleSlice * i;
        const labelRadius = radius + 8; // 减小标签距离

        svg.append("text")
          .attr("x", labelRadius * Math.cos(labelAngle))
          .attr("y", labelRadius * Math.sin(labelAngle))
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("font-size", "9px") // 减小字体
          .attr("fill", "#4b5563")
          .text(feature);
      });

      // 准备雷达图数据
      const coordinates = features.map((feature, i) => ({
        axis: feature,
        value: values[i],
        angle: angleSlice * i + Math.PI / 2
      }));

      // 创建雷达图线条生成器
      const line = d3.lineRadial()
        .angle(d => d.angle)
        .radius(d => rScale(d.value))
        .curve(d3.curveLinearClosed);

      // 绘制雷达区域
      svg.append("path")
        .datum(coordinates)
        .attr("d", line)
        .attr("fill", "#4a6cf7")
        .attr("fill-opacity", 0.1)
        .attr("stroke", "#4a6cf7")
        .attr("stroke-width", 1);

      // 添加数据点（小尺寸下去除数据点）
      // 添加数据值标签（小尺寸下去除数值标签）
    }
  }
};
</script>

<style scoped>
/* 主容器 - 完全移除滚动 */
.artist-prediction {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 头部样式 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px; /* 减小底部间距 */
  flex-shrink: 0;
}

.header h4 {
  margin: 0;
  color: #333333;
  font-size: 0.9rem; /* 稍微减小字体 */
  font-weight: 600;
}

/* Re-predict按钮 - 使用统一样式 */
.re-predict-btn {
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-surface);
  background-color: var(--color-primary-accent);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.re-predict-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0,0,0,0.2);
}

/* 权重选择区域 */
.weight-selection-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.selection-header {
  text-align: center;
  margin-bottom: 8px; /* 减小间距 */
  flex-shrink: 0;
}

.selection-header h4 {
  margin: 0 0 2px 0; /* 减小间距 */
  color: #333333;
  font-size: 0.8rem; /* 减小字体 */
}

.selection-subtitle {
  color: #666666;
  margin: 0;
  font-size: 0.65rem; /* 减小字体 */
}

/* 权重项目 - 改为3列2行网格布局，类似上方的艺术家选择框 */
.weight-items {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px; /* 减小间距 */
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
  margin-bottom: 8px; /* 减小间距 */
}

.weight-item {
  position: relative;
  display: flex;
  flex-direction: column;
}

/* 权重标签 - 类似艺术家选择框的label样式 */
.weight-label {
  margin-bottom: 3px; /* 减小间距 */
  font-size: 0.75rem; /* 减小字体 */
  color: #555;
  font-weight: 500;
}

/* 分数选择器 - 类似艺术家选择框的input样式 */
.score-select {
  padding: 4px; /* 减小内边距 */
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: white;
  font-size: 0.75rem; /* 减小字体 */
  width: 100%;
  box-sizing: border-box;
  color: #333333;
  cursor: pointer;
}

.score-select:focus {
  outline: none;
  border-color: #3498db;
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

/* 按钮区域 */
.selection-buttons {
  display: flex;
  justify-content: center;
  gap: 8px; /* 减小间距 */
  flex-shrink: 0;
}

/* Reset按钮 - 使用统一样式 */
.reset-btn {
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

.reset-btn:hover {
  background-color: var(--color-background, #e9ecef);
}

/* 主按钮 - 使用统一样式 */
.primary-btn {
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-surface);
  background-color: var(--color-primary-accent);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.primary-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0,0,0,0.2);
}

.primary-btn:disabled {
  color: var(--color-text-secondary);
  background-color: transparent;
  cursor: not-allowed;
  opacity: 0.5;
  box-shadow: none;
}

.primary-btn:disabled:hover {
  transform: none;
  box-shadow: none;
}

/* 错误消息 */
.error-message {
  padding: 4px 8px; /* 减小内边距 */
  background-color: #FFF3CD;
  color: #856404;
  border-radius: 4px;
  margin-bottom: 6px; /* 减小间距 */
  font-size: 0.7rem; /* 减小字体 */
  border: 1px solid #FFEAA7;
  flex-shrink: 0;
}

/* 结果展示区域 */
.results-section {
  flex: 1;
  display: flex;
  overflow: hidden;
  align-items: flex-start; /* 新增 */
}

.predicted-stars {
  flex: 1;
  display: flex;
}

/* 星级容器 - 横向布局 */
.stars-container {
  width: 100%;
  display: flex;
  gap: 3px; /* 减小间距 */
  padding: 0 2px; /* 减小内边距 */
  justify-content: space-between;
}

/* 星级卡片 - 垂直紧凑布局 */
.star-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px; /* 减小间距 */
  padding: 4px; /* 减小内边距 */
  background-color: #F8F9FA;
  border-radius: 6px;
  border: 1px solid #E0E0E0;
  transition: all 0.2s;
}

.star-card:hover {
  background-color: #F0F4F8;
  border-color: #A7C5EB;
}

/* 排名圆圈 */
.star-rank {
  width: 20px; /* 减小尺寸 */
  height: 20px; /* 减小尺寸 */
  background-color: #5D9CEC;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.7rem; /* 减小字体 */
  flex-shrink: 0;
}

/* 星级信息 */
.star-info {
  text-align: center;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px; /* 减小间距 */
  min-width: 0;
}

.star-name {
  font-weight: 600;
  font-size: 0.75rem; /* 减小字体 */
  color: #333333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* 优势标签 */
.star-strengths {
  display: flex;
  flex-direction: column;
  gap: 1px; /* 减小间距 */
  align-items: center;
}

.strength-tag {
  display: inline-block;
  background-color: #E3F2FD;
  color: #1976D2;
  padding: 1px 4px; /* 减小内边距 */
  border-radius: 3px;
  font-size: 0.6rem; /* 减小字体 */
  line-height: 1.2;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 雷达图容器 */
.star-radar {
  width: 100%;
  aspect-ratio: 1/1; /* 保持正方形比例 */
  flex-shrink: 0;
}

.radar-chart {
  height: 100%;
  width: 100%;
}

/* 响应式设计 - 权重选择框在小屏幕上变为单列 */
@media (max-width: 1200px) {
  .weight-items {
    grid-template-columns: repeat(2, 1fr); /* 中等屏幕显示2列 */
    gap: 8px;
  }

  .stars-container {
    flex-direction: column;
    gap: 4px; /* 减小间距 */
  }

  .star-card {
    flex-direction: row;
    justify-content: space-between;
    padding: 4px; /* 减小内边距 */
  }

  .star-info {
    text-align: left;
    flex: 1;
  }

  .star-strengths {
    flex-direction: row;
    gap: 3px; /* 减小间距 */
  }
}

@media (max-width: 800px) {
  .weight-items {
    grid-template-columns: 1fr; /* 小屏幕显示1列 */
  }

  /* 进一步压缩星级卡片 */
  .star-rank {
    width: 18px;
    height: 18px;
    font-size: 0.65rem;
  }

  .star-radar {
    width: 60px;
    height: 60px;
  }
}

@media (max-height: 700px) {
  /* 在屏幕高度较小时进一步压缩 */
  .header h4 {
    font-size: 0.85rem;
  }

  .selection-header h4 {
    font-size: 0.75rem;
  }

  .weight-label {
    font-size: 0.7rem;
  }

  .score-select {
    padding: 3px;
    font-size: 0.7rem;
  }
}
</style>

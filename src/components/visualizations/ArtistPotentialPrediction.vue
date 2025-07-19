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
              <ArtistRadarChart
                v-if="report.radar_data && report.radar_data[index]"
                :artistData="report.radar_data[index]"
                :width="80"
                :height="80"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useGraphStore } from '@/stores/graphStore';
import { loadOceanusDataAndPredict } from '@/services/dataService';
import ArtistRadarChart from './ArtistRadarChart.vue';

export default {
  name: 'ArtistPotentialPrediction',
  components: {
    ArtistRadarChart
  },
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
      weightScores: {}
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
}

.predicted-stars {
  flex: 1;
  display: flex;
  align-items: center;
}

/* 星级容器 - 横向布局 */
.stars-container {
  width: 100%;
  display: flex;
  gap: 6px; /* 减小间距 */
  padding: 0 2px; /* 减小内边距 */
  justify-content: space-between;
}

/* 星级卡片 - 垂直紧凑布局 */
.star-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px; /* 减小间距 */
  padding: 6px; /* 减小内边距 */
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

/* 雷达图 */
.star-radar {
  width: 70px; /* 减小尺寸 */
  height: 70px; /* 减小尺寸 */
  flex-shrink: 0;
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
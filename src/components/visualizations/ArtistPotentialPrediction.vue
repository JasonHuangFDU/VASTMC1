<template>
  <div class="artist-prediction">
    <div class="header">
      <h4>Oceanus Folk Stars Prediction</h4>
      <!-- 添加重新预测按钮 -->
      <button v-if="report" @click="resetPrediction" class="re-predict-btn">
        重新预测
      </button>
    </div>

    <!-- 权重排序区域 - 只在预测前显示 -->
    <div v-if="showWeightSelection" class="weight-selection-section">
      <div class="selection-header">
        <h3>请对以下权重因素进行排序</h3>
        <p class="selection-subtitle">(按重要性从高到低点击选择)</p>
      </div>

      <div class="selection-instruction" v-if="selectedWeights.length === 0">
        请点击下方因素开始排序（第一个点击的为最高权重）
      </div>

      <div class="selected-weights">
        <div v-for="(weight, index) in selectedWeights" :key="weight.id"
             class="weight-item selected" @click="removeWeight(weight.id)">
          <span class="order">{{ index + 1 }}</span>
          <span class="weight-label">{{ weight.label }}</span>
          <span class="weight-description">{{ weight.description }}</span>
          <span class="remove-btn">×</span>
        </div>
      </div>

      <div class="unselected-weights">
        <div v-for="weight in unselectedWeights" :key="weight.id"
             class="weight-item" @click="addWeight(weight.id)">
          <span class="weight-label">{{ weight.label }}</span>
          <span class="weight-description">{{ weight.description }}</span>
        </div>
      </div>

      <div class="selection-buttons">
        <button @click="resetWeights">重置排序</button>
        <button @click="runPrediction" :disabled="selectedWeights.length !== weightOrder.length"
                class="primary">
          {{ loading ? '分析中...' : '开始分析' }}
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
            <div class="star-header">
              <span class="rank">{{ index + 1 }}</span>
              <span class="name">{{ star.name }}</span>
              <span class="probability">{{ star.probability }}</span>
            </div>

            <div class="star-content">
              <div class="star-details">
                <div class="strengths">
                  <span v-for="(strength, sIndex) in star.strengths" :key="sIndex" class="strength-tag">
                    {{ strength }}
                  </span>
                </div>
              </div>

              <div class="star-radar">
                <ArtistRadarChart
                  v-if="report.radar_data && report.radar_data[index]"
                  :artistData="report.radar_data[index]"
                  :width="200"
                  :height="200"
                />
              </div>
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
      showWeightSelection: true, // 控制权重选择区域的显示
      weightOrder: [
        { id: 'influence_score', label: '影响力评分', description: '艺术家在行业中的影响力大小' },
        { id: 'creative_depth', label: '创作深度', description: '艺术家的创作能力和深度' },
        { id: 'label_weight', label: '唱片公司权重', description: '合作唱片公司的实力和资源' },
        { id: 'producer_count', label: '制作经验', description: '作为制作人的经验和作品数量' },
        { id: 'oceanus', label: 'Oceanus作品', description: '与Oceanus Folk相关的作品数量和质量' },
        { id: 'collab', label: '合作能力', description: '与其他艺术家的合作广度和深度' }
      ],
      selectedWeights: [] // 存储用户选择的权重顺序
    };
  },
  computed: {
    // 计算未选择的权重因素
    unselectedWeights() {
      return this.weightOrder.filter(weight =>
        !this.selectedWeights.some(selected => selected.id === weight.id)
      );
    }
  },
  methods: {
    // 添加权重因素（按点击顺序）
    addWeight(weightId) {
      const weight = this.weightOrder.find(w => w.id === weightId);
      if (weight) {
        this.selectedWeights.push(weight);
      }
    },

    // 移除权重因素
    removeWeight(weightId) {
      this.selectedWeights = this.selectedWeights.filter(w => w.id !== weightId);
    },

    // 重置权重排序
    resetWeights() {
      this.selectedWeights = [];
    },

    // 运行预测
    async runPrediction() {
      this.loading = true;
      this.error = null;
      this.report = null;

      try {
        const weightPreferences = this.selectedWeights.map(item => item.id);
        const result = await loadOceanusDataAndPredict(weightPreferences);
        this.report = result;
        // 预测完成后隐藏权重选择区域
        this.showWeightSelection = false;
        const predictedIds = result.predicted_stars.map(star => star.id);
        this.$emit('prediction-complete', predictedIds);
      } catch (error) {
        this.error = `预测失败: ${error.message}`;
        console.error('预测错误详情:', error);
      } finally {
        this.loading = false;
      }
    },

    // 重置整个预测
    resetPrediction() {
      this.showWeightSelection = true;
      this.report = null;
      this.error = null;
      this.selectedWeights = [];
    }
  }
};
</script>

<style scoped>
.artist-prediction {
  padding: 20px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  margin-top: 0px;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 0px;
}

.re-predict-btn {
  background-color: #6c757d;
  color: white;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
}

.re-predict-btn:hover {
  background-color: #5a6268;
}

.weight-selection-section {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.selection-header {
  text-align: center;
  margin-bottom: 20px;
}

.selection-header h3 {
  margin: 0;
  color: #2c3e50;
}

.selection-subtitle {
  color: #6c757d;
  margin-top: 5px;
  font-size: 0.9rem;
}

.selection-instruction {
  background-color: #e9ecef;
  padding: 10px 15px;
  border-radius: 4px;
  margin-bottom: 15px;
  color: #495057;
  font-size: 0.9rem;
  text-align: center;
}

.selected-weights, .unselected-weights {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
}

.weight-item {
  flex: 1 0 calc(33.333% - 10px);
  min-width: 300px;
  display: flex;
  align-items: center;
  padding: 12px 15px;
  background-color: white;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.weight-item:hover {
  border-color: #4a6cf7;
  box-shadow: 0 0 0 2px rgba(74, 108, 247, 0.2);
}

.weight-item.selected {
  border-color: #4a6cf7;
  background-color: #e0e7ff;
  padding-left: 35px;
}

.order {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  background-color: #4a6cf7;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.8rem;
}

.weight-label {
  font-weight: bold;
  color: #4a6cf7;
  min-width: 100px;
  margin-right: 10px;
}

.weight-description {
  color: #6c757d;
  font-size: 0.9rem;
  flex-grow: 1;
}

.remove-btn {
  margin-left: 10px;
  color: #dc3545;
  font-size: 1.2rem;
  font-weight: bold;
  width: 20px;
  text-align: center;
}

.selection-buttons {
  display: flex;
  justify-content: center;
  gap: 50px;
  margin-top: 0px;
}

.selection-buttons button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.selection-buttons button:first-child {
  background-color: #e9ecef;
  color: #495057;
}

.selection-buttons button.primary {
  background-color: #4a6cf7;
  color: white;
}

.selection-buttons button:disabled {
  background-color: #a0a0a0;
  cursor: not-allowed;
}

button {
  padding: 8px 16px;
  background-color: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  white-space: nowrap;
}

button:disabled {
  background-color: #a0a0a0;
  cursor: not-allowed;
}

.error-message {
  padding: 10px;
  background-color: #ffebee;
  color: #b71c1c;
  border-radius: 4px;
  margin-bottom: 10px;
  word-break: break-word;
}

.predicted-stars {
  margin-top: 0px;
}

.stars-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr));
  gap: 5px;
  width: 100%;
}

.star-card {
  padding: 20px;
  border-radius: 10px;
  background-color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  box-sizing: border-box;
  max-width: 100%;
}

.star-header {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
  flex-wrap: wrap;
}

.star-header .rank {
  width: 25px;
  height: 25px;
  background-color: #4a6cf7;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 10px;
  flex-shrink: 0;
}

.star-header .name {
  font-weight: bold;
  font-size: 12px;
  flex-grow: 1;
  min-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.star-header .probability {
  background-color: #e0e7ff;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: bold;
  color: #4a6cf7;
  font-size: 12px;
  flex-shrink: 0;
}

.star-content {
  display: flex;
  gap: 0px;
  flex-wrap: wrap;
}

.star-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 200px;
}

.strengths, .risks {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 5px;
}

.strength-tag {
  display: inline-block;
  background-color: #d1fae5;
  color: #047857;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 12px;
  word-break: break-word;
  max-width: 100%;
}

.risk-tag {
  display: inline-block;
  background-color: #fee2e2;
  color: #b91c1c;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 13px;
  word-break: break-word;
  max-width: 100%;
}

.star-radar {
  width: 220px;
  height: 220px;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .header {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .stars-container {
    grid-template-columns: 1fr;
  }

  .star-content {
    flex-direction: column;
  }

  .star-radar {
    width: 100%;
    height: 250px;
    margin-top: 15px;
  }

  .weight-item {
    flex: 1 0 100%;
  }

  .selection-buttons {
    flex-direction: column;
    gap: 10px;
  }

  .selection-buttons button {
    width: 100%;
  }

  .star-header .name {
    white-space: normal;
    min-width: auto;
  }
}

@media (max-width: 480px) {
  .star-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .star-header .rank,
  .star-header .probability {
    margin-right: 0;
  }

  .probability {
    align-self: flex-start;
  }

  .header button.re-predict-btn {
    width: 100%;
    margin-top: 10px;
  }
}
</style>

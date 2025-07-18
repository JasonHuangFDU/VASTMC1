<template>
  <div class="artist-prediction">
    <div class="header">
      <h4>Oceanus Folk Stars Prediction</h4>
      <button v-if="report" @click="resetPrediction" class="re-predict-btn">
        重新预测
      </button>
    </div>

    <!-- 权重排序区域 - 只在预测前显示 -->
    <div v-if="showWeightSelection" class="weight-selection-section">
      <div class="selection-header">
        <h4>Please rank the following weight factors.</h4>
        <p class="selection-subtitle">(Click to select in order of importance from highest to lowest.)</p>
      </div>

      <div class="selected-weights">
        <div v-for="(weight, index) in selectedWeights" :key="weight.id"
             class="weight-item selected" @click="removeWeight(weight.id)">
          <span class="order">{{ index + 1 }}</span>
          <span class="weight-label">{{ weight.label }}</span>
          <span class="remove-btn">×</span>
        </div>
      </div>

      <div class="unselected-weights">
        <div v-for="weight in unselectedWeights" :key="weight.id"
             class="weight-item" @click="addWeight(weight.id)">
          <span class="weight-label">{{ weight.label }}</span>
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
                  :width="130"
                  :height="130"
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
      showWeightSelection: true,
      weightOrder: [
        { id: 'influence_score', label: 'Influence', description: '艺术家在行业中的影响力大小' },
        { id: 'creative_depth', label: 'Creativity', description: '艺术家的创作能力和深度' },
        { id: 'label_weight', label: 'Record Company', description: '合作唱片公司的实力和资源' },
        { id: 'producer_count', label: 'Producer Experience', description: '作为制作人的经验和作品数量' },
        { id: 'oceanus', label: 'Oceanus Work', description: '与Oceanus Folk相关的作品数量和质量' },
        { id: 'collab', label: 'Collaboration', description: '与其他艺术家的合作广度和深度' }
      ],
      selectedWeights: []
    };
  },
  computed: {
    unselectedWeights() {
      return this.weightOrder.filter(weight =>
        !this.selectedWeights.some(selected => selected.id === weight.id)
      );
    }
  },
  methods: {
    addWeight(weightId) {
      const weight = this.weightOrder.find(w => w.id === weightId);
      if (weight) {
        this.selectedWeights.push(weight);
      }
    },
    removeWeight(weightId) {
      this.selectedWeights = this.selectedWeights.filter(w => w.id !== weightId);
    },
    resetWeights() {
      this.selectedWeights = [];
    },
    async runPrediction() {
      this.loading = true;
      this.error = null;
      this.report = null;

      try {
        const weightPreferences = this.selectedWeights.map(item => item.id);
        const result = await loadOceanusDataAndPredict(weightPreferences);
        this.report = result;
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
  margin-bottom: 0px;
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
  margin-bottom: 0px;
  border: 1px solid #e9ecef;
  transition: all 0.3s ease;
}

.selection-header {
  text-align: center;
  margin-bottom: 0px;
}

.selection-header h4 {
  margin: 0;
  color: #2c3e50;
  font-size: 1rem;
}

.selection-subtitle {
  color: #6c757d;
  margin-top: 0px;
  font-size: 0.8rem;
}

.selected-weights, .unselected-weights {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 5px;
}

.weight-item {
  flex: 0 0 calc(50% - 8px);
  min-width: 0;
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background-color: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  height: 36px;
  box-sizing: border-box;
}

.weight-item:hover {
  border-color: #4a6cf7;
  box-shadow: 0 0 0 2px rgba(74, 108, 247, 0.2);
}

.weight-item.selected {
  border-color: #4a6cf7;
  background-color: #e0e7ff;
  padding-left: 30px;
}

.order {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  background-color: #4a6cf7;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 0.7rem;
}

.weight-label {
  font-weight: bold;
  color: #4a6cf7;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 5px;
}

.remove-btn {
  margin-left: auto;
  color: #dc3545;
  font-size: 1rem;
  font-weight: bold;
  width: 16px;
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
  font-size: 0.85rem;
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
  font-size: 0.9rem;
}

.predicted-stars {
  margin-top: 0px;
}

.stars-container {
  display: flex;
  gap: 15px;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
}

.star-card {
  width: 160px;
  height: 250px;
  padding: 10px;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.star-header {
  display: flex;
  align-items: center;
  margin-bottom: 5px;
  flex-wrap: wrap;
  padding-bottom: 5px;
  border-bottom: 1px solid #f0f0f0;
}

.star-header .rank {
  width: 20px;
  height: 20px;
  background-color: #4a6cf7;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 5px;
  flex-shrink: 0;
  font-size: 0.75rem;
}

.star-header .name {
  font-weight: bold;
  font-size: 0.8rem;
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.star-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  gap: 8px;
  padding-top: 5px;
}

.star-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.strengths {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 4px;
  max-height: 60px;
  overflow-y: auto;
}

.strength-tag {
  display: inline-block;
  background-color: #d1fae5;
  color: #047857;
  padding: 3px 6px;
  border-radius: 3px;
  font-size: 0.7rem;
  word-break: break-word;
  max-width: 100%;
  line-height: 1.3;
}

.star-radar {
  height: 130px;
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
    flex-wrap: wrap;
    justify-content: center;
    max-width: 100%;
  }

  .weight-item {
    flex: 0 0 calc(50% - 8px);
  }

  .selection-buttons {
    flex-direction: column;
    gap: 10px;
  }

  .selection-buttons button {
    width: 100%;
  }
}

@media (max-width: 480px) {
  .star-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
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

  .weight-item {
    flex: 0 0 100%;
  }
}
</style>

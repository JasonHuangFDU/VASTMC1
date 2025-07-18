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

      <div class="weight-items">
        <div v-for="weight in weightOrder" :key="weight.id" class="weight-item">
          <div class="weight-info">
            <span class="weight-label">{{ weight.label }}</span>
          </div>
          <div class="score-selector">
            <select v-model="weightScores[weight.id]" class="score-select">
              <option v-for="n in 10" :key="n" :value="n">{{ n }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="selection-buttons">
        <button @click="resetScores">Reset</button>
        <button @click="runPrediction" :disabled="!allScoresSelected" class="primary">
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
.artist-prediction {
  padding: 15px;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  margin-top: 0px;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 0px;
}

.re-predict-btn {
  background-color: #6c757d;
  color: white;
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.85rem;
}

.re-predict-btn:hover {
  background-color: #5a6268;
}

.weight-selection-section {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 0px;
  border: 1px solid #e9ecef;
}

.selection-header {
  text-align: center;
  margin-bottom: 15px;
}

.selection-header h4 {
  margin: 0 0 5px 0;
  color: #2c3e50;
  font-size: 0.95rem;
}

.selection-subtitle {
  color: #6c757d;
  margin-top: 0;
  font-size: 0.75rem;
}

.weight-items {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 15px;
}

.weight-item {
  flex: 0 0 calc(50% - 4px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background-color: white;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  min-height: 40px;
  box-sizing: border-box;
}

.weight-item:hover {
  border-color: #4a6cf7;
}

.weight-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.weight-label {
  font-weight: 600;
  color: #4a6cf7;
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.score-selector {
  min-width: 60px;
  text-align: right;
}

.score-select {
  width: 100%;
  padding: 5px 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  background-color: white;
  font-size: 0.85rem;
  color: #495057;
  cursor: pointer;
  text-align: center;
}

.score-select:focus {
  border-color: #4a6cf7;
  outline: none;
}

.selection-buttons {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 10px;
}

.selection-buttons button {
  padding: 6px 14px;
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

.selection-buttons button:first-child:hover {
  background-color: #dde0e3;
}

.selection-buttons button.primary {
  background-color: #4a6cf7;
  color: white;
}

.selection-buttons button.primary:hover {
  background-color: #3a5ce5;
}

.selection-buttons button:disabled {
  background-color: #a0a0a0;
  cursor: not-allowed;
  opacity: 0.7;
}

.error-message {
  padding: 10px;
  background-color: #ffebee;
  color: #b71c1c;
  border-radius: 4px;
  margin-bottom: 10px;
  font-size: 0.85rem;
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
    gap: 10px;
  }

  .stars-container {
    flex-wrap: wrap;
    justify-content: center;
    max-width: 100%;
  }

  .selection-buttons {
    flex-direction: column;
    gap: 8px;
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

  .header button.re-predict-btn {
    width: 100%;
    margin-top: 8px;
  }

  .weight-item {
    flex: 0 0 100%;
  }
}
</style>

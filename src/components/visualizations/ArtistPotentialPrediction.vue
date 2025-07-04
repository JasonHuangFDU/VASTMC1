<!-- /components/visualizations/ArtistPotentialPrediction.vue -->
<template>
  <div class="artist-prediction">
    <div class="header">
      <h2>Oceanus Folk 艺术家潜力预测</h2>
      <button @click="runPrediction" :disabled="loading">
        {{ loading ? '分析中...' : '运行潜力预测' }}
      </button>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="report" class="results-section">
      <div class="top-artists">
        <h3>最具潜力艺术家 TOP 5</h3>
        <div class="artist-table">
          <table>
            <thead>
              <tr>
                <th>rank</th>
                <th>艺术家</th>
                <th>潜力指数</th>
                <th>最后活动</th>
                <th>Oceanus作品</th>
                <th>上榜作品</th>
                <th>影响力</th>
                <th>创作深度</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(artist, index) in report.top_artists" :key="artist.id">
                <td>{{ index + 1 }}</td>
                <td>{{ artist.name }}</td>
                <td>{{ artist.probability.toFixed(4) }}</td>
                <td>{{ artist.last_active }}</td>
                <td>{{ artist.oceanus_works }}</td>
                <td>{{ artist.notable_works }}</td>
                <td>{{ artist.influence_score.toFixed(1) }}</td>
                <td>{{ artist.creative_depth.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="predicted-stars">
        <h3>未来之星分析</h3>
        <div class="stars-container">
          <div v-for="(star, index) in report.predicted_stars" :key="index" class="star-card">
            <div class="star-header">
              <span class="rank">{{ index + 1 }}</span>
              <span class="name">{{ star.name }}</span>
              <span class="probability">{{ star.probability }}</span>
            </div>
            <div class="strengths">
              <strong>优势:</strong>
              <span v-for="(strength, sIndex) in star.strengths" :key="sIndex" class="strength-tag">
                {{ strength }}
              </span>
            </div>
            <div class="risks">
              <strong>风险因素:</strong>
              <span v-for="(risk, rIndex) in star.risk_factors" :key="rIndex" class="risk-tag">
                {{ risk }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
// import axios from 'axios';
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
      report: null
    };
  },
  methods: {
    async runPrediction() {
      this.loading = true;
      this.error = null;
      this.report = null;

      try {
        // 直接调用新函数加载 Oceanus 数据并进行预测
        const result = await loadOceanusDataAndPredict();
        this.report = result;
      } catch (error) {
        this.error = `预测失败: ${error.message}`;
        console.error('预测错误详情:', error);
      } finally {
        this.loading = false;
      }
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
  margin-top: 20px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

button {
  padding: 8px 16px;
  background-color: #4a6cf7;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
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
  margin-bottom: 20px;
}

.card-title {
  font-size: 14px;
  color: #6b7280;
  margin-bottom: 8px;
}

.card-value {
  font-size: 24px;
  font-weight: bold;
  color: #4a6cf7;
}

.card-companies {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.artist-table {
  margin-top: 15px;
  overflow-x: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th, td {
  padding: 12px 15px;
  text-align: left;
  border-bottom: 1px solid #e5e7eb;
}

th {
  background-color: #f9fafb;
  font-weight: 600;
  color: #4b5563;
}

tr:hover {
  background-color: #f3f4f6;
}

.predicted-stars {
  margin-top: 30px;
}

.stars-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-top: 15px;
}

.star-card {
  padding: 15px;
  border-radius: 8px;
  background-color: #f0f7ff;
  border: 1px solid #dbeafe;
}

.star-header {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.star-header .rank {
  width: 30px;
  height: 30px;
  background-color: #4a6cf7;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  margin-right: 10px;
}

.star-header .name {
  font-weight: bold;
  flex-grow: 1;
}

.star-header .probability {
  background-color: #e0e7ff;
  padding: 3px 8px;
  border-radius: 12px;
  font-weight: bold;
  color: #4a6cf7;
}

.strengths, .risks {
  margin-top: 8px;
  font-size: 14px;
}

.strength-tag {
  display: inline-block;
  background-color: #d1fae5;
  color: #047857;
  padding: 3px 8px;
  border-radius: 4px;
  margin: 3px 5px 3px 0;
  font-size: 12px;
}

.risk-tag {
  display: inline-block;
  background-color: #fee2e2;
  color: #b91c1c;
  padding: 3px 8px;
  border-radius: 4px;
  margin: 3px 5px 3px 0;
  font-size: 12px;
}
</style>

<template>
  <div class="artist-prediction">
    <div class="header">
      <h2>Oceanus Folk 艺术家潜力预测</h2>
      <button @click="showWeightDialog = true" :disabled="loading">
        {{ loading ? '分析中...' : '运行潜力预测' }}
      </button>
    </div>

    <!-- 权重排序对话框 -->
    <div v-if="showWeightDialog" class="weight-dialog">
      <div class="dialog-content">
        <h3>请对以下权重因素进行排序</h3>
        <p class="dialog-subtitle">(按重要性从高到低拖拽排序)</p>

        <draggable
          v-model="weightOrder"
          item-key="id"
          class="drag-container"
          handle=".drag-handle"
        >
          <template #item="{ element }">
            <div class="weight-item">
              <span class="drag-handle">☰</span>
              <span class="weight-label">{{ element.label }}</span>
              <span class="weight-description">{{ element.description }}</span>
            </div>
          </template>
        </draggable>

        <div class="dialog-buttons">
          <button @click="showWeightDialog = false">取消</button>
          <button @click="runPrediction" class="primary">开始分析</button>
        </div>
      </div>
    </div>

    <div v-if="error" class="error-message">
      {{ error }}
    </div>

    <div v-if="report" class="results-section">
      <div class="predicted-stars">
        <h3>未来之星分析</h3>
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

              <div class="star-radar">
                <ArtistRadarChart
                  v-if="report.radar_data && report.radar_data[index]"
                  :artistData="report.radar_data[index]"
                  :width="220"
                  :height="220"
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
// import axios from 'axios';
import { useGraphStore } from '@/stores/graphStore';
import { loadOceanusDataAndPredict } from '@/services/dataService';
import ArtistRadarChart from './ArtistRadarChart.vue';
import draggable from 'vuedraggable';

export default {
  name: 'ArtistPotentialPrediction',
  components: {
    ArtistRadarChart,
    draggable
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
      showWeightDialog: false,
      weightOrder: [
        { id: 'influence_score', label: '影响力评分', description: '艺术家在行业中的影响力大小' },
        { id: 'creative_depth', label: '创作深度', description: '艺术家的创作能力和深度' },
        { id: 'label_weight', label: '唱片公司权重', description: '合作唱片公司的实力和资源' },
        { id: 'producer_count', label: '制作经验', description: '作为制作人的经验和作品数量' },
        { id: 'oceanus', label: 'Oceanus作品', description: '与Oceanus Folk相关的作品数量和质量' },
        { id: 'collab', label: '合作能力', description: '与其他艺术家的合作广度和深度' }
      ]
    };
  },
  methods: {
    async runPrediction() {
      this.loading = true;
      this.error = null;
      this.report = null;
      this.showWeightDialog = false; // 关闭对话框

      try {
        // 获取用户排序的权重ID数组
        const weightPreferences = this.weightOrder.map(item => item.id);

        // 调用服务函数，传入权重偏好
        const result = await loadOceanusDataAndPredict(weightPreferences);
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

.top-artists {
  margin-bottom: 30px;
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
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 20px;
}

.star-card {
  padding: 20px;
  border-radius: 10px;
  background-color: #fff;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.star-header {
  display: flex;
  align-items: center;
  margin-bottom: 15px;
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
  font-size: 18px;
  flex-grow: 1;
}

.star-header .probability {
  background-color: #e0e7ff;
  padding: 5px 12px;
  border-radius: 20px;
  font-weight: bold;
  color: #4a6cf7;
  font-size: 16px;
}

.star-content {
  display: flex;
  gap: 20px;
}

.star-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.strengths, .risks {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 8px;
}

.strength-tag {
  display: inline-block;
  background-color: #d1fae5;
  color: #047857;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 13px;
}

.risk-tag {
  display: inline-block;
  background-color: #fee2e2;
  color: #b91c1c;
  padding: 5px 10px;
  border-radius: 4px;
  font-size: 13px;
}

.star-radar {
  width: 220px;
  height: 220px;
}

/* 权重排序对话框样式 */
.weight-dialog {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog-content {
  background-color: white;
  padding: 25px;
  border-radius: 10px;
  width: 90%;
  max-width: 600px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.2);
}

.dialog-content h3 {
  margin-top: 0;
  color: #2c3e50;
  text-align: center;
}

.dialog-subtitle {
  text-align: center;
  color: #7f8c8d;
  margin-top: -10px;
  margin-bottom: 20px;
}

.drag-container {
  margin: 20px 0;
  border: 1px solid #eee;
  border-radius: 8px;
  overflow: hidden;
}

.weight-item {
  display: flex;
  align-items: center;
  padding: 15px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #eee;
  cursor: move;
  transition: background-color 0.2s;
}

.weight-item:last-child {
  border-bottom: none;
}

.weight-item:hover {
  background-color: #e9ecef;
}

.drag-handle {
  margin-right: 15px;
  font-size: 20px;
  color: #6c757d;
  cursor: grab;
}

.weight-label {
  font-weight: bold;
  min-width: 140px;
  color: #4a6cf7;
}

.weight-description {
  color: #6c757d;
  font-size: 0.9rem;
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.dialog-buttons button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.dialog-buttons button:first-child {
  background-color: #e9ecef;
  color: #495057;
}

.dialog-buttons button.primary {
  background-color: #4a6cf7;
  color: white;
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
  }

  .weight-item {
    flex-direction: column;
    align-items: flex-start;
  }

  .drag-handle {
    margin-bottom: 10px;
  }

  .weight-label {
    margin-bottom: 5px;
  }
}
</style>

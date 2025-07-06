<template>
  <div class="q2-sankey-container">
    <header class="q2-header">
      <h3>Influence Analysis (Q2)</h3>
      <div class="controls">
        <button @click="loadData('q2_2')" :class="{ active: currentView === 'q2_2' }">
          Outward Influence
        </button>
        <button @click="loadData('q2_3')" :class="{ active: currentView === 'q2_3' }">
          Inward Inspirations
        </button>
      </div>
    </header>

    <main class="q2-main">
      <div v-if="loading" class="status">Loading Chart Data...</div>
      <div v-else-if="error" class="status error">{{ error }}</div>
      <InfluenceSankey v-if="chartData" :data="chartData" />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
// 导入已经存在的、负责渲染图表的InfluenceSankey组件
import InfluenceSankey from './visualizations/InfluenceSankey.vue'; 

// --- 这是Q2的 App.vue 中所有的 <script> 逻辑 ---
const loading = ref(true);
const error = ref(null);
const chartData = ref(null);
const currentView = ref('');

const dataFiles = {
  'q2_2': 'mc1_q2_2_data.json',
  'q2_3': 'mc1_q2_3_data.json'
};

const loadData = async (view) => {
  if (!dataFiles[view] || currentView.value === view) return;

  loading.value = true;
  error.value = null;
  currentView.value = view;
  
  try {
    const response = await fetch(`/${dataFiles[view]}`);
    if (!response.ok) throw new Error(`Could not load ${dataFiles[view]}`);
    chartData.value = await response.json();
  } catch (err) {
    error.value = err.message;
    chartData.value = null;
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadData('q2_2');
});
</script>

<style scoped>
/* --- 这里是Q2的 App.vue 中所有的 <style> 逻辑 --- */
/* 使用 scoped! 这能确保这里的样式只对本组件生效，绝不会污染全局样式 */

/* 定义本组件内部的颜色变量，避免与全局 :root 冲突 */
.q2-sankey-container {
  --q2-primary-color: #2c3e50;
  --q2-accent-color: #5d9cec;
  
  display: flex;
  flex-direction: column;
  height: 100%; /* 让组件填满父容器（left-column）的高度 */
}

.q2-header {
  margin-bottom: 1rem;
  text-align: center;
  flex-shrink: 0; /* 防止头部被压缩 */
}

.q2-header h3 {
  margin: 0 0 10px 0;
  font-weight: 600;
  color: var(--q2-primary-color);
}

.controls button {
  padding: 8px 16px; /* 调整大小以适应侧边栏 */
  margin: 0 5px;
  border: none;
  background-color: #e9ecef;
  color: var(--q2-primary-color);
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 500;
  transition: all 0.3s ease;
}

.controls button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0,0,0,0.08);
}

.controls button.active {
  background-color: var(--q2-accent-color);
  color: white;
}

.q2-main {
  /* 让 main 区域填满剩余空间并允许滚动 */
  flex-grow: 1;
  overflow: hidden; 
  position: relative; /* 为 status 定位提供参考 */
}

.status {
  padding: 2rem;
  font-size: 1rem;
  color: #888;
  text-align: center;
}

.error {
  color: #e74c3c;
}
</style>
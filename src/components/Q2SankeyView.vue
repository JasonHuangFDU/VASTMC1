<template>
  <div class="q2-sankey-container">
    <header class="q2-header">
      <h3>Influence Sankey</h3> <!-- 标题：Influence Flow Analysis -->
      <div class="controls"> <!-- 按钮容器 -->
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
      <InfluenceSankey v-if="chartData" :data="chartData" :currentView="currentView" @link-clicked="handleSankeyClick" />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import InfluenceSankey from './visualizations/InfluenceSankey.vue'; 
import { useGraphStore } from '@/stores/graphStore';
import { appColors } from '@/utils/colors'; // Import color definitions

const store = useGraphStore();
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

/**
 * Handle Sankey chart link click event logic
 */
const handleSankeyClick = (linkData) => {
  console.log("Sankey link clicked:", linkData);
  const { source, target } = linkData;
  console.log(`Sankey link clicked in view '${currentView.value}':`, source, '->', target);

  let payload = null;

  // --- Outward Influence (q2_2) ---
  if (currentView.value === 'q2_2') {
    // Scenario 1: Oceanus Folk -> Genre
    if (source.name === 'Oceanus Folk' && target.type === 'Genre') {
      payload = {
        type: 'outward_oceanus_to_genre',
        params: { genre: target.name }
      };
    }
    // Scenario 2: Genre -> Artist
    else if (source.type === 'Genre' && target.type === 'Artist') {
      payload = {
        type: 'outward_genre_to_artist',
        params: { 
          genre: source.name, 
          artist_id: target.id 
        }
      };
    }
  }
  // --- Inward Inspirations (q2_3) ---
  else if (currentView.value === 'q2_3') {
    // Scenario 3: Genre -> Artist
    if (source.type === 'Genre' && target.type === 'Artist') {
      payload = {
        type: 'inward_genre_to_artist',
        params: { genre: source.name, artist: target.name }
      };
    }
    // Scenario 4: Artist -> Oceanus Folk
    else if (source.type === 'Artist' && target.name === 'Oceanus Folk') {
      payload = {
        type: 'inward_artist_to_oceanus',
        params: { artist: source.name }
      };
    }
  }

  if (payload) {
    store.filterGraphForSankey(payload);
  } else {
    console.warn("Sankey click did not match any known interaction patterns.");
  }
};

onMounted(() => {
  loadData('q2_2'); 
});
</script>

<style scoped>
.q2-sankey-container {
  display: flex;
  flex-direction: column;
  height: 100%; 
  font-family: 'Inter', sans-serif; 
}

.q2-header {
  margin-bottom: 1rem;
  text-align: center;
  flex-shrink: 0; 
}

.q2-header h3 {
  margin: 0 0 10px 0;
  font-weight: 600;
  color: var(--color-text-primary); 
}

/* --- 按钮布局修改为横向 --- */
.controls {
  display: flex; /* 使用 Flexbox 实现横向布局 */
  flex-direction: row; /* 明确设置为行方向 */
  justify-content: center; /* 按钮居中 */
  gap: 10px; /* 按钮之间的间距 */
  background-color: var(--color-background);
  border-radius: 8px;
  padding: 4px;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
  margin-top: 10px; /* 与标题的间距 */
}

.controls button {
  padding: 8px 16px; 
  border: none;
  background-color: transparent; 
  color: var(--color-text-secondary); 
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
  background-color: var(--color-primary-accent); 
  color: var(--color-surface); 
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.q2-main {
  flex-grow: 1;
  overflow: hidden; 
  position: relative; 
}

.status {
  padding: 2rem;
  font-size: 1rem;
  color: var(--color-text-light); 
  text-align: center;
}

.error {
  color: #e74c3c; 
}
</style>

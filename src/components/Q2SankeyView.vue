<template>
  <div class="q2-sankey-container">
    <header class="q2-header">
      <h3 class="section-title">Oceanus Folk Influence Analysis</h3>
    </header>

    <main class="q2-main">
      <div class="sankey-panels">
        <!-- Outward Panel -->
        <div class="sankey-panel">
          <div class="panel-header">
            <h4 class="panel-title">Outward Influence</h4>
            <div class="panel-controls">
              <div class="slider-group">
                <label>Top Genres: {{ topNGenres }}</label>
                <input 
                  type="range" 
                  v-model="topNGenres" 
                  min="5" 
                  max="15" 
                  step="1"
                  class="slider"
                />
              </div>
            </div>
          </div>
          <div class="panel-content">
            <div v-if="loadingOutward" class="status">Loading...</div>
            <div v-else-if="errorOutward" class="status error">{{ errorOutward }}</div>
            <InfluenceSankey 
              v-if="outwardData" 
              :data="outwardData" 
              :currentView="'q2_2'" 
              :topNGenres="topNGenres"
              @link-clicked="handleSankeyClick" 
            />
          </div>
        </div>

        <!-- Inward Panel -->
        <div class="sankey-panel">
          <div class="panel-header">
            <h4 class="panel-title">Inward Influence</h4>
            <div class="panel-controls">
              <div class="slider-group">
                <label>Top Artists: {{ topNArtists }}</label>
                <input 
                  type="range" 
                  v-model="topNArtists" 
                  min="10" 
                  max="50" 
                  step="2"
                  class="slider"
                />
              </div>
            </div>
          </div>
          <div class="panel-content">
            <div v-if="loadingInward" class="status">Loading...</div>
            <div v-else-if="errorInward" class="status error">{{ errorInward }}</div>
            <InfluenceSankey 
              v-if="inwardData" 
              :data="inwardData" 
              :currentView="'q2_3'" 
              :topNArtists="topNArtists"
              @link-clicked="handleSankeyClick" 
            />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import InfluenceSankey from './visualizations/InfluenceSankey.vue'; 
import { useGraphStore } from '@/stores/graphStore';

const store = useGraphStore();

// 数据状态
const outwardData = ref(null);
const inwardData = ref(null);
const loadingOutward = ref(true);
const loadingInward = ref(true);
const errorOutward = ref(null);
const errorInward = ref(null);

// 滑块控制变量
const topNGenres = ref(10);  // Outward视图的流派数量
const topNArtists = ref(30); // Inward视图的艺术家数量

const loadOutwardData = async () => {
  loadingOutward.value = true;
  errorOutward.value = null;
  
  try {
    const response = await fetch('/mc1_q2_2_data_new.json');
    if (!response.ok) throw new Error('Could not load outward data');
    outwardData.value = await response.json();
  } catch (err) {
    errorOutward.value = err.message;
    outwardData.value = null;
  } finally {
    loadingOutward.value = false;
  }
};

const loadInwardData = async () => {
  loadingInward.value = true;
  errorInward.value = null;
  
  try {
    const response = await fetch('/mc1_q2_3_data_new.json');
    if (!response.ok) throw new Error('Could not load inward data');
    inwardData.value = await response.json();
  } catch (err) {
    errorInward.value = err.message;
    inwardData.value = null;
  } finally {
    loadingInward.value = false;
  }
};

const handleSankeyClick = (linkData) => {
  console.log("Sankey link clicked:", linkData);
  const { source, target } = linkData;

  let payload = null;

  // 根据数据结构判断是哪个视图
  if (source.name === 'Oceanus Folk' && target.type === 'Genre') {
    // Outward视图
    payload = {
      type: 'outward_oceanus_to_genre',
      params: { genre: target.name }
    };
  } else if (source.type === 'Genre' && target.type === 'Artist' && source.name !== 'Oceanus Folk') {
    // Outward视图的Genre到Artist
    payload = {
      type: 'outward_genre_to_artist',
      params: { 
        genre: source.name, 
        artist_id: target.original_id 
      }
    };
  } else if (source.type === 'Artist' && target.name === 'Oceanus Folk') {
    // Inward视图的Artist到Oceanus Folk
    payload = {
      type: 'inward_artist_to_oceanus',
      params: { artist_id: source.original_id } // <-- 已修正
    };
  } else if (source.type === 'Genre' && target.type === 'Artist' && !linkData.isOutward) {
    // Inward��图的Genre到Artist
    payload = {
      type: 'inward_genre_to_artist',
      params: { genre: source.name, artist_id: target.original_id } // <-- 已修正
    };
  }

  if (payload) {
    store.filterGraphForSankey(payload);
  } else {
    console.warn("Sankey click did not match any known interaction patterns.");
  }
};

onMounted(() => {
  loadOutwardData();
  loadInwardData();
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
  margin-bottom: 8px;
  flex-shrink: 0;
  text-align: center;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.q2-main {
  flex-grow: 1;
  overflow: hidden;
}

.sankey-panels {
  display: flex;
  gap: 8px;
  height: 100%;
}

.sankey-panel {
  flex: 1 1 50%; /* 确保各占一半 */
  min-width: 0; /* 允许收缩 */
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-surface);
  overflow: hidden;
}

.panel-header {
  padding: 8px 10px;
  background-color: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  min-height: 32px; /* 确保头部高度一致 */
}

.panel-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
  flex-shrink: 0; /* 防止标题被压缩 */
}

.panel-controls {
  display: flex;
  align-items: center;
  flex-shrink: 0; /* 防止控件被压缩 */
}

.slider-group {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap; /* 防止换行 */
}

.slider-group label {
  font-size: 10px;
  color: var(--color-text-secondary);
  font-weight: 500;
  white-space: nowrap;
  min-width: 65px; /* 确保标签宽度一致 */
}

.slider {
  width: 70px; /* 固定滑块宽度 */
  height: 3px;
  border-radius: 2px;
  background: var(--color-border);
  outline: none;
  -webkit-appearance: none;
  flex-shrink: 0; /* 防止滑块被压缩 */
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-primary-accent);
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-primary-accent);
  cursor: pointer;
  border: none;
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.panel-content {
  flex-grow: 1;
  position: relative;
  overflow: hidden;
}

.status {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
  color: var(--color-text-light);
  text-align: center;
}

.error {
  color: #e74c3c;
}
</style>
<template>
  <div class="q2-sankey-container">
    <header class="q2-header">
      <div class="global-controls">
        <div class="control-group">
          <div class="slider-group">
            <label>Top Genres: {{ topNGenres }}</label>
            <input 
              type="range" 
              v-model="topNGenres" 
              min="3" 
              max="10" 
              step="1"
              class="slider"
            />
          </div>
          <div class="slider-group">
            <label>Top Artists: {{ topNArtists }}</label>
            <input 
              type="range" 
              v-model="topNArtists" 
              min="5" 
              max="25" 
              step="1"
              class="slider"
            />
          </div>
        </div>
      </div>
    </header>

    <main class="q2-main">
      <div class="sankey-panels">
        <!-- Outward Panel -->
        <div class="sankey-panel">
          <div class="panel-header">
            <h4 class="panel-title">
              <span class="panel-icon">→</span>
              Outward Influence
            </h4>
          </div>
          <div class="panel-content">
            <div v-if="loadingOutward" class="status">
              <div class="loading-spinner"></div>
              <span>Loading outward data...</span>
            </div>
            <div v-else-if="errorOutward" class="status error">
              <span class="error-icon">⚠</span>
              {{ errorOutward }}
            </div>
            <InfluenceSankey 
              v-if="outwardData && !loadingOutward" 
              :key="`outward-${topNGenres}-${topNArtists}`"
              :data="outwardData" 
              :currentView="'q2_2'" 
              :topNGenres="topNGenres"
              :topNArtists="topNArtists"
              @link-clicked="handleSankeyClick" 
            />
          </div>
        </div>

        <!-- Inward Panel -->
        <div class="sankey-panel">
          <div class="panel-header">
            <h4 class="panel-title">
              <span class="panel-icon">←</span>
              Inward Influence
            </h4>
          </div>
          <div class="panel-content">
            <div v-if="loadingInward" class="status">
              <div class="loading-spinner"></div>
              <span>Loading inward data...</span>
            </div>
            <div v-else-if="errorInward" class="status error">
              <span class="error-icon">⚠</span>
              {{ errorInward }}
            </div>
            <InfluenceSankey 
              v-if="inwardData && !loadingInward" 
              :key="`inward-${topNGenres}-${topNArtists}`"
              :data="inwardData" 
              :currentView="'q2_3'" 
              :topNGenres="topNGenres"
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
import { ref, onMounted, watch } from 'vue';
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

// 全局控制变量 - 同时控制两个桑基图
const topNGenres = ref(6);   // 默认显示5个流派
const topNArtists = ref(10); // 默认显示10个艺术家

const loadOutwardData = async () => {
  loadingOutward.value = true;
  errorOutward.value = null;
  
  try {
    const response = await fetch('/mc1_q2_2_data_new.json');
    if (!response.ok) {
      throw new Error(`Failed to load outward data: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    
    // 验证数据结构
    if (!data.nodes || !data.links || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      throw new Error('Invalid data structure: missing nodes or links arrays');
    }
    
    // 验证数据内容
    console.log('Outward data sample nodes:', data.nodes.slice(0, 3));
    console.log('Outward data sample links:', data.links.slice(0, 3));
    
    outwardData.value = data;
    console.log('Outward data loaded successfully:', data.nodes.length, 'nodes,', data.links.length, 'links');
  } catch (err) {
    console.error('Error loading outward data:', err);
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
    if (!response.ok) {
      throw new Error(`Failed to load inward data: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    
    // 验证数据结构
    if (!data.nodes || !data.links || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      throw new Error('Invalid data structure: missing nodes or links arrays');
    }
    
    // 验证数据内容
    console.log('Inward data sample nodes:', data.nodes.slice(0, 3));
    console.log('Inward data sample links:', data.links.slice(0, 3));
    
    inwardData.value = data;
    console.log('Inward data loaded successfully:', data.nodes.length, 'nodes,', data.links.length, 'links');
  } catch (err) {
    console.error('Error loading inward data:', err);
    errorInward.value = err.message;
    inwardData.value = null;
  } finally {
    loadingInward.value = false;
  }
};

const handleSankeyClick = (linkData) => {
  console.log("Sankey link clicked:", linkData);
  const { source, target, currentView } = linkData;

  let payload = null;

  // 根据链接类型判断交互类型
  if (source.name === 'Oceanus Folk' && 
      (target.type === 'genre' || target.type === 'Genre')) {
    // Oceanus Folk → Genre （两个视图都可能有这种链接）
    payload = {
      type: currentView === 'q2_2' ? 'outward_oceanus_to_genre' : 'inward_oceanus_to_genre',
      params: { genre: target.name }
    };
  } else if ((source.type === 'genre' || source.type === 'Genre') && 
             (target.type === 'artist' || target.type === 'Artist')) {
    // Genre → Artist （两个视图都可能有这种链接）
    payload = {
      type: currentView === 'q2_2' ? 'outward_genre_to_artist' : 'inward_genre_to_artist',
      params: { 
        genre: source.name, 
        artist_id: target.original_id || target.id,
        artist_name: target.name
      }
    };
  }

  if (payload && store.filterGraphForSankey) {
    try {
      store.filterGraphForSankey(payload);
      console.log('Graph filter applied:', payload);
    } catch (err) {
      console.error('Error applying graph filter:', err);
    }
  } else {
    console.warn("Sankey click did not match any known interaction patterns or store method not available.");
  }
};

// 监听数据变化和滑块变化，确保组件响应调整
watch([topNGenres, topNArtists], ([newGenres, newArtists], [oldGenres, oldArtists]) => {
  console.log(`Filter parameters changed: Genres=${newGenres} (was ${oldGenres}), Artists=${newArtists} (was ${oldArtists})`);
  // Vue的响应式系统会自动重新渲染桑基图
}, { immediate: false });

// 监听数据加载状态，当数据加载完成后记录信息
watch([() => outwardData.value, () => inwardData.value], ([outward, inward]) => {
  if (outward && inward) {
    console.log('Both datasets ready:', {
      outward: { nodes: outward.nodes?.length, links: outward.links?.length },
      inward: { nodes: inward.nodes?.length, links: inward.links?.length }
    });
  }
}, { immediate: true });

onMounted(async () => {
  console.log('Q2SankeyView mounted, starting data load...');
  
  // 并行加载两个数据文件
  try {
    await Promise.all([
      loadOutwardData(),
      loadInwardData()
    ]);
    console.log('Both datasets loaded successfully');
  } catch (err) {
    console.error('Error loading datasets:', err);
  }
});
</script>

<style scoped>
.q2-sankey-container {
  display: flex;
  flex-direction: column;
  height: 100%; 
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: var(--color-background);
}

.q2-header {
  padding: 8px 16px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.global-controls {
  display: flex;
  justify-content: center;
}

.control-group {
  display: flex;
  gap: 24px;
  align-items: center;
}

.slider-group {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background-color: var(--color-background);
  border-radius: 6px;
  border: 1px solid var(--color-border);
}

.slider-group label {
  font-size: 12px;
  color: var(--color-text-secondary);
  font-weight: 600;
  white-space: nowrap;
  min-width: 85px;
}

.slider {
  width: 80px;
  height: 4px;
  border-radius: 2px;
  background: var(--color-border);
  outline: none;
  -webkit-appearance: none;
  transition: background 0.2s ease;
}

.slider:hover {
  background: var(--color-border-hover, var(--color-border));
}

.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-primary-accent);
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  transition: transform 0.2s ease;
}

.slider::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-primary-accent);
  cursor: pointer;
  border: none;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.q2-main {
  flex-grow: 1;
  padding: 16px;
  overflow: hidden;
}

.sankey-panels {
  display: flex;
  gap: 16px;
  height: 100%;
}

.sankey-panel {
  flex: 1 1 50%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background-color: var(--color-surface);
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.panel-header {
  padding: 12px 16px;
  background: linear-gradient(135deg, var(--color-background) 0%, var(--color-surface) 100%);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.panel-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-icon {
  font-size: 14px;
  color: var(--color-primary-accent);
  font-weight: 900;
  font-family: Arial, sans-serif;
}

.panel-content {
  flex-grow: 1;
  position: relative;
  overflow: hidden;
  background-color: var(--color-surface);
}

.status {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
  text-align: center;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-top: 2px solid var(--color-primary-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.error {
  color: #e74c3c;
}

.error-icon {
  font-size: 20px;
  color: #e74c3c;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .control-group {
    gap: 16px;
  }
  
  .slider-group {
    padding: 6px 10px;
  }
  
  .slider-group label {
    min-width: 75px;
    font-size: 11px;
  }
  
  .slider {
    width: 70px;
  }
}

@media (max-width: 768px) {
  .sankey-panels {
    flex-direction: column;
    gap: 12px;
  }
  
  .control-group {
    flex-direction: column;
    gap: 12px;
  }
}
</style>
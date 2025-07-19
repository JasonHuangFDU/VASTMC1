<template>
  <div class="q2-sankey-container">
    <header class="q2-header">
      <!-- 模式切换按钮 -->
      <div class="mode-toggle-container">
        <div class="mode-toggle-group">
          <button
            @click="setViewMode('direction')"
            :class="['mode-toggle-button', 'left-button', { active: viewMode === 'direction' }]"
          >
            Direction Comparison
          </button>
          <button
            @click="setViewMode('temporal')"
            :class="['mode-toggle-button', 'right-button', { active: viewMode === 'temporal' }]"
          >
            Temporal Comparison
          </button>
        </div>
      </div>

      <!-- 全局控制滑块 -->
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
        <!-- 左侧面板 -->
        <div class="sankey-panel">
          <div class="panel-header">
            <h4 class="panel-title">
              <span class="panel-icon">{{ leftPanelIcon }}</span>
              {{ leftPanelTitle }}
            </h4>
          </div>
          <div class="panel-content">
            <div v-if="loadingLeft" class="status">
              <div class="loading-spinner"></div>
              <span>Loading data...</span>
            </div>
            <div v-else-if="errorLeft" class="status error">
              <span class="error-icon">⚠</span>
              {{ errorLeft }}
            </div>
            <InfluenceSankey 
              v-if="leftChartData && !loadingLeft" 
              :key="`left-${viewMode}-${topNGenres}-${topNArtists}`"
              :data="leftChartData" 
              :currentView="leftViewType" 
              :topNGenres="topNGenres"
              :topNArtists="topNArtists"
              @link-clicked="handleSankeyClick" 
            />
          </div>
        </div>

        <!-- 右侧面板 -->
        <div class="sankey-panel">
          <div class="panel-header">
            <h4 class="panel-title">
              <span class="panel-icon">{{ rightPanelIcon }}</span>
              {{ rightPanelTitle }}
            </h4>
          </div>
          <div class="panel-content">
            <div v-if="loadingRight" class="status">
              <div class="loading-spinner"></div>
              <span>Loading data...</span>
            </div>
            <div v-else-if="errorRight" class="status error">
              <span class="error-icon">⚠</span>
              {{ errorRight }}
            </div>
            <InfluenceSankey 
              v-if="rightChartData && !loadingRight" 
              :key="`right-${viewMode}-${topNGenres}-${topNArtists}`"
              :data="rightChartData" 
              :currentView="rightViewType" 
              :topNGenres="topNGenres"
              :topNArtists="topNArtists"
              @link-clicked="handleInwardSankeyClick" 
            />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import InfluenceSankey from './visualizations/InfluenceSankey.vue'; 
import { useGraphStore } from '@/stores/graphStore';

const store = useGraphStore();

// 四个数据集
const sankeyDataSets = ref({
  outwardAll: null,      // mc1_outward_all.json
  inwardAll: null,       // mc1_inward_all.json
  inwardPre2028: null,   // mc1_inward_pre2028.json
  inwardPost2028: null   // mc1_q2_3_data_new.json (原mc1_q2_3_data_new.json)
});

// 当前显示模式
const viewMode = ref('direction'); // 'direction' | 'temporal'

// 当前显示的数据
const leftChartData = ref(null);
const rightChartData = ref(null);

// 加载状态
const loadingLeft = ref(true);
const loadingRight = ref(true);
const errorLeft = ref(null);
const errorRight = ref(null);

// 全局控制变量
const topNGenres = ref(6);
const topNArtists = ref(10);

// 计算属性：根据模式确定面板标题和图标
const leftPanelTitle = computed(() => {
  return viewMode.value === 'direction' ? 'Outward' : 'Pre-2028';
});

const rightPanelTitle = computed(() => {
  return viewMode.value === 'direction' ? 'Inward' : 'Post-2028';
});

const leftPanelIcon = computed(() => {
  return viewMode.value === 'direction' ? '→' : '←';
});

const rightPanelIcon = computed(() => {
  return '←';
});

// 计算属性：确定当前视图类型（用于InfluenceSankey组件）
const leftViewType = computed(() => {
  return viewMode.value === 'direction' ? 'q2_2' : 'q2_3_pre';
});

const rightViewType = computed(() => {
  return viewMode.value === 'direction' ? 'q2_3' : 'q2_3_post';
});

// 加载单个数据文件
const loadDataFile = async (filename) => {
  try {
    const response = await fetch(`/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${filename}: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    
    // 验证数据结构
    if (!data.nodes || !data.links || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      throw new Error(`Invalid data structure in ${filename}: missing nodes or links arrays`);
    }
    
    console.log(`${filename} loaded:`, data.nodes.length, 'nodes,', data.links.length, 'links');
    return data;
  } catch (err) {
    console.error(`Error loading ${filename}:`, err);
    throw err;
  }
};

// 加载所有数据
const loadAllData = async () => {
  console.log('Loading all sankey data files...');
  
  try {
    // 并行加载所有数据文件
    const [outwardAll, inwardAll, inwardPre2028, inwardPost2028] = await Promise.all([
      loadDataFile('mc1_outward_all.json'),
      loadDataFile('mc1_inward_all.json'),
      loadDataFile('mc1_inward_pre2028.json'),
      loadDataFile('mc1_inward_post2028.json')
    ]);
    
    sankeyDataSets.value = {
      outwardAll,
      inwardAll,
      inwardPre2028,
      inwardPost2028
    };
    
    console.log('All data files loaded successfully');
    
    // 更新当前显示的数据
    updateChartData();
  } catch (err) {
    console.error('Error loading data files:', err);
    errorLeft.value = 'Failed to load data';
    errorRight.value = 'Failed to load data';
  }
};

// 切换视图模式
const setViewMode = (mode) => {
  console.log('Switching view mode to:', mode);
  viewMode.value = mode;
  updateChartData();
};

// 更新图表数据
const updateChartData = () => {
  loadingLeft.value = true;
  loadingRight.value = true;
  errorLeft.value = null;
  errorRight.value = null;
  
  try {
    if (viewMode.value === 'direction') {
      // 方向对比模式：Outward vs Inward (All)
      leftChartData.value = sankeyDataSets.value.outwardAll;
      rightChartData.value = sankeyDataSets.value.inwardAll;
    } else {
      // 时间对比模式：Inward (Pre-2028) vs Inward (Post-2028)
      leftChartData.value = sankeyDataSets.value.inwardPre2028;
      rightChartData.value = sankeyDataSets.value.inwardPost2028;
    }
    
    console.log('Chart data updated for mode:', viewMode.value);
  } catch (err) {
    console.error('Error updating chart data:', err);
    errorLeft.value = 'Error updating chart';
    errorRight.value = 'Error updating chart';
  } finally {
    loadingLeft.value = false;
    loadingRight.value = false;
  }
};

// 处理Outward桑基图点击事件
const handleSankeyClick = (eventData) => {
  // 只在 "Direction Comparison" (Outward) 模式下响应点击
  if (viewMode.value !== 'direction') return;

  console.log("Outward Sankey link clicked:", eventData);
  
  const { source, target } = eventData;

  if (source && target) {
      // 桑基图的节点对象包含了所有原始数据，包括id和name
      // 我们将整个节点对象传递给store，让store来决定如何使用
      store.triggerSankeyInteraction(source, target);
  } else {
      console.warn("Invalid data received from Sankey component:", eventData);
  }
};

// 处理Inward桑基图点击事件
const handleInwardSankeyClick = (eventData) => {
  console.log("Inward Sankey link clicked:", eventData);
  
  const { source, target } = eventData;

  if (source && target) {
      // 调用 store 中为 inward 设计的新 action
      store.triggerInwardSankeyInteraction(source, target);
  } else {
      console.warn("Invalid data received from Inward Sankey component:", eventData);
  }
};

// 监听数据变化
watch([topNGenres, topNArtists], ([newGenres, newArtists]) => {
  console.log(`Filter parameters changed: Genres=${newGenres}, Artists=${newArtists}`);
});

onMounted(async () => {
  console.log('Q2SankeyView mounted, starting data load...');
  await loadAllData();
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
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

/* 模式切换按钮样式 */
.mode-toggle-container {
  display: flex;
  justify-content: center;
  padding: 4px 0;
}

.mode-toggle-group {
  display: inline-flex;
  background-color: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 2px;
}

.mode-toggle-button {
  padding: 6px 16px;
  font-size: 0.85rem;
  font-weight: 600;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: transparent;
  color: var(--color-text-secondary);
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  outline: none;
  position: relative;
}

.mode-toggle-button.left-button {
  border-radius: 4px 0 0 4px;
}

.mode-toggle-button.right-button {
  border-radius: 4px;
}

.mode-toggle-button:hover:not(.active) {
  background-color: rgba(93, 156, 236, 0.1);
  color: var(--color-text-primary);
}

.mode-toggle-button.active {
  background-color: var(--color-primary-accent);
  color: white;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

/* 全局控制样式 */
.global-controls {
  display: flex;
  justify-content: center;
  width: 100%;
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
}

.slider-group label {
  font-size: 0.9rem;
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
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-icon {
  font-size: 0.9rem;
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
  font-size: 0.9rem;
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
  font-size: 0.9rem;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .control-group {
    gap: 16px;
  }
  
  .slider-group label {
    min-width: 75px;
    font-size: 0.9rem;
  }
  
  .slider {
    width: 70px;
  }
  
  .mode-toggle-button {
    padding: 5px 12px;
    font-size: 0.8rem;
  }
}

@media (max-width: 768px) {
  .q2-header {
    padding: 6px 12px;
  }
  
  .sankey-panels {
    flex-direction: column;
    gap: 12px;
  }
  
  .control-group {
    flex-direction: column;
    gap: 12px;
  }
  
  .mode-toggle-button {
    padding: 4px 10px;
    font-size: 0.75rem;
  }
}
</style>
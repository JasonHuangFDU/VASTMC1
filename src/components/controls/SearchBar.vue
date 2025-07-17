<template>
  <div class="search-bar-container" v-on-click-outside="closeDropdowns">
    <div class="filter-group search-group">
      <label for="search-input-field" class="search-label">Center Node:</label>
      <div class="search-input-wrapper">
        <input
          id="search-input-field"
          type="text"
          v-model="localSearchQuery"
          @input="updateSuggestions"
          @focus="showSuggestions = true"
          placeholder="Type to search..." 
          class="search-input"
          autocomplete="off"
        />
        <div class="search-buttons">
          <button @click="confirmSearch" class="search-confirm-btn">Confirm</button>
          <button @click="clearSearch" class="search-clear-btn">Clear</button>
        </div>
        <div v-if="showSuggestions && suggestions.length > 0" class="suggestions-list">
          <div
            v-for="suggestion in suggestions"
            :key="suggestion.id"
            class="suggestion-item"
            @mousedown="selectSuggestion(suggestion)"
          >
            {{ suggestion.name }} (id: {{ suggestion.id }})
          </div>
        </div>
      </div>
    </div>

    <div class="filter-group time-range-group">
      <label>Time Range:</label>
      <div class="time-select-wrapper">
        <select
          :value="selectedTimeRange.start"
          @change="store.setTimeRange({ start: parseInt($event.target.value, 10), end: selectedTimeRange.end })"
          class="time-select"
        >
          <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
        </select>
        <span>-</span>
        <select
          :value="selectedTimeRange.end"
          @change="store.setTimeRange({ start: selectedTimeRange.start, end: parseInt($event.target.value, 10) })"
          class="time-select"
        >
          <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
        </select>
      </div>
    </div>

    <div class="filter-group dropdown-group">
      <div class="dropdown">
        <button @click="toggleDropdown('genres')" class="dropdown-toggle">Genres ({{ selectedGenres.length || 'All' }})</button>
        <div v-if="activeDropdown === 'genres'" class="dropdown-menu long-dropdown">
          <div v-for="genre in filterOptions.genres" :key="genre" class="dropdown-item">
            <input type="checkbox" :id="`genre-${genre}`" :value="genre" v-model="selectedGenres" @change="store.setGenres(selectedGenres)" />
            <label :for="`genre-${genre}`">{{ genre }}</label>
          </div>
        </div>
      </div>
    </div>

    <div class="filter-group dropdown-group">
      <div class="dropdown">
        <button @click="toggleDropdown('nodeTypes')" class="dropdown-toggle">Node Types ({{ selectedNodeTypes.length || 'All' }})</button>
        <div v-if="activeDropdown === 'nodeTypes'" class="dropdown-menu">
          <div v-for="type in filterOptions.node_types" :key="type" class="dropdown-item">
            <input type="checkbox" :id="`node-${type}`" :value="type" v-model="selectedNodeTypes" @change="store.setNodeTypes(selectedNodeTypes)" />
            <label :for="`node-${type}`">{{ type }}</label>
          </div>
        </div>
      </div>
    </div>

    <div class="filter-group dropdown-group">
      <div class="dropdown">
        <button @click="toggleDropdown('edgeTypes')" class="dropdown-toggle">Edge Types ({{ selectedEdgeTypes.length || 'All' }})</button>
        <div v-if="activeDropdown === 'edgeTypes'" class="dropdown-menu edge-type-dropdown">
          <div class="dropdown-item aggregate-item">
            <input type="checkbox" id="edge-group-influence" v-model="influenceEdges" />
            <label for="edge-group-influence">Influence Edges</label>
          </div>
          <div class="dropdown-item aggregate-item">
            <input type="checkbox" id="edge-group-collaboration" v-model="collaborationEdges" />
            <label for="edge-group-collaboration">Collaboration Edges</label>
          </div>
          <div class="dropdown-item aggregate-item">
            <input type="checkbox" id="edge-group-commercial" v-model="commercialEdges" />
            <label for="edge-group-commercial">Commercial Edges</label>
          </div>
          <hr class="dropdown-divider" />
          <div v-for="type in filterOptions.edge_types" :key="type" class="dropdown-item">
            <input type="checkbox" :id="`edge-${type}`" :value="type" v-model="selectedEdgeTypes" @change="store.setEdgeTypes(selectedEdgeTypes)" />
            <label :for="`edge-${type}`">{{ type }}</label>
          </div>
        </div>
      </div>
    </div>

    <button @click="store.resetView()" class="reset-button">Reset View</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useGraphStore } from '@/stores/graphStore';
import { storeToRefs } from 'pinia';
import { vOnClickOutside } from '@vueuse/components';

// --- Pinia Store ---
const store = useGraphStore();
const {
  searchQuery,
  selectedTimeRange,
  selectedGenres,
  selectedNodeTypes,
  selectedEdgeTypes,
  filterOptions
} = storeToRefs(store);

// --- 边类型分组 ---
const INFLUENCE_EDGES = ['InStyleOf', 'InterpolatesFrom', 'CoverOf', 'LyricalReferenceTo', 'DirectlySamples'];
const COLLABORATION_EDGES = ['PerformerOf', 'ComposerOf', 'ProducerOf', 'LyricistOf', 'MemberOf'];
const COMMERCIAL_EDGES = ['RecordedBy', 'DistributedBy'];

// --- 聚合选择的计算属性 ---
const createEdgeGroupComputer = (edgeGroup) => {
  return computed({
    get() {
      const selectedSet = new Set(selectedEdgeTypes.value);
      return edgeGroup.every(edge => selectedSet.has(edge));
    },
    set(value) {
      const selectedSet = new Set(selectedEdgeTypes.value);
      if (value) {
        edgeGroup.forEach(edge => selectedSet.add(edge));
      } else {
        edgeGroup.forEach(edge => selectedSet.delete(edge));
      }
      store.setEdgeTypes(Array.from(selectedSet));
    }
  });
};

const influenceEdges = createEdgeGroupComputer(INFLUENCE_EDGES);
const collaborationEdges = createEdgeGroupComputer(COLLABORATION_EDGES);
const commercialEdges = createEdgeGroupComputer(COMMERCIAL_EDGES);


// --- Component Local State ---
const activeDropdown = ref(null);
const localSearchQuery = ref(searchQuery.value || '');
const suggestions = ref([]);
const showSuggestions = ref(false);

// --- Watchers ---
// This watcher synchronizes the local input field with the store's state,
// ensuring the user-friendly "Name (id: XXX)" format is displayed.
watch([searchQuery, filterOptions], ([newQueryId, newOptions]) => {
  if (newQueryId && newOptions.person_nodes && newOptions.person_nodes.length > 0) {
    const selectedNode = newOptions.person_nodes.find(p => p.id === newQueryId);
    if (selectedNode) {
      // Found the corresponding person, so format the input text
      localSearchQuery.value = `${selectedNode.name} (id: ${selectedNode.id})`;
    } else {
      // If the ID is not in the person list (e.g., another node type), display the ID itself
      localSearchQuery.value = newQueryId.toString();
    }
  } else if (!newQueryId) {
    // If the search query is cleared, clear the input field
    localSearchQuery.value = '';
  }
}, {
  deep: true // Use a deep watch to detect changes within the filterOptions object
});

// --- Computed Properties ---
const availableYears = computed(() => {
  const years = [];
  for (let i = 1981; i <= 2040; i++) {
    years.push(i);
  }
  return years;
});

// --- Methods ---
const toggleDropdown = (dropdownName) => {
  activeDropdown.value = activeDropdown.value === dropdownName ? null : dropdownName;
};

const closeDropdowns = () => {
  activeDropdown.value = null;
  showSuggestions.value = false;
};

const confirmSearch = () => {
  store.setSearchQuery(localSearchQuery.value);
  store.updateGraphLayout(); // Explicitly trigger the update
  showSuggestions.value = false;
};

const clearSearch = () => {
  localSearchQuery.value = '';
  // This only clears the local input. The user must click "Confirm" to apply.
  showSuggestions.value = false;
};

const selectSuggestion = (suggestion) => {
  // suggestion is now an object: { name: '...', id: '...' }
  localSearchQuery.value = `${suggestion.name} (id: ${suggestion.id})`;
  store.selectCenterNode(suggestion.id); // Use the action that updates immediately
  showSuggestions.value = false;
};

// --- Lifecycle Hook ---
onMounted(() => {
  store.initializeStore();
});
</script>

<style scoped>
.search-bar-container {
  display: flex;
  align-items: center;
  gap: 1rem; /* 已修改: 进一步减小了元素之间的间距 */
  padding: 8px 1rem; /* 已修改: 显著减小了垂直方向的内边距 (padding)，使整个搜索栏高度降低。 */
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  width: 100%;
  box-sizing: border-box;
  flex-wrap: nowrap; /* 关键：强制内部元素不换行 */
}

.filter-group {
  position: relative;
  display: flex;
  align-items: center;
}

.search-group {
  flex-grow: 1;         /* 允许此元素（搜索框组）占据所有可用的额外空间。 */
  flex-shrink: 1;       /* 允许此元素在空间不足时收缩。 */
  min-width: 250px;     /* 设置一个最小宽度以保证可用性。 */
  max-width: 450px;     /* 设置一个最大宽度防止过度拉伸。 */
}

.search-label {
  margin-right: 0.5rem;
  font-size: 0.9rem; /* 已修改: 略微减小字体大小 */
  color: #4b5563;
  white-space: nowrap;
}

.search-input-wrapper {
  position: relative;
  width: 100%;
}

.search-input {
  width: 100%;
  padding: 6px 120px 6px 12px; /* 已修改: 减小垂直和水平内边距，同时调整右侧内边距以适应按钮 */
  border-radius: 6px; /* 已修改: 减小圆角以匹配更紧凑的外观 */
  border: 1px solid #d1d5db;
  font-size: 0.9rem; /* 已修改: 减小字体大小 */
  box-sizing: border-box;
}

.search-buttons {
  position: absolute;
  right: 4px; /* 已修改: 微调按钮位置 */
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 4px; /* 已修改: 减小按钮间距 */
}

.search-confirm-btn, .search-clear-btn {
  padding: 4px 8px; /* 已修改: 减小按钮内边距 */
  border: none;
  border-radius: 4px; /* 已修改: 减小圆角 */
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem; /* 已修改: 减小字体大小 */
}

.search-confirm-btn {
  background-color: #3b82f6;
  color: white;
}
.search-confirm-btn:hover {
  background-color: #2563eb;
}

.search-clear-btn {
  background-color: #e5e7eb;
  color: #4b5563;
}
.search-clear-btn:hover {
  background-color: #d1d5db;
}

.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background-color: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  z-index: 101;
  max-height: 300px;
  overflow-y: auto;
}

.suggestion-item {
  padding: 8px 12px; /* 已修改: 减小内边距 */
  cursor: pointer;
  font-size: 0.9rem; /* 已修改: 减小字体大小 */
}
.suggestion-item:hover {
  background-color: #f3f4f6;
}

.time-range-group {
  gap: 0.5rem;
}
.time-range-group label {
  font-size: 0.9rem; /* 已修改: 减小字体大小 */
  color: #4b5563;
  white-space: nowrap;
}
.time-select-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}
.time-select {
  padding: 6px 8px; /* 已修改: 减小内边距 */
  border-radius: 6px; /* 已修改: 减小圆角 */
  border: 1px solid #d1d5db;
  font-size: 0.9rem; /* 已修改: 减小字体大小 */
  background-color: #f3f4f6;
}

.dropdown-group {
  /* min-width: 150px; */ /* 已移除: 移除最小宽度，改用下面的固定宽度。 */
  width: 170px; /* 新增: 设置一个固定的宽度，让三个下拉按钮大小完全一致，实现视觉上的对齐和统一间距。 */
}

.dropdown-toggle {
  width: 100%;
  padding: 6px 12px; /* 已修改: 减小内边距 */
  background-color: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 6px; /* 已修改: 减小圆角 */
  cursor: pointer;
  font-size: 0.9rem; /* 已修改: 减小字体大小 */
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  left: 0;
  background-color: white;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  padding: 0.5rem;
  z-index: 100;
  max-height: 300px;
  overflow-y: auto;
  width: 100%;
}

.long-dropdown {
  max-height: 520px; /* 显著增加高度以尝试显示所有流派 */
}

/* 为边类型下拉菜单新增的样式 */
.edge-type-dropdown {
  min-width: 280px; /* 增加宽度以显示完整边类型名称 */
  max-height: 450px; /* 增加高度以显示所有边类型 */
}

.dropdown-item {
  display: flex;
  align-items: center;
  padding: 0.5rem; /* 已修改: 减小内边距 */
}
.dropdown-item label {
  margin-left: 0.5rem; /* 已修改: 减小间距 */
  font-size: 0.9rem; /* 已修改: 减小字体大小 */
}

/* 新增样式 */
.aggregate-item label {
  font-weight: bold;
}
.dropdown-divider {
  border: none;
  border-top: 1px solid #e5e7eb;
  margin: 0.5rem 0;
}

.reset-button {
  padding: 6px 16px; /* 已修改: 减小内边距以匹配其他元素的高度 */
  border: none;
  background-color: #6b7280;
  color: white;
  border-radius: 6px; /* 已修改: 减小圆角 */
  cursor: pointer;
  font-weight: 600;
  font-size: 0.9rem; /* 已修改: 减小字体大小 */
  white-space: nowrap; /* 新增: 确保按钮内的文字不会换行 */
  flex-shrink: 0;      /* 新增: 防止按钮在空间不足时被flex容器压缩变形，保证其宽度 */
}
.reset-button:hover {
  background-color: #4b5563;
}
</style>
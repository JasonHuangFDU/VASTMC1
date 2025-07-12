<template>
  <div class="search-bar-container" v-on-click-outside="closeDropdowns">
    <!-- 中心节点选择框 -->
    <div class="filter-group search-group">
      <label for="search-input-field" class="search-label">中心节点:</label>
      <div class="search-input-wrapper">
        <input
          id="search-input-field"
          type="text"
          v-model="localSearchQuery"
          @input="updateSuggestions"
          @focus="showSuggestions = true"
          placeholder="输入以搜索..."
          class="search-input"
          autocomplete="off"
        />
        <div class="search-buttons">
          <button @click="confirmSearch" class="search-confirm-btn">确认</button>
          <button @click="clearSearch" class="search-clear-btn">清空</button>
        </div>
        <div v-if="showSuggestions && suggestions.length > 0" class="suggestions-list">
          <div
            v-for="suggestion in suggestions"
            :key="suggestion"
            class="suggestion-item"
            @mousedown="selectSuggestion(suggestion)"
          >
            {{ suggestion }}
          </div>
        </div>
      </div>
    </div>

    <!-- 时间范围选择 -->
    <div class="filter-group time-range-group">
      <label>时间范围:</label>
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

    <!-- 流派筛选 -->
    <div class="filter-group dropdown-group">
      <div class="dropdown">
        <button @click="toggleDropdown('genres')" class="dropdown-toggle">流派 ({{ selectedGenres.length || '所有' }})</button>
        <div v-if="activeDropdown === 'genres'" class="dropdown-menu long-dropdown">
          <div v-for="genre in filterOptions.genres" :key="genre" class="dropdown-item">
            <input type="checkbox" :id="`genre-${genre}`" :value="genre" v-model="selectedGenres" @change="store.setGenres(selectedGenres)" />
            <label :for="`genre-${genre}`">{{ genre }}</label>
          </div>
        </div>
      </div>
    </div>

    <!-- 节点类型筛选 -->
    <div class="filter-group dropdown-group">
      <div class="dropdown">
        <button @click="toggleDropdown('nodeTypes')" class="dropdown-toggle">节点类型 ({{ selectedNodeTypes.length || '所有' }})</button>
        <div v-if="activeDropdown === 'nodeTypes'" class="dropdown-menu">
          <div v-for="type in filterOptions.node_types" :key="type" class="dropdown-item">
            <input type="checkbox" :id="`node-${type}`" :value="type" v-model="selectedNodeTypes" @change="store.setNodeTypes(selectedNodeTypes)" />
            <label :for="`node-${type}`">{{ type }}</label>
          </div>
        </div>
      </div>
    </div>

    <!-- 边类型筛选 -->
    <div class="filter-group dropdown-group">
      <div class="dropdown">
        <button @click="toggleDropdown('edgeTypes')" class="dropdown-toggle">边类型 ({{ selectedEdgeTypes.length || '所有' }})</button>
        <div v-if="activeDropdown === 'edgeTypes'" class="dropdown-menu edge-type-dropdown">
          <!-- 新增：聚合选择 -->
          <div class="dropdown-item aggregate-item">
            <input type="checkbox" id="edge-group-influence" v-model="influenceEdges" />
            <label for="edge-group-influence">影响力边</label>
          </div>
          <div class="dropdown-item aggregate-item">
            <input type="checkbox" id="edge-group-collaboration" v-model="collaborationEdges" />
            <label for="edge-group-collaboration">合作边</label>
          </div>
          <div class="dropdown-item aggregate-item">
            <input type="checkbox" id="edge-group-commercial" v-model="commercialEdges" />
            <label for="edge-group-commercial">商业边</label>
          </div>
          <hr class="dropdown-divider" />
          <!-- 单个边选择 -->
          <div v-for="type in filterOptions.edge_types" :key="type" class="dropdown-item">
            <input type="checkbox" :id="`edge-${type}`" :value="type" v-model="selectedEdgeTypes" @change="store.setEdgeTypes(selectedEdgeTypes)" />
            <label :for="`edge-${type}`">{{ type }}</label>
          </div>
        </div>
      </div>
    </div>

    <!-- 重置按钮 -->
    <button @click="store.resetView()" class="reset-button">重置视图</button>
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
watch(searchQuery, (newVal) => {
  localSearchQuery.value = newVal;
});

// --- Computed Properties ---
const availableYears = computed(() => {
  const years = [];
  for (let i = 1981; i <= 2034; i++) {
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

const updateSuggestions = () => {
  if (!localSearchQuery.value) {
    suggestions.value = [];
    return;
  }
  const query = localSearchQuery.value.toLowerCase();
  suggestions.value = filterOptions.value.node_names
    .filter(name => name.toLowerCase().includes(query))
    .slice(0, 10); // Limit to 10 suggestions
  showSuggestions.value = true;
};

const selectSuggestion = (suggestion) => {
  localSearchQuery.value = suggestion;
  showSuggestions.value = false; // Just update the input and hide suggestions
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
  gap: 4rem; /* 增加间距 */
  padding: 1rem;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  width: 100%;
  box-sizing: border-box;
  flex-wrap: wrap;
}

.filter-group {
  position: relative;
  display: flex;
  align-items: center;
}

.search-group {
  flex-grow: 0; /* 取消弹性增长以防止过度拉伸 */
  width: 350px; /* 设置一个固定的、较��的宽度 */
}

.search-label {
  margin-right: 0.5rem;
  font-size: 1rem;
  color: #4b5563;
  white-space: nowrap;
}

.search-input-wrapper {
  position: relative;
  width: 100%;
}

.search-input {
  width: 100%;
  padding: 10px 130px 10px 15px; /* Right padding for buttons */
  border-radius: 8px;
  border: 1px solid #d1d5db;
  font-size: 1.1rem;
  box-sizing: border-box;
}

.search-buttons {
  position: absolute;
  right: 5px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  gap: 5px;
}

.search-confirm-btn, .search-clear-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
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
  padding: 10px 15px;
  cursor: pointer;
}
.suggestion-item:hover {
  background-color: #f3f4f6;
}

.time-range-group {
  gap: 0.5rem;
}
.time-range-group label {
  font-size: 1rem;
  color: #4b5563;
  white-space: nowrap;
}
.time-select-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}
.time-select {
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  font-size: 1.1rem;
  background-color: #f3f4f6;
}

.dropdown-group {
  min-width: 180px;
}

.dropdown-toggle {
  width: 100%;
  padding: 14px 18px;
  background-color: #f3f4f6;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1.1rem;
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
  padding: 0.75rem;
}
.dropdown-item label {
  margin-left: 0.75rem;
  font-size: 1.1rem;
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
  padding: 14px 22px;
  border: none;
  background-color: #6b7280;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  font-size: 1.1rem;
}
.reset-button:hover {
  background-color: #4b5563;
}
</style>

<template>
  <div class="search-bar-container" v-on-click-outside="closeDropdowns">
    <!-- 搜索输入框 -->
    <div class="search-input-wrapper">
      <input
        type="text"
        :value="searchTerm"
        @input="onSearchInput($event.target.value)"
        placeholder="搜索..."
        class="search-input"
      />
      <div class="search-type-selector">
        <select v-model="searchType" class="search-type-select">
          <option value="all">所有</option>
          <option value="artist">艺术家</option>
          <option value="song">歌曲</option>
          <option value="musicalGroup">乐队</option>
        </select>
      </div>
      <ul v-if="suggestions.length > 0" class="suggestions-list">
        <li
          v-for="suggestion in suggestions"
          :key="suggestion.id"
          @click="selectSuggestion(suggestion)"
        >
          {{ suggestion.name }} ({{ suggestion['Node Type'] }})
        </li>
      </ul>
    </div>

    <!-- 时间范围下拉选择框 -->
    <div class="filter-group time-range-group">
      <label>时间范围:</label>
      <div class="time-select-wrapper">
        <select
          :value="timeRange.start"
          @change="updateTimeRange({ start: parseInt($event.target.value, 10), end: timeRange.end })"
          class="time-select"
        >
          <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
        </select>
        <span>-</span>
        <select
          :value="timeRange.end"
          @change="updateTimeRange({ start: timeRange.start, end: parseInt($event.target.value, 10) })"
          class="time-select"
        >
          <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
        </select>
      </div>
    </div>

    <!-- 下拉筛选器 -->
    <div class="filter-group dropdown-group">
      <div class="dropdown">
        <button @click="toggleDropdown('nodeTypes')" class="dropdown-toggle">节点类型 ({{ selectedNodeTypes.length || '无' }})</button>
        <div v-if="activeDropdown === 'nodeTypes'" class="dropdown-menu">
          <div v-for="type in availableNodeTypes" :key="type" class="dropdown-item">
            <input type="checkbox" :id="`node-${type}`" :value="type" :checked="selectedNodeTypes.includes(type)" @change="updateMultiSelectFilter('selectedNodeTypes', type)" />
            <label :for="`node-${type}`">{{ type }}</label>
          </div>
        </div>
      </div>
    </div>
    <div class="filter-group dropdown-group">
      <div class="dropdown">
        <button @click="toggleDropdown('edgeTypes')" class="dropdown-toggle">边类型 ({{ selectedEdgeTypes.length || '无' }})</button>
        <div v-if="activeDropdown === 'edgeTypes'" class="dropdown-menu">
          <div v-for="type in availableEdgeTypes" :key="type" class="dropdown-item">
            <input type="checkbox" :id="`edge-${type}`" :value="type" :checked="selectedEdgeTypes.includes(type)" @change="updateMultiSelectFilter('selectedEdgeTypes', type)" />
            <label :for="`edge-${type}`">{{ type }}</label>
          </div>
        </div>
      </div>
    </div>
    <div class="filter-group dropdown-group">
      <div class="dropdown">
        <button @click="toggleDropdown('genres')" class="dropdown-toggle">流派 ({{ selectedGenres.length || '无' }})</button>
        <div v-if="activeDropdown === 'genres'" class="dropdown-menu">
          <div v-for="genre in availableGenres" :key="genre" class="dropdown-item">
            <input type="checkbox" :id="`genre-${genre}`" :value="genre" :checked="selectedGenres.includes(genre)" @change="updateMultiSelectFilter('selectedGenres', genre)" />
            <label :for="`genre-${genre}`">{{ genre }}</label>
          </div>
        </div>
      </div>
    </div>
    <button @click="resetAllFilters" class="reset-button">重置视图</button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useGraphStore } from '@/stores/graphStore';
import { debounce } from 'lodash-es';
import { vOnClickOutside } from '@vueuse/components';

const store = useGraphStore();

onMounted(() => {
  console.log('SearchBar mounted. Initial timeRange.end:', timeRange.value.end);
});

// --- Component State ---
const activeDropdown = ref(null);
const suggestions = ref([]);
const searchTerm = ref('');
const searchType = ref('all'); // 'all', 'artist', 'song', 'musicalGroup'

// --- Computed Properties from Store ---
const availableNodeTypes = computed(() => store.filterOptions.nodeTypes);
const availableEdgeTypes = computed(() => store.filterOptions.edgeTypes);
const availableGenres = computed(() => store.filterOptions.genres);
const timeRange = computed(() => store.selectedTimeRange);
const selectedNodeTypes = computed(() => store.selectedNodeTypes);
const selectedEdgeTypes = computed(() => store.selectedEdgeTypes);
const selectedGenres = computed(() => store.selectedGenres);

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
};

const onSearchInput = (value) => {
  searchTerm.value = value;
  debouncedSearch(value);
};

const performSearch = (value) => {
  if (value.length < 2) {
    suggestions.value = [];
    return;
  }
  const lowerCaseValue = value.toLowerCase();
  let filteredNodes = store.allNodesMasterList.filter(node =>
    node.name.toLowerCase().includes(lowerCaseValue)
  );

  if (searchType.value === 'artist') {
    filteredNodes = filteredNodes.filter(node => node['Node Type'] === 'Person');
  } else if (searchType.value === 'song') {
    filteredNodes = filteredNodes.filter(node => node['Node Type'] === 'Song');
  } else if (searchType.value === 'musicalGroup') {
    filteredNodes = filteredNodes.filter(node => node['Node Type'] === 'MusicalGroup');
  }

  suggestions.value = filteredNodes.slice(0, 10);
};

const debouncedSearch = debounce(performSearch, 300);

const selectSuggestion = (node) => {
  searchTerm.value = node.name;
  suggestions.value = [];
  store.focusOnNode(node.id);
};

const updateTimeRange = (newRange) => {
  if (newRange.start > newRange.end) {
    newRange.end = newRange.start;
  }
  store.setFilters({ selectedTimeRange: newRange });
};

const updateMultiSelectFilter = (filterKey, value) => {
  const currentValues = [...store[filterKey]];
  const index = currentValues.indexOf(value);
  if (index > -1) {
    currentValues.splice(index, 1);
  } else {
    currentValues.push(value);
  }
  store.setFilters({ [filterKey]: currentValues });
};

const resetAllFilters = () => {
  searchTerm.value = '';
  suggestions.value = [];
  store.resetFilters();
};
</script>

<style scoped>
.search-bar-container {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 1rem;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  width: 100%;
  box-sizing: border-box;
  flex-wrap: wrap;
}

.search-input-wrapper {
  position: relative;
  flex: 1 1 200px;
  max-width: 300px;
}

.search-input {
  width: 100%;
  padding: 14px 18px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  font-size: 1.1rem;
}

.suggestions-list {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #d1d5db;
  border-top: none;
  border-radius: 0 0 8px 8px;
  list-style: none;
  margin: 0;
  padding: 0;
  z-index: 101;
  max-height: 300px;
  overflow-y: auto;
}
.suggestions-list li {
  padding: 12px 18px;
  cursor: pointer;
}
.suggestions-list li:hover {
  background-color: #f3f4f6;
}

.filter-group {
  position: relative;
}

.time-range-group {
  flex: 2 1 300px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.75rem;
}
.time-range-group label {
  font-size: 1rem;
  color: #4b5563;
}
.time-select-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
.time-select {
  flex-grow: 1;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  font-size: 1.1rem;
  text-align: center;
  background-color: #f3f4f6;
  cursor: pointer;
}
.time-select:hover {
  background-color: #e5e7eb;
}

.dropdown-group {
  flex: 1 1 200px;
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
.dropdown-toggle:hover {
  background-color: #e5e7eb;
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

.dropdown-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
}
.dropdown-item label {
  margin-left: 0.75rem;
  white-space: nowrap;
  font-size: 1.1rem;
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
  transition: background-color 0.2s;
}
.reset-button:hover {
  background-color: #4b5563;
}

.search-input-wrapper {
  display: flex; /* Make it a flex container */
  align-items: center; /* Align items vertically */
  gap: 10px; /* Space between input and select */
  position: relative;
  flex: 1 1 200px;
  max-width: 400px; /* Increased max-width to accommodate select */
}

.search-input {
  flex-grow: 1; /* Allow input to take available space */
}

.search-type-selector {
  /* No specific styles needed here, as select is styled directly */
}

.search-type-select {
  padding: 14px 10px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  font-size: 1.1rem;
  background-color: #f3f4f6;
  cursor: pointer;
}

.search-type-select:hover {
  background-color: #e5e7eb;
}
</style>
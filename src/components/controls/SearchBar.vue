<template>
  <div class="search-bar-container" v-on-click-outside="closeDropdowns">
    <!-- 搜索输入框 -->
    <div class="search-input-wrapper">
      <input
        type="text"
        :value="searchQuery"
        @input="store.setSearchQuery($event.target.value)"
        placeholder="搜索节点名称..."
        class="search-input"
      />
      <!-- 搜索建议的功能可以后续添加，通过监听searchQuery变化，从后端获取建议列表 -->
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
       <select v-model="selectedGenre" @change="store.setGenre(selectedGenre)" class="dropdown-toggle">
          <option :value="null">所有流派</option>
          <option v-for="genre in filterOptions.genres" :key="genre" :value="genre">
            {{ genre }}
          </option>
        </select>
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
        <div v-if="activeDropdown === 'edgeTypes'" class="dropdown-menu">
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
import { ref, computed, onMounted } from 'vue';
import { useGraphStore } from '@/stores/graphStore';
import { storeToRefs } from 'pinia';
import { vOnClickOutside } from '@vueuse/components';

// --- Pinia Store ---
const store = useGraphStore();

// 使用 storeToRefs 来保持响应性，这样可以直接在模板中使用 v-model
const {
  searchQuery,
  selectedTimeRange,
  selectedGenre,
  selectedNodeTypes,
  selectedEdgeTypes,
  filterOptions
} = storeToRefs(store);

// --- Component Local State ---
const activeDropdown = ref(null);

// 生成可用的年份列表
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

// --- Lifecycle Hook ---
// 在组件挂载时，初始化store（获取筛选选项和初始视图）
onMounted(() => {
  store.initializeStore();
});
</script>

<style scoped>
/* 样式保持不变，与您提供的文件一致 */
.search-bar-container {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background-color: #ffffff;
  border-bottom: 1px solid #e5e7eb;
  width: 100%;
  box-sizing: border-box;
  flex-wrap: wrap;
}

.search-input-wrapper {
  position: relative;
  flex-grow: 1;
  min-width: 200px;
}

.search-input {
  width: 100%;
  padding: 7px 5px;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  font-size: 1.1rem;
}

.filter-group {
  position: relative;
}

.time-range-group {
  display: flex;
  align-items: center;
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

.dropdown-item {
  display: flex;
  align-items: center;
  padding: 0.75rem;
}
.dropdown-item label {
  margin-left: 0.75rem;
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
}
.reset-button:hover {
  background-color: #4b5563;
}
</style>

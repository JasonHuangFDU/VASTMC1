<template>
  <div id="oceanus-weaver">
    <header>
      <h1>oceanus-weaver</h1>
      <SearchBar />
    </header>
    <main>
      <aside class="left-column">
        <GenreLineGraph class="genre-line-graph" />
        <Q2SankeyView class="q2-sankey-view" />
      </aside>

      <div class="center-column">
        <InfluenceNetwork />
      </div>

      <aside class="right-column">
        <CareerTrajectory />
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useGraphStore } from './stores/graphStore';

// Import all necessary components
import SearchBar from './components/controls/SearchBar.vue';
import InfluenceNetwork from './components/visualizations/InfluenceNetwork.vue';
import GenreLineGraph from './components/visualizations/GenreLineGraph.vue';
import CareerTrajectory from './components/visualizations/CareerTrajectory.vue';
import Q2SankeyView from './components/Q2SankeyView.vue';

const q2_1_data = ref(null);
const store = useGraphStore();

// Asynchronous function to load data
async function loadVisualizationsData() {
  try {
    const response = await fetch('/mc1_q2_1_data.json');
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    q2_1_data.value = await response.json();
    console.log("q2_1_data loaded successfully.");
  } catch (error) {
    console.error("Failed to load q2.1 data:", error);
  }
}

onMounted(() => {
  // Initialize Pinia store
  store.initializeStore();
  
  // Call function to load data
  loadVisualizationsData();
});
</script>

<style>
/* Import global color variables */
:root {
  --color-background: #F8F8F8;
  --color-surface: #FFFFFF;
  --color-border: #E0E0E0;
  --color-text-primary: #333333;
  --color-text-secondary: #666666;
  --color-text-light: #999999;
  --color-primary-accent: #5D9CEC;
  --color-secondary-accent: #A7C5EB;
}

/* Global styles */
html, body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', sans-serif;
  background-color: var(--color-background);
  height: 100%;
}

#oceanus-weaver {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

header {
  padding: 10px 20px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

header h1 {
  margin: 0;
  margin-right: 30px;
  font-size: 1.5em;
  white-space: nowrap;
  color: var(--color-text-primary);
}

/* Main content area uses a three-column Flexbox layout */
main {
  display: flex;
  flex-grow: 1;
  overflow: hidden;
}

.left-column, .right-column {
  flex: 0.6;
  display: flex;
  flex-direction: column; /* Ensure it's a column layout */
  padding: 10px;
  overflow-y: auto; /* <--- 统一的纵向滚动条在这里！ */
  background-color: var(--color-surface);
  border-right: 1px solid var(--color-border);
}

.right-column {
  border-right: none;
  border-left: 1px solid var(--color-border);
}

.center-column {
  flex: 4;
  display: flex;
  flex-direction: column;
  padding: 5px;
  flex-grow: 1;
  overflow: hidden;
}

/* Allocate space for child components in the left column */
.left-column .genre-line-graph {
  flex-shrink: 0; /* 不收缩 */
  height: 300px; /* <--- 固定高度，根据折线图内容调整 */
  margin-bottom: 10px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  background-color: var(--color-surface);
  padding: 5px;
  overflow: hidden; /* 确保折线图自身不滚动 */
}

.left-column .q2-sankey-view {
  flex-shrink: 0; /* 不收缩 */
  height: 700px; /* <--- 桑基图的固定高度，确保有足够空间展开 */
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  background-color: var(--color-surface);
  padding: 5px;
  overflow: hidden; /* 确保桑基图容器自身不滚动 */
}

/* Keep general styles for right column children */
.right-column > * {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 10px;
  padding: 5px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  background-color: var(--color-surface);
}
.right-column > *:last-child {
  margin-bottom: 0;
}
</style>

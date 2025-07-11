<template>
  <div id="oceanus-weaver">
    <header>
      <h1>oceanus-weaver</h1>
      <SearchBar />
    </header>
    <main>
      <aside class="left-column">
        <GenreLineGraph />
        <Q2SankeyView />
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

// 导入所有需要的组件
import SearchBar from './components/controls/SearchBar.vue';
import InfluenceNetwork from './components/visualizations/InfluenceNetwork.vue';
import GenreLineGraph from './components/visualizations/GenreLineGraph.vue';
import CareerTrajectory from './components/visualizations/CareerTrajectory.vue';
import Q2SankeyView from './components/Q2SankeyView.vue';

const q2_1_data = ref(null);
const store = useGraphStore();

// 异步函数加载数据
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
  // 初始化 Pinia store
  store.initializeStore();
  
  // 调用函数来加载数据
  loadVisualizationsData();
});
</script>

<style>
/* 全局样式 */
html, body {
  margin: 0;
  padding: 0;
  font-family: sans-serif;
  background-color: #f0f2f5;
  height: 100%;
}

#oceanus-weaver {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

header {
  padding: 10px 20px;
  background-color: #fff;
  border-bottom: 1px solid #ddd;
  display: flex;
  align-items: center;
  flex-shrink: 0; /* 防止 header 在 flex 布局中被压缩 */
}

header h1 {
  margin: 0;
  margin-right: 30px;
  font-size: 1.5em;
  white-space: nowrap; /* 防止标题换行 */
}

/* 主内容区采用三栏式 Flexbox 布局 */
main {
  display: flex;
  flex-grow: 1; /* 让 main 区域填满剩余空间 */
  overflow: hidden; /* 防止内容溢出导致滚动条 */
}

.left-column,.right-column {
  flex: 0.6; /* 左右两栏各占1.5份空间 */
  display: flex;
  flex-direction: column;
  padding: 10px;
  overflow-y: auto; /* 如果内容过多，允许内部滚动 */
  background-color: #fff;
  border-right: 1px solid #ddd;
}

.right-column {
  border-right: none;
  border-left: 1px solid #ddd;
}

.center-column {
  flex: 4; /* 中间一栏占据4份空间 */
  display: flex;
  flex-direction: column;
  padding: 5px; /* 恢复内边距 */
  flex-grow: 1; /* 确保中间列能够填充可用空间 */
  overflow: hidden; /* 防止内容溢出 */
}

/* 为每个视图组件添加一些基本样式，方便区分 */
.left-column > *,.right-column > * {
  border: 1px solid #eee;
  border-radius: 4px;
  margin-bottom: 10px;
  padding: 5px;
  flex-shrink: 0; /* 防止子元素被压缩 */
}

.left-column > *:last-child,.right-column > *:last-child {
  margin-bottom: 0;
}
</style>

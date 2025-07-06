<template>
  <div id="oceanus-weaver">
    <header>
      <h1>oceanus-weaver</h1>
      <SearchBar />
    </header>
    <main>
      <aside class="left-column">
        <GenreStreamgraph />
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
import GenreStreamgraph from './components/visualizations/GenreStreamgraph.vue';
import CareerTrajectory from './components/visualizations/CareerTrajectory.vue';
import Q2SankeyView from './components/Q2SankeyView.vue';

// 获取 store 实例
const store = useGraphStore();

onMounted(() => {
  document.title = 'Oceanus Influence Weaver';
});

// 在组件挂载后，触发数据加载
onMounted(() => {
  store.fetchGraphData().then(() => {
    console.log('App.vue: nodes', store.nodes);
    console.log('App.vue: links', store.links);
  });
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
}

/* 主内容区采用三栏式 Flexbox 布局 */
main {
  display: flex;
  flex-grow: 1; /* 让 main 区域填满剩余空间 */
  overflow: hidden; /* 防止内容溢出导致滚动条 */
}

.left-column,.right-column {
  flex: 1.5; /* 左右两栏各占1.5份空间 */
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
  flex: 2; /* 中间一栏占据2份空间 */
  display: flex;
  flex-direction: column;
  padding: 10px;
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

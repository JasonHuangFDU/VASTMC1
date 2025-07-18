<template>
  <div id="oceanus-weaver">
    <header>
      <h1>oceanus-weaver</h1>
      <SearchBar />
    </header>
    <main>
      <aside class="left-column" :style="{ flex: `0 0 ${leftColumnWidth}px` }">
        <GenreLineGraph class="genre-line-graph" />
        <Q2SankeyView class="q2-sankey-view" />
      </aside>

      <div class="resizer" @mousedown="startResizeLeft"></div>

      <div class="center-column" :style="{ flex: 1 }">
        <div class="top-view">
          <InfluenceNetwork />
        </div>
        <div class="bottom-view">
          <BottomView />
        </div>
      </div>

      <div class="resizer" @mousedown="startResizeRight"></div>

      <aside class="right-column" :style="{ flex: `0 0 ${rightColumnWidth}px` }">
        <CareerTrajectory />
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useGraphStore } from './stores/graphStore';

import SearchBar from './components/controls/SearchBar.vue';
import InfluenceNetwork from './components/visualizations/InfluenceNetwork.vue';
import GenreLineGraph from './components/visualizations/GenreLineGraph.vue';
import CareerTrajectory from './components/visualizations/CareerTrajectory.vue';
import Q2SankeyView from './components/Q2SankeyView.vue';
import BottomView from './components/visualizations/BottomView.vue';

const store = useGraphStore();

// 可调整大小的面板
const leftColumnWidth = ref(480);
const rightColumnWidth = ref(480);
const isResizingLeft = ref(false);
const isResizingRight = ref(false);

const minWidth = 300;
const maxWidth = 800;

// 左侧面板拖拽逻辑
const startResizeLeft = (e) => {
  isResizingLeft.value = true;
  document.addEventListener('mousemove', handleResizeLeft);
  document.addEventListener('mouseup', stopResizeLeft);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

const handleResizeLeft = (e) => {
  if (!isResizingLeft.value) return;
  const newWidth = e.clientX;
  if (newWidth >= minWidth && newWidth <= maxWidth) {
    leftColumnWidth.value = newWidth;
  }
};

const stopResizeLeft = () => {
  isResizingLeft.value = false;
  document.removeEventListener('mousemove', handleResizeLeft);
  document.removeEventListener('mouseup', stopResizeLeft);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
};

// 右侧面板拖拽逻辑
const startResizeRight = (e) => {
  isResizingRight.value = true;
  document.addEventListener('mousemove', handleResizeRight);
  document.addEventListener('mouseup', stopResizeRight);
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
};

const handleResizeRight = (e) => {
  if (!isResizingRight.value) return;
  const newWidth = window.innerWidth - e.clientX;
  if (newWidth >= minWidth && newWidth <= maxWidth) {
    rightColumnWidth.value = newWidth;
  }
};

const stopResizeRight = () => {
  isResizingRight.value = false;
  document.removeEventListener('mousemove', handleResizeRight);
  document.removeEventListener('mouseup', stopResizeRight);
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
};

onMounted(() => {
  store.initializeStore();
});

onUnmounted(() => {
  // 确保所有事件监听器都被清理
  document.removeEventListener('mousemove', handleResizeLeft);
  document.removeEventListener('mouseup', stopResizeLeft);
  document.removeEventListener('mousemove', handleResizeRight);
  document.removeEventListener('mouseup', stopResizeRight);
});
</script>

<style>
:root {
  --color-background: #F8F8F8;
  --color-surface: #FFFFFF;
  --color-border: #E0E0E0;
  --color-text-primary: #333333;
  --color-text-secondary: #666666;
  --color-text-light: #999999;
  --color-primary-accent: #5D9CEC;
  --color-secondary-accent: #A7C5EB;
  --color-resizer: #D0D0D0;
  --color-resizer-hover: #B0B0B0;
  --color-resizer-active: #909090;
}

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
  justify-content: space-between;
  gap: 20px;
}

header h1 {
  margin: 0;
  font-size: 1.5em;
  white-space: nowrap;
  color: var(--color-text-primary);
}

main {
  display: flex;
  flex-grow: 1;
  overflow: hidden;
}

.left-column, .right-column {
  display: flex;
  flex-direction: column;
  padding: 8px;
  background-color: var(--color-surface);
  min-width: 300px;
  max-width: 800px;
  overflow: hidden;
}

.left-column {
  border-right: 1px solid var(--color-border);
}

.right-column {
  border-left: 1px solid var(--color-border);
}

.resizer {
  width: 6px;
  background-color: var(--color-resizer);
  cursor: col-resize;
  position: relative;
  transition: background-color 0.2s ease;
  flex-shrink: 0;
  z-index: 1;
}

.resizer:hover {
  background-color: var(--color-resizer-hover);
}

.resizer:active {
  background-color: var(--color-resizer-active);
}

.resizer::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2px;
  height: 40px;
  background-color: var(--color-surface);
  border-radius: 1px;
  opacity: 0.6;
}

.center-column {
  display: flex;
  flex-direction: column;
  padding: 5px;
  overflow: hidden;
  background-color: var(--color-background);
}

.top-view {
  height: 75%;
  min-height: 0; /* 允许flex item收缩 */
}

.bottom-view {
  height: 25%;
  min-height: 0; /* 允许flex item收缩 */
  border-top: 2px solid var(--color-border);
  padding: 10px;
  background-color: var(--color-surface);
  text-align: center;
  color: var(--color-text-secondary);
}

/* 弹性布局设计 - 响应式高度分配 */
.left-column .genre-line-graph {
  flex: 1;
  min-height: 200px;
  max-height: 320px;
  margin-bottom: 8px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  background-color: var(--color-surface);
  padding: 8px;
  overflow: hidden;
}

.left-column .q2-sankey-view {
  flex: 2;
  min-height: 450px;
  max-height: 600px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  background-color: var(--color-surface);
  padding: 6px;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 响应式设计 */
@media (max-height: 700px) {
  .left-column .genre-line-graph {
    min-height: 160px;
    max-height: 220px;
  }
  
  .left-column .q2-sankey-view {
    min-height: 350px;
    max-height: 450px;
  }
}

@media (max-height: 900px) {
  .left-column .genre-line-graph {
    min-height: 180px;
    max-height: 260px;
  }
  
  .left-column .q2-sankey-view {
    min-height: 400px;
    max-height: 500px;
  }
}

@media (min-height: 1200px) {
  .left-column .genre-line-graph {
    min-height: 240px;
    max-height: 360px;
  }
  
  .left-column .q2-sankey-view {
    min-height: 500px;
    max-height: 700px;
  }
}

.right-column > * {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 8px;
  padding: 8px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  background-color: var(--color-surface);
}

.right-column > *:last-child {
  margin-bottom: 0;
}

/* 拖拽时的样式 */
body.resizing {
  cursor: col-resize !important;
  user-select: none !important;
}

body.resizing * {
  cursor: col-resize !important;
  user-select: none !important;
}
</style>

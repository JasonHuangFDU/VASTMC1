// src/services/dataService.js
import * as d3 from 'd3';

export async function loadData() {
  const graph = await d3.json('/src/assets/graph_processed.json');

  // 可以在这里进行数据预处理

  return graph;
}
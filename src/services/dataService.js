// src/services/dataService.js
import * as d3 from 'd3';

export async function loadData() {
  console.log("loadData 被调用");
  const graph = await d3.json('/graph_processed.json');
  console.log("1.加载的图数据:", graph);
  // 可以在这里进行数据预处理

  return graph;
}
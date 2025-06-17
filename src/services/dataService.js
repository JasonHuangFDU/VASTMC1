// src/services/dataService.js
import * as d3 from 'd3';

export async function loadData() {
  const graph = await d3.json('/src/assets/MC1_graph.json');

  // 可以在这里进行数据预处理，例如计算影响力分数
  graph.nodes.forEach(node => {
    // 示例：给没有分数的节点一个基础分
    if (!node.influenceScore) {
      node.influenceScore = 1;
    }
  });

  return graph;
}
// src/services/dataService.js
import * as d3 from 'd3';

export async function loadData() {
  console.log("loadData 被调用");
  const graph = await d3.json('/graph_processed.json');
  console.log("1.加载的图数据:", graph);
  // 可以在这里进行数据预处理

  return graph;
}

// 新增功能：加载 Oceanus 数据并发送到后端
export async function loadOceanusDataAndPredict() {
  try {
    console.log("加载 Oceanus 数据...");

    // 加载 Oceanus.json 数据
    const oceanusData = await d3.json('/Oceanus.json');
    console.log("Oceanus 数据加载完成", oceanusData);

    // 发送数据到后端进行预测
    const response = await fetch('http://localhost:5001/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ graphData: oceanusData })
    });

    if (!response.ok) {
      throw new Error(`预测请求失败: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log("预测结果:", result);
    return result;

  } catch (error) {
    console.error("加载和预测 Oceanus 数据失败:", error);
    throw error;
  }
}

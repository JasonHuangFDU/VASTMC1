// src/services/dataService.js
import * as d3 from 'd3';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5001/api';

/**
 * @deprecated This function loads the full, unprocessed graph.
 * Use loadYearlyData for better performance.
 */
export async function loadData() {
  console.log("loadData 被调用 (deprecated)");
  const graph = await d3.json('/MC1_graph.json'); // 指向原始文件以防万一
  console.log("1.加载的全量图数据:", graph);
  return graph;
}

export async function fetchGraphLayout(payload) {
  try {
    // 调用后端的 /api/graph/layout 接口
    const response = await axios.post(`${API_BASE_URL}/graph/layout`, payload);
    return response.data;
  } catch (error) {
    console.error("获取图布局时出错:", error);
    // 重新抛出错误，以便 store 中的调用函数可以捕获它
    throw error;
  }
}

/**
 * 从后端获取可用的筛选选项（流派、节点类型等）。
 * @returns {Promise<object>} 筛选选项数据。
 */
export async function fetchFilterOptions() {
  try {
    // 调用后端的 /api/graph/meta 接口
    const response = await axios.get(`${API_BASE_URL}/graph/meta`);
    return response.data;
  } catch (error) {
    console.error("获取筛选选项时出错:", error);
    throw error;
  }
}

/**
 * Loads the graph data that has been pre-processed and chunked by year.
 * @returns {Promise<Object>} A promise that resolves to the yearly graph data.
 */
export async function loadYearlyData() {
  console.log("Loading pre-processed yearly data...");
  const yearlyData = await d3.json('/graph_by_year.json');
  console.log("Yearly data loaded:", yearlyData);
  return yearlyData;
}

/**
 * Loads the available filter options (genres, node types, edge types).
 * @returns {Promise<Object>} A promise that resolves to the filter options.
 */
export async function loadFilterOptions() {
  console.log("Loading filter options...");
  const filterOptions = await d3.json('/filter_options.json');
  console.log("Filter options loaded:", filterOptions);
  return filterOptions;
}


// 修改函数以接受权重偏好参数
export async function loadOceanusDataAndPredict(weightPreferences = null) {
  try {
    console.log("加载 Oceanus 数据...");
    const oceanusData = await d3.json('/Oceanus.json');
    console.log("Oceanus 数据加载完成", oceanusData);

    // 构建请求体，包含权重偏好
    const requestBody = { graphData: oceanusData };
    if (weightPreferences) {
      requestBody.weightPreferences = weightPreferences;
    }

    // 发送数据到后端进行预测
    const response = await fetch('http://localhost:5001/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
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

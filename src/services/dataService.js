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
  const graph = await d3.json('/graph_processed.json'); // 更新为处理后的数据源
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
 * 新增：为桑基图交互获取过滤后的图数据。
 * @param {object} payload - 包含过滤类型和参数的对象。
 * @returns {Promise<object>} D3兼容的图数据。
 */
export async function getFilteredGraphForSankey(payload) {
  try {
    const response = await axios.post(`${API_BASE_URL}/filter-for-sankey`, payload);
    return response.data;
  } catch (error)
  {
    console.error("从桑基图交互获取图数据时出错:", error);
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

//新增艺术家生涯轨迹数据处理函数
/**
 * 处理艺术家生涯数据
 * @param {Object} graphData - 图数据 { nodes: [], links: [] }
 * @param {number} artistId - 艺术家节点ID
 * @returns {Object|null} 处理后的生涯数据对象
 */
export function processArtistData(graphData, artistId) {
  // 1. 提取目标艺术家节点
  const artist = graphData.nodes.find(n => n.id === artistId && n['Node Type'] === 'Person');
  if (!artist) return null;

  // 2. 构建数据结构
  const result = {
    artistInfo: { ...artist },
    timelineEvents: [],
    yearlyStats: {}
  };

  // 3. 收集艺术家相关作品和合作者
  const { works, collaborations } = extractWorksAndCollabs(graphData, artistId);

  // 4. 计算年度指标
  calculateYearlyStats(result, works, collaborations);

  return result;
}

// 内部辅助函数
function extractWorksAndCollabs(graphData, artistId) {
  const works = [];
  const collaborations = new Map();

  // 查找艺术家参与的作品
  graphData.links.forEach(link => {
    if (link.source === artistId &&
        ['PerformerOf', 'ComposerOf', 'LyricistOf', 'ProducerOf'].includes(link['Edge Type'])) {

      const work = graphData.nodes.find(n => n.id === link.target &&
        (n['Node Type'] === 'Song' || n['Node Type'] === 'Album'));

      if (work) {
        let workEntry = works.find(w => w.id === work.id);
        if (!workEntry) {
          workEntry = {
            ...work,
            type: work['Node Type'],
            roles: [],
            collaborators: new Set()
          };
          works.push(workEntry);
        }
        workEntry.roles.push(link['Edge Type']);
      }
    }
  });

  // 识别合作者
  works.forEach(work => {
    graphData.links.forEach(link => {
      if (link.target === work.id &&
          ['PerformerOf', 'ComposerOf', 'LyricistOf', 'ProducerOf'].includes(link['Edge Type']) &&
          link.source !== artistId) {

        const collaborator = graphData.nodes.find(n => n.id === link.source);
        if (collaborator && collaborator['Node Type'] === 'Person') {
          work.collaborators.add(collaborator.id);

          if (!collaborations.has(work.release_date)) {
            collaborations.set(work.release_date, { collaborators: new Set(), count: 0 });
          }
          const yearData = collaborations.get(work.release_date);
          yearData.collaborators.add(collaborator.id);
          yearData.count++;
        }
      }
    });
  });

  return { works, collaborations };
}

// src/services/dataService.js
function calculateYearlyStats(result, works, collaborations) {
  const stats = {};

  // 初始化时间范围
  const years = [...new Set(works.map(w => w.release_date))].sort();
  if (years.length === 0) return;

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  // 初始化年度数据
  for (let year = minYear; year <= maxYear; year++) {
    stats[year] = {
      influence: 0,
      collabRoles: { Performer: 0, Composer: 0, Lyricist: 0, Producer: 0 },
      genres: new Set(),
      genreDistribution: {},
      workCount: 0,        // 年度作品总数
      notableCount: 0,     // 年度notable作品数
      nodeConnections: 0   // 年度新增连接节点数
    };
  }

  // 按年份处理作品
  works.forEach(work => {
    const year = work.release_date;
    if (!stats[year]) return;

    // 记录作品数量
    stats[year].workCount++;

    // 记录notable作品
    if (work.notable) {
      stats[year].notableCount++;
    }

    // 记录合作角色
    work.roles.forEach(role => {
      const roleType = role.replace('Of', '');
      if (stats[year].collabRoles[roleType] !== undefined) {
        stats[year].collabRoles[roleType]++;
      }
    });

    // 记录流派
    if (work.genre) {
      stats[year].genres.add(work.genre);
      stats[year].genreDistribution[work.genre] =
        (stats[year].genreDistribution[work.genre] || 0) + 1;
    }
  });

  // 计算年度影响力（修正公式）
  for (const year in stats) {
    if (Object.prototype.hasOwnProperty.call(stats, year)) {
      // 计算年度新增节点连接数（作品数 + 合作者数）
      const workConnections = stats[year].workCount;
      const collabCount = collaborations.get(parseInt(year))?.count || 0;

      // 应用公式：影响力 = 2 * notable作品数 + 总连接数
      stats[year].influence = 2 * stats[year].notableCount + workConnections + collabCount;
    }
  }

  // 添加合作数据
  collaborations.forEach((data, year) => {
    if (stats[year]) {
      stats[year].collabCount = data.count;
    }
  });

  result.yearlyStats = stats;
}


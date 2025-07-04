// src/stores/graphStore.js

import { defineStore } from 'pinia';
import { loadData } from '../services/dataService'; // 确保这个路径是正确的

export const useGraphStore = defineStore('graph', {
  // state 定义了应用的核心数据
  state: () => ({
    nodes:[], // 初始化为空数组
    links:[], // 初始化为空数组
    isLoading: false,
    error: null,
    // 过滤条件
    selectedTimeRange:[], // 初始化为空数组
    selectedGenres:[],    // 初始化为空数组
    // 当前选中的实体
    selectedNodeId: null,  // 初始化为 null
  }),

  // getters 允许你创建计算属性，例如根据过滤器返回过滤后的数据
  getters: {
    // 这个 getter 会根据过滤器返回过滤后的节点
    // 目前为了简化，我们先返回所有节点
    filteredNodes: (state) => {
      // TODO: 在这里根据 state.selectedTimeRange 和 state.selectedGenres 过滤节点

      return state.nodes;
    },
    // 这个 getter 会返回过滤后的链接
    filteredLinks: (state) => {
      // TODO: 过滤链接

      return state.links;
    },
    // 这个 getter 返回当前选中节点的详细信息
    selectedNodeDetails: (state) => {
      if (!state.selectedNodeId) return null;
      return state.nodes.find(n => n.id === state.selectedNodeId);
    },
    // 新增：获取图谱数据用于预测
    getGraphDataForPrediction: (state) => {
      // 将 links 转换为 edges 格式
      const edges = state.links.map(link => ({
        source: link.source,
        target: link.target,
        // 确保有必要的属性
        relationship: link.relationship || link['Edge Type'] || 'Unknown'
      }));

      return {
        nodes: state.nodes,
        edges: edges
      };
    }
  },

  // actions 是更新 state 的方法
  actions: {
    async fetchGraphData() {
      console.log("fetchGraphData action 被调用");
      this.isLoading = true;
      this.error = null;
      try {
        const graphData = await loadData(); // 从 dataService 加载数据
        console.log("2.加载的图数据:", graphData);
        this.nodes = graphData.nodes || [];
        this.links = graphData.links || [];
        console.log(`加载数据完成: ${this.nodes.length} 节点, ${this.links.length} 边`);
      } catch (e) {
        console.error("加载数据失败:", e);
        this.error = e;
      } finally {
        this.isLoading = false;
      }
    },

    // 更新过滤器的 action
    updateFilters(newFilters) {
      if (newFilters.timeRange) {
        this.selectedTimeRange = newFilters.timeRange;
      }
      if (newFilters.genres) {
        this.selectedGenres = newFilters.genres;
      }
    },

    // 更新选中节点的 action
    selectNode(nodeId) {
      this.selectedNodeId = nodeId;
    }
  }
});

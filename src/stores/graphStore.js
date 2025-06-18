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
      if (state.nodes.length === 0) {
        return;
      }
      return state.nodes;
    },
    // 这个 getter 会返回过滤后的链接
    filteredLinks: (state) => {
      // TODO: 过滤链接
      if (state.links.length === 0) {
        return;
      }
      return state.links;
    },
    // 这个 getter 返回当前选中节点的详细信息
    selectedNodeDetails: (state) => {
      if (!state.selectedNodeId) return null;
      return state.nodes.find(n => n.id === state.selectedNodeId);
    }
  },

  // actions 是更新 state 的方法
  actions: {
    async fetchGraphData() {
      this.isLoading = true;
      this.error = null;
      try {
        const graphData = await loadData(); // 从 dataService 加载数据
        this.nodes = graphData.nodes;
        this.links = graphData.links;
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
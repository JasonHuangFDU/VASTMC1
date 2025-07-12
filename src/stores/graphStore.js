import { defineStore } from 'pinia';
import { fetchGraphLayout, fetchFilterOptions, processArtistData, getFilteredGraphForSankey } from '../services/dataService';
import { debounce } from 'lodash-es';

export const useGraphStore = defineStore('graph', {
  state: () => ({
    // --- Data from Backend ---
    graphData: { nodes: [], links: [] },
    filterOptions: { genres: [], node_types: [], edge_types: [], node_names: [] },

    // --- Filter Criteria ---
    selectedTimeRange: { start: 1981, end: 2040 },
    selectedGenres: [], // <--- MODIFIED: Was selectedGenre: null
    selectedNodeTypes: [],
    selectedEdgeTypes: [],
    searchQuery: null,
    hopLevel: 1, // 新增：控制网络图的跳数，1或2

    // --- UI State ---
    isLoading: false,
    error: null,
    isRequestPending: false,
    isInitialized: false,

    //新增艺术家生涯轨迹相关状态
    artistCareerData: null,      // 当前选中的艺术家生涯数据
    artistComparisonData: null,  // 艺术家对比数据
    selectedArtists: [],         // 选择的艺术家ID列表（用于对比）
  }),

  getters: {
    // ================================================ //
    //           新增艺术家生涯轨迹相关计算属性           //
    // ================================================ //
    /**
     * 获取当前艺术家的时间线事件
     */
    careerTimelineEvents: (state) => {
      return state.artistCareerData?.timelineEvents || [];
    },

    /**
     * 获取当前艺术家的年度统计数据
     */
    careerYearlyStats: (state) => {
      return state.artistCareerData?.yearlyStats || {};
    },

    /**
     * 获取所有艺术家列表（Person节点）
     */
    artistList: (state) => {
      return state.graphData.nodes.filter(node =>
        node['Node Type'] === 'Person' && node.name
      );
    },

    /**
     * 检查是否可以选择艺术家进行对比
     */
    canCompareArtists: (state) => {
      return state.selectedArtists.filter(id => id !== null).length === 3;
    }
  },

  actions: {
    /**
     * Initializes the store. This action is now idempotent.
     */
    async initializeStore() {
      // 如果已经初始化过，则直接返回，防止重复执行
      if (this.isInitialized) {
        return;
      }

      // Fetch filter options first, as they are needed for the UI.
      await this.loadFilterOptions();

      // Set initial state for the first graph request.
      this.searchQuery = "Sailor Shift";
      this.selectedGenres = []; // <--- MODIFIED: Was selectedGenre: null
      this.selectedNodeTypes = [];
      this.selectedEdgeTypes = [];
      this.selectedTimeRange = { start: 1981, end: 2040 };

      // Fetch the initial graph view.
      await this.updateGraphLayout();

      // 在所有操作成功完成后，将状态标记为已初始化
      this.isInitialized = true;
    },

    /**
     * Fetches available filter options from the backend.
     */
    async loadFilterOptions() {
        try {
            const options = await fetchFilterOptions();
            this.filterOptions.genres = options.genres || [];
            this.filterOptions.node_types = options.node_types || [];
            this.filterOptions.edge_types = options.edge_types || [];
            this.filterOptions.node_names = options.node_names || [];
        } catch (e) {
            console.error('Failed to load filter options:', e);
            this.error = 'Could not load filter options.';
        }
    },

    /**
     * Core action to fetch graph data from the backend based on current state.
     */
    async updateGraphLayout() {
      if (this.isRequestPending) {
        console.log("Request is already in progress. Skipping new request.");
        return;
      }

      this.isLoading = true;
      this.error = null;
      this.isRequestPending = true;

      const payload = {
        centerNodeName: this.searchQuery,
        hopLevel: this.hopLevel, // 新增：将跳数信息发送给后端
        filters: {
          nodeTypes: this.selectedNodeTypes.length > 0 ? this.selectedNodeTypes : null,
          edgeTypes: this.selectedEdgeTypes.length > 0 ? this.selectedEdgeTypes : null,
          genre: this.selectedGenres.length > 0 ? this.selectedGenres : null, // <--- MODIFIED: Use selectedGenres
          timeRange: this.selectedTimeRange,
        },
      };

      try {
        console.log("Requesting graph layout with payload:", JSON.stringify(payload, null, 2));
        const data = await fetchGraphLayout(payload);
        if (data.error) {
            this.error = data.error;
            this.graphData = { nodes: [], links: [] };
        } else {
            this.graphData = data;
        }
      } catch (e) {
        this.error = 'Failed to fetch graph layout: ' + e.toString();
        console.error(this.error);
        this.graphData = { nodes: [], links: [] };
      } finally {
        this.isLoading = false;
        this.isRequestPending = false;
      }
    },

    /**
     * 新增: 处理来自桑基图的过滤请求
     */
    async filterGraphForSankey(filterPayload) {
      this.isLoading = true;
      this.error = null;
      try {
        console.log("Requesting graph for Sankey with payload:", JSON.stringify(filterPayload, null, 2));
        const data = await getFilteredGraphForSankey(filterPayload);
        if (data.error) {
          this.error = data.error;
          this.graphData = { nodes: [], links: [] };
        } else {
          // 直接用后端返回的子图更新graphData
          this.graphData = data;
        }
      } catch (e) {
        this.error = 'Failed to fetch graph for Sankey interaction: ' + e.toString();
        console.error(this.error);
        this.graphData = { nodes: [], links: [] };
      } finally {
        this.isLoading = false;
      }
    },

    /**
     * Debounced version of the update function for frequent UI events.
     */
    debouncedUpdateGraphLayout: debounce(function() {
      this.updateGraphLayout();
    }, 500),

    /**
     * Resets the view to the initial state by setting filters and fetching data.
     */
    async resetView() {
      console.log("Resetting view to 'Sailor Shift'");
      // Reset all filter states
      this.searchQuery = "Sailor Shift";
      this.selectedGenres = []; // <--- MODIFIED: Was selectedGenre: null
      this.selectedNodeTypes = [];
      this.selectedEdgeTypes = [];
      this.selectedTimeRange = { start: 1981, end: 2040 };

      // Fetch the initial graph view
      await this.updateGraphLayout();
    },

    // --- Actions for setting individual filters ---

    setSearchQuery(query) {
        this.searchQuery = query;
        // DO NOT trigger update here. The component will do it.
    },

    selectCenterNode(nodeName) {
        this.searchQuery = nodeName;
        this.updateGraphLayout(); // Immediate update, no debounce
    },

    setGenres(genres) { // <--- MODIFIED: Renamed from setGenre
        this.selectedGenres = genres;
        this.updateGraphLayout();
    },

    setTimeRange(range) {
        this.selectedTimeRange = range;
        this.debouncedUpdateGraphLayout();
    },

    setNodeTypes(types) {
        this.selectedNodeTypes = types;
        this.updateGraphLayout();
    },

    setEdgeTypes(types) {
        this.selectedEdgeTypes = types;
        this.updateGraphLayout();
    },

    setHopLevel(level) {
        if (this.hopLevel !== level) {
            this.hopLevel = level;
            this.updateGraphLayout(); // 当跳数变化时，��即更新图
        }
    },

    setGenreAndResetOthers(genre) {
      console.log(`Filtering by Sankey click, genre: ${genre}`);
      // 1. Set the genre filter
      this.selectedGenres = [genre];

      // 2. Reset all other filters to their default state
      this.searchQuery = ''; // Clear center node
      this.selectedNodeTypes = [];
      this.selectedEdgeTypes = [];
      this.selectedTimeRange = { start: 1981, end: 2040 };

      // 3. Trigger the graph update with the new, clean state
      this.updateGraphLayout();
    },

    /**
     * 设置选中的艺术家列表（用于对比）
     * @param {Array} artistIds - 艺术家ID数组
     */
    setSelectedArtists(artistIds) {
      this.selectedArtists = [...artistIds];
    },

    /**
     * 清除特定位置的艺术家选择
     * @param {number} index - 艺术家在列表中的索引
     */
    clearArtistSelection(index) {
      this.selectedArtists[index] = null;
      this.artistComparisonData = null;
    },

    /**
     * 加载单个艺术家的生涯数据
     * @param {number} artistId - 艺术家ID
     */
    async fetchArtistCareerData(artistId) {
      if (!this.graphData.nodes.length || !this.graphData.links.length) {
        await this.updateGraphLayout();
      }

      try {
        this.artistCareerData = processArtistData(
          {
            nodes: this.graphData.nodes,
            links: this.graphData.links
          },
          artistId
        );
      } catch (error) {
        console.error('处理艺术家生涯数据失败:', error);
        this.artistCareerData = null;
      }
    },

    /**
     * 加载多个艺术家的对比数据
     */
    async fetchArtistComparisonData() {
      if (!this.canCompareArtists) {
        console.error('需要选择三位艺术家才能进行对比');
        return;
      }

      const artistIds = this.selectedArtists.filter(id => id !== null);
      const results = [];

      for (const id of artistIds) {
        await this.fetchArtistCareerData(id);
        if (this.artistCareerData) {
          const artistNode = this.graphData.nodes.find(n => n.id === id);
          results.push({
            id,
            data: this.artistCareerData,
            name: artistNode?.name || `艺术家 ${id}`
          });
        }
      }

      this.artistComparisonData = results;
    }
  },
});

import { defineStore } from 'pinia';
import { fetchGraphLayout, fetchFilterOptions } from '../services/dataService';
import { debounce } from 'lodash-es';

export const useGraphStore = defineStore('graph', {
  state: () => ({
    // --- Data from Backend ---
    graphData: { nodes: [], links: [] },
    filterOptions: { genres: [], node_types: [], edge_types: [], node_names: [] },

    // --- Filter Criteria ---
    selectedTimeRange: { start: 1981, end: 2034 },
    selectedGenres: [], // <--- MODIFIED: Was selectedGenre: null
    selectedNodeTypes: [],
    selectedEdgeTypes: [],
    searchQuery: null,

    // --- UI State ---
    isLoading: false,
    error: null,
    isRequestPending: false,
    isInitialized: false,
  }),

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
      this.selectedTimeRange = { start: 1981, end: 2034 };
      
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
      this.selectedTimeRange = { start: 1981, end: 2034 };
      
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

    setGenreAndResetOthers(genre) {
      console.log(`Filtering by Sankey click, genre: ${genre}`);
      // 1. Set the genre filter
      this.selectedGenres = [genre];
      
      // 2. Reset all other filters to their default state
      this.searchQuery = ''; // Clear center node
      this.selectedNodeTypes = [];
      this.selectedEdgeTypes = [];
      this.selectedTimeRange = { start: 1981, end: 2034 };
      
      // 3. Trigger the graph update with the new, clean state
      this.updateGraphLayout();
    }
  },
});

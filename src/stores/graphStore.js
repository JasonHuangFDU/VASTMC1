import { defineStore } from 'pinia';
import { 
    fetchGraphLayout, 
    fetchFilterOptions, 
    processArtistData, 
    getFilteredGraphForSankey, 
    fetchArtistSubgraph, 
    fetchFocusGraph,
    getFocusCollaborationData,
    getFocusInfluenceData
} from '../services/dataService';
import { debounce } from 'lodash-es';

export const useGraphStore = defineStore('graph', {
  state: () => ({
    graphData: { nodes: [], links: [] },
    originalGraphData: null,
    filterOptions: { genres: [], node_types: [], edge_types: [], node_names: [], person_nodes: [] },
    selectedTimeRange: { start: 1981, end: 2040 },
    selectedGenres: [], 
    selectedNodeTypes: [],
    selectedEdgeTypes: [],
    searchQuery: null, 
    hopLevel: 1, 
    isLoading: false,
    error: null,
    isRequestPending: false,
    isInitialized: false,
    isCollaborationFocusActive: false,
    isInfluenceFocusActive: false,
    artistCareerData: null,      
    artistComparisonData: null,  
    selectedArtists: [],         
  }),

  getters: {
    careerTimelineEvents: (state) => state.artistCareerData?.timelineEvents || [],
    careerYearlyStats: (state) => state.artistCareerData?.yearlyStats || {},
    artistList: (state) => state.graphData.nodes.filter(node => node['Node Type'] === 'Person' && node.name),
    canCompareArtists: (state) => state.selectedArtists.filter(id => id !== null).length === 3,
  },

  actions: {
    async initializeStore() {
      if (this.isInitialized) return;
      await this.fetchFilterOptions();
      this.searchQuery = 17255;
      this.selectedGenres = [];
      this.selectedNodeTypes = [];
      this.selectedEdgeTypes = [];
      this.selectedTimeRange = { start: 1981, end: 2040 };
      await this.updateGraphLayout();
      const initialCenterNode = this.graphData.nodes.find(node => node.id === this.searchQuery);
      if (initialCenterNode) this.centerNode = initialCenterNode;
      this.isInitialized = true;
    },

    async fetchFilterOptions() {
        try {
            const options = await fetchFilterOptions();
            this.filterOptions = { ...this.filterOptions, ...options };
        } catch (e) {
            this.error = 'Could not load filter options.';
        }
    },

    async updateGraphLayout() {
      if (this.isRequestPending) return;
      this.isLoading = true;
      this.error = null;
      this.isRequestPending = true;
      const payload = {
        centerNodeId: this.searchQuery,
        hopLevel: this.hopLevel,
        filters: {
          nodeTypes: this.selectedNodeTypes.length > 0 ? this.selectedNodeTypes : null,
          edgeTypes: this.selectedEdgeTypes.length > 0 ? this.selectedEdgeTypes : null,
          genre: this.selectedGenres.length > 0 ? this.selectedGenres : null,
          timeRange: this.selectedTimeRange,
        },
      };
      try {
        const data = await fetchGraphLayout(payload);
        this.graphData = data.error ? { nodes: [], links: [] } : data;
        if (!data.error) this.originalGraphData = JSON.parse(JSON.stringify(data));
      } catch (e) {
        this.error = 'Failed to fetch graph layout: ' + e.toString();
        this.graphData = { nodes: [], links: [] };
      } finally {
        this.isLoading = false;
        this.isRequestPending = false;
      }
    },

    debouncedUpdateGraphLayout: debounce(function() { this.updateGraphLayout(); }, 500),

    selectCenterNode(nodeId) {
      this.searchQuery = nodeId;
      this.updateGraphLayout();
    },

    setHopLevel(level) {
        if (this.hopLevel !== level) {
            this.hopLevel = level;
            this.updateGraphLayout();
        }
    },

    setGenres(genres) {
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

    // --- FOCUS ACTIONS ---
    async _applyFocus(fetchFunction, activeStateFlag) {
      this._resetHighlights(activeStateFlag);
      
      this.isLoading = true;
      try {
        const response = await fetchFunction();
        const { nodes: highlightNodeIds, links: highlightLinkDefs } = response.data;
        
        const nodeIds = new Set(highlightNodeIds);
        // Create a set of "source-target" strings for easy lookup
        const linkKeys = new Set(highlightLinkDefs.map(l => `${l.source}-${l.target}`));

        this.graphData.nodes.forEach(node => {
          node.highlight = nodeIds.has(node.id);
        });
        this.graphData.links.forEach(link => {
          const linkKey = `${link.source}-${link.target}`;
          link.highlight = linkKeys.has(linkKey);
        });
        
        this[activeStateFlag] = true;
      } catch (e) {
        this.error = `Failed to fetch focus data: ${e.toString()}`;
      } finally {
        this.isLoading = false;
        this.graphData = { ...this.graphData };
      }
    },

    _resetHighlights(excludeFlag = null) {
      this.graphData.nodes.forEach(n => n.highlight = false);
      this.graphData.links.forEach(l => l.highlight = false);
      if (excludeFlag !== 'isCollaborationFocusActive') this.isCollaborationFocusActive = false;
      if (excludeFlag !== 'isInfluenceFocusActive') this.isInfluenceFocusActive = false;
    },

    async toggleCollaborationFocus() {
      if (this.isCollaborationFocusActive) {
        this._resetHighlights();
        this.graphData = { ...this.graphData };
      } else {
        await this._applyFocus(getFocusCollaborationData, 'isCollaborationFocusActive');
      }
    },

    async toggleInfluenceFocus() {
      if (this.isInfluenceFocusActive) {
        this._resetHighlights();
        this.graphData = { ...this.graphData };
      } else {
        await this._applyFocus(getFocusInfluenceData, 'isInfluenceFocusActive');
      }
    },
    
    // Other actions...
    async fetchFocusGraph() {
      this.isLoading = true;
      this.error = null;
      try {
        const data = await fetchFocusGraph();
        this.graphData = data.error ? { nodes: [], links: [] } : data;
      } catch (e) {
        this.error = 'Failed to fetch focus graph: ' + e.toString();
      } finally {
        this.isLoading = false;
      }
    }
  },
});

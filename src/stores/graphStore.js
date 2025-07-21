import { defineStore } from 'pinia';
import { 
    fetchFullGraph, // New
    fetchGraphLayout, 
    fetchFilterOptions, 
    processArtistData, 
    getFilteredGraphForSankey, // This will be replaced by a new service function
    fetchArtistSubgraph, 
    fetchFocusGraph,
    getFocusCollaborationData,
    getFocusInfluenceData,
    fetchSankeyInteractionData,
    fetchInwardSankeyInteractionData
} from '../services/dataService';
import { debounce } from 'lodash-es';

export const useGraphStore = defineStore('graph', {
  state: () => ({
    fullGraph: null, // To store the complete graph data
    graphData: { nodes: [], links: [] },
    originalGraphData: null,
    // New state for Sankey interaction
    sankeyFilteredData: null,
    isSankeyFiltered: false,
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
      this.isLoading = true;
      await this.fetchFilterOptions();
      await this.fetchFullGraph(); // Fetch the entire graph once
      this.searchQuery = 17255;
      this.selectedGenres = [];
      this.selectedNodeTypes = [];
      this.selectedEdgeTypes = [];
      this.selectedTimeRange = { start: 1981, end: 2040 };
      await this.updateGraphLayout();
      const initialCenterNode = this.graphData.nodes.find(node => node.id === this.searchQuery);
      if (initialCenterNode) this.centerNode = initialCenterNode;
      this.isInitialized = true;
      this.isLoading = false;
    },

    async fetchFullGraph() {
        try {
            const fullData = await fetchFullGraph(); 
            this.fullGraph = fullData;
        } catch (e) {
            this.error = 'Could not load the full graph data.';
            console.error(e);
        }
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
      // When we update the main layout, we are no longer in Sankey-filtered mode.
      this.isSankeyFiltered = false;
      this.sankeyFilteredData = null;

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
        if (!data.error) {
            // Save the initial state of the graph for restoration later
            this.originalGraphData = JSON.parse(JSON.stringify(data));
        }
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
        if (this.hopLevel !== level || this.isCollaborationFocusActive || this.isInfluenceFocusActive) {
            this.hopLevel = level;
            // Deactivate any special focus modes when a hop level is explicitly set.
            this.isCollaborationFocusActive = false;
            this.isInfluenceFocusActive = false;
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

    // --- SANKEY INTERACTION ACTIONS ---
    async triggerSankeyInteraction(sourceNode, targetNode) {
        this.isLoading = true;
        this.error = null;
        this._resetHighlights(); // Clear any previous focus states

        try {
            // 将节点对象传递给服务层
            const subgraphData = await fetchSankeyInteractionData(sourceNode, targetNode);
            
            if (subgraphData && subgraphData.nodes && subgraphData.nodes.length > 0) {
                this.sankeyFilteredData = subgraphData;
                this.isSankeyFiltered = true;
            } else {
                this.sankeyFilteredData = { nodes: [], links: [] };
                this.isSankeyFiltered = true; // Still true, to show the empty state
                console.log("Sankey interaction returned no data, showing empty graph.");
            }
        } catch (e) {
            this.error = `Failed to fetch subgraph for Sankey interaction: ${e.toString()}`;
            console.error(this.error);
            this.sankeyFilteredData = { nodes: [], links: [] };
            this.isSankeyFiltered = true;
        } finally {
            this.isLoading = false;
        }
    },

    async triggerInwardSankeyInteraction(sourceNode, targetNode) {
        this.isLoading = true;
        this.error = null;
        this._resetHighlights();

        try {
            const subgraphData = await fetchInwardSankeyInteractionData(sourceNode, targetNode);
            
            if (subgraphData && subgraphData.nodes && subgraphData.nodes.length > 0) {
                this.sankeyFilteredData = subgraphData;
                this.isSankeyFiltered = true;
            } else {
                this.sankeyFilteredData = { nodes: [], links: [] };
                this.isSankeyFiltered = true;
                console.log("Inward Sankey interaction returned no data.");
            }
        } catch (e) {
            this.error = `Failed to fetch subgraph for Inward Sankey interaction: ${e.toString()}`;
            console.error(this.error);
            this.sankeyFilteredData = { nodes: [], links: [] };
            this.isSankeyFiltered = true;
        } finally {
            this.isLoading = false;
        }
    },

    resetSankeyFilter() {
        this.isSankeyFiltered = false;
        this.sankeyFilteredData = null;
        // Optionally, trigger a re-render of the original graph if its state could be stale
        // For now, we assume the original graphData is still valid.
        console.log("Sankey filter reset.");
    },

    async resetGraphView() {
      this.isLoading = true;
      this.error = null;

      // Reset all filters and view states to their defaults
      this.searchQuery = 17255; // Default to Sailor Shift
      this.hopLevel = 1;
      this.selectedGenres = [];
      this.selectedNodeTypes = [];
      this.selectedEdgeTypes = [];
      this.selectedTimeRange = { start: 1981, end: 2040 };

      // Reset special view states
      this.isSankeyFiltered = false;
      this.sankeyFilteredData = null;
      this._resetHighlights(); // This also resets focus flags

      // Fetch the graph with the reset parameters
      await this.updateGraphLayout();
      
      this.isLoading = false;
    },

    async showArtistComparison(artistId) {
      this.isLoading = true;
      this.error = null;
      this._resetHighlights(); // Clear any previous focus states
      this.isSankeyFiltered = false; // Ensure we exit any Sankey-specific view
      
      try {
        const subgraphData = await fetchArtistSubgraph(artistId);
        if (subgraphData && subgraphData.nodes && subgraphData.nodes.length > 0) {
          this.graphData = subgraphData;
        } else {
          this.graphData = { nodes: [], links: [] };
          console.log(`Comparison subgraph for artist ${artistId} returned no data.`);
        }
      } catch (e) {
        this.error = `Failed to fetch comparison subgraph for artist ${artistId}: ${e.toString()}`;
        console.error(this.error);
        this.graphData = { nodes: [], links: [] };
      } finally {
        this.isLoading = false;
      }
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
          const linkKey = `${link.source.id || link.source}-${link.target.id || link.target}`;
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
      if (this.graphData && this.graphData.nodes) {
        this.graphData.nodes.forEach(n => n.highlight = false);
      }
      if (this.graphData && this.graphData.links) {
        this.graphData.links.forEach(l => l.highlight = false);
      }
      if (excludeFlag !== 'isCollaborationFocusActive') this.isCollaborationFocusActive = false;
      if (excludeFlag !== 'isInfluenceFocusActive') this.isInfluenceFocusActive = false;
    },

    async toggleCollaborationFocus() {
      // If it's currently active, we want to turn it off and restore the original graph.
      if (this.isCollaborationFocusActive) {
        this.isCollaborationFocusActive = false;
        // Restore the graph to its state before the focus was applied.
        // The originalGraphData is saved after every layout update.
        if (this.originalGraphData) {
            this.graphData = JSON.parse(JSON.stringify(this.originalGraphData));
        }
        this.isLoading = false;
      } else {
        // If it's not active, we fetch the special collaboration graph.
        this.isLoading = true;
        this.error = null;
        this._resetHighlights(); // Clear other focus states like influence focus

        try {
          const response = await getFocusCollaborationData();
          // The backend now returns a full graph object, not just IDs.
          // We replace the current graphData with this new focused graph.
          this.graphData = response.data;
          this.isCollaborationFocusActive = true;
        } catch (e) {
          this.error = `Failed to fetch collaboration focus data: ${e.toString()}`;
          this.graphData = { nodes: [], links: [] }; // Clear graph on error
        } finally {
          this.isLoading = false;
        }
      }
    },

    async toggleInfluenceFocus() {
      // If it's currently active, we want to turn it off and restore the original graph.
      if (this.isInfluenceFocusActive) {
        this.isInfluenceFocusActive = false;
        // Restore the graph to its state before the focus was applied.
        if (this.originalGraphData) {
            this.graphData = JSON.parse(JSON.stringify(this.originalGraphData));
        }
        this.isLoading = false;
      } else {
        // If it's not active, we fetch the special influence graph.
        this.isLoading = true;
        this.error = null;
        this._resetHighlights(); // Clear other focus states

        try {
          const response = await getFocusInfluenceData();
          // The backend returns a full graph object to replace the current view.
          this.graphData = response.data;
          this.isInfluenceFocusActive = true;
        } catch (e) {
          this.error = `Failed to fetch influence focus data: ${e.toString()}`;
          this.graphData = { nodes: [], links: [] }; // Clear graph on error
        } finally {
          this.isLoading = false;
        }
      }
    },
    
    // --- SANKEY INTERACTION ACTION (OLD - to be removed or refactored) ---
    async handleSankeyClick(payload) {
        // payload is expected to be { type: '...', params: { ... } }
        this.isLoading = true;
        this.error = null;
        this._resetHighlights(); // Clear any previous focus states

        try {
            // Call the service function that hits the backend endpoint
            const subgraphData = await getFilteredGraphForSankey(payload);
            
            if (subgraphData && subgraphData.nodes && subgraphData.nodes.length > 0) {
                // Replace the main graph data with the focused subgraph
                this.graphData = subgraphData;
            } else {
                // If no data is returned, show an empty graph
                this.graphData = { nodes: [], links: [] };
                console.log("Sankey interaction returned no data, showing empty graph.");
            }
        } catch (e) {
            this.error = `Failed to fetch subgraph for Sankey interaction: ${e.toString()}`;
            console.error(this.error);
            this.graphData = { nodes: [], links: [] }; // Clear graph on error
        } finally {
            this.isLoading = false;
        }
    },

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
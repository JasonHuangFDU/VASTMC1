// src/stores/graphStore.js
import { defineStore } from 'pinia';
import { loadYearlyData, loadFilterOptions, loadData } from '../services/dataService';
import { uniqBy } from 'lodash-es';

export const useGraphStore = defineStore('graph', {
  state: () => ({
    // --- Raw Data ---
    graphByYear: {}, 
    filterOptions: { genres: [], nodeTypes: [], edgeTypes: [] },
    allNodesMasterList: [],
    allLinksMasterList: [],
    
    // --- Filter Criteria ---
    selectedTimeRange: { start: 1981, end: 2034 },
    selectedGenres: [],
    selectedNodeTypes: [],
    selectedEdgeTypes: [],
    searchTerm: '',

    // --- UI & Data State ---
    isLoading: false,
    error: null,
    selectedNodeId: null,
    isInitialView: true,
    focusedNodeId: null, // ID of the node to focus on
  }),

  getters: {
    filteredGraph(state) {
      const allNodes = state.allNodesMasterList;
      const allLinks = state.allLinksMasterList;

      if (allNodes.length === 0) {
        return { nodes: [], links: [] };
      }

      // Determine if any filters are active (excluding initial view and focused node)
      const anyFiltersActive =
        state.selectedTimeRange.start !== 1981 || state.selectedTimeRange.end !== 2048 ||
        state.selectedGenres.length > 0 ||
        state.selectedNodeTypes.length > 0 ||
        state.selectedEdgeTypes.length > 0 ||
        state.searchTerm.trim() !== '';

      // --- 1. Filter-based View (优先) ---
      if (anyFiltersActive) {
        let nodes = [];
        let links = [];
        const yearKeys = Object.keys(state.graphByYear);

        for (const yearStr of yearKeys) {
          const year = parseInt(yearStr, 10);
          if (year >= state.selectedTimeRange.start && year <= state.selectedTimeRange.end) {
            nodes.push(...(state.graphByYear[yearStr].nodes || []));
            links.push(...(state.graphByYear[yearStr].links || []));
          }
        }

        let uniqueNodes = uniqBy(nodes, 'id');
        let uniqueLinks = uniqBy(links, link => `${link.source}-${link.target}-${link['Edge Type']}`);
        console.log(`FilteredGraph: Initial unique nodes after time range: ${uniqueNodes.length}`);
        // Debugging: Check influence_score for Person nodes after initial aggregation
        uniqueNodes.filter(node => node['Node Type'] === 'Person').forEach(person => {
          if (person.influence_score === undefined) {
            console.log(`FilteredGraph Debug: Person node ${person.name} (ID: ${person.id}) is missing influence_score after initial aggregation.`);
          } else {
            console.log(`FilteredGraph Debug: Person node ${person.name} (ID: ${person.id}) has influence_score: ${person.influence_score} after initial aggregation.`);
          }
        });

        let furtherFilteredNodes = uniqueNodes;

        if (state.selectedGenres.length > 0) {
          const selectedGenresSet = new Set(state.selectedGenres);
          furtherFilteredNodes = furtherFilteredNodes.filter(node =>
            node.genre && selectedGenresSet.has(node.genre)
          );
          console.log(`FilteredGraph: Nodes after genre filter: ${furtherFilteredNodes.length}`);
        }

        if (state.selectedNodeTypes.length > 0) {
          const selectedNodeTypesSet = new Set(state.selectedNodeTypes);
          console.log(`FilteredGraph: Before node type filter, nodes: ${furtherFilteredNodes.length}. Selected types: ${Array.from(selectedNodeTypesSet).join(', ')}`);
          furtherFilteredNodes = furtherFilteredNodes.filter(node => {
            const nodeType = node['Node Type'];
            const isMatch = selectedNodeTypesSet.has(nodeType);
            if (!isMatch) {
              console.log(`FilteredGraph: Filtering out node ${node.id} (${node.name}) with type '${nodeType}'`);
            }
            return isMatch;
          });
          console.log(`FilteredGraph: After node type filter, nodes: ${furtherFilteredNodes.length}`);
          // Debugging: Check influence_score for Person nodes after node type filter
          furtherFilteredNodes.filter(node => node['Node Type'] === 'Person').forEach(person => {
            if (person.influence_score === undefined) {
              console.log(`FilteredGraph Debug: Person node ${person.name} (ID: ${person.id}) is missing influence_score after node type filter.`);
            } else {
              console.log(`FilteredGraph Debug: Person node ${person.name} (ID: ${person.id}) has influence_score: ${person.influence_score} after node type filter.`);
            }
          });
        }

        if (state.searchTerm.trim() !== '') {
          const term = state.searchTerm.trim().toLowerCase();
          furtherFilteredNodes = furtherFilteredNodes.filter(node =>
            node.name.toLowerCase().includes(term)
          );
          console.log(`FilteredGraph: Nodes after search term filter: ${furtherFilteredNodes.length}`);
        }

        const visibleNodeIds = new Set(furtherFilteredNodes.map(n => n.id));
        const finalLinks = uniqueLinks.filter(link => {
          const edgeTypeMatch = state.selectedEdgeTypes.length === 0 || state.selectedEdgeTypes.includes(link['Edge Type']);
          return edgeTypeMatch && visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target);
        });

        const finalNodeIds = new Set(visibleNodeIds);
        finalLinks.forEach(link => {
          finalNodeIds.add(link.source);
          finalNodeIds.add(link.target);
        });
        const finalNodes = uniqueNodes.filter(node => finalNodeIds.has(node.id));
        console.log(`FilteredGraph: Final nodes count: ${finalNodes.length}`);
        // Debugging: Check influence_score for Person nodes in finalNodes
        finalNodes.filter(node => node['Node Type'] === 'Person').forEach(person => {
          if (person.influence_score === undefined) {
            console.log(`FilteredGraph Debug: Person node ${person.name} (ID: ${person.id}) is missing influence_score in finalNodes.`);
          } else {
            console.log(`FilteredGraph Debug: Person node ${person.name} (ID: ${person.id}) has influence_score: ${person.influence_score} in finalNodes.`);
          }
        });

        return { nodes: finalNodes, links: finalLinks };
      }

      // --- 2. Focused View (仅当没有其他筛选条件时) ---
      if (state.focusedNodeId) {
        const centerNode = allNodes.find(n => n.id === state.focusedNodeId);
        if (!centerNode) return { nodes: [], links: [] };

        const relatedLinkSet = new Set();
        allLinks.forEach(link => {
          if (link.source === centerNode.id || link.target === centerNode.id) {
            relatedLinkSet.add(link);
          }
        });
        const relatedNodeIdSet = new Set([centerNode.id]);
        relatedLinkSet.forEach(link => {
          relatedNodeIdSet.add(link.source);
          relatedNodeIdSet.add(link.target);
        });
        const focusedNodes = allNodes.filter(n => relatedNodeIdSet.has(n.id));
        return { nodes: focusedNodes, links: Array.from(relatedLinkSet) };
      }

      // --- 3. Initial View (仅当没有其他筛选条件且没有焦点节点时) ---
      if (state.isInitialView) {
        const centerNode = allNodes.find(n => n.name === 'Sailor Shift');
        if (!centerNode) return { nodes: [], links: [] };

        const relatedLinkSet = new Set();
        allLinks.forEach(link => {
          if (link.source === centerNode.id || link.target === centerNode.id) {
            relatedLinkSet.add(link);
          }
        });
        const relatedNodeIdSet = new Set([centerNode.id]);
        relatedLinkSet.forEach(link => {
          relatedNodeIdSet.add(link.source);
          relatedNodeIdSet.add(link.target);
        });
        const initialNodes = allNodes.filter(n => relatedNodeIdSet.has(n.id));
        return { nodes: initialNodes, links: Array.from(relatedLinkSet) };
      }

      // Fallback if no specific view is active (should ideally not be reached if initial view is always set)
      return { nodes: [], links: [] };

      let furtherFilteredNodes = uniqueNodes;

      if (state.selectedGenres.length > 0) {
        const selectedGenresSet = new Set(state.selectedGenres);
        furtherFilteredNodes = furtherFilteredNodes.filter(node => 
          node.genre && selectedGenresSet.has(node.genre)
        );
      }

      if (state.selectedNodeTypes.length > 0) {
        const selectedNodeTypesSet = new Set(state.selectedNodeTypes);
        furtherFilteredNodes = furtherFilteredNodes.filter(node => 
          selectedNodeTypesSet.has(node['Node Type'])
        );
      }
      
      if (state.searchTerm.trim() !== '') {
        const term = state.searchTerm.trim().toLowerCase();
        furtherFilteredNodes = furtherFilteredNodes.filter(node => 
          node.name.toLowerCase().includes(term)
        );
      }

      const visibleNodeIds = new Set(furtherFilteredNodes.map(n => n.id));
      const finalLinks = uniqueLinks.filter(link => {
        const edgeTypeMatch = state.selectedEdgeTypes.length === 0 || state.selectedEdgeTypes.includes(link['Edge Type']);
        return edgeTypeMatch && visibleNodeIds.has(link.source) && visibleNodeIds.has(link.target);
      });

      const finalNodeIds = new Set(visibleNodeIds);
      finalLinks.forEach(link => {
        finalNodeIds.add(link.source);
        finalNodeIds.add(link.target);
      });
      const finalNodes = uniqueNodes.filter(node => finalNodeIds.has(node.id));

      return { nodes: finalNodes, links: finalLinks };
    },

    selectedNodeDetails(state) {
      if (!state.selectedNodeId) return null;
      return state.allNodesMasterList.find(n => n.id === state.selectedNodeId);
    },
  },

  actions: {
    async initializeStore() {
      if (this.allNodesMasterList.length > 0) return;
      this.isLoading = true;
      this.error = null;
      try {
        const [yearlyData, options, fullData] = await Promise.all([
          loadYearlyData(),
          loadFilterOptions(),
          loadData()
        ]);
        this.graphByYear = yearlyData;
        this.filterOptions = options;
        this.allNodesMasterList = fullData.nodes;
        this.allLinksMasterList = fullData.links;
        console.log("Store initialized.");
        
        // Debugging: Check node types in yearlyData
        const allYearlyNodes = Object.values(yearlyData).flatMap(year => year.nodes || []);
        const nodeTypeCounts = allYearlyNodes.reduce((acc, node) => {
          const type = node['Node Type'];
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        }, {});
        console.log("initializeStore: Node types and counts in yearlyData:", nodeTypeCounts);

      } catch (e) {
        console.error("Failed to initialize graph store:", e);
        this.error = e;
      } finally {
        this.isLoading = false;
      }
    },

    setFilters(newFilters) {
      this.isInitialView = false;
      this.focusedNodeId = null; // Clear focus when filtering
      if (newFilters.selectedTimeRange !== undefined) this.selectedTimeRange = newFilters.selectedTimeRange;
      if (newFilters.selectedGenres !== undefined) this.selectedGenres = newFilters.selectedGenres;
      if (newFilters.selectedNodeTypes !== undefined) this.selectedNodeTypes = newFilters.selectedNodeTypes;
      if (newFilters.selectedEdgeTypes !== undefined) this.selectedEdgeTypes = newFilters.selectedEdgeTypes;
      if (newFilters.searchTerm !== undefined) this.searchTerm = newFilters.searchTerm;
    },

    focusOnNode(nodeId) {
        this.isInitialView = false;
        this.focusedNodeId = nodeId;
        // Optionally clear other filters when focusing
        this.searchTerm = '';
    },

    selectNode(nodeId) {
      this.selectedNodeId = nodeId;
    },

    resetFilters() {
      this.isInitialView = true;
      this.focusedNodeId = null;
      this.selectedTimeRange = { start: 1981, end: 2048 };
      this.selectedGenres = [];
      this.selectedNodeTypes = [];
      this.selectedEdgeTypes = [];
      this.searchTerm = '';
      this.selectedNodeId = null;
    }
  }
});;
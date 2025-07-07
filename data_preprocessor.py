
import json
from collections import defaultdict
import os

def preprocess_graph_data():
    """
    Processes the original graph data based on the actual field names found in MC1_graph.json.
    The new logic associates links with years based on the release_date of their source nodes.
    """
    # --- Configuration ---
    original_graph_file = os.path.join('public', 'MC1_graph.json')
    processed_graph_file = os.path.join('public', 'graph_processed.json')
    output_yearly_file = os.path.join('public', 'graph_by_year.json')
    output_options_file = os.path.join('public', 'filter_options.json')
    
    print("Starting data preprocessing with corrected logic...")
    print(f"Original graph file: {os.path.abspath(original_graph_file)}")
    print(f"Processed graph file: {os.path.abspath(processed_graph_file)}")

    # --- Load Original Data ---
    try:
        with open(original_graph_file, 'r', encoding='utf-8') as f:
            original_data = json.load(f)
        print("Successfully loaded original graph data.")
    except FileNotFoundError:
        print(f"Error: Original graph file not found at {os.path.abspath(original_graph_file)}")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {original_graph_file}")
        return

    # --- Load Processed Data for Influence Scores ---
    try:
        with open(processed_graph_file, 'r', encoding='utf-8') as f:
            processed_data = json.load(f)
        print("Successfully loaded processed graph data.")
    except FileNotFoundError:
        print(f"Error: Processed graph file not found at {os.path.abspath(processed_graph_file)}")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {processed_graph_file}")
        return

    nodes = original_data['nodes']
    links = original_data['links']
    
    # Create a dictionary for quick node lookup by id from original data
    nodes_dict = {node['id']: node for node in nodes}

    # Create a lookup for influence scores from processed data
    influence_scores_map = {node['id']: node.get('influence_score') for node in processed_data['nodes'] if 'influence_score' in node}
    print(f"Collected {len(influence_scores_map)} influence scores from processed data.")

    # --- Data Structures for Processed Data ---
    graph_by_year = defaultdict(lambda: {"nodes": {}, "links": []})
    all_genres = set()
    all_node_types = set()
    all_edge_types = set()

    # --- Process Nodes to Collect Filter Options ---
    for node in nodes:
        # Corrected field name: 'genre' (singular)
        if 'genre' in node and node['genre']:
            all_genres.add(node['genre'])
        # Corrected field name: 'Node Type'
        if 'Node Type' in node:
            all_node_types.add(node['Node Type'])

    # --- Process Links and Associate with Years via Nodes ---
    print("Processing links and chunking data by year based on node release_date...")
    for link in links:
        # Corrected field name: 'Edge Type'
        if 'Edge Type' in link:
            all_edge_types.add(link['Edge Type'])

        source_node = nodes_dict.get(link['source'])
        target_node = nodes_dict.get(link['target'])

        if not source_node or not target_node:
            continue # Skip invalid links

        year_str = None

        # Prioritize Song/Album release_date for year determination
        if 'release_date' in source_node and (source_node.get('Node Type') == 'Song' or source_node.get('Node Type') == 'Album'):
            try:
                year_str = str(source_node['release_date'])[:4]
            except (ValueError, TypeError):
                pass # Invalid date, continue to next check

        if year_str is None and 'release_date' in target_node and (target_node.get('Node Type') == 'Song' or target_node.get('Node Type') == 'Album'):
            try:
                year_str = str(target_node['release_date'])[:4]
            except (ValueError, TypeError):
                pass # Invalid date, continue to next check

        # Fallback to source node's release_date if no Song/Album defined the year
        if year_str is None and 'release_date' in source_node:
            try:
                year_str = str(source_node['release_date'])[:4]
            except (ValueError, TypeError):
                pass # Invalid date, skip this link

        if year_str: # Only process if a valid year_str was determined
            # Add the link to the corresponding year
            graph_by_year[year_str]["links"].append(link)

            # Add source and target nodes for that year, ensuring no duplicates
            for node_to_add in [source_node, target_node]:
                if node_to_add and node_to_add['id'] not in graph_by_year[year_str]["nodes"]:
                    # Create a copy to avoid modifying the original node_dict entry directly
                    node_copy = node_to_add.copy()
                    node_type = node_copy.get('Node Type')
                    if node_type in ['Person', 'MusicalGroup', 'RecordLabel']:
                        if node_copy['id'] in influence_scores_map:
                            node_copy['influence_score'] = influence_scores_map[node_copy['id']]
                    graph_by_year[year_str]["nodes"][node_copy['id']] = node_copy

    # Convert the nodes dictionary back to a list for each year
    for year in graph_by_year:
        graph_by_year[year]["nodes"] = list(graph_by_year[year]["nodes"].values())

    # --- Prepare Filter Options ---
    filter_options = {
        "genres": sorted(list(all_genres)),
        "nodeTypes": sorted(list(all_node_types)),
        "edgeTypes": sorted(list(all_edge_types))
    }
    
    print("Data chunking complete.")

    # --- Save Processed Data to Files ---
    try:
        with open(output_yearly_file, 'w', encoding='utf-8') as f:
            json.dump(graph_by_year, f, indent=2)
        print(f"Successfully saved yearly data to {os.path.abspath(output_yearly_file)}")

        with open(output_options_file, 'w', encoding='utf-8') as f:
            json.dump(filter_options, f, indent=2)
        print(f"Successfully saved filter options to {os.path.abspath(output_options_file)}")

    except IOError as e:
        print(f"Error writing to output file: {e}")

    print("Preprocessing finished successfully!")

if __name__ == '__main__':
    preprocess_graph_data()

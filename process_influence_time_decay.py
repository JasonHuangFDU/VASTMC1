# process_influence_time_decay.py

import json
import os
import math

def process_time_decay_scores(input_path, output_path):
    """
    Reads influence data, adds a 'first_year' field, and recalculates
    influence scores based on a time-decay formula, ensuring floating-point
    arithmetic and providing detailed logging for a specific node.
    """
    print(f"Starting time-decay processing for '{input_path}'...")

    # --- 1. Load the input JSON data ---
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print("Successfully loaded data.")
    except FileNotFoundError:
        print(f"Error: Input file not found at '{input_path}'")
        return
    except json.JSONDecodeError:
        print(f"Error: Failed to decode JSON from '{input_path}'.")
        return

    # --- 2. Pre-computation Pass ---
    node_first_year = {}
    node_original_scores = {}
    
    years = sorted([int(y) for y in data.keys() if y.isdigit()])

    for year in years:
        year_str = str(year)
        if not isinstance(data.get(year_str), list):
            continue
            
        for node in data[year_str]:
            node_id = node.get("node id")
            if node_id is None:
                continue

            if node_id not in node_first_year:
                node_first_year[node_id] = year

            if node_id not in node_original_scores:
                node_original_scores[node_id] = {}
            # *** FIX: Ensure all scores are read as floats from the start ***
            node_original_scores[node_id][year] = float(node.get("Influence score", 0.0))

    print(f"Pre-computation complete. Found {len(node_first_year)} unique nodes.")

    # --- 3. Main Calculation Pass ---
    new_max_info = {
        "year": None,
        "node_id": None,
        "name": None,
        "max_influence_score": -float('inf')
    }

    # ID for detailed logging
    DEBUG_NODE_ID = 17255 

    for node_id, first_year in node_first_year.items():
        
        last_calculated_score = None
        original_score_at_last_calc = None

        # *** FIX: Ensure base score is a float ***
        first_year_original_score = float(node_original_scores[node_id].get(first_year, 0.0))

        if node_id == DEBUG_NODE_ID:
            print("\n" + "="*50)
            print(f"DEBUGGING NODE: {node_id} (First Year: {first_year})")
            print(f"Base Score in First Year ({first_year}): {first_year_original_score}")
            print("="*50)

        for year in years:
            if year < first_year:
                continue

            node_to_update = None
            for node in data[str(year)]:
                if node.get("node id") == node_id:
                    node_to_update = node
                    break
            
            if not node_to_update:
                continue

            node_to_update['first_year'] = first_year

            # *** FIX: Ensure current score is a float ***
            current_original_score = float(node_original_scores[node_id].get(year, 0.0))
            new_score = current_original_score

            if last_calculated_score is not None and current_original_score == original_score_at_last_calc:
                new_score = last_calculated_score
                if node_id == DEBUG_NODE_ID:
                    print(f"  - Year {year}: Original score ({current_original_score}) is unchanged. Propagating last calculated score.")
                    print(f"    --> New Score: {new_score:.4f}")

            else:
                time_delta = year - first_year
                
                if node_id == DEBUG_NODE_ID:
                    print(f"  - Year {year}: Original score ({current_original_score}) changed. Recalculating...")
                    print(f"    - Time Delta (current_year - first_year): {year} - {first_year} = {time_delta}")

                if time_delta > 0:
                    score_difference = current_original_score - first_year_original_score
                    time_factor = math.sqrt(time_delta)
                    
                    # *** CORRECTED FORMULA with explicit floats ***
                    calculated_part = score_difference / time_factor
                    new_score = calculated_part + first_year_original_score
                    
                    if node_id == DEBUG_NODE_ID:
                        print(f"    - Score Difference (current - base): {current_original_score} - {first_year_original_score} = {score_difference}")
                        print(f"    - Time Factor (sqrt(delta)): sqrt({time_delta}) = {time_factor:.4f}")
                        print(f"    - Calculated Part (diff / factor): {score_difference} / {time_factor:.4f} = {calculated_part:.4f}")
                        print(f"    - Final Score (calculated_part + base): {calculated_part:.4f} + {first_year_original_score} = {new_score:.4f}")

                else:
                    new_score = first_year_original_score
                    if node_id == DEBUG_NODE_ID:
                        print(f"    - This is the first year. Score remains original: {new_score:.4f}")

                last_calculated_score = new_score
                original_score_at_last_calc = current_original_score

            node_to_update["Influence score"] = new_score

            if new_score > new_max_info["max_influence_score"]:
                new_max_info["max_influence_score"] = new_score
                new_max_info["year"] = year
                new_max_info["node_id"] = node_id
                new_max_info["name"] = node_to_update.get("name")

    print("\nFinished processing all nodes and years.")

    if "max_info" in data:
        data["max_info"] = new_max_info
        print(f"Successfully updated 'max_info'. New max score: {new_max_info['max_influence_score']:.4f}")
    else:
        data["max_info"] = new_max_info
        print("Warning: 'max_info' block not found, creating it.")

    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4, ensure_ascii=False)
        print(f"Successfully saved processed data to '{output_path}'")
    except Exception as e:
        print(f"An error occurred while writing the output file: {e}")


if __name__ == "__main__":
    input_file = os.path.join("public", "influence_data_Sailor_test.json")
    output_file = os.path.join("public", "influence_data_Sailor_time.json")
    
    process_time_decay_scores(input_file, output_file)
# process_influence_data.py

import json
import os

def process_influence_scores(input_path, output_path):
    """
    Reads an influence data JSON file, recalculates the influence scores based on
    total notability, updates the max_info, and saves to a new file.
    """
    print(f"Starting data processing for '{input_path}'...")

    # --- 1. Read the input JSON file ---
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print("Successfully loaded data.")
    except FileNotFoundError:
        print(f"Error: Input file not found at '{input_path}'")
        return
    except json.JSONDecodeError:
        print(f"Error: Failed to decode JSON from '{input_path}'. Please check the file format.")
        return

    # --- 2. Initialize variables to track the new maximum influence ---
    # We start with a very low number to ensure any real score will be higher.
    new_max_score = -1.0
    new_max_info_details = {
        "year": None,
        "node_id": None,
        "name": None,
        "max_influence_score": -1.0
    }

    # --- 3. Iterate through each year and each node to update scores ---
    # We iterate over the dictionary's items to get both the year (key) and the list of nodes (value).
    for year_str, nodes_in_year in data.items():
        # The top-level object contains years (like "1981") and a "max_info" object.
        # We only want to process the years, so we check if the key is a digit.
        if not year_str.isdigit():
            continue

        print(f"Processing year: {year_str}...")

        # Now, iterate through each node (which is a dictionary) in the list for the current year.
        for node in nodes_in_year:
            # Check if the necessary keys exist to prevent errors.
            if "Influence score" in node and "Total_notability" in node:
                original_score = float(node.get("Influence score", 0))
                total_notability = float(node.get("Total_notability", 0))

                # Apply the specified formula.
                new_score = (original_score * total_notability) / 10.0
                
                # Update the node's influence score with the new calculated value.
                node["Influence score"] = new_score

                # --- 4. Check if this new score is the overall maximum ---
                if new_score > new_max_info_details["max_influence_score"]:
                    # If it is, update our tracking variables with the details of this node and score.
                    new_max_info_details["max_influence_score"] = new_score
                    new_max_info_details["year"] = int(year_str)
                    new_max_info_details["node_id"] = node.get("node id")
                    new_max_info_details["name"] = node.get("name")

    print("Finished processing all years.")

    # --- 5. Update the top-level "max_info" object with the new maximums we found ---
    if "max_info" in data:
        data["max_info"] = new_max_info_details
        print(f"Successfully updated 'max_info'. New max score: {new_max_info_details['max_influence_score']:.2f}")
    else:
        print("Warning: 'max_info' block not found in the original data. It will be created.")
        data["max_info"] = new_max_info_details

    # --- 6. Write the modified data structure to the new output file ---
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            # json.dump writes the Python dictionary to a file in JSON format.
            # indent=4 makes the file human-readable.
            # ensure_ascii=False is important for handling non-English characters correctly.
            json.dump(data, f, indent=4, ensure_ascii=False)
        print(f"Successfully saved processed data to '{output_path}'")
    except Exception as e:
        print(f"An error occurred while writing the output file: {e}")


if __name__ == "__main__":
    # Define the relative paths for the input and output files.
    # This assumes the script is run from the root of the project directory.
    input_file = os.path.join("public", "influence_data_Sailor.json")
    output_file = os.path.join("public", "influence_data_Sailor_new.json")
    
    process_influence_scores(input_file, output_file)

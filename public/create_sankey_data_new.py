import json
from collections import Counter, defaultdict
import os

# --- 配置区 ---
# 影响类型
INFLUENCE_EDGE_TYPES = [
    "InStyleOf", "InterpolatesFrom", "CoverOf",
    "LyricalReferenceTo", "DirectlySamples"
]
# 艺人角色类型
ARTIST_ROLE_EDGE_TYPES = ["PerformerOf", "ComposerOf", "LyricistOf"]


# --- 核心数据处理逻辑 ---

class SankeyDataBuilder:
    """
    一个健壮的Sankey图数据构建器。
    关键修改：使用 original_id 作为艺术家的唯一标识符来处理重名问题。
    """

    def __init__(self):
        self.nodes = []
        self.links = []
        self.node_map = {}
        self.current_id = 0

    def add_node(self, name, node_type, original_id=None):
        """
        添加节点，如果不存在。
        对于艺术家，使用 original_id 作为唯一键。
        对于其他类型，使用 'type_name' 作为键。
        """
        # 关键修改: 如果是艺术家且有original_id，则用它作为唯一键
        if node_type == "Artist" and original_id is not None:
            key = f"{node_type}_{original_id}"
        else:
            key = f"{node_type}_{name}"

        if key not in self.node_map:
            self.node_map[key] = self.current_id
            node_data = {"id": self.current_id, "name": name, "type": node_type}
            
            # 如果是艺术家，则添加 original_id 属性
            if node_type == "Artist" and original_id is not None:
                node_data["original_id"] = original_id
                
            self.nodes.append(node_data)
            self.current_id += 1
        return self.node_map[key]

    def get_data(self):
        """返回最终的节点和链接数据。"""
        return {"nodes": self.nodes, "links": self.links}


def preprocess_graph_data(graph_data):
    """
    预处理原始图数据，构建高效的查找字典。
    """
    print("Preprocessing graph data for efficient lookups...")
    nodes_dict = {node['id']: node for node in graph_data['nodes']}
    outgoing_links = defaultdict(list)
    incoming_links = defaultdict(list)
    for link in graph_data['links']:
        outgoing_links[link['source']].append(link)
        incoming_links[link['target']].append(link)
    print("Preprocessing complete.")
    return nodes_dict, outgoing_links, incoming_links


def generate_q2_2_data(nodes_dict, outgoing_links, incoming_links):
    """
    为Q2.2生成三级桑基图数据: Oceanus Folk -> Genre -> Artist
    """
    print("\nGenerating data for Q2.2: Oceanus Folk's Outward Influence...")
    builder = SankeyDataBuilder()
    # 路径计数器现在存储 {target_genre: {(artist_name, artist_original_id): count}}
    path_counts = defaultdict(Counter)

    oceanus_folk_song_ids = {
        nid for nid, node in nodes_dict.items()
        if node.get("Node Type") == "Song" and node.get("genre") == "Oceanus Folk"
    }
    print(f"Found {len(oceanus_folk_song_ids)} Oceanus Folk songs.")

    for of_song_id in oceanus_folk_song_ids:
        for influence_link in outgoing_links.get(of_song_id, []):
            if influence_link['Edge Type'] in INFLUENCE_EDGE_TYPES:
                influenced_work_id = influence_link['target']
                influenced_work_node = nodes_dict.get(influenced_work_id)
                if not influenced_work_node or influenced_work_node.get('genre') == 'Oceanus Folk': continue
                
                target_genre = influenced_work_node.get('genre')
                if not target_genre: continue

                for artist_link in incoming_links.get(influenced_work_id, []):
                    if artist_link['Edge Type'] in ARTIST_ROLE_EDGE_TYPES:
                        artist_id = artist_link['source']
                        artist_node = nodes_dict.get(artist_id)
                        if artist_node:
                            # 同时获取艺术家名字和原始ID
                            artist_name = artist_node['name']
                            artist_original_id = artist_node['id']
                            path_counts[target_genre][(artist_name, artist_original_id)] += 1
                            break
    
    of_id = builder.add_node("Oceanus Folk", "Genre")
    for genre, artists in path_counts.items():
        genre_id = builder.add_node(genre, "Genre")
        total_genre_influence = sum(artists.values())
        builder.links.append({"source": of_id, "target": genre_id, "value": total_genre_influence})

        for (artist_name, artist_original_id), count in artists.items():
            # 关键修改: 调用 add_node 时传入 original_id
            artist_sankey_id = builder.add_node(artist_name, "Artist", original_id=artist_original_id)
            builder.links.append({"source": genre_id, "target": artist_sankey_id, "value": count})

    print(f"Q2.2 data generated: {len(builder.nodes)} nodes, {len(builder.links)} links.")
    return builder.get_data()


def generate_q2_3_data(nodes_dict, outgoing_links, incoming_links):
    """
    为Q2.3生成三级桑基图数据: Influencing Genre -> Influencing Artist -> Oceanus Folk
    """
    print("\nGenerating data for Q2.3: Oceanus Folk's Contemporary Inspirations...")
    builder = SankeyDataBuilder()
    path_counts = defaultdict(Counter)
    notoriety_year = 2020

    contemporary_song_ids = {
        nid for nid, node in nodes_dict.items()
        if node.get("Node Type") == "Song" and node.get("genre") == "Oceanus Folk" and
           node.get("release_date") and int(node.get("release_date")) >= notoriety_year
    }
    print(f"Found {len(contemporary_song_ids)} contemporary Oceanus Folk songs (since {notoriety_year}).")

    for c_song_id in contemporary_song_ids:
        for influence_link in incoming_links.get(c_song_id, []):
            if influence_link['Edge Type'] in INFLUENCE_EDGE_TYPES:
                source_work_id = influence_link['source']
                source_work_node = nodes_dict.get(source_work_id)
                if not source_work_node: continue
                
                source_genre = source_work_node.get('genre')
                if not source_genre or source_genre == 'Oceanus Folk': continue

                for artist_link in incoming_links.get(source_work_id, []):
                    if artist_link['Edge Type'] in ARTIST_ROLE_EDGE_TYPES:
                        artist_id = artist_link['source']
                        artist_node = nodes_dict.get(artist_id)
                        if artist_node:
                            artist_name = artist_node['name']
                            artist_original_id = artist_node['id']
                            path_counts[source_genre][(artist_name, artist_original_id)] += 1
                            break

    ofc_id = builder.add_node("Oceanus Folk (Contemporary)", "Genre")
    for genre, artists in path_counts.items():
        genre_id = builder.add_node(genre, "Genre")
        for (artist_name, artist_original_id), count in artists.items():
            # 关键修改: 调用 add_node 时传入 original_id
            artist_sankey_id = builder.add_node(artist_name, "Artist", original_id=artist_original_id)
            builder.links.append({"source": genre_id, "target": artist_sankey_id, "value": count})
            builder.links.append({"source": artist_sankey_id, "target": ofc_id, "value": count})

    print(f"Q2.3 data generated: {len(builder.nodes)} nodes, {len(builder.links)} links.")
    return builder.get_data()


def main():
    """主执行函数，处理文件路径，并生成所有数据。"""
    input_path = r"D:/sss_files/FDUVIS/MC1_release/vue_projects/VASTMC1_0716_ver/public/MC1_graph.json"
    output_path_q2 = r"D:/sss_files/FDUVIS/MC1_release/vue_projects/VASTMC1_0716_ver/public/mc1_q2_2_data_new.json"
    output_path_q3 = r"D:/sss_files/FDUVIS/MC1_release/vue_projects/VASTMC1_0716_ver/public/mc1_q2_3_data_new.json"

    os.makedirs(os.path.dirname(output_path_q2), exist_ok=True)

    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            graph_data = json.load(f)
    except FileNotFoundError:
        print(f"错误: 输入文件未找到! 请确认路径是否正确: {input_path}")
        return

    nodes_dict, outgoing_links, incoming_links = preprocess_graph_data(graph_data)

    q2_2_data = generate_q2_2_data(nodes_dict, outgoing_links, incoming_links)
    with open(output_path_q2, 'w', encoding='utf-8') as f:
        json.dump(q2_2_data, f, indent=2, ensure_ascii=False)
    print(f"成功将Q2.2数据保存到: {output_path_q2}")

    q2_3_data = generate_q2_3_data(nodes_dict, outgoing_links, incoming_links)
    with open(output_path_q3, 'w', encoding='utf-8') as f:
        json.dump(q2_3_data, f, indent=2, ensure_ascii=False)
    print(f"成功将Q2.3数据保存到: {output_path_q3}")


if __name__ == "__main__":
    main()

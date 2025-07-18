import json
import networkx as nx
from networkx.readwrite import node_link_graph

VALID_CONNECTIONS = {
    'InStyleOf': (['Song', 'Album'], ['Song', 'Album', 'Person', 'MusicalGroup']),
    'InterpolatesFrom': (['Song', 'Album'], ['Song', 'Album']),
    'CoverOf': (['Song', 'Album'], ['Song', 'Album']),
    'LyricalReferenceTo': (['Song', 'Album'], ['Song', 'Album']),
    'DirectlySamples': (['Song', 'Album'], ['Song', 'Album']),
    'PerformerOf': (['Person', 'MusicalGroup'], ['Song', 'Album']),
    'ComposerOf': (['Person', 'MusicalGroup'], ['Song', 'Album']),
    'ProducerOf': (['Person', 'MusicalGroup', 'RecordLabel'], ['Song', 'Album', 'Person', 'MusicalGroup']),
    'LyricistOf': (['Person', 'MusicalGroup'], ['Song', 'Album']),
    'MemberOf': (['Person'], ['MusicalGroup']),
    'RecordedBy': (['Song', 'Album'], ['RecordLabel']),
    'DistributedBy': (['Song', 'Album'], ['RecordLabel']),
}

# 加载图数据
with open('graph_with_yearly_influence.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
G = node_link_graph(data)

edges_to_remove = []
edges_to_reverse = []

for u, v, k, d in G.edges(data=True, keys=True):
    edge_type = d.get('Edge Type')
    if edge_type not in VALID_CONNECTIONS:
        edges_to_remove.append((u, v, k, edge_type, "未知类型"))
        continue
    valid_sources, valid_targets = VALID_CONNECTIONS[edge_type]
    source_type = G.nodes[u].get('Node Type')
    target_type = G.nodes[v].get('Node Type')
    if source_type not in valid_sources or target_type not in valid_targets:
        if edge_type == 'RecordedBy':
            # 不删除，调换源和目标
            edges_to_reverse.append((u, v, k, d))
        else:
            edges_to_remove.append((u, v, k, edge_type, f"{source_type} -> {target_type}"))

# 删除无效边
for u, v, k, edge_type, info in edges_to_remove:
    print(f"删除无效边: {u} -> {v}, key={k}, 类型={edge_type}, 信息={info}")
    G.remove_edge(u, v, k)

# 调换RecordedBy边
for u, v, k, d in edges_to_reverse:
    print(f"调换RecordedBy边: {u} -> {v}, key={k}, 类型={d.get('Edge Type')}, 信息={G.nodes[u].get('Node Type')} -> {G.nodes[v].get('Node Type')}")
    G.remove_edge(u, v, k)
    G.add_edge(v, u, key=k, **d)

from networkx.readwrite import node_link_data
    
# 保存处理后的图数据
with open('graph_with_yearly_influence_new.json', 'w', encoding='utf-8') as f:
    json.dump(node_link_data(G), f, ensure_ascii=False, indent=4)
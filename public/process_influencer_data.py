
import json

def process_influencer_data():
    graph_path = 'C:/Users/jasonHuang/Desktop/MC1_release/oceanus-weaver/public/graph_with_yearly_influence.json'
    influencer_data_path = 'C:/Users/jasonHuang/Desktop/MC1_release/oceanus-weaver/public/influence_data.json'

    try:
        with open(graph_path, 'r', encoding='utf-8') as f:
            graph_data = json.load(f)
        
        with open(influencer_data_path, 'r', encoding='utf-8') as f:
            influencer_data = json.load(f)
    except FileNotFoundError:
        print(f"错误：文件未找到。请确保 '{graph_path}' 和 '{influencer_data_path}' 存在。")
        return
    except json.JSONDecodeError:
        print("错误：JSON 文件解析失败。请检查文件内容是否为有效的 JSON 格式。")
        return

    # 将graph_data中的节点信息转换为以node id为key的字典，方便查找
    nodes_info = {node['id']: node for node in graph_data.get('nodes', [])}

    new_influencer_data = {}

    for year_str, nodes_scores in influencer_data.items():
        try:
            year = int(year_str)
        except ValueError:
            print(f"警告：跳过无效的年份键 '{year_str}'。")
            continue

        nodes_list_for_year = []
        for node_id, influence_score in nodes_scores.items():
            node_info = nodes_info.get(int(node_id))
            if node_info:
                # 提取所需信息
                name = node_info.get('name', '未知')
                max_genre = node_info.get('max_genre', '未知')
                notability_score = node_info.get('influence_score', [])
                total_notability = node_info.get('total_influence_score', 0)

                nodes_list_for_year.append({
                    'node id': int(node_id),
                    'Influence score': influence_score,
                    'name': name,
                    'max_genre': max_genre,
                    'notability_score': notability_score,
                    'Total_notability': total_notability
                })
            else:
                print(f"警告：在 '{graph_path}' 中未找到节点 ID '{node_id}'。")
        
        new_influencer_data[year] = nodes_list_for_year

    try:
        with open('influence_data_new.json', 'w', encoding='utf-8') as f:
            json.dump(new_influencer_data, f, indent=4, ensure_ascii=False)
        print(f"数据已成功处理并保存到 'influence_data_new.json'。")
    except IOError:
        print(f"错误：无法写入文件 'influence_data_new.json'。")

if __name__ == "__main__":
    process_influencer_data()

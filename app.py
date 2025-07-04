# app.py
from flask import Flask, jsonify, request
import json
import numpy as np
import networkx as nx
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch_geometric.data import Data, HeteroData
from torch_geometric.nn import GATConv
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import GridSearchCV
from sklearn.base import BaseEstimator, RegressorMixin
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error
from collections import defaultdict
import shap
import matplotlib
matplotlib.use('Agg')  # 使用非GUI后端
import matplotlib.pyplot as plt
import os
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 允许所有跨域请求

# 当前日期设定
CURRENT_YEAR = 2040

# 1. 数据加载与预处理（过滤未来数据）
def load_data(filename):
    with open(filename, 'r') as f:
        data = json.load(f)
    
    # 过滤未来数据
    for node in data['nodes']:
        if 'release_date' in node and node['release_date'].isdigit():
            release_year = int(node['release_date'])
            if release_year > CURRENT_YEAR:
                # 清空未来数据
                node['release_date'] = ""
                node['notable'] = False
    
    return data

# 2. 构建知识图谱
def build_knowledge_graph(data):
    G = nx.MultiDiGraph()
    node_mapping = {}
    label_mapping = {}
    
    for node in data['nodes']:
        node_id = node['id']
        node_mapping[node_id] = node
        node_type = node['Node Type']
        G.add_node(node_id, **node)
        
        if node_type == 'RecordLabel':
            label_mapping[node_id] = node['name']
    
    for edge in data['edges']:
        source = edge['source']
        target = edge['target']
        edge_type = edge['Edge Type']
        
        if source in node_mapping and target in node_mapping:
            G.add_edge(source, target, relationship=edge_type)
    
    return G, node_mapping, label_mapping

# 3. 增强特征工程 - 使用动态计算的唱片公司权重
def extract_features(G, node_mapping, label_mapping):
    # 动态计算唱片公司权重
    label_stats = defaultdict(lambda: {
        'artist_count': 0,
        'total_works': 0,
        'notable_works': 0,
        'recent_works': 0
    })
    
    # 构建作品到唱片公司的映射
    work_to_labels = defaultdict(set)
    for src, tgt, data in G.edges(data=True):
        edge_type = data.get('relationship', '')
        # 处理唱片公司关联边
        if edge_type in ['RecordedBy', 'DistributedBy']:
            work_id = src
            label_id = tgt
            if (G.nodes.get(work_id, {}).get('Node Type') in ['Song', 'Album'] and 
                G.nodes.get(label_id, {}).get('Node Type') == 'RecordLabel'):
                work_to_labels[work_id].add(label_id)
    
    # 构建艺术家到唱片公司的映射 - 通过作品间接关联
    artist_to_labels = defaultdict(set)
    
    # 第一轮：通过作品统计唱片公司数据
    for node_id, data in G.nodes(data=True):
        node_type = data.get('Node Type', '')
        
        # 只处理作品节点
        if node_type not in ['Song', 'Album']:
            continue
        
        # 过滤未来数据
        release_date = data.get('release_date', '')
        if release_date and release_date.isdigit():
            release_year = int(release_date)
            if release_year > CURRENT_YEAR:  # 跳过未来数据
                continue
        else:
            release_year = 0
        
        notable = data.get('notable', False)
        is_recent = CURRENT_YEAR - 3 < release_year <= CURRENT_YEAR
        
        # 获取作品关联的唱片公司
        label_ids = work_to_labels.get(node_id, set())
        
        # 更新唱片公司统计
        for label_id in label_ids:
            label_stats[label_id]['total_works'] += 1
            if notable:
                label_stats[label_id]['notable_works'] += 1
            if is_recent:
                label_stats[label_id]['recent_works'] += 1
        
        # 获取作品关联的艺术家
        artists = set()
        for src, _, edge_data in G.in_edges(node_id, data=True):
            if edge_data['relationship'] in ['PerformerOf', 'ComposerOf', 'LyricistOf']:
                artists.add(src)
        
        # 将艺术家与唱片公司关联
        for artist_id in artists:
            artist_to_labels[artist_id].update(label_ids)
    
    # 第二轮：通过艺术家统计唱片公司数据
    for artist_id, label_ids in artist_to_labels.items():
        for label_id in label_ids:
            label_stats[label_id]['artist_count'] += 1
    
    # 第三轮：直接关联统计（确保所有唱片公司都被包含）
    for node_id, data in G.nodes(data=True):
        if data.get('Node Type') == 'RecordLabel' and node_id not in label_stats:
            label_stats[node_id] = {
                'artist_count': 0,
                'total_works': 0,
                'notable_works': 0,
                'recent_works': 0
            }
    
    # 计算唱片公司权重（仅基于历史数据）
    LABEL_WEIGHTS = {}
    
    # 计算各项指标的最大值（避免除零错误）
    max_artist = max(1, max(stats['artist_count'] for stats in label_stats.values()))
    max_works = max(1, max(stats['total_works'] for stats in label_stats.values()))
    max_notable = max(1, max(stats['notable_works'] for stats in label_stats.values()))
    max_recent = max(1, max(stats['recent_works'] for stats in label_stats.values()))
    
    # 计算每家唱片公司的权重
    for label_id, stats in label_stats.items():
        # 标准化各项指标（0-1范围）
        artist_score = stats['artist_count'] / max_artist
        works_score = stats['total_works'] / max_works
        notable_score = stats['notable_works'] / max_notable
        recent_score = stats['recent_works'] / max_recent
        
        # 计算综合权重
        composite_score = (
            0.3 * artist_score +
            0.2 * works_score +
            0.3 * notable_score +
            0.2 * recent_score
        )
        
        # 确保权重在合理范围内
        weight = max(0.4, min(0.95, composite_score))
        
        label_name = node_mapping.get(label_id, {}).get('name', f"Label_{label_id}")
        LABEL_WEIGHTS[label_name] = weight
    
    # 设置默认权重
    LABEL_WEIGHTS["Other"] = 0.5
    
    # 打印权重信息
    print("\n唱片公司权重计算:")
    print("=" * 70)
    print(f"{'唱片公司':<25}{'艺术家数':<8}{'作品数':<8}{'上榜作品':<10}{'近期作品':<10}{'权重':<8}")
    print("-" * 70)
    for label_name, weight in sorted(LABEL_WEIGHTS.items(), key=lambda x: x[1], reverse=True):
        if label_name == "Other":
            continue
        # 查找对应的统计数据
        label_stats_entry = next(
            (stats for label_id, stats in label_stats.items() 
             if node_mapping.get(label_id, {}).get('name') == label_name),
            {'artist_count': 0, 'total_works': 0, 'notable_works': 0, 'recent_works': 0}
        )
        print(f"{label_name:<25}{label_stats_entry.get('artist_count',0):<8}{label_stats_entry.get('total_works',0):<8}"
              f"{label_stats_entry.get('notable_works',0):<10}{label_stats_entry.get('recent_works',0):<10}{weight:.4f}")
    print("=" * 70)
    
    # 艺术家特征提取
    artist_features_dict = {}
    work_stats = defaultdict(lambda: defaultdict(int))
    all_works = defaultdict(list)
    
    # 收集所有作品信息（过滤未来数据）
    for node_id, data in G.nodes(data=True):
        node_type = data.get('Node Type', '')
        
        if node_type in ['Song', 'Album']:
            notable = data.get('notable', False)
            release_date = data.get('release_date')
            genre = data.get('genre', '')
            
            # 过滤未来年份数据
            if release_date and release_date.isdigit():
                release_year = int(release_date)
                if release_year > CURRENT_YEAR:  # 跳过未来数据
                    continue
            else:
                release_year = 0
                
            performers = []
            composers = []
            lyricists = []
            
            # 收集所有参与者
            for src, _, edge_data in G.in_edges(node_id, data=True):
                if edge_data['relationship'] == 'PerformerOf':
                    performers.append(src)
                elif edge_data['relationship'] == 'ComposerOf':
                    composers.append(src)
                elif edge_data['relationship'] == 'LyricistOf':
                    lyricists.append(src)
            
            all_artists = set(performers + composers + lyricists)
            
            for artist_id in all_artists:
                all_works[artist_id].append({
                    'id': node_id,
                    'type': node_type,
                    'notable': notable,
                    'release_year': release_year,
                    'genre': genre,
                    'roles': []
                })
                
                if artist_id in performers:
                    all_works[artist_id][-1]['roles'].append('performer')
                if artist_id in composers:
                    all_works[artist_id][-1]['roles'].append('composer')
                if artist_id in lyricists:
                    all_works[artist_id][-1]['roles'].append('lyricist')
                
                # 确保只统计当前及之前年份的数据
                if 'Oceanus Folk' in genre and release_year <= CURRENT_YEAR:
                    work_stats[artist_id]['oceanus_works'] += 1
                    if notable:
                        work_stats[artist_id]['oceanus_notable'] += 1
                    if release_year > CURRENT_YEAR - 3 and release_year <= CURRENT_YEAR:
                        work_stats[artist_id]['oceanus_recent'] += 1
    
    # 计算影响力特征
    for node_id, data in G.nodes(data=True):
        node_type = data.get('Node Type', '')
        
        if node_type == 'Person':
            features = {
                'oceanus_works': 0,
                'oceanus_notable': 0,
                'oceanus_recent': 0,
                'total_works': 0,
                'total_notable': 0,
                'recent_activity': CURRENT_YEAR,
                'collab_diversity': 0,
                'influence_score': 0,
                'creative_depth': 0,
                'label_weight': 0,
                'years_active': 0,
                'last_release_year': 0,  # 新增：最后发布作品的年份
                'composer_count': 0,
                'lyricist_count': 0,
                'producer_count': 0,
                'oceanus_ratio': 0.0,
                'interpolation_count': 0,
                'lyrical_references': 0,
                'collaboration_score': 0 
            }
            
            if node_id in work_stats:
                for k, v in work_stats[node_id].items():
                    features[k] = v
            
            artist_works = all_works.get(node_id, [])
            features['total_works'] = len(artist_works)
            
            collaborators = set()
            labels_worked_with = set()
            earliest_year = CURRENT_YEAR
            latest_year = 0
            notable_count = 0
            composer_count = 0
            lyricist_count = 0
            producer_count = 0
            
            for work in artist_works:
                release_year = work['release_year']
                # 确保只使用有效历史数据
                if release_year > 0 and release_year <= CURRENT_YEAR:
                    earliest_year = min(earliest_year, release_year)
                    latest_year = max(latest_year, release_year)
                    # 封顶到当前年份
                    features['last_release_year'] = max(features['last_release_year'], min(release_year, CURRENT_YEAR))
                
                if work['notable']:
                    notable_count += 1
                
                if 'composer' in work['roles']:
                    composer_count += 1
                if 'lyricist' in work['roles']:
                    lyricist_count += 1
                
                for other_artist in all_works:
                    if other_artist != node_id:
                        for other_work in all_works[other_artist]:
                            if other_work['id'] == work['id']:
                                collaborators.add(other_artist)
                                # 计算协作强度
                                features['collaboration_score'] += 1
                
                # 处理作品关联的唱片公司
                for _, label_id, e_data in G.in_edges(work['id'], data=True):
                    if e_data['relationship'] in ['RecordedBy', 'DistributedBy']:
                        label_name = node_mapping.get(label_id, {}).get('name', "Other")
                        labels_worked_with.add(label_name)
            
            features['total_notable'] = notable_count
            features['composer_count'] = composer_count
            features['lyricist_count'] = lyricist_count
            features['collab_diversity'] = len(collaborators)
            # 确保活跃年限计算有效
            if latest_year > 0 and earliest_year <= CURRENT_YEAR:
                features['years_active'] = min(latest_year, CURRENT_YEAR) - min(earliest_year, CURRENT_YEAR)
            else:
                features['years_active'] = 0
            
            # 确保最近活动时间有效
            if latest_year > 0 and latest_year <= CURRENT_YEAR:
                features['recent_activity'] = CURRENT_YEAR - latest_year
                features['last_release_year'] = latest_year  # 记录最后发布年份
            else:
                features['recent_activity'] = CURRENT_YEAR
                features['last_release_year'] = 0
            
            label_weight_sum = 0
            for label in labels_worked_with:
                label_weight_sum += LABEL_WEIGHTS.get(label, LABEL_WEIGHTS['Other'])
            features['label_weight'] = label_weight_sum / max(1, len(labels_worked_with)) if labels_worked_with else 0
            
            # 计算影响力评分 - 包含所有关系类型
            influence_score = 0
            influence_relations = [
                'InStyleOf', 'CoverOf', 'DirectlySamples',
                'InterpolatesFrom', 'LyricalReferenceTo'
            ]
            
            for work in artist_works:
                # 只考虑当前及之前年份的影响力
                if work['release_year'] > CURRENT_YEAR:
                    continue
                    
                # 作品被其他作品影响
                for _, _, edge_data in G.in_edges(work['id'], data=True):
                    if edge_data['relationship'] in influence_relations:
                        influence_score += 1.0  # 被动影响力
                    
                # 作品影响其他作品
                for _, _, edge_data in G.out_edges(work['id'], data=True):
                    if edge_data['relationship'] in influence_relations:
                        influence_score += 0.5  # 主动影响力
                        
                    # 特定关系类型计数
                    if edge_data['relationship'] == 'InterpolatesFrom':
                        features['interpolation_count'] += 1
                    elif edge_data['relationship'] == 'LyricalReferenceTo':
                        features['lyrical_references'] += 1
            
            # 艺术家被直接引用
            for src, _, edge_data in G.in_edges(node_id, data=True):
                if edge_data['relationship'] in influence_relations:
                    influence_score += 2.0  # 直接影响力
            
            influence_score += features['total_notable'] * 0.5
            influence_score += features['oceanus_notable'] * 1.0
            
            features['influence_score'] = influence_score
            
            # 制作人角色统计
            for _, _, edge_data in G.out_edges(node_id, data=True):
                if edge_data['relationship'] == 'ProducerOf':
                    producer_count += 1
            features['producer_count'] = producer_count
            
            # 乐队成员关系统计
            band_members = set()
            for _, tgt, edge_data in G.in_edges(node_id, data=True):
                if edge_data['relationship'] == 'MemberOf':
                    band_members.add(tgt)
            for src, _, edge_data in G.out_edges(node_id, data=True):
                if edge_data['relationship'] == 'MemberOf':
                    band_members.add(src)
            features['band_members'] = len(band_members)
            
            # 创作深度计算
            creative_works = composer_count + lyricist_count + features['interpolation_count'] + features['lyrical_references']
            features['creative_depth'] = creative_works / max(1, features['total_works']) if features['total_works'] > 0 else 0
            
            oceanus_works = features.get('oceanus_works', 0)
            features['oceanus_ratio'] = oceanus_works / max(1, features['total_works']) if features['total_works'] > 0 else 0
            
            artist_features_dict[node_id] = features
    
    return artist_features_dict

# 4. 自定义权重优化器类（符合scikit-learn接口）
class WeightOptimizer(BaseEstimator, RegressorMixin):
    def __init__(self, weights=None):
        self.weights = weights if weights is not None else [0.20, 0.18, 0.15, 0.15, 0.12, 0.10, 0.05, 0.05]
    
    def fit(self, X, y):
        # 不需要实际训练，权重已由网格搜索提供
        return self
    
    def predict(self, X):
        return np.sum(X * self.weights, axis=1)
    
    def score(self, X, y):
        predictions = self.predict(X)
        return -mean_squared_error(y, predictions)  # 负MSE，越大越好
    
    def get_params(self, deep=True):
        return {"weights": self.weights}
    
    def set_params(self, **params):
        if "weights" in params:
            self.weights = params["weights"]
        return self

# 5. 网格搜索优化权重系数
def optimize_weights(artist_features_dict):
    # 准备数据
    features_list = []
    scores_list = []
    
    for artist_id, feat in artist_features_dict.items():
        features_list.append([
            feat.get('influence_score', 0),
            feat.get('creative_depth', 0),
            feat.get('label_weight', 0),
            feat.get('oceanus_recent', 0),
            feat.get('collab_diversity', 0),
            feat.get('producer_count', 0),
            feat.get('oceanus_ratio', 0),
            feat.get('collaboration_score', 0)
        ])
        
        # 使用当前公式计算基准分数
        base_score = (
            feat.get('influence_score', 0) * 0.20 +
            feat.get('creative_depth', 0) * 0.18 +
            feat.get('label_weight', 0) * 0.15 +
            feat.get('oceanus_recent', 0) * 0.15 +
            feat.get('collab_diversity', 0) * 0.12 +
            feat.get('producer_count', 0) * 0.10 +
            feat.get('oceanus_ratio', 0) * 0.05 +
            feat.get('collaboration_score', 0) * 0.05
        )
        scores_list.append(base_score)
    
    X = np.array(features_list)
    y = np.array(scores_list)
    
    # 标准化特征
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    # 定义参数网格
    param_grid = {
        'weights': [
            [0.20, 0.18, 0.15, 0.15, 0.12, 0.10, 0.05, 0.05],  # 原始权重
            [0.22, 0.20, 0.12, 0.15, 0.10, 0.08, 0.06, 0.07],  # 调整1
            [0.18, 0.20, 0.16, 0.14, 0.10, 0.12, 0.05, 0.05],  # 调整2
            [0.25, 0.15, 0.15, 0.12, 0.08, 0.12, 0.08, 0.05],  # 调整3
            [0.20, 0.18, 0.10, 0.20, 0.10, 0.10, 0.07, 0.05],  # 调整4
            [0.15, 0.25, 0.15, 0.15, 0.10, 0.10, 0.05, 0.05]   # 调整5
        ]
    }
    
    # 网格搜索
    grid_search = GridSearchCV(
        WeightOptimizer(),
        param_grid,
        scoring='neg_mean_squared_error',  # 使用内置的负MSE评分
        cv=5,
        refit=True
    )
    
    grid_search.fit(X_scaled, y)
    
    # 获取最佳权重
    best_weights = grid_search.best_params_['weights']
    print(f"网格搜索完成，最佳权重: {best_weights}")
    print(f"最佳分数: {-grid_search.best_score_:.4f}")
    
    # 使用SHAP分析特征重要性
    model = LinearRegression()
    model.fit(X_scaled, y)
    
    # 创建SHAP解释器
    explainer = shap.Explainer(model, X_scaled)
    shap_values = explainer(X_scaled)
    
    # 计算平均SHAP值
    feature_names = [
        'influence_score',
        'creative_depth',
        'label_weight',
        'oceanus_recent',
        'collab_diversity',
        'producer_count',
        'oceanus_ratio',
        'collaboration_score'
    ]
    
    shap_importances = np.abs(shap_values.values).mean(axis=0)
    total_shap = sum(shap_importances)
    shap_weights = shap_importances / total_shap
    
    print("\nSHAP特征重要性:")
    for i, name in enumerate(feature_names):
        print(f"{name}: {shap_weights[i]:.4f}")
    
    # 结合网格搜索和SHAP结果
    final_weights = [
        0.8 * best_weights[i] + 0.2 * shap_weights[i]
        for i in range(len(best_weights))
    ]
    
    # 归一化确保权重和为1
    total = sum(final_weights)
    final_weights = [w / total for w in final_weights]
    
    print("\n优化后最终权重:")
    for i, name in enumerate(feature_names):
        print(f"{name}: {final_weights[i]:.4f}")
    
    return final_weights

# 6. 异构图神经网络模型
class HeteroArtistPredictor(nn.Module):
    def __init__(self, input_dim_artist, input_dim_work, hidden_dim):
        super(HeteroArtistPredictor, self).__init__()
        
        # 艺术家特征编码
        self.artist_encoder = nn.Sequential(
            nn.Linear(input_dim_artist, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim)
        )
        
        # 作品特征编码
        self.work_encoder = nn.Sequential(
            nn.Linear(input_dim_work, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, hidden_dim)
        )
        
        # 创作关系图卷积
        self.creation_conv = GATConv(
            in_channels=hidden_dim,
            out_channels=hidden_dim,
            heads=1,
            concat=False
        )
        
        # 影响关系图卷积
        self.influence_conv = GATConv(
            in_channels=hidden_dim,
            out_channels=hidden_dim,
            heads=1,
            concat=False
        )
        
        # 协作关系图卷积
        self.collab_conv = GATConv(
            in_channels=hidden_dim,
            out_channels=hidden_dim,
            heads=1,
            concat=False
        )
        
        # 预测层
        self.predictor = nn.Sequential(
            nn.Linear(hidden_dim * 2, 256),
            nn.ReLU(),
            nn.Dropout(0.4),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, 1)
        )

    def forward(self, data):
        # 编码节点特征
        artist_x = self.artist_encoder(data['artist'].x)
        work_x = self.work_encoder(data['work'].x)
        
        # 创作关系传播 (艺术家 -> 作品)
        if hasattr(data, 'artist_creates_work_edge_index'):
            work_x = self.creation_conv(
                (artist_x, work_x),
                data.artist_creates_work_edge_index
            )
            work_x = F.elu(work_x)
        
        # 影响关系传播 (作品 -> 作品)
        if hasattr(data, 'work_influences_work_edge_index'):
            work_x = self.influence_conv(
                work_x,
                data.work_influences_work_edge_index
            )
            work_x = F.elu(work_x)
        
        # 反向创作关系传播 (作品 -> 艺术家)
        if hasattr(data, 'work_created_by_artist_edge_index'):
            artist_x_updated = self.creation_conv(
                (work_x, artist_x),
                data.work_created_by_artist_edge_index
            )
        else:
            artist_x_updated = artist_x
        
        # 协作关系传播 (艺术家 -> 艺术家)
        if hasattr(data, 'artist_collaborates_artist_edge_index'):
            artist_collab = self.collab_conv(
                artist_x_updated,
                data.artist_collaborates_artist_edge_index
            )
            artist_collab = F.elu(artist_collab)
        else:
            artist_collab = artist_x_updated
        
        # 合并特征
        combined = torch.cat([artist_x_updated, artist_collab], dim=1)
        
        # 最终预测
        return self.predictor(combined).squeeze()

# 7. 准备异构图数据
def prepare_hetero_graph_data(G, artist_features_dict, node_mapping, weights):
    # 收集艺术家节点 - 只包含最近5年有活动的艺术家
    artist_nodes = []
    artist_features_list = []
    for node_id, data in G.nodes(data=True):
        if data['Node Type'] == 'Person' and node_id in artist_features_dict:
            feat = artist_features_dict[node_id]
            
            # 检查艺术家是否在最近5年有活动
            if feat.get('last_release_year', 0) >= CURRENT_YEAR - 5:
                artist_nodes.append(node_id)
                artist_features_list.append([
                    feat.get('oceanus_works', 0),
                    feat.get('oceanus_notable', 0),
                    feat.get('oceanus_recent', 0),
                    feat.get('total_works', 0),
                    feat.get('total_notable', 0),
                    feat.get('influence_score', 0),
                    feat.get('creative_depth', 0),
                    feat.get('label_weight', 0),
                    feat.get('composer_count', 0),
                    feat.get('lyricist_count', 0),
                    feat.get('producer_count', 0),
                    feat.get('collab_diversity', 0),
                    feat.get('oceanus_ratio', 0),
                    feat.get('interpolation_count', 0),
                    feat.get('lyrical_references', 0),
                    feat.get('collaboration_score', 0)
                ])
    
    # 收集作品节点
    work_nodes = []
    work_features_list = []
    for node_id, data in G.nodes(data=True):
        if data['Node Type'] in ['Song', 'Album']:
            work_nodes.append(node_id)
            release_date = data.get('release_date', '')
            if release_date and release_date.isdigit():
                release_year = int(release_date)
                if release_year > CURRENT_YEAR:  # 过滤未来作品
                    release_year = 0
            else:
                release_year = 0
                
            work_features_list.append([
                1 if data.get('notable', False) else 0,
                release_year,
                1 if 'Oceanus Folk' in data.get('genre', '') else 0
            ])
    
    # 标准化特征
    artist_scaler = StandardScaler()
    artist_features_scaled = artist_scaler.fit_transform(artist_features_list) if artist_features_list else np.zeros((0, 16))
    
    work_scaler = StandardScaler()
    work_features_scaled = work_scaler.fit_transform(work_features_list) if work_features_list else np.zeros((0, 3))
    
    # 创建异构图数据对象
    data = HeteroData()
    
    # 添加节点
    data['artist'].x = torch.tensor(artist_features_scaled, dtype=torch.float)
    data['artist'].node_id = artist_nodes
    data['work'].x = torch.tensor(work_features_scaled, dtype=torch.float)
    data['work'].node_id = work_nodes
    
    # 添加边索引
    # 协作关系 (艺术家-艺术家)
    collab_edges = []
    for src, tgt, edge_data in G.edges(data=True):
        if (edge_data['relationship'] == 'MemberOf' and
            src in artist_nodes and tgt in artist_nodes):
            src_idx = artist_nodes.index(src)
            tgt_idx = artist_nodes.index(tgt)
            collab_edges.append([src_idx, tgt_idx])
            collab_edges.append([tgt_idx, src_idx])
    
    if collab_edges:
        collab_edge_index = torch.tensor(collab_edges, dtype=torch.long).t().contiguous()
        setattr(data, 'artist_collaborates_artist_edge_index', collab_edge_index)
    
    # 影响关系 (作品-作品)
    influence_edges = []
    influence_relations = [
        'InStyleOf', 'CoverOf', 'DirectlySamples',
        'InterpolatesFrom', 'LyricalReferenceTo'
    ]
    
    for src, tgt, edge_data in G.edges(data=True):
        if (edge_data['relationship'] in influence_relations and
            src in work_nodes and tgt in work_nodes):
            src_idx = work_nodes.index(src)
            tgt_idx = work_nodes.index(tgt)
            influence_edges.append([src_idx, tgt_idx])
    
    if influence_edges:
        influence_edge_index = torch.tensor(influence_edges, dtype=torch.long).t().contiguous()
        setattr(data, 'work_influences_work_edge_index', influence_edge_index)
    
    # 创作关系 (艺术家-作品)
    creates_edges = []
    created_by_edges = []
    for src, tgt, edge_data in G.edges(data=True):
        if (edge_data['relationship'] in ['PerformerOf', 'ComposerOf', 'LyricistOf'] and
            src in artist_nodes and tgt in work_nodes):
            artist_idx = artist_nodes.index(src)
            work_idx = work_nodes.index(tgt)
            creates_edges.append([artist_idx, work_idx])
            created_by_edges.append([work_idx, artist_idx])
    
    if creates_edges:
        creates_edge_index = torch.tensor(creates_edges, dtype=torch.long).t().contiguous()
        setattr(data, 'artist_creates_work_edge_index', creates_edge_index)
        
        created_by_edge_index = torch.tensor(created_by_edges, dtype=torch.long).t().contiguous()
        setattr(data, 'work_created_by_artist_edge_index', created_by_edge_index)
    
    # 使用优化后的权重计算标签
    labels = []
    for artist_id in artist_nodes:
        feat = artist_features_dict[artist_id]
        # 使用后的权重计算潜力评分
        score = (
            feat.get('influence_score', 0) * weights[0] +
            feat.get('creative_depth', 0) * weights[1] +
            feat.get('label_weight', 0) * weights[2] +
            feat.get('oceanus_recent', 0) * weights[3] +
            feat.get('collab_diversity', 0) * weights[4] +
            feat.get('producer_count', 0) * weights[5] +
            feat.get('oceanus_ratio', 0) * weights[6] +
            feat.get('collaboration_score', 0) * weights[7]
        )
        labels.append(score)
    
    data['artist'].y = torch.tensor(labels, dtype=torch.float) if labels else torch.zeros(0, dtype=torch.float)
    
    return data

# 8. 训练与预测 (基于训练损失早停)
def train_and_predict(data, node_mapping, artist_features_dict):
    if data['artist'].num_nodes == 0:
        return []
    
    model = HeteroArtistPredictor(
        input_dim_artist=data['artist'].x.size(1),
        input_dim_work=data['work'].x.size(1),
        hidden_dim=64
    )
    
    optimizer = torch.optim.Adam(model.parameters(), lr=0.001, weight_decay=1e-4)
    criterion = nn.MSELoss()
    
    # 早停法参数 - 基于训练损失
    patience = 50  # 连续多少个epoch损失无改善则停止
    min_delta = 0.001  # 视为改善的最小变化量
    best_loss = float('inf')
    patience_counter = 0
    best_model_state = None
    
    model.train()
    losses = []
    
    for epoch in range(1000):
        optimizer.zero_grad()
        out = model(data)
        
        if data['artist'].y.numel() > 0:
            loss = criterion(out, data['artist'].y)
            loss.backward()
            optimizer.step()
            losses.append(loss.item())
            
            # 早停法检查 - 基于训练损失
            if loss.item() < best_loss - min_delta:
                best_loss = loss.item()
                patience_counter = 0
                # 保存最佳模型状态
                best_model_state = model.state_dict().copy()
            else:
                patience_counter += 1
                
            if patience_counter >= patience:
                print(f'早停在epoch {epoch}: 训练损失连续{patience}个epoch未改善')
                # 恢复最佳模型状态
                model.load_state_dict(best_model_state)
                break
        else:
            # 如果没有标签数据，无法计算损失，跳过训练
            print("无有效标签数据，跳过训练")
            break
        
        if epoch % 50 == 0:
            loss_value = loss.item() if 'loss' in locals() else float('nan')
            print(f'Epoch {epoch}, Loss: {loss_value:.4f}')
    
    model.eval()
    with torch.no_grad():
        if data['artist'].x.size(0) > 0:
            raw_predictions = model(data)
            predictions = torch.sigmoid(raw_predictions)
        else:
            predictions = torch.tensor([])
    
    results = []
    for i in range(data['artist'].num_nodes):
        artist_id = data['artist'].node_id[i]
        artist_data = node_mapping.get(artist_id, {'name': 'Unknown', 'stage_name': 'Unknown'})
        
        name = artist_data.get('stage_name', artist_data.get('name', 'Unknown'))
        feat = artist_features_dict.get(artist_id, {})
        
        # 双重验证：只包含最近5年有活动的艺术家
        if feat.get('last_release_year', 0) < CURRENT_YEAR - 5:
            continue
        
        probability = predictions[i].item() if predictions.numel() > 1 else (predictions.item() if predictions.numel() == 1 else 0.0)
        
        results.append({
            'id': artist_id,
            'name': name,
            'probability': probability,
            'features': feat
        })
    
    results.sort(key=lambda x: x['probability'], reverse=True)
    return results

# 修改后的 Flask API
@app.route('/predict', methods=['POST'])
def predict():
    try:
        # 获取前端发送的 JSON 数据
        request_data = request.get_json()
        
        if not request_data or 'graphData' not in request_data:
            return jsonify({'error': 'No graph data provided'}), 400
        
        graph_data = request_data['graphData']
        
        # 调试日志
        print(f"收到图谱数据: {len(graph_data.get('nodes', []))} 节点, {len(graph_data.get('edges', []))} 边")
        
        # 使用接收到的数据构建图谱
        G, node_mapping, label_mapping = build_knowledge_graph(graph_data)
        
        # 特征提取
        artist_features_dict = extract_features(G, node_mapping, label_mapping)
        
        # 优化权重
        optimized_weights = optimize_weights(artist_features_dict)
        
        # 准备图数据
        hetero_data = prepare_hetero_graph_data(G, artist_features_dict, node_mapping, optimized_weights)
        
        # 训练和预测
        results = train_and_predict(hetero_data, node_mapping, artist_features_dict)
        
        # 准备返回结果
        top_artists = []
        for artist in results[:5]:
            features = artist.get('features', {})
            top_artists.append({
                'id': artist['id'],
                'name': artist['name'],
                'probability': artist['probability'],
                'last_active': features.get('last_release_year', '未知'),
                'oceanus_works': features.get('oceanus_works', 0),
                'notable_works': features.get('total_notable', 0),
                'influence_score': features.get('influence_score', 0),
                'creative_depth': features.get('creative_depth', 0),
                'features': features
            })
        
        # 生成报告
        creativity_scores = [a['features'].get('creative_depth', 0) for a in results]
        avg_creativity = np.mean(creativity_scores) if creativity_scores else 0
        
        top_companies = list(label_mapping.values())[:3] if label_mapping else ["无唱片公司数据"]
        
        # 准备未来之星数据
        predicted_stars = []
        for artist in results[:3]:
            feat = artist.get('features', {})
            strengths = []
            if feat.get('composer_count', 0) > 0:
                strengths.append(f"作曲作品: {feat['composer_count']}")
            if feat.get('lyricist_count', 0) > 0:
                strengths.append(f"作词作品: {feat['lyricist_count']}")
            if feat.get('producer_count', 0) > 0:
                strengths.append(f"制作经验: {feat['producer_count']}")
            
            risk_factors = []
            if 'recent_activity' in feat:
                risk_factors.append(f"最近活动: {feat['recent_activity']}年前")
            if 'collab_diversity' in feat:
                risk_factors.append(f"合作多样性: {feat['collab_diversity']}")
            
            predicted_stars.append({
                'name': artist['name'],
                'probability': round(artist['probability'], 4),
                'strengths': strengths,
                'risk_factors': risk_factors
            })
        
        # 准备雷达图数据
        radar_dimensions = {
            'influence_score': '影响力',
            'creative_depth': '创作深度',
            'collab_diversity': '合作多样性',
            'oceanus_works': 'Oceanus作品',
            'total_notable': '知名作品',
            'collaboration_score': '协作强度'
        }
        
        radar_data = []
        for artist in results[:3]:
            feat = artist['features']
            radar_values = {}
            
            # 计算每个维度的标准化值 (0-100)
            for dim, dim_name in radar_dimensions.items():
                value = feat.get(dim, 0)
                if dim == 'influence_score':
                    normalized = value
                elif dim == 'creative_depth':
                    normalized = value * 100  # 已经是0-1范围
                else:
                    # 其他维度使用相对比例
                    max_val = max(1, max(feat.get(dim, 0) for feat in artist_features_dict.values()))
                    normalized = min(value / max_val * 100, 100)
                
                radar_values[dim_name] = round(normalized, 1)
            
            radar_data.append({
                'name': artist['name'],
                'data': radar_values
            })

        report = {
            "top_artists": top_artists,
            "trends": {
                "top_companies": top_companies,
                "avg_creativity": round(avg_creativity, 2),
                "active_artists": len(results)
            },
            "predicted_stars": predicted_stars,
            "radar_data": radar_data  # 包含三位艺术家的雷达图数据
        }
        print(radar_data)
        return jsonify(report)
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'服务器错误: {str(e)}'}), 500
    
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
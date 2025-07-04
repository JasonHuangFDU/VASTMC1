import axios from 'axios';
import { useGraphStore } from '@/stores/graphStore';

export const predictArtists = async () => {
  try {
    const graphStore = useGraphStore();

    // 确保图数据已加载
    if (!graphStore.nodes.length) {
      await graphStore.fetchGraphData();
    }

    // 准备图数据
    const graphData = {
      nodes: graphStore.nodes,
      edges: graphStore.links
    };

    // 使用代理路径
    const response = await axios.post('/api/predict', {
      graphData: graphData
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    console.error('预测请求失败:', error);

    // 添加详细的错误日志
    if (error.response) {
      console.error('响应数据:', error.response.data);
      console.error('状态码:', error.response.status);
      console.error('响应头:', error.response.headers);
    } else if (error.request) {
      console.error('请求信息:', error.request);
    } else {
      console.error('错误信息:', error.message);
    }

    throw error;
  }
};

import axios from 'axios';
import { useGraphStore } from '@/stores/graphStore';

// 修改函数以接受权重偏好参数
export const predictArtists = async (weightPreferences = null) => {
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

    // 构建请求体，包含权重偏好
    const requestBody = { graphData };
    if (weightPreferences) {
      requestBody.weightPreferences = weightPreferences;
    }

    // 使用代理路径
    const response = await axios.post('/api/predict', requestBody, {
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

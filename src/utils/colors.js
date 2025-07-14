/**
 * 定义整个应用的主题颜色和图表特定颜色
 */
export const appColors = {
  // --- 通用基础色 ---
  background: '#F8F8F8', // 浅背景色，用于页面或图表容器
  surface: '#FFFFFF',    // 表面色，用于卡片、面板背景
  border: '#E0E0E0',     // 边框色，柔和的灰色
  textPrimary: '#333333', // 主要文本颜色
  textSecondary: '#666666', // 次要文本颜色
  textLight: '#999999',   // 更浅的文本颜色

  // --- 主强调色（用于主要交互、高亮） ---
  primaryAccent: '#5D9CEC', // 清新蓝，例如按钮激活态、主要线条
  secondaryAccent: '#A7C5EB', // 柔和蓝，用于次要高亮

  // --- 桑基图和折线图的通用颜色系列 ---
  // 用于流派、艺术家等分类数据，确保在不同图中保持一致
  categoryPalette: [
    '#E6A7A6', // 柔和橘粉
    '#B7D962', // 清新绿
    '#FDD787', // 柔和橙
    '#9FC1E8', // 柔和蓝
    '#CCB8D2', // 柔和紫罗兰
    '#8DE3C7', // 柔和薄荷绿
    '#FFC599', // 柔和蜜桃色
    '#A0A0A0', // 中性灰
    '#6A9B9B', // 柔和青
    '#D3A9C8', // 柔和玫粉紫
  ],

  // --- 特定实体颜色 ---
  // 如果某些特定艺术家或流派需要固定颜色，可以在这里定义
  sailorShift: '#FF6F61', // Sailor Shift 的专属颜色，更鲜明一些以突出
  oceanusFolk: '#6B7A8F', // Oceanus Folk 的专属颜色，沉稳的蓝灰色
  
  // --- 节点类型颜色 (桑基图) ---
  // 这些颜色可以帮助区分不同类型的节点（例如：艺术家、流派）
  nodeTypeColors: {
    artist: '#9FC1E8', // 艺术家节点使用柔和天蓝
    genre: '#E6A7A6',  // 流派节点使用柔和砖红
    // 可以根据需要添加更多类型
  },

  // --- 桑基图连线颜色 ---
  // 连线颜色可以根据源节点类型或一个中性色来定义
  sankeyLinkBase: 'rgba(107, 122, 143, 0.4)', // 桑基图连线基础色（半透明蓝灰）
  sankeyLinkHighlight: 'rgba(93, 156, 236, 0.7)', // 桑基图连线高亮色
};

/**
 * 根据流派名称获取颜色。
 * 如果流派不在预定义调色板中，则使用一个默认颜色。
 * @param {string} genreName - 流派名称
 * @returns {string} 对应的颜色值
 */
export const getGenreColor = (genreName) => {
  const paletteMap = {
    'Dream Pop': appColors.categoryPalette[0],
    'Indie Folk': appColors.categoryPalette[1],
    'Desert Rock': appColors.categoryPalette[2],
    'Space Rock': appColors.categoryPalette[3],
    'Synthwave': appColors.categoryPalette[4],
    'Americana': appColors.categoryPalette[5],
    'Doom Metal': appColors.categoryPalette[6],
    'Jazz Surf Rock': appColors.categoryPalette[7],
    'Synthpop': appColors.categoryPalette[8],
    'Post-Apocalyptic Folk': appColors.categoryPalette[9],
    // 添加更多流派到调色板的映射
    'Oceanus Folk': appColors.oceanusFolk, // 确保 Oceanus Folk 有固定颜色
    // 如果有其他重要的流派，可以在这里显式映射
  };
  return paletteMap[genreName] || '#D9D9D9'; // 默认颜色为浅灰
};

/**
 * 根据节点名称或类型获取桑基图节点颜色。
 * @param {object} node - 桑基图节点对象
 * @returns {string} 对应的颜色值
 */
export const getSankeyNodeColor = (node) => {
  if (node.name === 'Sailor Shift') {
    return appColors.sailorShift;
  }
  if (node.name === 'Oceanus Folk') {
    return appColors.oceanusFolk;
  }
  if (node.type === 'Artist') {
    return appColors.nodeTypeColors.artist;
  }
  if (node.type === 'Genre') {
    // 尝试从流派调色板获取，否则使用默认流派节点颜色
    return getGenreColor(node.name);
  }
  // 默认颜色
  return appColors.textLight;
};

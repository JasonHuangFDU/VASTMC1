//艺术家生涯轨迹数据处理函数
/**
 * 处理艺术家生涯数据
 * @param {Object} graphData - 图数据 { nodes: [], links: [] }
 * @param {number} artistId - 艺术家节点ID
 * @returns {Object|null} 处理后的生涯数据对象
 */
export function processArtistData(graphData, artistId) {
  // 1. 提取目标艺术家节点
  const artist = graphData.nodes.find(n => n.id === artistId && n['Node Type'] === 'Person');
  if (!artist) return null;

  // 2. 构建数据结构
  const result = {
    artistInfo: { ...artist },
    timelineEvents: [],
    yearlyStats: {}
  };

  // 3. 收集艺术家相关作品和合作者
  const { works, collaborations, workReferencesByYear, artistStyleInfluencesByYear } = extractWorksAndCollabs(graphData, artistId);

  // 4. 计算年度指标
  calculateYearlyStats(result, works, collaborations, workReferencesByYear, artistStyleInfluencesByYear);

  return result;
}

// 内部辅助函数
function extractWorksAndCollabs(graphData, artistId) {
  const works = [];
  const collaborations = new Map();
  // 按年份统计作品被引用次数
  const workReferencesByYear = new Map();
  // 按年份统计艺术家被模仿次数
  const artistStyleInfluencesByYear = new Map();

  // 创建节点ID到节点的映射表
  const nodeMap = new Map();
  graphData.nodes.forEach(node => nodeMap.set(node.id, node));

  // 查找艺术家参与的作品
  graphData.links.forEach(link => {
    // 指标2: 艺术家被模仿统计 (在遍历所有链接时直接处理)
    if (link.target === artistId && link['Edge Type'] === 'InStyleOf') {
      const sourceNode = nodeMap.get(link.source);
      if (sourceNode && sourceNode.release_date) {
        const year = sourceNode.release_date;
        const count = artistStyleInfluencesByYear.get(year) || 0;
        artistStyleInfluencesByYear.set(year, count + 1);
      }
    }

    // 查找艺术家参与的作品
    if (link.source === artistId &&
        ['PerformerOf', 'ComposerOf', 'LyricistOf', 'ProducerOf'].includes(link['Edge Type'])) {

      const work = graphData.nodes.find(n => n.id === link.target &&
        (n['Node Type'] === 'Song' || n['Node Type'] === 'Album'));

      if (work) {
        let workEntry = works.find(w => w.id === work.id);
        if (!workEntry) {
          workEntry = {
            ...work,
            type: work['Node Type'],
            roles: [],
            collaborators: new Set()
          };
          works.push(workEntry);
        }
        workEntry.roles.push(link['Edge Type']);
      }
    }
  });

  // 识别合作者并处理指标1
  const referenceEdgeTypes = ['InStyleOf', 'InterpolatesFrom', 'CoverOf', 'LyricalReferenceTo', 'DirectlySamples'];

  works.forEach(work => {
    graphData.links.forEach(link => {
      // 指标1: 作品被引用统计 (在遍历作品链接时直接处理)
      if (referenceEdgeTypes.includes(link['Edge Type']) &&
          link.target === work.id) {
        const sourceNode = nodeMap.get(link.source);
        if (sourceNode && sourceNode.release_date) {
          const year = sourceNode.release_date;
          const count = workReferencesByYear.get(year) || 0;
          workReferencesByYear.set(year, count + 1);
        }
      }

      // 合作者识别 (保持原有逻辑)
      if (link.target === work.id &&
          ['PerformerOf', 'ComposerOf', 'LyricistOf', 'ProducerOf'].includes(link['Edge Type']) &&
          link.source !== artistId) {

        const collaborator = graphData.nodes.find(n => n.id === link.source);
        if (collaborator && collaborator['Node Type'] === 'Person') {
          work.collaborators.add(collaborator.id);

          if (!collaborations.has(work.release_date)) {
            collaborations.set(work.release_date, { collaborators: new Set(), count: 0 });
          }
          const yearData = collaborations.get(work.release_date);
          yearData.collaborators.add(collaborator.id);
          yearData.count++;
        }
      }
    });
  });

  return { works, collaborations, workReferencesByYear, artistStyleInfluencesByYear };
}

function calculateYearlyStats(result, works, collaborations, workReferencesByYear, artistStyleInfluencesByYear) {
  const stats = {};

  // 初始化时间范围
  const years = [...new Set(works.map(w => w.release_date))].sort();
  if (years.length === 0) return;

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);

  // 初始化年度数据
  for (let year = minYear; year <= maxYear; year++) {
    stats[year] = {
      influence: 0,
      collabRoles: { Performer: 0, Composer: 0, Lyricist: 0, Producer: 0 },
      genres: new Set(),
      genreDistribution: {},
      workCount: 0,        // 年度作品总数
      notableCount: 0,     // 年度notable作品数
      workReferences: 0,   // 年度作品被引用次数
      styleInfluences: 0   // 年度艺术家被模仿次数
    };
  }

  // 按年份处理作品
  works.forEach(work => {
    const year = work.release_date;
    if (!stats[year]) return;

    // 记录作品数量
    stats[year].workCount++;

    // 记录notable作品
    if (work.notable) {
      stats[year].notableCount++;
    }

    // 记录合作角色
    work.roles.forEach(role => {
      const roleType = role.replace('Of', '');
      if (stats[year].collabRoles[roleType] !== undefined) {
        stats[year].collabRoles[roleType]++;
      }
    });

    // 记录流派
    if (work.genre) {
      stats[year].genres.add(work.genre);
      stats[year].genreDistribution[work.genre] =
        (stats[year].genreDistribution[work.genre] || 0) + 1;
    }
  });

  // 添加间接影响力指标到年度数据
  for (const year in stats) {
    if (Object.prototype.hasOwnProperty.call(stats, year)) {
      // 添加作品被引用次数
      stats[year].workReferences = workReferencesByYear.get(parseInt(year)) || 0;

      // 添加艺术家被模仿次数
      stats[year].styleInfluences = artistStyleInfluencesByYear.get(parseInt(year)) || 0;
    }
  }

  // 计算年度影响力（修正公式）
  for (const year in stats) {
    if (Object.prototype.hasOwnProperty.call(stats, year)) {
      // 计算年度新增节点连接数（作品数 + 合作者数）
      const workConnections = stats[year].workCount;
      const collabCount = collaborations.get(parseInt(year))?.count || 0;

      // 应用公式：影响力 = 2 * notable作品数 + 总连接数 + 间接影响力指标
      stats[year].influence = 2 * stats[year].notableCount +
                             workConnections +
                             collabCount +
                             stats[year].workReferences +
                             stats[year].styleInfluences;
    }
  }

  // 添加合作数据
  collaborations.forEach((data, year) => {
    if (stats[year]) {
      stats[year].collabCount = data.count;
    }
  });

  result.yearlyStats = stats;
}

<!-- /components/visualizations/ArtistRadarChart.vue -->
<template>
  <div ref="radarContainer" class="radar-chart"></div>
</template>

<script>
import * as d3 from 'd3';

export default {
  name: 'ArtistRadarChart',
  props: {
    artistData: {
      type: Object,
      required: true
    },
    width: {
      type: Number,
      default: 200
    },
    height: {
      type: Number,
      default: 150
    }
  },
  mounted() {
    this.renderRadar();
  },
  watch: {
    artistData: {
      deep: true,
      handler() {
        this.renderRadar();
      }
    }
  },
  methods: {
    renderRadar() {
      if (!this.artistData || Object.keys(this.artistData.data).length === 0) return;

      // 清除现有图表
      d3.select(this.$refs.radarContainer).selectAll("*").remove();

      const margin = { top: 20, right: 20, bottom: 20, left: 20 };
      const width = this.width - margin.left - margin.right;
      const height = this.height - margin.top - margin.bottom;
      const radius = Math.min(width, height) / 2;

      const svg = d3.select(this.$refs.radarContainer)
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left + width/2},${margin.top + height/2})`);

      // 获取特征名称和数据
      const features = Object.keys(this.artistData.data);
      const values = Object.values(this.artistData.data);
      const levels = 5;

      // 角度比例尺
      const angleSlice = (Math.PI * 2) / features.length;

      // 半径比例尺 (数据已经是0-100范围)
      const rScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, radius]);

      // 创建雷达网格
      for (let level = 1; level <= levels; level++) {
        const levelFactor = radius * level / levels;

        // 绘制网格圆环
        svg.append("circle")
          .attr("r", levelFactor)
          .attr("fill", "none")
          .attr("stroke", "#e0e7ff")
          .attr("stroke-width", "0.5px");

        // 添加刻度标签
        svg.append("text")
          .attr("x", 5)
          .attr("y", -levelFactor + 2)
          .attr("font-size", "8px")
          .attr("fill", "#64748b")
          .text(level * 20);
      }

      // 绘制轴线
      features.forEach((feature, i) => {
        const angle = angleSlice * i + Math.PI / 3;

        // 绘制轴线
        svg.append("line")
          .attr("x1", 0)
          .attr("y1", 0)
          .attr("x2", radius * Math.cos(angle))
          .attr("y2", radius * Math.sin(angle))
          .attr("stroke", "#e0e7ff")
          .attr("stroke-width", "0.5px");

          // 添加特征标签 - 修正角度计算
        const labelAngle = angleSlice * i ;
        const labelRadius = radius + 10;

        svg.append("text")
          .attr("x", labelRadius * Math.cos(labelAngle))
          .attr("y", labelRadius * Math.sin(labelAngle))
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "middle")
          .attr("font-size", "9px")
          .attr("fill", "#4b5563")
          .text(feature);
      });

      // 准备雷达图数据
      const coordinates = features.map((feature, i) => ({
        axis: feature,
        value: values[i],
        angle: angleSlice * i + Math.PI / 2
      }));

      // 创建雷达图线条生成器
      const line = d3.lineRadial()
        .angle(d => d.angle)
        .radius(d => rScale(d.value))
        .curve(d3.curveLinearClosed);

      // 绘制雷达区域
      svg.append("path")
        .datum(coordinates)
        .attr("d", line)
        .attr("fill", "#4a6cf7")
        .attr("fill-opacity", 0.1)
        .attr("stroke", "#4a6cf7")
        .attr("stroke-width", 1.5);

      // 添加数据点
      svg.selectAll(".radar-point")
        .data(coordinates)
        .enter()
        .append("circle")
        .attr("cx", d => rScale(d.value) * Math.cos(d.angle - Math.PI / 2))
        .attr("cy", d => rScale(d.value) * Math.sin(d.angle - Math.PI / 2))
        .attr("r", 3)
        .attr("fill", "#4a6cf7")
        .attr("stroke", "#fff")
        .attr("stroke-width", 1);

      // 添加数据值标签
      svg.selectAll(".radar-value")
        .data(coordinates)
        .enter()
        .append("text")
        .attr("x", d => (rScale(d.value) + 8) * Math.cos(d.angle - Math.PI / 2))
        .attr("y", d => (rScale(d.value) + 8) * Math.sin(d.angle - Math.PI / 2))
        .attr("font-size", "8px")
        .attr("fill", "#4a6cf7")
        .text(d => d.value);
    }
  },
  beforeUnmount() {
    // 清理图表
    d3.select(this.$refs.radarContainer).selectAll("*").remove();
  }
};
</script>

<style scoped>
.radar-chart {
  height: 100%;
  width: 100%;
}
</style>

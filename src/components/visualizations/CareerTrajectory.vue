<!-- /components/visualizations/CareerTrajectory.vue -->
<template>
  <div class="career-trajectory">
    <!-- 现有的生涯轨迹图 -->
    <div class="trajectory-graph">
      <!-- 现有代码保持不变 -->
    </div>

    <!-- 添加潜力预测组件 -->
    <ArtistPotentialPrediction />
  </div>
</template>

<script>
import ArtistPotentialPrediction from './ArtistPotentialPrediction.vue';

export default {
  name: 'CareerTrajectory',
  components: {
    ArtistPotentialPrediction
  },
  // 现有代码保持不变
};
</script>

<style scoped>
.career-trajectory {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
</style>

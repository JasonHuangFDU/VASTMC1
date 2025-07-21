<template>
  <div class="bottom-view-container">
    <InfluenceBarRace :data="influenceData" :maxInfluenceInfo="maxInfluenceInfo" v-if="influenceData" />
    <div v-else>Loading data</div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import InfluenceBarRace from '@/components/visualizations/InfluenceBarRace.vue';
import { loadInfluenceData } from '@/services/dataService';

const influenceData = ref(null);
const maxInfluenceInfo = ref(null);

onMounted(async () => {
  try {
    const data = await loadInfluenceData();
    //console.log("加载的影响力数据:", data);
    influenceData.value = data;

    // 计算最大影响力信息
    let maxScore = null;
    let maxNodeId = null;
    let maxYear = null;
    let maxName = null;
    //console.log("最大影响力信息:", maxNodeId, maxName, maxYear, maxScore);
    maxInfluenceInfo.value = {
      node_id: maxNodeId,
      name: maxName,
      year: maxYear,
      score: maxScore,
    };

  } catch (error) {
    console.error("加载影响力数据失败:", error);
  }
});
</script>

<style scoped>
.bottom-view-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #f7f7f7;
  color: #333;
}
</style>
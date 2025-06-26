import { createRouter, createWebHistory } from 'vue-router'
import InfluenceNetwork from '../components/visualizations/InfluenceNetwork.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: InfluenceNetwork,
    },
  ],
})

export default router

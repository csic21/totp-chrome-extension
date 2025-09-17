<template>
  <div class="flex items-center gap-2">
    <div class="relative">
      <svg class="w-6 h-6" viewBox="0 0 36 36">
        <!-- Background circle (未走过的时间，浅色) -->
        <circle cx="18" cy="18" r="15" fill="#9e9e9e" />
        <!-- Progress sector (已走过的时间，深色) -->
        <path
          :d="pathData"
          fill="#757575"
          class="transition-all duration-1000 ease-linear"
        />
      </svg>
    </div>
    <span class="text-xs text-gray-400 w-4 text-right"
      >{{ remainingTime }}s
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  remainingTime: number;
}>();

// 计算扇形路径数据
const pathData = computed(() => {
  // 30秒为完整周期，计算已完成的时间百分比（而不是剩余时间）
  const elapsedPercent = ((30 - props.remainingTime) / 30) * 100;
  return createSectorPath(elapsedPercent);
});

// 创建扇形路径
function createSectorPath(progress: number) {
  if (progress <= 0) return "";
  if (progress >= 100) {
    // 完整的圆
    return "M18,18 L18,3 A15,15 0 1,1 18,33 A15,15 0 1,1 18,3 Z";
  }

  const angle = (progress / 100) * 360;
  const radius = 15;
  const centerX = 18;
  const centerY = 18;

  // 将角度转换为弧度
  const radians = (angle * Math.PI) / 180;

  // 计算终点坐标 (调整为顺时针方向)
  const endX = centerX + radius * Math.sin(radians);
  const endY = centerY - radius * Math.cos(radians);

  // 大角度标志 (大于180度时为1)
  const largeArcFlag = angle > 180 ? 1 : 0;

  // 生成SVG路径数据
  // M: 移动到中心点
  // L: 画线到起始点 (顶部)
  // A: 画弧到终点 (顺时针方向)
  // L: 画线回到中心点
  return `M${centerX},${centerY} L${centerX},${
    centerY - radius
  } A${radius},${radius} 0 ${largeArcFlag},1 ${endX},${endY} L${centerX},${centerY} Z`;
}
</script>

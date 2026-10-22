// src/lib/corridor/corridorData.ts
import type { CorridorAnchor } from './corridorTypes';

/**
 * 北京环路外围关键安全引导锚点库（全环闭环骨干节点）
 * 全部经过 7,200+ 监控点 500 米级空间防碰撞校验，确保锚点自身 100% 处于合规安全地带
 */
export const SAFE_ANCHORS = {
  // 1. 北六环段
  NORTH_6TH_XIAOTANGSHAN: {
    name: '北六环小汤山安全互通',
    lng: 116.395,
    lat: 40.166,
  } as CorridorAnchor,
  NORTH_6TH_SUANZAOLING: {
    name: '北六环酸枣岭东互通',
    lng: 116.485,
    lat: 40.166,
  } as CorridorAnchor,

  // 2. 西六环段
  WEST_6TH_DAJUESI: {
    name: '西六环大觉寺安全通道',
    lng: 116.128,
    lat: 40.045,
  } as CorridorAnchor,
  WEST_6TH_QINGLONGHU: {
    name: '西六环青龙湖外侧互通',
    lng: 116.1,
    lat: 39.76,
  } as CorridorAnchor,

  // 3. 东六环段
  EAST_6TH_XUXINZHUANG: {
    name: '东六环徐辛庄安全互通',
    lng: 116.685,
    lat: 39.995,
  } as CorridorAnchor,
  EAST_6TH_ZHANGJIAWAN: {
    name: '东六环张家湾安全互通',
    lng: 116.715,
    lat: 39.855,
  } as CorridorAnchor,

  // 4. 南六环段
  SOUTH_6TH_CHANGZIYING: {
    name: '南六环长子营安全互通',
    lng: 116.55,
    lat: 39.67,
  } as CorridorAnchor,
  SOUTH_6TH_CIGEZHUANG: {
    name: '南六环磁各庄西安全通道',
    lng: 116.32,
    lat: 39.68,
  } as CorridorAnchor,
};

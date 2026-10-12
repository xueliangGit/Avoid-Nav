import rawData from '@/lib/refined-data.json';
import type { RefinedData } from '@/lib/types';

export interface ChangelogItem {
  version: string;
  date: string;
  title: string;
  type: 'data' | 'feature' | 'fix';
  details: string[];
}

export interface DataMeta {
  pointCount: number;
  updatedAt: string;
  formattedDate: string;
  source: string;
}

export function getDataMeta(): DataMeta {
  const data = rawData as unknown as RefinedData;
  const pointCount = Array.isArray(data.points) ? data.points.length : 0;
  const updatedAt = data.updatedAt || '';

  let formattedDate = '';
  if (updatedAt) {
    try {
      const d = new Date(updatedAt);
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      formattedDate = `${month}-${day}`;
    } catch {
      formattedDate = '';
    }
  }

  return {
    pointCount,
    updatedAt,
    formattedDate,
    source: data.source === 'api' ? '外部 API' : 'jinjing365',
  };
}

export const CHANGELOG_LIST: ChangelogItem[] = [
  {
    version: 'v1.3.0',
    date: '2026-10-10',
    title: '规避算路极速响应与抽屉手势丝滑重构',
    type: 'feature',
    details: [
      '多轮规避算法探测耗时由 6~8 秒大幅缩短至 2 秒内，消除假死感。',
      '移动端抽屉重构为 GPU 硬件加速，支持轻扫（Flick）手势与弹性物理阻尼。',
      '规避过程状态步进全流程可视化，规划进度实时可知。',
    ],
  },
  {
    version: '数据更新',
    date: '2026-10-10',
    title: '最新进京证与限行监控点位刷新',
    type: 'data',
    details: [
      '监控点位总数刷新至 6,288 处（净增 18 处）。',
      '增补进京主要干道与六环周边最新管控监控点位。',
    ],
  },
  {
    version: 'v1.2.1',
    date: '2026-09-29',
    title: '移动端布局适配与样式修复',
    type: 'fix',
    details: [
      '修复移动端标题栏在窄屏下的文字折行问题。',
      '修复操作区规划与保存按钮在部分机型上的重叠遮挡。',
    ],
  },
  {
    version: '数据更新',
    date: '2026-09-29',
    title: '进京证与限行监控点位历史刷新',
    type: 'data',
    details: [
      '监控点位总数刷新至 6,270 处（净增 81 处）。',
      '新增 81 处最新监控点位（通州区 38 处、顺义区 30 处、开发区 5 处、大兴区 3 处等）。',
      '校准 2 处原有监控点（通州区司空分署街道路名修正、金榆路南口坐标微调）。',
    ],
  },
  {
    version: '数据更新',
    date: '2026-09-11',
    title: '进京证与限行监控点位历史刷新',
    type: 'data',
    details: [
      '监控点位总数刷新至 6,189 处（净增 75 处）。',
      '新增 77 处最新录入监控点（包含通州区徐尹路、新华南路等）。',
      '下线移除 2 处失效点位（丰台区云岗路、经开区科谷一街）。',
      '优化 3 处点位描述（试用期转正、精确道路名对齐）。',
    ],
  },
  {
    version: 'v1.2.0',
    date: '2026-07-13',
    title: '明暗主题支持与体验优化',
    type: 'feature',
    details: [
      '新增明暗主题切换，支持浅色、深色及跟随系统。',
      '适配高德地图深色底图样式。',
      '优化移动端横屏与窄屏视口布局。',
    ],
  },
  {
    version: 'v1.1.0',
    date: '2026-06-15',
    title: '高德导航外链与路线分享',
    type: 'feature',
    details: [
      '支持生成高德地图 App 导航链接（包含关键途经点）。',
      '支持路线配置短链分享与本地历史记录。',
      '增加自定义避让区域圈定功能。',
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-04-10',
    title: '首发版本上线',
    type: 'feature',
    details: [
      '基于高德地图驾车规划与 Spatial R-Tree 空间索引。',
      '实现进京证摄像头与限行区域自动避让及风险预警。',
    ],
  },
];

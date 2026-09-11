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
    version: '数据更新',
    date: '2026-09-11',
    title: '最新进京证与限行监控点位刷新',
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

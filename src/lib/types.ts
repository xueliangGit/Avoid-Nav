// 共享类型定义 - 整个应用的契约层
// 所有模块都基于这里的类型

export interface LngLat {
  lng: number;
  lat: number;
}

// 一个电子眼/监控点（来自 refined-data.json）
export interface CameraPoint {
  lng: number;
  lat: number;
  type: string;       // 图标类型："1"-"6"
  risk: number;       // 风险等级
  href: string;       // 详情页路径
  name: string;       // 地点名称
  direction?: string; // "东向西"/"双向" 等
}

// 路线上识别到的风险点 - 用 lng,lat 字符串作 id
export interface RouteRisk {
  id: string;
  lng: number;
  lat: number;
  name: string;
  type: string;
  risk: number;
  href: string;
  direction?: string;
}

// 用户手动添加的避让区
export type ManualAvoidSize = 'small' | 'medium' | 'large';

export interface ManualAvoidArea {
  id: string;
  lng: number;
  lat: number;
  label: string;
  size?: ManualAvoidSize; // 默认 medium（向后兼容）
}

// 用户添加的途经点
export interface Waypoint {
  id: string;
  lng: number;
  lat: number;
  name: string;
}

// 起点 / 终点
export interface PlaceItem {
  lng: number;
  lat: number;
  name: string;
}

// 调试日志
export interface DebugLog {
  round: number;
  message: string;
  type: 'info' | 'success' | 'warn' | 'ignore' | 'error';
  timestamp: string;
}

// refined-data.json 中点数据原始格式：
// [lng, lat, type, risk, href, name, direction]
export type RawCameraTuple = [number, number, string, number, string, string, string?];

export interface RefinedData {
  updatedAt: string;
  points: RawCameraTuple[];
}

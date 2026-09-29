'use client';

import { Navigation, Settings, History } from 'lucide-react';
import type {
  PlaceItem,
  Waypoint,
  ManualAvoidArea,
  ManualAvoidSize,
  RouteRisk,
} from '@/lib/types';
import UpdateBadge from '@/components/shared/UpdateBadge';
import EndpointInputs from './components/EndpointInputs';
import WaypointList from './components/WaypointList';
import AvoidAreaList from './components/AvoidAreaList';
import RouteActionBar from './components/RouteActionBar';
import RiskDetailSection from './components/RiskDetailSection';

export type InteractionMode = 'none' | 'add-waypoint' | 'add-avoid';

export interface RouteInfo {
  distance: number; // meters
  duration: number; // seconds
}

interface ControlPanelProps {
  // 起终点
  start: PlaceItem | null;
  end: PlaceItem | null;

  // 中间状态
  waypoints: Waypoint[];
  manualAvoidAreas: ManualAvoidArea[];

  // 风险
  avoidedRisks: RouteRisk[];
  safelyIgnoredRisks: RouteRisk[];
  deadRisks: RouteRisk[];
  routeRisks: RouteRisk[];
  ignoredRiskIds: Set<string>;
  forcedRiskIds: Set<string>;

  // 路线
  routeInfo: RouteInfo | null;

  // 规划状态
  planning: boolean;
  status: string | null;

  // 是否有用户位置（按钮可用与否）
  hasUserLocation: boolean;

  // 当前交互模式
  mode: InteractionMode;

  // 回调
  onUseMyLocation: () => void;
  onRemoveWaypoint: (id: string) => void;
  onRemoveAvoidArea: (id: string) => void;
  onToggleAddWaypoint: () => void;
  onStartAddAvoid: (size: ManualAvoidSize) => void;
  pendingAvoidSize: ManualAvoidSize;
  onOpenSettings: () => void;
  onPlan: () => void | Promise<void>;
  onToggleIgnoreRisk: (id: string) => void;
  onToggleForceRisk: (id: string) => void;
  onFocusRisk: (risk: RouteRisk) => void;
  onSwapEndpoints: () => void;
  onClearStart: () => void;
  onClearEnd: () => void;
  onOpenHistory: () => void;
  onSaveRoute: () => void;
  canSave: boolean;
  onStartNavigation: () => void;
  canNavigate: boolean;
  onShareRoute: () => void;
  canShare: boolean;
  onOpenChangelog?: () => void;

  // 布局模式：constrained = 桌面端固定高度容器（内部滚动）；flow = 手机端自然流式（外层滚动）
  variant?: 'constrained' | 'flow';
}

const ControlPanel = ({
  start,
  end,
  waypoints,
  manualAvoidAreas,
  avoidedRisks,
  safelyIgnoredRisks,
  deadRisks,
  routeRisks,
  ignoredRiskIds,
  forcedRiskIds,
  routeInfo,
  planning,
  status,
  hasUserLocation,
  mode,
  onUseMyLocation,
  onRemoveWaypoint,
  onRemoveAvoidArea,
  onToggleAddWaypoint,
  onStartAddAvoid,
  pendingAvoidSize,
  onOpenSettings,
  onPlan,
  onToggleIgnoreRisk,
  onToggleForceRisk,
  onFocusRisk,
  onSwapEndpoints,
  onClearStart,
  onClearEnd,
  onOpenHistory,
  onSaveRoute,
  canSave,
  onStartNavigation,
  canNavigate,
  onShareRoute,
  canShare,
  onOpenChangelog,
  variant = 'constrained',
}: ControlPanelProps) => {
  const isFlow = variant === 'flow';
  const rootClass = isFlow
    ? 'bg-surface/80 backdrop-blur shadow-2xl rounded-3xl p-6 border border-border flex flex-col'
    : 'bg-surface/80 backdrop-blur shadow-2xl rounded-3xl p-6 border border-border flex flex-col max-h-full overflow-y-auto custom-scrollbar';

  return (
    <div className={rootClass}>
      {/* 标题栏 */}
      <div className="flex items-start justify-between mb-5 px-1">
        <div className="flex items-start space-x-3 min-w-0">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20 shrink-0 mt-0.5">
            <Navigation className="text-white w-5 h-5 fill-current" />
          </div>
          <div className="flex flex-col gap-1 min-w-0">
            <h2 className="font-black text-fg text-lg leading-tight tracking-tight">
              北京避让导航
            </h2>
            {onOpenChangelog && (
              <div className="pt-0.5">
                <UpdateBadge onClick={onOpenChangelog} />
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-1.5 shrink-0 pt-0.5">
          {status && (
            <span className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded-lg animate-pulse font-bold tracking-widest shrink-0">
              {status}
            </span>
          )}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 rounded-xl bg-overlay-soft hover:bg-overlay text-fg-2 hover:text-fg transition shrink-0"
            aria-label="设置"
            title="设置"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onOpenHistory}
            className="p-2 rounded-xl bg-overlay-soft hover:bg-overlay text-fg-2 hover:text-fg transition shrink-0"
            aria-label="历史路线"
            title="历史路线"
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 起点 / 终点输入 */}
      <EndpointInputs
        start={start}
        end={end}
        hasUserLocation={hasUserLocation}
        onUseMyLocation={onUseMyLocation}
        onSwapEndpoints={onSwapEndpoints}
        onClearStart={onClearStart}
        onClearEnd={onClearEnd}
      />

      {/* 途经点列表 */}
      <WaypointList
        waypoints={waypoints}
        mode={mode}
        onToggleAddWaypoint={onToggleAddWaypoint}
        onRemoveWaypoint={onRemoveWaypoint}
      />

      {/* 手动避让区 */}
      <AvoidAreaList
        manualAvoidAreas={manualAvoidAreas}
        mode={mode}
        pendingAvoidSize={pendingAvoidSize}
        onStartAddAvoid={onStartAddAvoid}
        onRemoveAvoidArea={onRemoveAvoidArea}
      />

      {/* 规划、保存与路线导航动作栏 */}
      <RouteActionBar
        planning={planning}
        routeInfo={routeInfo}
        canSave={canSave}
        canNavigate={canNavigate}
        canShare={canShare}
        onPlan={onPlan}
        onSaveRoute={onSaveRoute}
        onStartNavigation={onStartNavigation}
        onShareRoute={onShareRoute}
      />

      {/* 风险点详细列表折叠组 */}
      <RiskDetailSection
        avoidedRisks={avoidedRisks}
        safelyIgnoredRisks={safelyIgnoredRisks}
        deadRisks={deadRisks}
        routeRisks={routeRisks}
        ignoredRiskIds={ignoredRiskIds}
        forcedRiskIds={forcedRiskIds}
        onToggleIgnoreRisk={onToggleIgnoreRisk}
        onToggleForceRisk={onToggleForceRisk}
        onFocusRisk={onFocusRisk}
      />
    </div>
  );
};

export default ControlPanel;

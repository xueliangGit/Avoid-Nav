'use client';

import { useState, type ReactNode } from 'react';
import type { PlaceItem } from '@/lib/types';
import type { RouteInfo } from '@/components/Map/ControlPanel';
import MobileCapsuleHeader from '@/components/Map/components/MobileCapsuleHeader';
import MobileRouteSummaryBar from '@/components/Map/components/MobileRouteSummaryBar';
import MobilePlannerModal from '@/components/Map/components/MobilePlannerModal';

interface Props {
  controlPanel: ReactNode;
  debugPanel: ReactNode;
  mapElement: ReactNode;
  start: PlaceItem | null;
  end: PlaceItem | null;
  planning: boolean;
  status: string | null;
  routeInfo: RouteInfo | null;
  avoidedRiskCount: number;
  unavoidedRiskCount?: number;
  canSave: boolean;
  canNavigate: boolean;
  canShare: boolean;
  onPlan: () => void | Promise<void>;
  onStartNavigation: () => void;
  onSaveRoute: () => void;
  onShareRoute: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenChangelog?: () => void;
}

export default function MobileLayout({
  controlPanel,
  debugPanel,
  mapElement,
  start,
  end,
  planning,
  status,
  routeInfo,
  avoidedRiskCount,
  unavoidedRiskCount = 0,
  canSave,
  canNavigate,
  canShare,
  onPlan: _onPlan,
  onStartNavigation,
  onSaveRoute,
  onShareRoute,
  onOpenSettings,
  onOpenHistory,
  onOpenChangelog,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'control' | 'debug'>('control');

  const handleOpenPlanner = () => {
    setModalTab('control');
    setModalOpen(true);
  };

  const handleOpenDebug = () => {
    setModalTab('debug');
    setModalOpen(true);
  };

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* 1. 地图背景（100% 全屏可视） */}
      {mapElement}

      {/* 2. 顶部轻量悬浮胶囊栏 */}
      <MobileCapsuleHeader
        start={start}
        end={end}
        planning={planning}
        status={status}
        onOpenPlannerModal={handleOpenPlanner}
        onOpenSettings={onOpenSettings}
        onOpenHistory={onOpenHistory}
        onOpenDebug={handleOpenDebug}
      />

      {/* 3. 规划完成后底部轻量摘要浮条（仅在未打开全屏编排面板时呈现） */}
      {!modalOpen && (
        <MobileRouteSummaryBar
          routeInfo={routeInfo}
          planning={planning}
          canSave={canSave}
          canNavigate={canNavigate}
          canShare={canShare}
          avoidedRiskCount={avoidedRiskCount}
          unavoidedRiskCount={unavoidedRiskCount}
          onStartNavigation={onStartNavigation}
          onSaveRoute={onSaveRoute}
          onShareRoute={onShareRoute}
          onExpandDetails={handleOpenPlanner}
        />
      )}

      {/* 4. 路线编排与详情弹出层 */}
      <MobilePlannerModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={modalTab === 'control' ? '路线编排与避让' : '系统运行日志'}
        tab={modalTab}
        onTabChange={setModalTab}
        hasDebugTab={true}
        onOpenChangelog={onOpenChangelog}
      >
        {modalTab === 'control' ? controlPanel : debugPanel}
      </MobilePlannerModal>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
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
  modalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
  onPlan: () => void | Promise<void>;
  onStartNavigation: () => void;
  onSaveRoute: () => void;
  onShareRoute: () => void;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenChangelog?: () => void;
  hasNewUpdate?: boolean;
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
  modalOpen: controlledModalOpen,
  onModalOpenChange,
  onPlan: _onPlan,
  onStartNavigation,
  onSaveRoute,
  onShareRoute,
  onOpenSettings,
  onOpenHistory,
  onOpenChangelog,
  hasNewUpdate = false,
}: Props) {
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const isControlled = controlledModalOpen !== undefined;
  const isModalOpen = isControlled ? controlledModalOpen : internalModalOpen;

  const setModalOpenState = (open: boolean) => {
    if (!isControlled) {
      setInternalModalOpen(open);
    }
    onModalOpenChange?.(open);
  };

  const [modalTab, setModalTab] = useState<'control' | 'debug'>('control');
  const prevPlanningRef = useRef(planning);

  // 当规划从进行中变为完成且有路线信息时，自动收起弹窗，让用户一眼看到全景路线和底部摘要
  useEffect(() => {
    if (prevPlanningRef.current && !planning && routeInfo) {
      setModalOpenState(false);
    }
    prevPlanningRef.current = planning;
  }, [planning, routeInfo]);

  const handleOpenPlanner = () => {
    setModalTab('control');
    setModalOpenState(true);
  };

  const handleOpenDebug = () => {
    setModalTab('debug');
    setModalOpenState(true);
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
        hasNewUpdate={hasNewUpdate}
        onOpenPlannerModal={handleOpenPlanner}
        onOpenSettings={onOpenSettings}
        onOpenHistory={onOpenHistory}
        onOpenDebug={handleOpenDebug}
      />

      {/* 3. 规划完成后底部轻量摘要浮条（仅在未打开全屏编排面板时呈现） */}
      {!isModalOpen && (
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
        open={isModalOpen}
        onClose={() => setModalOpenState(false)}
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

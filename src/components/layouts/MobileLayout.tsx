'use client';

import { useState, type ReactNode } from 'react';
import BottomSheet, { type SheetHeight } from '@/components/shared/BottomSheet';

interface Props {
  controlPanel: ReactNode;
  debugPanel: ReactNode;
  mapElement: ReactNode;
}

type TabKey = 'control' | 'debug';

export default function MobileLayout({ controlPanel, debugPanel, mapElement }: Props) {
  const [height, setHeight] = useState<SheetHeight>('half');
  const [tab, setTab] = useState<TabKey>('control');

  return (
    <div className="relative w-full h-full">
      {mapElement}
      <BottomSheet height={height} onHeightChange={setHeight}>
        <div className="flex flex-col h-full min-h-0">
          <div className="flex border-b border-white/5 px-4 shrink-0">
            <TabButton active={tab === 'control'} onClick={() => setTab('control')}>
              控制
            </TabButton>
            <TabButton active={tab === 'debug'} onClick={() => setTab('debug')}>
              日志
            </TabButton>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar overscroll-contain p-3 touch-pan-y">
            {tab === 'control' ? controlPanel : debugPanel}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-3 text-xs font-black transition border-b-2 ${
        active
          ? 'text-blue-400 border-blue-400'
          : 'text-slate-500 border-transparent hover:text-slate-300'
      }`}
    >
      {children}
    </button>
  );
}

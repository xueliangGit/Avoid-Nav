'use client';

import { useState, type ReactNode } from 'react';

interface Props {
  controlPanel: ReactNode;
  debugPanel: ReactNode;
  mapElement: ReactNode;
}

type TabKey = 'control' | 'debug';

export default function MobileLandscapeLayout({
  controlPanel,
  debugPanel,
  mapElement,
}: Props) {
  const [tab, setTab] = useState<TabKey>('control');

  return (
    <div className="relative w-full h-full flex">
      <div className="flex-1 relative">{mapElement}</div>
      <div className="w-[40%] max-w-[420px] min-w-[280px] bg-surface/95 backdrop-blur-xl border-l border-border flex flex-col">
        <div className="flex border-b border-border-soft px-3">
          <button
            type="button"
            onClick={() => setTab('control')}
            className={`px-3 py-2.5 text-[11px] font-black ${
              tab === 'control' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-fg-subtle'
            }`}
          >
            控制
          </button>
          <button
            type="button"
            onClick={() => setTab('debug')}
            className={`px-3 py-2.5 text-[11px] font-black ${
              tab === 'debug' ? 'text-blue-400 border-b-2 border-blue-400' : 'text-fg-subtle'
            }`}
          >
            日志
          </button>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3">
          {tab === 'control' ? controlPanel : debugPanel}
        </div>
      </div>
    </div>
  );
}

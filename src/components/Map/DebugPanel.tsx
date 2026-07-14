'use client';

import { useEffect, useRef } from 'react';
import { Terminal } from 'lucide-react';
import type { DebugLog } from '@/lib/types';

interface DebugPanelProps {
  logs: DebugLog[];
  variant?: 'constrained' | 'flow';
}

const typeClassMap: Record<DebugLog['type'], string> = {
  success: 'text-emerald-400 font-bold',
  warn: 'text-orange-400',
  error: 'text-red-400 font-bold',
  ignore: 'text-fg-subtle italic',
  info: 'text-blue-400',
};

const DebugPanel = ({ logs, variant = 'constrained' }: DebugPanelProps) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const isFlow = variant === 'flow';
  const rootClass = isFlow
    ? 'bg-surface/80 backdrop-blur shadow-2xl rounded-3xl p-5 border border-border flex flex-col w-full'
    : 'bg-surface/80 backdrop-blur shadow-2xl rounded-3xl p-5 border border-border flex flex-col overflow-hidden h-full w-full';

  return (
    <div className={rootClass}>
      <div className="flex items-center space-x-2 mb-4 border-b border-border-soft pb-3">
        <Terminal className="text-emerald-500 w-4 h-4" />
        <h3 className="font-black text-[10px] uppercase tracking-[0.2em] text-emerald-500">
          Algorithm Log
        </h3>
        <span className="ml-auto text-[10px] text-fg-faint font-mono">{logs.length}</span>
      </div>

      <div className={`space-y-2 custom-scrollbar text-[10px] font-mono leading-relaxed pr-1 ${isFlow ? '' : 'flex-1 overflow-y-auto'}`}>
        {logs.length === 0 ? (
          <div className="text-fg-faint italic">等待规划...</div>
        ) : (
          logs.map((log, idx) => (
            <div key={idx} className="flex space-x-2">
              <span className="text-fg-faint shrink-0">[{log.round}]</span>
              <div className={typeClassMap[log.type]}>{log.message}</div>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default DebugPanel;

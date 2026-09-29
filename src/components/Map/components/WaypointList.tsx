'use client';

import { MapPin, Plus, Trash2 } from 'lucide-react';
import type { Waypoint } from '@/lib/types';
import type { InteractionMode } from '../ControlPanel';

interface WaypointListProps {
  waypoints: Waypoint[];
  mode: InteractionMode;
  onToggleAddWaypoint: () => void;
  onRemoveWaypoint: (id: string) => void;
}

export default function WaypointList({
  waypoints,
  mode,
  onToggleAddWaypoint,
  onRemoveWaypoint,
}: WaypointListProps) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2 px-1">
        <h3 className="text-[10px] font-black text-fg-subtle uppercase tracking-widest flex items-center space-x-2">
          <MapPin className="w-3 h-3 text-amber-400" />
          <span>途经点 ({waypoints.length})</span>
        </h3>
        <button
          type="button"
          onClick={onToggleAddWaypoint}
          className={`flex items-center space-x-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition ${
            mode === 'add-waypoint'
              ? 'bg-amber-500 text-white shadow shadow-amber-500/30'
              : 'bg-overlay-soft text-amber-400 hover:bg-overlay'
          }`}
        >
          <Plus className="w-3 h-3" />
          <span>{mode === 'add-waypoint' ? '点击地图添加' : '添加途经点'}</span>
        </button>
      </div>
      {waypoints.length > 0 && (
        <div className="space-y-1.5">
          {waypoints.map((w, idx) => (
            <div
              key={w.id}
              className="flex items-center justify-between bg-surface-2/60 border border-border-soft rounded-xl py-2 px-3 text-[11px]"
            >
              <div className="flex items-center space-x-2 overflow-hidden">
                <span className="shrink-0 w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 text-[10px] font-black flex items-center justify-center">
                  {idx + 1}
                </span>
                <span className="truncate text-fg-2 font-semibold">{w.name}</span>
              </div>
              <button
                type="button"
                onClick={() => onRemoveWaypoint(w.id)}
                className="shrink-0 p-1 rounded-md text-fg-subtle hover:text-red-400 hover:bg-red-500/10 transition"
                aria-label="删除途经点"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

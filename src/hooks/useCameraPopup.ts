// src/hooks/useCameraPopup.ts
'use client';

import { useCallback, useEffect, useRef } from 'react';
import { toRiskId } from '@/lib/avoidance';
import type { RouteRisk } from '@/lib/types';

const POPUP_BASE_URL = 'https://www.jinjing365.com';

const TYPE_NAMES: Record<string, { label: string; color: string }> = {
  '2': { label: '早晚高峰与外地车限行', color: '#f59e0b' },
  '3': { label: '外地车限行监控', color: '#10b981' },
  '5': { label: '进京证与早晚高峰双拍', color: '#e11d48' },
  '1': { label: '仅限早晚高峰 (五环内)', color: '#2563eb' },
  '6': { label: '六环外监控 (外证即可)', color: '#059669' },
  '4': { label: '已拆除 / 已停拍', color: '#64748b' },
};

export interface CameraPopupData {
  lng: number;
  lat: number;
  name?: string;
  href?: string;
  type?: string;
  direction?: string;
  picCount?: number;
}

interface UseCameraPopupProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AMap: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any;
  ignoredRiskIds: Set<string>;
  avoidedRisks: RouteRisk[];
  onToggleIgnoreRisk: (id: string) => void;
  onChanged?: () => void;
  onOpenDetail?: (url: string, title: string) => void;
  showToast?: (msg: string, variant?: 'success' | 'error') => void;
}

export function useCameraPopup({
  AMap,
  map,
  ignoredRiskIds,
  avoidedRisks,
  onToggleIgnoreRisk,
  onChanged,
  onOpenDetail,
  showToast,
}: UseCameraPopupProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const infoWindowRef = useRef<any>(null);
  const onOpenDetailRef = useRef(onOpenDetail);
  onOpenDetailRef.current = onOpenDetail;

  // 保持最新引用以供点击闭包读取
  const ignoredRef = useRef(ignoredRiskIds);
  ignoredRef.current = ignoredRiskIds;
  const avoidedRef = useRef(avoidedRisks);
  avoidedRef.current = avoidedRisks;

  // 内部维护同步的 Set，确保在防抖连点期间多个点的变更不丢失
  const activeIgnoredSetRef = useRef<Set<string>>(new Set(ignoredRiskIds));
  useEffect(() => {
    activeIgnoredSetRef.current = new Set(ignoredRiskIds);
  }, [ignoredRiskIds]);

  useEffect(() => {
    if (!AMap || !map) return;
    const iw = new AMap.InfoWindow({
      offset: new AMap.Pixel(0, -30),
      zIndex: 3000,
      isCustom: false,
    });
    infoWindowRef.current = iw;
    return () => {
      iw.close();
    };
  }, [AMap, map]);

  const openCameraPopup = useCallback(
    (data: CameraPopupData) => {
      if (!AMap || !map || !infoWindowRef.current) return;
      const { lng, lat, name = '交通监控点', href = '', type = '2', direction, picCount = 0 } = data;
      const id = toRiskId(lng, lat);
      const isAvoided = avoidedRef.current.some((r) => r.id === id);
      let isIgnored = activeIgnoredSetRef.current.has(id);

      const typeInfo = TYPE_NAMES[String(type)] || { label: '交通监控点', color: '#2563eb' };
      const cleanName = name.replace(/\[\（方向待确认\）\]/g, '').trim();
      const targetHref = href
        ? href.startsWith('http')
          ? href
          : `${POPUP_BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`
        : '#';

      const container = document.createElement('div');
      container.style.cssText =
        'padding:12px;min-width:240px;max-width:300px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;';

      // 1. 顶部类型徽章
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
      header.innerHTML = `
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${typeInfo.color};"></span>
        <span style="font-size:11px;font-weight:800;color:${typeInfo.color};">${typeInfo.label}</span>
      `;
      container.appendChild(header);

      // 2. 标题
      const title = document.createElement('h4');
      title.style.cssText = 'margin:0 0 6px 0;font-size:13px;font-weight:700;line-height:1.4;color:#1e293b;';
      title.textContent = cleanName;
      container.appendChild(title);

      // 3. 标签行 (朝向与照片)
      const tags = document.createElement('div');
      tags.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;';
      if (direction) {
        tags.innerHTML += `<div style="padding:2px 6px;border-radius:6px;background:#f1f5f9;border:1px solid #e2e8f0;color:#334155;font-size:11px;font-weight:600;">🚗 朝向: ${direction}</div>`;
      }
      if (picCount > 0) {
        tags.innerHTML += `<div style="padding:2px 6px;border-radius:6px;background:#fef2f2;border:1px solid #fecaca;color:#dc2626;font-size:11px;font-weight:700;">🖼️ 车友违章截图: ${picCount} 张</div>`;
      }
      container.appendChild(tags);

      // 4. 避让状态指示条
      const statusBadge = document.createElement('div');
      statusBadge.style.cssText = 'margin-bottom:8px;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;';

      // 5. 避让切换按钮
      const actionBtn = document.createElement('button');
      actionBtn.type = 'button';
      actionBtn.style.cssText =
        'width:100%;border:none;padding:8px 12px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all 0.2s;margin-bottom:8px;';

      const updateStateDisplay = (ignored: boolean) => {
        if (ignored) {
          statusBadge.style.background = '#f1f5f9';
          statusBadge.style.border = '1px solid #cbd5e1';
          statusBadge.style.color = '#475569';
          statusBadge.innerHTML = '⚪ 当前状态：已取消避让 (不设阻断红框)';

          actionBtn.style.background = '#10b981';
          actionBtn.style.color = '#ffffff';
          actionBtn.style.boxShadow = '0 2px 6px rgba(16,185,129,0.3)';
          actionBtn.innerHTML = '✅ 开启避让此点';
        } else {
          statusBadge.style.background = '#fef2f2';
          statusBadge.style.border = '1px solid #fecaca';
          statusBadge.style.color = '#dc2626';
          statusBadge.innerHTML = isAvoided
            ? '🔴 当前状态：规划避让中 (已设阻断红框)'
            : '🟠 当前状态：正常避让模式';

          actionBtn.style.background = '#ef4444';
          actionBtn.style.color = '#ffffff';
          actionBtn.style.boxShadow = '0 2px 6px rgba(239,68,68,0.3)';
          actionBtn.innerHTML = '🚫 取消避让此点';
        }
      };

      updateStateDisplay(isIgnored);

      actionBtn.onclick = (e) => {
        e.stopPropagation();
        isIgnored = !isIgnored;
        if (isIgnored) {
          activeIgnoredSetRef.current.add(id);
          showToast?.(`已取消避让: ${cleanName} (可继续在地图调整其他点)`, 'success');
        } else {
          activeIgnoredSetRef.current.delete(id);
          showToast?.(`已恢复避让: ${cleanName} (可继续在地图调整其他点)`, 'success');
        }
        onToggleIgnoreRisk(id);
        updateStateDisplay(isIgnored);
        onChanged?.();
      };

      container.appendChild(statusBadge);
      container.appendChild(actionBtn);

      // 6. 底部讨论外链（在当前页以安全沙箱 iframe 打开）
      if (targetHref !== '#') {
        const linkBtn = document.createElement('button');
        linkBtn.type = 'button';
        linkBtn.style.cssText =
          'display:block;width:100%;text-align:center;box-sizing:border-box;background:#f8fafc;border:1px solid #e2e8f0;color:#2563eb;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.2s;';
        linkBtn.innerHTML = '🖼️ 查看现场照片与车友讨论 &#8599;';
        linkBtn.onclick = (e) => {
          e.stopPropagation();
          if (onOpenDetailRef.current) {
            onOpenDetailRef.current(targetHref, cleanName);
          } else {
            window.open(targetHref, '_blank', 'noopener,noreferrer');
          }
        };
        container.appendChild(linkBtn);
      }

      infoWindowRef.current.setContent(container);
      infoWindowRef.current.open(map, [lng, lat]);
    },
    [AMap, map, onToggleIgnoreRisk, onChanged, showToast],
  );

  return { openCameraPopup };
}

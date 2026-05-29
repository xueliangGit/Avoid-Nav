'use client';

import { useEffect, useRef } from 'react';
import { decodeShare, SHARE_QUERY_KEY, type ShareableRouteV1 } from '@/lib/share';

/**
 * 在挂载时扫描 URL 上的 ?route=... 参数：
 *  - 命中且解码成功 → 调用 onLoad(state)
 *  - 解码后立即把 URL 上的参数清掉（避免刷新重复加载、URL 变长）
 * 只执行一次（无论 onLoad 引用变化）。
 */
export function useShareLink(onLoad: (state: ShareableRouteV1) => void): void {
  const calledRef = useRef(false);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;

  useEffect(() => {
    if (calledRef.current) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get(SHARE_QUERY_KEY);
    if (!token) return;
    const state = decodeShare(token);
    if (!state) return;
    calledRef.current = true;

    // 清掉 query 参数，但保留 hash 和 pathname
    const url = new URL(window.location.href);
    url.searchParams.delete(SHARE_QUERY_KEY);
    const newSearch = url.searchParams.toString();
    const cleaned = `${url.pathname}${newSearch ? `?${newSearch}` : ''}${url.hash}`;
    window.history.replaceState({}, '', cleaned);

    onLoadRef.current(state);
  }, []);
}

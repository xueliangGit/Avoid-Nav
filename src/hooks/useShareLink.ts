'use client';

import { useEffect, useRef } from 'react';
import { decodeShare, SHARE_QUERY_KEY, type ShareableRouteV1 } from '@/lib/share';

const DEDUPE_KEY = 'avoid-nav:loaded-share-token';

/**
 * 在挂载时扫描 URL 上的 ?route=... 参数：
 *  - 命中且解码成功 → 调用 onLoad(state)
 *  - 保留 URL 参数：用户从微信"在浏览器中打开"会复制当前 URL，
 *    若清掉参数，浏览器侧再次打开就丢失了路线。
 *  - 用 sessionStorage 记录已加载过的 token，避免刷新/二次挂载重复触发 onLoad。
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

    // 同一 token 在本会话内只加载一次（防止刷新重复触发规划）
    let alreadyLoaded = false;
    try {
      alreadyLoaded = window.sessionStorage.getItem(DEDUPE_KEY) === token;
    } catch {
      // sessionStorage 不可用时降级为允许加载
    }
    if (alreadyLoaded) {
      calledRef.current = true;
      return;
    }

    const state = decodeShare(token);
    if (!state) return;
    calledRef.current = true;

    try {
      window.sessionStorage.setItem(DEDUPE_KEY, token);
    } catch {
      // 忽略 quota / 隐私模式
    }

    onLoadRef.current(state);
  }, []);
}

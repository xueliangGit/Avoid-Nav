'use client';

import { useState, useEffect, useCallback } from 'react';
import { getDataMeta } from '@/lib/changelog';

const STORAGE_KEY = 'beijing_nav_last_seen_changelog_date';

export function useChangelogNotice() {
  const [hasNewUpdate, setHasNewUpdate] = useState(false);

  useEffect(() => {
    try {
      const meta = getDataMeta();
      const currentVersionOrDate = meta.updatedAt || meta.formattedDate || 'initial';
      const lastSeen = localStorage.getItem(STORAGE_KEY);

      // 如果未记录或者当前数据日期更新，则标记有新更新
      if (!lastSeen || lastSeen !== currentVersionOrDate) {
        setHasNewUpdate(true);
      } else {
        setHasNewUpdate(false);
      }
    } catch {
      // 忽略存储读取异常
    }
  }, []);

  // 用户主动点击打开更新日志时，标记已读
  const markAsSeen = useCallback(() => {
    try {
      const meta = getDataMeta();
      const currentVersionOrDate = meta.updatedAt || meta.formattedDate || 'initial';
      localStorage.setItem(STORAGE_KEY, currentVersionOrDate);
      setHasNewUpdate(false);
    } catch {
      // 忽略存储异常
    }
  }, []);

  return {
    hasNewUpdate,
    markAsSeen,
  };
}

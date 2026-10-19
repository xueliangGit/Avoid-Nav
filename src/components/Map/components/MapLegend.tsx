'use client';

import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';

interface LegendItem {
  iconUrl: string;
  code: string;
  title: string;
  level: string;
  levelColor: string;
  desc: string;
}

const LEGEND_ITEMS: LegendItem[] = [
  {
    iconUrl: '/images/2.png',
    code: 'aa=2',
    title: '常规进京证监控',
    level: '高风险',
    levelColor: 'text-red-500 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900',
    desc: '六环内常规抓拍进京证点位',
  },
  {
    iconUrl: '/images/5.png',
    code: 'aa=5',
    title: '进京证与高峰双拍',
    level: '极高风险',
    levelColor: 'text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900',
    desc: '重点路口，进京证与早晚高峰兼拍',
  },
  {
    iconUrl: '/images/1.png',
    code: 'aa=1',
    title: '仅早晚高峰监控',
    level: '中风险',
    levelColor: 'text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900',
    desc: '仅工作日早晚高峰五环内限行',
  },
  {
    iconUrl: '/images/6.png',
    code: 'aa=6',
    title: '六环外监控',
    level: '低风险',
    levelColor: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900',
    desc: '仅需办六环外证，不限办证次数',
  },
  {
    iconUrl: '/images/4.png',
    code: 'aa=4',
    title: '已停拍 / 已拆除',
    level: '已失效',
    levelColor: 'text-slate-400 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    desc: '经核实已拆除，默认不强制绕路',
  },
];

export default function MapLegend() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="absolute right-4 bottom-20 z-30 select-none">
      {/* 展开面板 */}
      {isOpen && (
        <div className="mb-2 w-72 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-2xl p-3.5 transition-all animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-1.5 text-xs font-black text-slate-800 dark:text-slate-100">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>监控点位图例说明</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="收起图例"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {LEGEND_ITEMS.map((item) => (
              <div
                key={item.code}
                className="flex items-start space-x-2.5 p-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <img
                  src={item.iconUrl}
                  alt={item.title}
                  className="w-5 h-6 object-contain flex-shrink-0 mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                      {item.title}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${item.levelColor}`}
                    >
                      {item.level}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-center">
            点击地图上的探头图标可查看违章实证与详情
          </div>
        </div>
      )}

      {/* 折叠唤起胶囊按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-3 py-2 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/80 dark:border-slate-800/80 shadow-lg hover:shadow-xl text-slate-700 dark:text-slate-200 hover:text-primary transition-all ml-auto text-xs font-bold"
        title="点位图例说明"
      >
        <Info className="w-3.5 h-3.5 text-primary" />
        <span>点位图例</span>
        {isOpen ? <ChevronDown className="w-3 h-3 ml-0.5" /> : <ChevronUp className="w-3 h-3 ml-0.5" />}
      </button>
    </div>
  );
}

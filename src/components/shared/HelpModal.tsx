'use client';

import { useEffect } from 'react';
import {
  X,
  HelpCircle,
  AlertTriangle,
  Compass,
  Navigation,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

export default function HelpModal({ open, onClose }: HelpModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[2200] bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed inset-x-4 top-[6%] bottom-[6%] sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 sm:w-[540px] z-[2250] bg-surface rounded-3xl border border-border shadow-2xl flex flex-col overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-soft shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-fg text-base">使用帮助与避让说明</h3>
              <p className="text-xs text-fg-muted">规避规则、高架上下道及导航注意事项</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-overlay text-fg-muted hover:text-fg transition"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 滚动内容区 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
          {/* 重点说明：高架桥与上下道 */}
          <section className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>特别说明：高架桥与主辅路上下道</span>
            </div>
            <div className="space-y-1.5 text-fg leading-relaxed">
              <p>
                <strong>为什么无法区分上下道？</strong>
                电子眼监控坐标与地图引擎均为二维经纬度平面，<strong>缺乏垂直三维高度（Z轴）感知能力</strong>。系统无法自动区分车辆是在“高架桥上主路”还是“地面辅路/桥下”，亦无法自动辨识立交桥进出口上下道。
              </p>
              <p>
                <strong>规避影响：</strong>
                若探头位于高架桥上，避让阻断区域可能会同时覆盖下方的地面道路导致误绕行；反之，地面探头也可能波及桥上通行的规划。
              </p>
              <div className="pt-1 space-y-1 text-fg-muted">
                <div className="font-bold text-fg">推荐应对方案：</div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>手动忽略点位：</strong>点击路线风险列表或地图上的探头查看实证信息。若确认实际走地面辅路不会被抓拍，点击<strong>【忽略此点】</strong>即可立即恢复直行。
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>添加引导途经点：</strong>在关键辅路或匝道路口长按地图添加途经点，强制引导导航走向。
                  </span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong>调节避让范围：</strong>在设置中将“自动避让范围”切换为“小 40m”，降低主辅路与窄路误伤。
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* 方向感知避让机制 */}
          <section className="p-4 rounded-2xl bg-surface-2 border border-border-soft space-y-2">
            <div className="flex items-center gap-2 text-fg font-black">
              <Compass className="w-4 h-4 text-blue-500" />
              <span>智能方向过滤机制</span>
            </div>
            <p className="text-fg-muted leading-relaxed">
              系统根据车辆行进矢量与探头抓拍方位夹角进行动态匹配：
            </p>
            <ul className="space-y-1 text-fg-muted pl-1">
              <li>• <strong>同向冲突（夹角 ≤45°）：</strong>触发严格多边形避让，重新计算绕行路线。</li>
              <li>• <strong>反向放行：</strong>车辆背向探头行驶时自动识别为无风险直行，避免不必要的大绕道。</li>
              <li>• <strong>双向严控：</strong>双向监控及进出京干线探头按双向严格阻断。</li>
            </ul>
          </section>

          {/* 外跳高德 App 导航须知 */}
          <section className="p-4 rounded-2xl bg-surface-2 border border-border-soft space-y-2">
            <div className="flex items-center gap-2 text-fg font-black">
              <Navigation className="w-4 h-4 text-emerald-500" />
              <span>外跳高德地图 App 实时导航须知</span>
            </div>
            <p className="text-fg-muted leading-relaxed">
              点击“开始导航”唤起高德地图 App 时，本系统会自动提取已算好的关键途经点并注入高德导航：
            </p>
            <div className="p-2.5 rounded-xl bg-overlay-soft border border-border-soft text-fg-muted leading-relaxed">
              ⚠️ <strong>切勿在手机高德中切换推荐路线：</strong>导航启动后高德自带算法可能提示“发现更快路线”，请勿切换！高德自带规划不包含进京证电子眼数据，切换后极易误闯抓拍路段。请严格按照预设途经点指引行驶。
            </div>
          </section>

          {/* 常用规则与点位分类 */}
          <section className="p-4 rounded-2xl bg-surface-2 border border-border-soft space-y-2">
            <div className="flex items-center gap-2 text-fg font-black">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <span>监控类型与限行时段</span>
            </div>
            <div className="space-y-1.5 text-fg-muted leading-relaxed">
              <div>• <strong>常规进京证：</strong>六环内全天抓拍外埠客车，需办理六环内进京通行证。</div>
              <div>• <strong>进京证+高峰双拍：</strong>重点路口兼具进京证和工作日早晚高峰抓拍能力。</div>
              <div>• <strong>早晚高峰监控：</strong>仅在工作日 07:00-09:00 与 17:00-20:00 抓拍五环内违规上路。</div>
              <div>• <strong>六环外监控：</strong>仅需六环外证，不占用每年 12 次、每次 7 天的内环办证额度。</div>
            </div>
          </section>
        </div>

        {/* 底部按钮 */}
        <div className="p-3.5 border-t border-border-soft bg-surface-2/50 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition text-xs shadow-md"
          >
            我已知晓
          </button>
        </div>
      </div>
    </>
  );
}

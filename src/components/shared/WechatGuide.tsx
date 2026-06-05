'use client';

import { X } from 'lucide-react';

interface WechatGuideProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 微信环境引导遮罩
 * 提示用户点击右上角"..."在浏览器中打开，才能唤起高德 App
 */
const WechatGuide = ({ open, onClose }: WechatGuideProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-black/95 backdrop-blur-sm">
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="关闭"
      >
        <X className="w-6 h-6 text-white" />
      </button>

      {/* 引导内容 */}
      <div className="mt-20 px-6 max-w-sm text-center">
        {/* 箭头指示 */}
        <div className="flex justify-end mb-4 animate-bounce">
          <svg
            className="w-16 h-16 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        </div>

        {/* 提示文字 */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-8 shadow-2xl">
          <div className="text-white space-y-4">
            <div className="text-2xl font-black">请在浏览器中打开</div>
            <div className="text-sm leading-relaxed opacity-90">
              微信内无法直接唤起高德地图 App
              <br />
              <br />
              请点击右上角 <span className="font-black text-lg">···</span>
              <br />
              选择 <span className="font-bold">"在浏览器中打开"</span>
              <br />
              <br />
              路线会自动带过去，再点导航即可
            </div>
          </div>
        </div>

        {/* 底部说明 */}
        <div className="mt-6 text-xs text-slate-400">
          这是微信的安全限制，我们无法绕过
        </div>
      </div>
    </div>
  );
};

export default WechatGuide;

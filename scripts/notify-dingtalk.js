// 钉钉群机器人消息通知脚本
const https = require('https');
const crypto = require('crypto');
const { URL } = require('url');

const WEBHOOK_URL = process.env.DINGTALK_WEBHOOK;
const SECRET = process.env.DINGTALK_SECRET;
const COUNT = process.argv[2] || '最新';
const COMMIT_SHA = (process.argv[3] || '').slice(0, 7);

function getSignedUrl(webhook, secret) {
  if (!secret) return webhook;
  const timestamp = Date.now();
  const stringToSign = `${timestamp}\n${secret}`;
  const sign = crypto
    .createHmac('sha256', secret)
    .update(stringToSign)
    .digest('base64');
  const encodedSign = encodeURIComponent(sign);
  const delimiter = webhook.includes('?') ? '&' : '?';
  return `${webhook}${delimiter}timestamp=${timestamp}&sign=${encodedSign}`;
}

async function sendNotification() {
  if (!WEBHOOK_URL) {
    console.log('ℹ️ 未检测到 DINGTALK_WEBHOOK 环境变量，跳过钉钉通知。');
    return;
  }

  const finalUrl = getSignedUrl(WEBHOOK_URL, SECRET);
  const now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });

  const payload = {
    msgtype: 'markdown',
    markdown: {
      title: '北京探头点位更新提醒',
      text: [
        '### 🚗 北京探头点位数据已自动刷新',
        `> **有效监控点位**：${COUNT} 处`,
        `> **同步时间**：${now}`,
        COMMIT_SHA ? `> **关联提交**：\`${COMMIT_SHA}\`` : '',
        '> **部署状态**：已自动推送到 `main` 分支并触发线上构建',
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  };

  const data = JSON.stringify(payload);
  const targetUrl = new URL(finalUrl);

  const options = {
    hostname: targetUrl.hostname,
    port: 443,
    path: `${targetUrl.pathname}${targetUrl.search}`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
  };

  return new Promise((resolve) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        console.log('📢 钉钉通知响应:', body);
        resolve();
      });
    });

    req.on('error', (err) => {
      console.error('❌ 发送钉钉通知失败:', err.message);
      resolve(); // 不阻塞流水线
    });

    req.write(data);
    req.end();
  });
}

sendNotification();

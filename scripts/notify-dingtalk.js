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
  console.log('🔍 [钉钉通知诊断信息]');
  console.log('  - DINGTALK_WEBHOOK 是否存在:', !!WEBHOOK_URL);
  if (WEBHOOK_URL) {
    const maskedWebhook =
      WEBHOOK_URL.length > 30
        ? `${WEBHOOK_URL.slice(0, 35)}...${WEBHOOK_URL.slice(-6)}`
        : WEBHOOK_URL;
    console.log(`  - DINGTALK_WEBHOOK 长度: ${WEBHOOK_URL.length}, 脱敏预览: ${maskedWebhook}`);
  }
  console.log('  - DINGTALK_SECRET 是否存在:', !!SECRET);
  if (SECRET) {
    const maskedSecret =
      SECRET.length > 8 ? `${SECRET.slice(0, 4)}...${SECRET.slice(-4)}` : '****';
    console.log(`  - DINGTALK_SECRET 长度: ${SECRET.length}, 脱敏预览: ${maskedSecret}`);
  }

  if (!WEBHOOK_URL) {
    console.log('❌ 未检测到 DINGTALK_WEBHOOK 环境变量（未在 GitHub Secrets 配置或名称不一致），跳过发送。');
    return;
  }

  const finalUrl = getSignedUrl(WEBHOOK_URL, SECRET);
  console.log(`  - 签名计算完成，目标请求路径: ${finalUrl.split('?')[0]}?***`);
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
        console.log('📢 钉钉原始响应:', body);
        try {
          const resJson = JSON.parse(body);
          if (resJson.errcode === 0) {
            console.log('✅ 钉钉通知发送成功！');
          } else if (resJson.errcode === 310000) {
            console.error('❌ 钉钉报错 310000：关键词不匹配！');
            console.error('👉 解决办法：请进入钉钉群机器人安全设置，确保自定义关键词列表中包含“北京”或“提醒”。');
          } else if (resJson.errcode === 300001) {
            console.error('❌ 钉钉报错 300001：token 不合法或已被删除！');
            console.error('👉 解决办法：请检查 DINGTALK_WEBHOOK 中的 access_token 是否复制完整。');
          } else {
            console.error(`⚠️ 钉钉返回错误码: ${resJson.errcode}, 详情: ${resJson.errmsg}`);
          }
        } catch {
          // 非 JSON 格式
        }
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

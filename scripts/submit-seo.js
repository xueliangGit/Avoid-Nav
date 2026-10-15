// 向各大搜索引擎（Bing IndexNow、百度等）主动推送网站 URL
const https = require('https');

const HOST = 'avoid-nav-bj.yamjs.cn';
const URL_LIST = [
  `https://${HOST}/`,
  `https://${HOST}/sitemap.xml`,
];
const INDEXNOW_KEY = '94a73752697b4f4c9c8ef1284d7a8d5f';
const BAIDU_TOKEN = process.env.BAIDU_PUSH_TOKEN;

function postJson(urlStr, data) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const body = JSON.stringify(data);
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let respBody = '';
        res.on('data', (c) => (respBody += c));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: respBody }));
      },
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function postText(urlStr, bodyText) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(bodyText),
        },
      },
      (res) => {
        let respBody = '';
        res.on('data', (c) => (respBody += c));
        res.on('end', () => resolve({ statusCode: res.statusCode, body: respBody }));
      },
    );
    req.on('error', reject);
    req.write(bodyText);
    req.end();
  });
}

async function submitIndexNow() {
  console.log('🚀 正在向 Bing / IndexNow 提交最新链接...');
  const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
    urlList: URL_LIST,
  };
  try {
    const res = await postJson('https://api.indexnow.org/indexnow', payload);
    console.log(`📢 Bing/IndexNow 响应状态码: ${res.statusCode} (${res.statusCode === 200 || res.statusCode === 202 ? '成功' : '响应: ' + res.body})`);
  } catch (err) {
    console.error('❌ Bing/IndexNow 提交失败:', err.message);
  }
}

async function submitBaidu() {
  if (!BAIDU_TOKEN) {
    console.log('ℹ️ 未检测到 BAIDU_PUSH_TOKEN 环境变量，跳过百度 API 自动推送。');
    return;
  }
  console.log('🚀 正在向百度搜索资源平台 API 提交最新链接...');
  const baiduApiUrl = `https://data.zz.baidu.com/urls?site=https://${HOST}&token=${BAIDU_TOKEN}`;
  try {
    const res = await postText(baiduApiUrl, URL_LIST.join('\n'));
    console.log('📢 百度 API 响应:', res.body);
  } catch (err) {
    console.error('❌ 百度 API 提交失败:', err.message);
  }
}

async function main() {
  console.log(`🌐 目标站点: https://${HOST}`);
  console.log('📄 待推送链接:', URL_LIST);
  await submitIndexNow();
  await submitBaidu();
  console.log('✨ 搜索引擎主动推送流程执行完毕！');
}

main();

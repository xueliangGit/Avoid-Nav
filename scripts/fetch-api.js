// 新 API 数据源抓取脚本
// 调用接口获取摄像头数据，原样写入根目录 data.json
// 之后由 preprocess.js 自动识别新格式并精炼为 refined-data.json
//
// 用法:
//   DATA_API_URL=https://xxx/api/cameras node scripts/fetch-api.js
//   或直接在下面 DEFAULT_API_URL 填死地址
//   或 node scripts/fetch-api.js https://xxx/api/cameras

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// TODO: 把新数据源接口地址填到这里（或用环境变量 DATA_API_URL / 命令行参数覆盖）
const DEFAULT_API_URL = '';

const API_URL = process.argv[2] || process.env.DATA_API_URL || DEFAULT_API_URL;
const OUTPUT_FILE = path.join(__dirname, '..', 'data.json');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function httpGet(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'));
    const lib = url.startsWith('https') ? https : http;
    lib
      .get(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } }, (res) => {
        const { statusCode, headers } = res;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          resolve(httpGet(new URL(headers.location, url).toString(), redirects + 1));
          return;
        }
        if (statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${statusCode}`));
          return;
        }
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      })
      .on('error', reject);
  });
}

// 从接口响应里取出数据数组。接口可能直接返回数组，也可能包一层
// （如 { data: [...] } / { rows: [...] } / { result: { list: [...] } }）。
function extractList(json) {
  if (Array.isArray(json)) return json;
  const candidates = [json.data, json.rows, json.list, json.items, json.result];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
    if (c && Array.isArray(c.list)) return c.list;
    if (c && Array.isArray(c.rows)) return c.rows;
  }
  throw new Error('接口响应中未找到数据数组，请检查 extractList 适配');
}

async function main() {
  if (!API_URL) {
    console.error('❌ 未配置 API 地址。请用以下任一方式提供:');
    console.error('   1) 编辑 scripts/fetch-api.js 的 DEFAULT_API_URL');
    console.error('   2) DATA_API_URL=https://xxx node scripts/fetch-api.js');
    console.error('   3) node scripts/fetch-api.js https://xxx');
    process.exit(1);
  }

  console.log('🌐 调用接口:', API_URL);
  const body = await httpGet(API_URL);

  let json;
  try {
    json = JSON.parse(body);
  } catch (e) {
    throw new Error('接口返回的不是合法 JSON: ' + e.message);
  }

  const list = extractList(json);
  if (list.length === 0) throw new Error('接口返回数据为空');

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(list));
  console.log(`✅ 写入 ${list.length} 条 → ${OUTPUT_FILE}`);
  console.log('👉 接下来运行 node scripts/preprocess.js（npm run update-data-v2 会自动跑）');
}

main().catch((e) => {
  console.error('❌ 抓取失败:', e.message);
  process.exit(1);
});

// 北京避让导航数据抓取脚本
// 从数据源页面抓取内联的 `var LabelsData = [...]`，转成根目录 data.json
// 之后由 preprocess.js 精炼为前端用的 refined-data.json
// 用法：node scripts/fetch-data.js   （或 npm run update-data，会顺带跑 preprocess）

const fs = require('fs');
const path = require('path');
const https = require('https');

const SOURCE_URL = 'https://www.jinjing365.com/index.asp';
const OUTPUT_FILE = path.join(__dirname, '..', 'data.json');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// 用内置 https 抓取（兼容 Node 16，无需全局 fetch / 第三方依赖）
function httpGet(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'));
    https
      .get(url, { headers: { 'User-Agent': UA } }, (res) => {
        const { statusCode, headers } = res;
        if (statusCode >= 300 && statusCode < 400 && headers.location) {
          res.resume();
          const next = new URL(headers.location, url).toString();
          resolve(httpGet(next, redirects + 1));
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

// 在 html 中从 `var LabelsData` 起，按方括号配对截取完整数组源码
// （数组里有嵌套的 position:[lng,lat]，不能用非贪婪正则，必须做括号计数）
function extractLabelsArray(html) {
  const anchor = html.indexOf('var LabelsData');
  if (anchor < 0) throw new Error('页面中未找到 var LabelsData');
  const start = html.indexOf('[', anchor);
  if (start < 0) throw new Error('未找到 LabelsData 的起始 [');
  let depth = 0;
  for (let i = start; i < html.length; i += 1) {
    const ch = html[i];
    if (ch === '[') depth += 1;
    else if (ch === ']') {
      depth -= 1;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  throw new Error('LabelsData 数组括号未闭合');
}

const RAW_OUTPUT_FILE = path.join(__dirname, '..', 'raw-secondary.json');

async function fetchSecondaryData() {
  const html = await httpGet(SOURCE_URL);
  const arrSrc = extractLabelsArray(html);

  let list;
  try {
    list = new Function('icon', `"use strict"; return (${arrSrc});`)(null);
  } catch (e) {
    throw new Error('解析 LabelsData 失败: ' + e.message);
  }
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error('LabelsData 解析结果为空');
  }

  return list
    .filter((it) => it && Array.isArray(it.position) && it.position.length === 2)
    .map((it) => ({
      name: it.name || '',
      position: [Number(it.position[0]), Number(it.position[1])],
      aa: String(it.aa ?? ''),
      time: it.time || '',
      edittime: it.edittime || '',
      href: it.href || '',
      icon: null,
    }));
}

async function main() {
  console.log('🌐 正在从辅助数据源抓取数据 (jinjing365.com)...');
  try {
    const cleaned = await fetchSecondaryData();
    fs.writeFileSync(RAW_OUTPUT_FILE, JSON.stringify(cleaned), 'utf-8');
    console.log(`✅ 辅助源拉取成功，共 ${cleaned.length} 处点位，已保存至 raw-secondary.json`);
  } catch (e) {
    console.error('❌ 辅助源抓取失败:', e.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchSecondaryData };

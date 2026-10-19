// 主数据源抓取脚本 (jjz365.cn API)
// 抓取全量摄像头点位数据，原样保存为临时文件或内存对象供合并引擎使用

const fs = require('fs');
const path = require('path');
const https = require('https');

const PRIMARY_API_URL = 'https://www.jjz365.cn/CameraData/GetAllRing';
const OUTPUT_FILE = path.join(__dirname, '..', 'raw-primary.json');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function fetchPrimaryData() {
  return new Promise((resolve, reject) => {
    const url = new URL(PRIMARY_API_URL);
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'User-Agent': UA,
          'Content-Length': '0',
          Accept: 'application/json, text/plain, */*',
        },
        timeout: 15000,
      },
      (res) => {
        const { statusCode } = res;
        if (statusCode !== 200) {
          res.resume();
          return reject(new Error(`主数据源响应异常: HTTP ${statusCode}`));
        }

        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const raw = Buffer.concat(chunks).toString('utf-8');
            const data = JSON.parse(raw);
            if (!Array.isArray(data) || data.length < 5000) {
              return reject(new Error(`主源数据量异常，期望大于5000条，实际收到 ${data?.length} 条`));
            }
            resolve(data);
          } catch (err) {
            reject(new Error(`主源数据 JSON 解析失败: ${err.message}`));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('主源请求超时 (15s)'));
    });

    req.on('error', (err) => {
      reject(new Error(`主源网络请求失败: ${err.message}`));
    });

    req.end();
  });
}

async function main() {
  console.log('📡 正在从主数据源拉取最新摄像头点位 (jjz365.cn)...');
  try {
    const list = await fetchPrimaryData();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(list, null, 2), 'utf-8');
    console.log(`✅ 主数据源拉取成功，共 ${list.length} 处点位，已保存至 raw-primary.json`);
  } catch (err) {
    console.error(`❌ 主数据源拉取失败: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchPrimaryData };

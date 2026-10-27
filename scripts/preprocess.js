// 北京避让导航数据预处理脚本
// 把根目录的 data.json 转换为 src/lib/refined-data.json (压缩七元组格式)
// 支持双源合并格式及历史源格式，build 前自动运行

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '..', 'data.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'lib', 'refined-data.json');

const AA_MAP = {
  '1': { label: '其他监控', risk: 2 },
  '2': { label: '新增/实锤点位', risk: 3 },
  '3': { label: '仅高峰期/顺义区', risk: 2 },
  '4': { label: '失效/已拆除(不拍)', risk: 0 },
  '5': { label: '六环内(未办证+高峰)', risk: 3 },
  '6': { label: '六环外(六环外证即可)', risk: 1 },
};

function extractDirection(name) {
  const pattern = /(西向东|东向西|南向北|北向南|进京|出京|双向|由[东西南北]向[东西南北])/;
  const match = (name || '').match(pattern);
  return match ? match[0] : undefined;
}

function refineItem(item) {
  // 1. 双源合并后的标准契约结构
  if (Array.isArray(item.position) && item.aa !== undefined) {
    const lng = Number(item.position[0]);
    const lat = Number(item.position[1]);
    const aa = String(item.aa ?? '1');
    const risk = typeof item.risk === 'number' ? item.risk : (AA_MAP[aa]?.risk ?? 2);
    const href = item.href || '';
    const name = item.name || '';
    const direction = item.direction || extractDirection(name);
    const picCount = Number(item.picCount) || 0;
    return [lng, lat, aa, risk, href, name, direction, picCount];
  }

  // 2. 原生新 API 格式 (兜底)
  if (item.Lng !== undefined || item.Longitude !== undefined) {
    const lng = Number(item.Lng || item.Longitude);
    const lat = Number(item.Lat || item.Latitude);
    const isOut = String(item.IsSixRingOut || item.IsSixRing) === '1';
    const name = item.Address || item.LocationDescript || item.RoadName || '';
    const aa = isOut ? '6' : '5';
    const risk = AA_MAP[aa]?.risk ?? 2;
    const href = item.Id ? `https://www.jjz365.cn/XMap/ToDiscuss/${item.Id}` : '';
    const picCount = Number(item.PicCount) || 0;
    return [lng, lat, aa, risk, href, name, extractDirection(name), picCount];
  }

  return null;
}

function processData() {
  console.log('🚀 开始精炼监控数据...');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ 找不到输入文件 ${INPUT_FILE}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  if (!Array.isArray(data) || data.length === 0) {
    console.error('❌ data.json 内容为空或非数组');
    process.exit(1);
  }

  const refined = data
    .map((item) => {
      try {
        return refineItem(item);
      } catch {
        return null;
      }
    })
    .filter((row) => row && Number.isFinite(row[0]) && Number.isFinite(row[1]) && row[0] > 0);

  const output = {
    updatedAt: new Date().toISOString(),
    source: 'merged-dual-source',
    points: refined,
  };

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));
  console.log(`✅ 成功精炼 ${refined.length} 处点位 → ${OUTPUT_FILE}`);
}

if (require.main === module) {
  processData();
}

module.exports = { processData };

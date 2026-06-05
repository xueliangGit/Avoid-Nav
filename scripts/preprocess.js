// 北京避让导航数据预处理脚本
// 把根目录的 data.json 转成 src/lib/refined-data.json (压缩七元组格式)
// 自动识别两套数据源格式：
//   - jinjing365 旧源:  { position:[lng,lat], aa, href, name }
//   - 新 API 源:        { Longitude, Latitude, CameraType, IsSixRing, Id, LocationDescript }
// 统一输出: [lng, lat, aa, risk, href, name, direction]
// build 前自动运行，产物不进库

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '..', 'data.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'lib', 'refined-data.json');

// aa 字段即图标编号，对应 /images/{aa}.png
// 按 jinjing365 官方 about 页面 (https://www.jinjing365.com/about/?19.html) 定义
const AA_MAP = {
  '1': { label: '其他监控', risk: 2 },
  '2': { label: '新增点位', risk: 3 },
  '3': { label: '仅高峰期/顺义区', risk: 2 },
  '4': { label: '失效/个例(不拍)', risk: 0 }, // 已停拍，避让时跳过
  '5': { label: '六环内(未办证+高峰)', risk: 3 },
  '6': { label: '六环外(六环外证即可)', risk: 1 },
};

function extractDirection(name) {
  const pattern = /(西向东|东向西|南向北|北向南|进京|出京|双向|由[东西南北]向[东西南北])/;
  const match = (name || '').match(pattern);
  return match ? match[0] : null;
}

// —— 新 API 源：把 CameraType + IsSixRing 映射到 aa 图标编号 ——
// IsSixRing: '1'=六环外, '0'=六环内(或非环线分类)
function newSourceToAa(item) {
  const type = item.CameraType || '';
  // 六环外 → aa=6
  if (String(item.IsSixRing) === '1') return '6';
  // 失效/停拍
  if (/失效|停拍|不拍|个例/.test(type)) return '4';
  // 仅高峰期
  if (/高峰/.test(type)) return '3';
  // 进京证类(六环内) → aa=5
  if (/进京证/.test(type)) return '5';
  // 其余未知 → aa=2(按新增点位/高风险处理)
  return '2';
}

// 判断单条数据属于哪套数据源
function isNewSource(item) {
  return (
    item &&
    (item.Longitude !== undefined || item.Latitude !== undefined || item.CameraType !== undefined)
  );
}

function refineOld(item) {
  const info = AA_MAP[item.aa] || { risk: 0 };
  return [
    item.position[0],
    item.position[1],
    String(item.aa ?? ''),
    info.risk,
    item.href || '',
    item.name || '',
    extractDirection(item.name),
  ];
}

function refineNew(item) {
  const aa = newSourceToAa(item);
  const info = AA_MAP[aa] || { risk: 0 };
  const name = item.LocationDescript || item.RoadName || '';
  return [
    Number(item.Longitude),
    Number(item.Latitude),
    aa,
    info.risk,
    item.Id ? `/content/?id=${item.Id}` : '',
    name,
    extractDirection(name),
  ];
}

function processData() {
  console.log('🚀 开始精炼数据...');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ 找不到 ${INPUT_FILE}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  if (!Array.isArray(data) || data.length === 0) {
    console.error('❌ data.json 为空或格式错误');
    process.exit(1);
  }

  const useNew = isNewSource(data[0]);
  console.log(`📊 数据源: ${useNew ? '新 API 源' : 'jinjing365 旧源'}，原始 ${data.length} 条`);

  const refined = data
    .map((item) => {
      try {
        return useNew ? refineNew(item) : refineOld(item);
      } catch {
        return null;
      }
    })
    .filter((row) => row && Number.isFinite(row[0]) && Number.isFinite(row[1]));

  const output = {
    updatedAt: new Date().toISOString(),
    source: useNew ? 'api' : 'jinjing',
    points: refined,
  };

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));
  console.log(`✅ 处理完成 ${refined.length} 条，输出: ${OUTPUT_FILE}`);
}

processData();

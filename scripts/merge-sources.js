// 北京避让导航双源合并与消歧引擎
// 主数据源 (jjz365.cn) 为基准，辅助源 (jinjing365.com) 做 35m 空间邻近消歧与遗漏补充
// 产生 data.json 与 src/lib/refined-data.json

const fs = require('fs');
const path = require('path');

const DATA_JSON_FILE = path.join(__dirname, '..', 'data.json');
const REFINED_JSON_FILE = path.join(__dirname, '..', 'src', 'lib', 'refined-data.json');

// 图标与风险等级定义 (依据交通管控严格度)
const AA_CONFIG = {
  '1': { label: '其他监控', risk: 2 },
  '2': { label: '新增/实锤点位', risk: 3 },
  '3': { label: '仅高峰期/顺义区', risk: 2 },
  '4': { label: '失效/已拆除(不拍)', risk: 0 },
  '5': { label: '六环内(未办证+高峰)', risk: 3 },
  '6': { label: '六环外(六环外证即可)', risk: 1 },
};

// 提取方向信息 [西向东]、进京、出京等
function extractDirection(text) {
  if (!text) return null;
  const pattern = /(西向东|东向西|南向北|北向南|进京|出京|双向|由[东西南北]向[东西南北])/;
  const match = text.match(pattern);
  return match ? match[0] : null;
}

// 检查是否包含废除/已拆除/停拍关键词
function isDiscarded(text, cameraType) {
  const combined = `${text || ''} ${cameraType || ''}`;
  return /已拆除|拆除|停拍|失效|不处罚|暂停抓拍|不拍/.test(combined);
}

// 将主源 (jjz365.cn) 点位归一化
function normalizePrimaryPoint(item) {
  const lng = Number(item.Lng);
  const lat = Number(item.Lat);
  const address = (item.Address || '').trim();
  const cameraType = (item.CameraType || '').trim();
  const isSixRingOut = String(item.IsSixRingOut) === '1';
  const picCount = Number(item.PicCount) || 0;
  const isNew = Boolean(item.IsNew);
  const discarded = isDiscarded(address, cameraType);

  let aa = '2';
  if (discarded) {
    aa = '4';
  } else if (isSixRingOut) {
    aa = '6';
  } else if (
    cameraType.includes('进京证') &&
    (cameraType.includes('高峰') || cameraType.includes('早晩'))
  ) {
    // 既拍进京证又拍早晚高峰 -> 蓝红双拼水滴 (5.png)
    aa = '5';
  } else if (cameraType.includes('高峰')) {
    // 仅拍早晚高峰 -> 蓝色水滴 (1.png)
    aa = '1';
  } else {
    // 常规拍进京证 -> 经典红色水滴 (2.png)
    aa = '2';
  }

  const detailHref = item.Id
    ? `https://www.jjz365.cn/XMap/ToDiscuss/${item.Id}`
    : '';

  return {
    id: item.Id || `pri_${lng.toFixed(5)}_${lat.toFixed(5)}`,
    name: address,
    position: [lng, lat],
    aa,
    risk: AA_CONFIG[aa]?.risk ?? 2,
    href: detailHref,
    isSixRingOut: isSixRingOut ? '1' : '0',
    cameraType,
    picCount,
    source: 'primary',
    direction: extractDirection(address),
  };
}

// 将辅助源 (jinjing365.com) 点位归一化
function normalizeSecondaryPoint(item) {
  const lng = Number(item.position[0]);
  const lat = Number(item.position[1]);
  const name = (item.name || '').trim();
  const rawAa = String(item.aa ?? '');
  const discarded = rawAa === '4' || isDiscarded(name, '');
  const isSixRingOut = rawAa === '6' || /【六环外】/.test(name);

  let aa = rawAa;
  if (discarded) {
    aa = '4';
  } else if (isSixRingOut) {
    aa = '6';
  } else if (!AA_CONFIG[aa]) {
    aa = '1';
  }

  let detailHref = '';
  if (item.href) {
    detailHref = item.href.startsWith('http')
      ? item.href
      : `https://www.jinjing365.com/wap${item.href.startsWith('/') ? '' : '/'}${item.href}`;
  }

  return {
    id: `sec_${lng.toFixed(5)}_${lat.toFixed(5)}`,
    name,
    position: [lng, lat],
    aa,
    risk: AA_CONFIG[aa]?.risk ?? 2,
    href: detailHref,
    isSixRingOut: isSixRingOut ? '1' : '0',
    cameraType: isSixRingOut ? '六环外进京证' : '六环内进京证',
    picCount: 0,
    source: 'secondary',
    direction: extractDirection(name),
  };
}

// 空间距离计算 (米，北京经纬度下局部球面拟合)
function getDistanceMeters(lng1, lat1, lng2, lat2) {
  const dLat = (lat1 - lat2) * 111320;
  const dLng = (lng1 - lng2) * 85270;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// 空间网格分桶消歧去重合并
function mergeCameraSources(primaryList, secondaryList) {
  const merged = [];
  const primaryNormalized = [];

  // 1. 规范化并全量载入主源
  for (const item of primaryList) {
    const p = normalizePrimaryPoint(item);
    if (!isNaN(p.position[0]) && !isNaN(p.position[1]) && p.position[0] > 0) {
      primaryNormalized.push(p);
      merged.push(p);
    }
  }

  // 2. 构建主源空间网格索引 (格宽约 50 米: 经度 0.0006，纬度 0.00045)
  const grid = new Map();
  const getGridKey = (lng, lat) =>
    `${Math.floor(lng / 0.0006)}_${Math.floor(lat / 0.00045)}`;

  for (const p of primaryNormalized) {
    const key = getGridKey(p.position[0], p.position[1]);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(p);
  }

  // 3. 遍历辅助源，在 35 米范围内检索消歧
  const DEDUPE_RADIUS_METERS = 35;
  let dedupeCount = 0;
  let supplementalCount = 0;

  for (const sec of secondaryList) {
    const p = normalizeSecondaryPoint(sec);
    const [lng, lat] = p.position;
    if (isNaN(lng) || isNaN(lat) || lng <= 0) continue;

    // 检查中心及周边 9 个网格
    const gx = Math.floor(lng / 0.0006);
    const gy = Math.floor(lat / 0.00045);
    let matchedInPrimary = false;

    for (let dx = -1; dx <= 1 && !matchedInPrimary; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = grid.get(`${gx + dx}_${gy + dy}`);
        if (!bucket) continue;
        for (const candidate of bucket) {
          const dist = getDistanceMeters(lng, lat, candidate.position[0], candidate.position[1]);
          if (dist <= DEDUPE_RADIUS_METERS) {
            matchedInPrimary = true;
            break;
          }
        }
        if (matchedInPrimary) break;
      }
    }

    if (matchedInPrimary) {
      dedupeCount++;
    } else {
      // 辅助源独有点位，补充合入
      supplementalCount++;
      merged.push(p);
    }
  }

  return {
    merged,
    primaryCount: primaryNormalized.length,
    secondaryTotal: secondaryList.length,
    dedupeCount,
    supplementalCount,
  };
}

// 执行合并并输出文件
function runMergeAndSerialize(primaryList, secondaryList) {
  console.log('🔄 开始执行主辅双源空间拓扑合并...');
  const { merged, primaryCount, secondaryTotal, dedupeCount, supplementalCount } =
    mergeCameraSources(primaryList, secondaryList);

  console.log(`📊 数据合并统计看板:`);
  console.log(`   - 主源有效点位: ${primaryCount} 处`);
  console.log(`   - 辅源总点位数: ${secondaryTotal} 处`);
  console.log(`   - 空间消歧去重: ${dedupeCount} 处 (采用主源高精度坐标)`);
  console.log(`   - 辅源成功补漏: ${supplementalCount} 处 (防止冷门点遗漏)`);
  console.log(`   - 最终全景总数: ${merged.length} 处`);

  // 1. 写入 data.json
  fs.writeFileSync(DATA_JSON_FILE, JSON.stringify(merged), 'utf-8');
  console.log(`💾 已保存全量数据至: ${DATA_JSON_FILE}`);

  // 2. 导出前端专用七元组 refined-data.json
  // [lng, lat, aa, risk, href, name, direction, picCount]
  const refined = {
    updatedAt: new Date().toISOString().split('T')[0],
    total: merged.length,
    points: merged.map((p) => [
      p.position[0],
      p.position[1],
      p.aa,
      p.risk,
      p.href,
      p.name,
      p.direction,
      p.picCount || 0,
    ]),
  };

  fs.writeFileSync(REFINED_JSON_FILE, JSON.stringify(refined), 'utf-8');
  console.log(`🚀 已生成前端精炼七元组至: ${REFINED_JSON_FILE}`);

  return { total: merged.length, diff: supplementalCount };
}

module.exports = {
  mergeCameraSources,
  runMergeAndSerialize,
  normalizePrimaryPoint,
  normalizeSecondaryPoint,
};

// 北京避让导航双源合并与空间语义消歧引擎
// 主数据源 (jjz365.cn) 为基准，辅助源 (jinjing365.com) 做多层次空间与语义消歧补充
// 产生 data.json 与 src/lib/refined-data.json

const fs = require('fs');
const path = require('path');

const DATA_JSON_FILE = path.join(__dirname, '..', 'data.json');
const REFINED_JSON_FILE = path.join(__dirname, '..', 'src', 'lib', 'refined-data.json');

// 图标与风险等级定义
const AA_CONFIG = {
  '1': { label: '其他监控', risk: 2 },
  '2': { label: '新增/实锤点位', risk: 3 },
  '3': { label: '仅高峰期/顺义区', risk: 2 },
  '4': { label: '失效/已拆除(不拍)', risk: 0 },
  '5': { label: '六环内(未办证+高峰)', risk: 3 },
  '6': { label: '六环外(六环外证即可)', risk: 1 },
};

// 清除不可见字符与零宽空格
function cleanZeroWidth(str) {
  return (str || '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
}

// 提取并归一化方向
function extractDirection(text) {
  if (!text) return null;
  const cleaned = cleanZeroWidth(text);
  const match = cleaned.match(/(由?[东西南北]向[东西南北]|进京|出京|南北双向|东西双向|双向)/);
  if (!match) return null;
  let dir = match[0];
  if (dir.startsWith('由')) dir = dir.slice(1);
  if (dir === '南北双向' || dir === '东西双向') dir = '双向';
  return dir;
}

// 方向兼容性判定：若方向垂直或相反则互斥，不可合并；若一方未标或一致或双向则兼容
function isDirectionCompatible(dir1, dir2) {
  if (!dir1 || !dir2) return true;
  if (dir1 === dir2) return true;
  if (dir1 === '双向' || dir2 === '双向') return true;
  return false;
}

// 主路 vs 辅路 属性互斥判定：若一明确只拍主路，另一明确只拍辅路，则为两个物理独立探头，绝不可合并
function hasRoadTypeConflict(n1, n2) {
  const isBoth1 = /主\+?辅路|主辅路/.test(n1);
  const isBoth2 = /主\+?辅路|主辅路/.test(n2);
  if (isBoth1 || isBoth2) return false;

  const isMain1 = /主路/.test(n1);
  const isAux1 = /辅路/.test(n1);
  const isMain2 = /主路/.test(n2);
  const isAux2 = /辅路/.test(n2);

  return (isMain1 && isAux2) || (isAux1 && isMain2);
}

// 检查是否包含废除/已拆除/停拍关键词
function isDiscarded(text, cameraType) {
  const combined = `${text || ''} ${cameraType || ''}`;
  return /已拆除|拆除|停拍|失效|不处罚|暂停抓拍|不拍/.test(combined);
}

// 提取地名核心（去除行政区划前缀、方括号、圆括号、方向词及标点符号）
function cleanLocationName(name) {
  if (!name) return '';
  return cleanZeroWidth(name)
    .replace(/【.*?】/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/（.*?）/g, '')
    .replace(/(由?[东西南北]向[东西南北]|进京|出京|南北双向|东西双向|双向)/g, '')
    .replace(/^(北京市?|海淀区?|朝阳区?|昌平区?|大兴区?|丰台区?|通州区?|顺义区?|西城区?|东城区?|石景山区?|房山区?|门头沟区?|平谷区?|怀柔区?|密云区?|延庆区?)/g, '')
    .replace(/[\s\-_,，。、\/]/g, '')
    .toLowerCase();
}

// 地名语义相似度快速比对
function isNameSimilar(n1, n2) {
  const c1 = cleanLocationName(n1);
  const c2 = cleanLocationName(n2);
  if (!c1 || !c2) return false;
  if (c1 === c2) return true;
  const minLen = Math.min(c1.length, c2.length);
  if (minLen >= 5 && (c1.includes(c2) || c2.includes(c1))) return true;
  return false;
}

// 空间距离计算 (米，北京经纬度下局部球面拟合)
function getDistanceMeters(lng1, lat1, lng2, lat2) {
  const dLat = (lat1 - lat2) * 111320;
  const dLng = (lng1 - lng2) * 85270;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// 将主源 (jjz365.cn) 点位归一化
function normalizePrimaryPoint(item) {
  const lng = Number(item.Lng);
  const lat = Number(item.Lat);
  const address = cleanZeroWidth(item.Address || '');
  const cameraType = cleanZeroWidth(item.CameraType || '');
  const isSixRingOut = String(item.IsSixRingOut) === '1';
  const picCount = Number(item.PicCount) || 0;
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
    aa = '5';
  } else if (cameraType.includes('高峰')) {
    aa = '1';
  } else {
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
  const name = cleanZeroWidth(item.name || '');
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

// 双源空间网格分桶消歧去重合并
function mergeCameraSources(primaryList, secondaryList) {
  const CELL_SIZE = 0.002; // 网格大小约为 170m-220m
  const getGridKey = (lng, lat) => `${Math.floor(lng / CELL_SIZE)}_${Math.floor(lat / CELL_SIZE)}`;

  // 1. 规范化主源点位
  const primaryNormalized = [];
  for (const item of primaryList) {
    const p = normalizePrimaryPoint(item);
    if (!isNaN(p.position[0]) && !isNaN(p.position[1]) && p.position[0] > 0) {
      primaryNormalized.push(p);
    }
  }

  // 2. 主源内部严格消歧（仅去除坐标极近 <=20m、同名同向且无主辅路/车道区分的纯录入重复点）
  const primaryDedupled = [];
  const primaryGrid = new Map();
  let primaryInternalDedupeCount = 0;

  for (const p of primaryNormalized) {
    const [lng, lat] = p.position;
    const gx = Math.floor(lng / CELL_SIZE);
    const gy = Math.floor(lat / CELL_SIZE);
    let matched = false;

    for (let dx = -1; dx <= 1 && !matched; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const bucket = primaryGrid.get(`${gx + dx}_${gy + dy}`);
        if (!bucket) continue;
        for (const exist of bucket) {
          const dist = getDistanceMeters(lng, lat, exist.position[0], exist.position[1]);
          // 超近距离且无主辅路冲突且朝向兼容
          if (dist <= 20 && isDirectionCompatible(p.direction, exist.direction)) {
            if (hasRoadTypeConflict(p.name, exist.name)) continue;
            // 细分车道标识（如左侧/右侧）不可合并
            if (/(左侧|右侧|第[一二三四1234]车道)/.test(p.name) || /(左侧|右侧|第[一二三四1234]车道)/.test(exist.name)) {
              if (p.name !== exist.name) continue;
            }

            const c1 = cleanLocationName(p.name);
            const c2 = cleanLocationName(exist.name);
            if (c1 === c2) {
              matched = true;
              if ((p.picCount || 0) > (exist.picCount || 0)) {
                exist.picCount = p.picCount;
                exist.href = p.href;
              }
              break;
            }
          }
        }
        if (matched) break;
      }
    }

    if (matched) {
      primaryInternalDedupeCount++;
    } else {
      primaryDedupled.push(p);
      const key = getGridKey(lng, lat);
      if (!primaryGrid.has(key)) primaryGrid.set(key, []);
      primaryGrid.get(key).push(p);
    }
  }

  // 3. 辅助源多层次空间与语义消歧匹配（主源为绝对基准）
  const merged = [...primaryDedupled];
  let secondaryDedupeCount = 0;
  let secondarySupplementalCount = 0;

  for (const sec of secondaryList) {
    const p = normalizeSecondaryPoint(sec);
    const [lng, lat] = p.position;
    if (isNaN(lng) || isNaN(lat) || lng <= 0) continue;

    const gx = Math.floor(lng / CELL_SIZE);
    const gy = Math.floor(lat / CELL_SIZE);
    let matchedInPrimary = false;

    // 搜索周围 25 格（覆盖半径约 250m）
    for (let dx = -2; dx <= 2 && !matchedInPrimary; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const bucket = primaryGrid.get(`${gx + dx}_${gy + dy}`);
        if (!bucket) continue;
        for (const candidate of bucket) {
          const dist = getDistanceMeters(lng, lat, candidate.position[0], candidate.position[1]);
          if (dist > 250) continue;

          // 核心防御 1：方向明确互斥时绝不消歧（保护十字路口不同朝向抓拍点）
          if (!isDirectionCompatible(p.direction, candidate.direction)) continue;

          // 核心防御 2：主路与辅路明确互斥时绝不消歧（保护主辅路物理隔离探头）
          if (hasRoadTypeConflict(p.name, candidate.name)) continue;

          // 层级 1: 超近距离 (<= 35米) 且方向、路况不冲突
          if (dist <= 35) {
            matchedInPrimary = true;
            break;
          }

          // 层级 2: 近距离 (35米-150米)，地名核心相似且方向、路况不冲突（解决跨源定位漂移）
          if (dist <= 150 && isNameSimilar(p.name, candidate.name)) {
            matchedInPrimary = true;
            break;
          }

          // 层级 3: 扩展距离 (150米-250米)，地名核心完全一致且方向、路况不冲突
          if (dist <= 250) {
            const c1 = cleanLocationName(p.name);
            const c2 = cleanLocationName(candidate.name);
            if (c1.length >= 6 && c1 === c2) {
              matchedInPrimary = true;
              break;
            }
          }
        }
        if (matchedInPrimary) break;
      }
    }

    if (matchedInPrimary) {
      secondaryDedupeCount++;
    } else {
      secondarySupplementalCount++;
      merged.push(p);
    }
  }

  return {
    merged,
    primaryRawCount: primaryList.length,
    primaryValidCount: primaryDedupled.length,
    primaryInternalDedupeCount,
    secondaryTotal: secondaryList.length,
    secondaryDedupeCount,
    secondarySupplementalCount,
  };
}

// 执行合并并输出文件
function runMergeAndSerialize(primaryList, secondaryList) {
  console.log('🔄 开始执行主辅双源空间拓扑合并...');
  const stats = mergeCameraSources(primaryList, secondaryList);
  const { merged } = stats;

  console.log('📊 数据合并统计看板:');
  console.log(`   - 主源有效点位: ${stats.primaryValidCount} 处 (内部消歧 ${stats.primaryInternalDedupeCount} 处)`);
  console.log(`   - 辅源总点位数: ${stats.secondaryTotal} 处`);
  console.log(`   - 空间语义消歧: ${stats.secondaryDedupeCount} 处 (优先采纳主源高精坐标与实景讨论)`);
  console.log(`   - 辅源成功补漏: ${stats.secondarySupplementalCount} 处 (防止冷门点遗漏)`);
  console.log(`   - 最终全景总数: ${merged.length} 处`);

  // 1. 写入全量 data.json
  fs.writeFileSync(DATA_JSON_FILE, JSON.stringify(merged), 'utf-8');
  console.log(`💾 已保存全量数据至: ${DATA_JSON_FILE}`);

  // 2. 导出前端专用七元组 refined-data.json
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

  return { total: merged.length, diff: stats.secondarySupplementalCount };
}

module.exports = {
  mergeCameraSources,
  runMergeAndSerialize,
  normalizePrimaryPoint,
  normalizeSecondaryPoint,
  extractDirection,
  cleanLocationName,
  isNameSimilar,
  isDirectionCompatible,
  hasRoadTypeConflict,
};

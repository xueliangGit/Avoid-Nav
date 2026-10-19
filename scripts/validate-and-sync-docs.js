// 校验数据完整性并自动同步 README.md 点位计数
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');
const README_FILE = path.join(__dirname, '..', 'README.md');
const CHANGELOG_FILE = path.join(__dirname, '..', 'src', 'lib', 'changelog.ts');
const MIN_SAFE_COUNT = 5000; // 熔断保护阈值：点位数低于此值视为源站异常

function getBeijingDateStr() {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const bj = new Date(utc + 3600000 * 8);
  const year = bj.getFullYear();
  const month = String(bj.getMonth() + 1).padStart(2, '0');
  const day = String(bj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const { execSync } = require('child_process');

function getDiffPoints(currentList) {
  try {
    const oldRaw = execSync('git show HEAD:data.json', {
      encoding: 'utf-8',
      maxBuffer: 15 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const oldList = JSON.parse(oldRaw);
    if (!Array.isArray(oldList)) return [];
    const oldNames = new Set(oldList.map((p) => p.name || p.Address || ''));
    return currentList.filter((p) => {
      const name = p.name || p.Address;
      return name && !oldNames.has(name);
    });
  } catch {
    return [];
  }
}

function syncChangelog(count, formattedCount, currentList) {
  if (!fs.existsSync(CHANGELOG_FILE)) return [];
  let content = fs.readFileSync(CHANGELOG_FILE, 'utf-8');

  // 正则寻找最近一条数据更新记录的点位数
  const prevMatch = content.match(/监控点位总数刷新至\s*([0-9,]+)\s*处/);
  let prevCount = null;
  if (prevMatch) {
    prevCount = parseInt(prevMatch[1].replace(/,/g, ''), 10);
  }

  // 若最新记录的点位数与当前一致，说明已记录，跳过
  if (prevCount === count) {
    console.log(`ℹ️ changelog.ts 中最新记录已为 ${formattedCount} 处，无需重复写入`);
    return [];
  }

  const todayStr = getBeijingDateStr();
  let diffStr = '';
  if (prevCount !== null) {
    const diff = count - prevCount;
    if (diff > 0) diffStr = `（净增 ${diff} 处）`;
    else if (diff < 0) diffStr = `（净减 ${Math.abs(diff)} 处）`;
  }

  // 提取本次新增点位列表
  const newPoints = getDiffPoints(currentList);
  const details = [`'监控点位总数刷新至 ${formattedCount} 处${diffStr}。'`];

  if (newPoints.length > 0) {
    const names = newPoints.map((p) => p.name);
    // 前 8 个点位详细列出，过多则折叠提示
    const previewNames = names.slice(0, 8);
    const pointListStr = previewNames.map((n) => `“${n}”`).join('、');
    if (names.length > 8) {
      details.push(`'新增点位：${pointListStr} 等共 ${names.length} 处。'`);
    } else {
      details.push(`'新增点位：${pointListStr}。'`);
    }
    details.push(`'增补进京主要干道与六环周边最新管控监控点位。'`);
  } else {
    details.push(`'增补进京主要干道与六环周边最新管控监控点位。'`);
  }

  const formattedDetails = details.map((d) => `      ${d},`).join('\n');

  const newItem = `  {
    version: '数据更新',
    date: '${todayStr}',
    title: '最新进京证与限行监控点位刷新',
    type: 'data',
    details: [
${formattedDetails}
    ],
  },
`;

  const marker = 'export const CHANGELOG_LIST: ChangelogItem[] = [\n';
  if (content.includes(marker)) {
    content = content.replace(marker, marker + newItem);
    fs.writeFileSync(CHANGELOG_FILE, content, 'utf-8');
    console.log(`✅ 已自动向 changelog.ts 插入 ${formattedCount} 处详细数据更新日志`);
  }

  return newPoints;
}

function main() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error('❌ 未找到 data.json 文件');
    process.exit(1);
  }

  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  let list;
  try {
    list = JSON.parse(raw);
  } catch (error) {
    console.error('❌ data.json 格式损坏:', error.message);
    process.exit(1);
  }

  if (!Array.isArray(list) || list.length < MIN_SAFE_COUNT) {
    console.error(`🚨 触发熔断保护：点位数量 (${list ? list.length : 0}) 低于安全阈值 (${MIN_SAFE_COUNT})，拒绝同步更新！`);
    process.exit(1);
  }

  const count = list.length;
  const formattedCount = count.toLocaleString('en-US');
  console.log(`✅ 数据量校验通过：当前共有 ${formattedCount} 处有效点位`);

  if (fs.existsSync(README_FILE)) {
    let readme = fs.readFileSync(README_FILE, 'utf-8');
    const regex = /(- \*\*数据源与点位\*\*：内置 )([0-9,]+)( 处最新北京监控点位)/;
    if (regex.test(readme)) {
      readme = readme.replace(regex, `$1${formattedCount}$3`);
      fs.writeFileSync(README_FILE, readme, 'utf-8');
      console.log(`✅ 已同步更新 README.md 点位数为 ${formattedCount} 处`);
    }
  }

  const newPoints = syncChangelog(count, formattedCount, list);

  // 持久化保存本次新增的点位清单供钉钉通知使用
  const newPointsFile = path.join(__dirname, '..', '.new-points.json');
  fs.writeFileSync(newPointsFile, JSON.stringify(newPoints || []), 'utf-8');

  // 若处于 GitHub Actions 环境，向环境输出变量
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `count=${formattedCount}\nraw_count=${count}\nnew_count=${(newPoints || []).length}\n`,
    );
  }
}

main();

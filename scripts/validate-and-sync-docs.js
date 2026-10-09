// 校验数据完整性并自动同步 README.md 点位计数
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data.json');
const README_FILE = path.join(__dirname, '..', 'README.md');
const MIN_SAFE_COUNT = 5000; // 熔断保护阈值：点位数低于此值视为源站异常

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

  // 若处于 GitHub Actions 环境，向环境输出变量
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `count=${formattedCount}\nraw_count=${count}\n`);
  }
}

main();

// 北京避让导航数据预处理脚本
// 把根目录的 data.json (RawData[]) 转成 src/lib/refined-data.json (压缩数组格式)
// build 前自动运行，产物不进库

const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, '..', 'data.json');
const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'lib', 'refined-data.json');

const AA_MAP = {
  '2': { label: '未办证/限行监控', risk: 3, color: 'red' },
  '1': { label: '高峰期监控/顺义', risk: 2, color: 'blue' },
  '3': { label: '低风险/个别', risk: 1, color: 'orange' },
  '6': { label: '六环外进京证区域', risk: 1, color: 'purple' },
};

function extractDirection(name) {
  const pattern = /(西向东|东向西|南向北|北向南|进京|出京|双向|由[东西南北]向[东西南北])/;
  const match = name.match(pattern);
  return match ? match[0] : null;
}

function processData() {
  console.log('🚀 开始精炼数据...');

  if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ 找不到 ${INPUT_FILE}`);
    process.exit(1);
  }

  const rawContent = fs.readFileSync(INPUT_FILE, 'utf-8');
  const data = JSON.parse(rawContent);

  console.log(`📊 原始数据量: ${data.length} 条`);

  const refined = data.map((item) => {
    const info = AA_MAP[item.aa] || { label: '未知', risk: 0, color: 'gray' };
    return [
      item.position[0],
      item.position[1],
      item.aa,
      info.risk,
      item.href,
      item.name,
      extractDirection(item.name),
    ];
  });

  const output = {
    updatedAt: new Date().toISOString(),
    points: refined,
  };

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));
  console.log(`✅ 处理完成，输出: ${OUTPUT_FILE}`);
}

processData();

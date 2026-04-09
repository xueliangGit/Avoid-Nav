import * as fs from 'fs';
import * as path from 'path';

/**
 * 北京避让导航数据预处理脚本
 * 目标：将 11w 行冗余数据转换为前端高性能渲染格式
 */

interface RawData {
  name: string;
  position: [number, number];
  aa: string;
  [key: string]: any;
}

const INPUT_FILE = path.join(__dirname, '../data.json');
const OUTPUT_FILE = path.join(__dirname, '../src/lib/refined-data.json');

// 根据用户提供的业务逻辑定义映射表
const AA_MAP: Record<string, { label: string; risk: number; color: string }> = {
  '2': { label: '未办证/限行监控', risk: 3, color: 'red' },      // 红色图标
  '1': { label: '高峰期监控/顺义', risk: 2, color: 'blue' },     // 蓝色图标
  '3': { label: '低风险/个别', risk: 1, color: 'orange' },    // 橙色图标
  '6': { label: '六环外进京证区域', risk: 1, color: 'purple' },  // 紫色图标
};

async function processData() {
  console.log('🚀 开始精炼数据...');
  
  if (!fs.existsSync(INPUT_FILE)) {
    console.error('❌ 找不到 data.json，请确保文件位于项目根目录');
    process.exit(1);
  }

  const rawContent = fs.readFileSync(INPUT_FILE, 'utf-8');
  let data: RawData[] = JSON.parse(rawContent);

  console.log(`📊 原始数据量: ${data.length} 条`);

  // 1. 过滤掉不完整的点，并提取核心字段
  const refined = data.map(item => {
    const info = AA_MAP[item.aa] || { label: '未知', risk: 0, color: 'gray' };
    return [
        item.position[0], // 经度
        item.position[1], // 纬度
        item.aa,          // 原类型 ID
        info.risk         // 风险等级 (1-3)
    ];
  });

  // 2. 导出为压缩格式 [lng, lat, type, risk][]
  // 这种 [][], 而不是 [{}, {}] 的格式能大幅减少冗余的 Key 字符串
  const output = {
    updatedAt: new Date().toISOString(),
    points: refined
  };

  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output));

  console.log(`✅ 处理完成！已保存至: ${OUTPUT_FILE}`);
  console.log(`📉 数据已从冗余格式压缩为轻量化数组格式。`);
}

processData().catch(err => {
    console.error('❌ 处理出错:', err);
    process.exit(1);
});

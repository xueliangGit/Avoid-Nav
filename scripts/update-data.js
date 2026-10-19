// 北京避让导航全量数据更新入口脚本
// 依次拉取主数据源 (jjz365.cn) 与辅数据源 (jinjing365.com) 并调用空间消歧合并引擎

const { fetchPrimaryData } = require('./fetch-primary');
const { fetchSecondaryData } = require('./fetch-jinjing');
const { runMergeAndSerialize } = require('./merge-sources');

async function main() {
  console.log('🏁 开始执行全量监控点位数据更新工作流...');

  // 1. 拉取主数据源 (核心)
  let primaryList = [];
  try {
    console.log('📡 正在拉取主数据源 (jjz365.cn)...');
    primaryList = await fetchPrimaryData();
    console.log(`✅ 主数据源获取成功，共 ${primaryList.length} 条记录`);
  } catch (err) {
    console.error(`❌ 主数据源获取失败: ${err.message}`);
    process.exit(1);
  }

  // 2. 拉取辅助数据源 (补充遗漏与容灾)
  let secondaryList = [];
  try {
    console.log('🌐 正在拉取辅助数据源 (jinjing365.com)...');
    secondaryList = await fetchSecondaryData();
    console.log(`✅ 辅助数据源获取成功，共 ${secondaryList.length} 条记录`);
  } catch (err) {
    console.warn(`⚠️ 辅助数据源拉取异常: ${err.message}，将降级仅使用主源数据`);
    secondaryList = [];
  }

  // 3. 执行空间消歧与合并
  const result = runMergeAndSerialize(primaryList, secondaryList);
  console.log(`🎉 监控数据全量更新完毕！总计生效点位: ${result.total} 处`);
}

main().catch((err) => {
  console.error('❌ 数据更新工作流异常终止:', err);
  process.exit(1);
});

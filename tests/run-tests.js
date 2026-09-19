// 纯逻辑测试入口：node tests/run-tests.js
import { run, assert } from './harness.js';
import './geometry.test.js';
import './graph.test.js';
import './history.test.js';
import './validate.test.js';
import './clipboard.test.js';

const failures = run();
if (failures > 0) {
  console.error(`\n${failures} 个测试失败`);
  process.exit(1);
}
console.log('\n全部通过 ✔');

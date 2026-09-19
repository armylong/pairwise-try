let cases = [];

export function test(name, fn) {
  cases.push({ name, fn });
}

export function assert(condition, message) {
  if (!condition) throw new Error(message || '断言失败');
}

export function assertEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${message || '值不相等'}\n  期望: ${b}\n  实际: ${a}`);
  }
}

export function run() {
  let failures = 0;
  for (const { name, fn } of cases) {
    try {
      fn();
      console.log(`  ✔ ${name}`);
    } catch (error) {
      failures += 1;
      console.error(`  ✘ ${name}`);
      console.error(`    ${error.message}`);
    }
  }
  console.log(`\n${cases.length - failures}/${cases.length} 通过`);
  return failures;
}

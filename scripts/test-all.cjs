const { spawnSync } = require('node:child_process');
const path = require('node:path');
const cwd = path.resolve(__dirname, '..');
for (const runtime of ['userscript', 'firefox']) {
  console.log(`\nTesting ${runtime}`);
  const result = spawnSync(process.execPath, ['--test', 'tests/userscript.test.cjs'], {
    cwd, stdio: 'inherit', env: { ...process.env, HIT_TEST_RUNTIME: runtime }
  });
  if (result.status !== 0) process.exit(result.status || 1);
}
const result = spawnSync(process.execPath, ['--test', 'tests/firefox-extension.test.cjs'], { cwd, stdio: 'inherit' });
process.exit(result.status || (result.error ? 1 : 0));

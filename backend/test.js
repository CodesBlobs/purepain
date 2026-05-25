#!/usr/bin/env node
// Runs the full integration test suite against a running server.
// Usage: node test.js [base_url]
//   base_url defaults to http://localhost:3000

const BASE = process.argv[2] || 'http://localhost:3000';

const RESET = '\x1b[0m';
const GREEN = '\x1b[32m';
const RED   = '\x1b[31m';
const BOLD  = '\x1b[1m';
const DIM   = '\x1b[2m';
const YELLOW = '\x1b[33m';

async function main() {
  console.log(`\n${BOLD}PurePain Integration Tests${RESET}`);
  console.log(`${DIM}Target: ${BASE}${RESET}\n`);

  // Health check first
  let healthOk = false;
  try {
    const r = await fetch(`${BASE}/api/agent/health`);
    const data = await r.json();
    if (data.status === 'ok') {
      healthOk = true;
      console.log(`${GREEN}✓${RESET} Server healthy (uptime ${data.uptime_seconds}s, db ${data.db})\n`);
    }
  } catch (err) {
    console.error(`${RED}✗ Cannot reach server at ${BASE}${RESET}`);
    console.error(`  ${err.message}\n`);
    process.exit(1);
  }

  if (!healthOk) {
    console.error(`${RED}✗ Server reports degraded status${RESET}\n`);
    process.exit(1);
  }

  // Run test suite
  console.log(`${BOLD}Running test suite…${RESET}`);
  const r = await fetch(`${BASE}/api/agent/run-tests`, { method: 'POST' });
  const data = await r.json();

  const groups = {};
  for (const result of data.results) {
    const [group, ...rest] = result.name.split('.');
    if (!groups[group]) groups[group] = [];
    groups[group].push({ ...result, short: rest.join('.') });
  }

  for (const [group, tests] of Object.entries(groups)) {
    const groupFailed = tests.some(t => t.status === 'fail');
    console.log(`\n  ${BOLD}${group}${RESET}${groupFailed ? ` ${RED}(failures)${RESET}` : ''}`);
    for (const t of tests) {
      if (t.status === 'pass') {
        const detail = t.detail ? ` ${DIM}(${t.detail})${RESET}` : '';
        console.log(`    ${GREEN}✓${RESET} ${t.short}${detail}`);
      } else {
        console.log(`    ${RED}✗${RESET} ${t.short}`);
        console.log(`      ${DIM}${t.error}${RESET}`);
      }
    }
  }

  const { summary } = data;
  console.log(`\n${'─'.repeat(50)}`);
  const badge = summary.all_passed ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`${BOLD}${badge}${RESET}  ${summary.passed}/${summary.total} passed`);
  if (summary.failed > 0) {
    console.log(`${RED}      ${summary.failed} test(s) failed${RESET}`);
  }
  console.log();

  process.exit(summary.all_passed ? 0 : 1);
}

main().catch(err => {
  console.error(RED + 'Unexpected error: ' + err.message + RESET);
  process.exit(1);
});

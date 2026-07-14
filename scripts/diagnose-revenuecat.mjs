#!/usr/bin/env node
/**
 * Show what RevenueCat returns for the monentry_plans offering (uses public test_/appl_ key).
 */
import fs from 'node:fs';
import path from 'node:path';

const OFFERING_ID = 'monentry_plans';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) return {};
  const env = {};
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv();
const publicKey = env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
const secretKey = env.REVENUECAT_SECRET_API_KEY ?? '';

async function main() {
  console.log('Monentry — RevenueCat diagnosis');
  console.log('================================\n');

  if (!publicKey) {
    console.error('FAIL: EXPO_PUBLIC_REVENUECAT_IOS_API_KEY missing from .env');
    process.exit(1);
  }

  console.log(`Public key: ${publicKey.slice(0, 12)}… (${publicKey.startsWith('test_') ? 'Test Store' : 'App Store'})`);

  if (secretKey) {
    const v2 = await fetch('https://api.revenuecat.com/v2/projects', {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (v2.status === 403) {
      const body = await v2.json().catch(() => ({}));
      if (/legacy API key.*API v2/i.test(body.message ?? '')) {
        console.log('Secret key: legacy v1 — npm run configure-revenuecat will NOT work');
        console.log('  Fix: API keys → + New → Version V2 → project_configuration read/write\n');
      } else {
        console.log(`Secret key: v2 check failed (${v2.status})\n`);
      }
    } else if (v2.ok) {
      console.log('Secret key: v2 OK — run npm run configure-revenuecat\n');
    }
  } else {
    console.log('Secret key: not set (add REVENUECAT_SECRET_API_KEY for auto-configure)\n');
  }

  const res = await fetch('https://api.revenuecat.com/v1/subscribers/monentry_diag/offerings', {
    headers: {
      Authorization: `Bearer ${publicKey}`,
      'X-Platform': 'ios',
    },
  });

  if (!res.ok) {
    console.error(`FAIL: offerings API ${res.status}`, await res.text());
    process.exit(1);
  }

  const data = await res.json();
  const currentId = data.current_offering_id ?? '(none)';
  const offerings = data.offerings ?? [];

  console.log(`Current offering (dashboard): ${currentId}\n`);

  if (offerings.length === 0) {
    console.log('No offerings returned. Create monentry_plans in RevenueCat.');
    process.exit(1);
  }

  const target =
    offerings.find((o) => o.identifier === OFFERING_ID) ??
    offerings.find((o) => o.identifier === currentId) ??
    offerings[0];

  if (target.identifier !== OFFERING_ID) {
    console.log(`WARN: "${OFFERING_ID}" not found — checking "${target.identifier}" instead`);
    console.log(`      Create offering "${OFFERING_ID}" and mark it Current.\n`);
  }

  const packages = target.packages ?? [];
  console.log(`Offering "${target.identifier}" packages:\n`);

  if (packages.length === 0) {
    console.log('  (none) — add plus and family packages');
  } else {
    for (const pkg of packages) {
      const product = pkg.platform_product_identifier ?? '?';
      const legacy = ['monthly', 'yearly', 'lifetime'].includes(product);
      const flag = legacy ? ' ← legacy $9.99 template (app ignores)' : '';
      console.log(`  ${pkg.identifier} → ${product}${flag}`);
    }
  }

  const hasPlus = packages.some((p) => p.platform_product_identifier === 'monentry_plus_monthly');
  const hasFamily = packages.some((p) => p.platform_product_identifier === 'monentry_family_monthly');

  console.log(`\nApp expects on offering "${OFFERING_ID}":`);
  console.log('  plus   → monentry_plus_monthly');
  console.log('  family → monentry_family_monthly');
  console.log('');

  if (hasPlus && hasFamily) {
    console.log('OK   Both products are in the offering. Reload the app (npm start -- --clear).');
    if (currentId !== OFFERING_ID) {
      console.log(`     Mark "${OFFERING_ID}" as Current in RevenueCat (current is "${currentId}").`);
    }
    return;
  }

  console.log('FIX  Packages missing or wrong products.\n');
  console.log('Option A — auto (needs V2 secret key in .env):');
  console.log('  npm run configure-revenuecat\n');
  console.log('Option B — manual in RevenueCat dashboard:');
  console.log(`  Offerings → + New → identifier "${OFFERING_ID}" → mark Current`);
  console.log('  Add packages:');
  if (!hasPlus) {
    console.log('  • plus → monentry_plus_monthly');
  }
  if (!hasFamily) {
    console.log('  • family → monentry_family_monthly');
  }
  console.log('\nThen: npm start -- --clear and force-quit Monentry');
}

main().catch((error) => {
  console.error(`\nFAIL: ${error.message}`);
  process.exit(1);
});

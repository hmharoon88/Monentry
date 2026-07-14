#!/usr/bin/env node
/**
 * Copy EXPO_PUBLIC_* vars from .env into eas.json build profile env blocks.
 * Run before EAS cloud builds so TestFlight includes Firebase + RevenueCat keys.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envFile = path.join(root, '.env');
const easFile = path.join(root, 'eas.json');
const STORE_PROFILES = new Set(['production', 'testflight', 'preview']);

if (!fs.existsSync(envFile)) {
  console.error('Missing .env — copy .env.example and fill in keys.');
  process.exit(1);
}

if (!fs.existsSync(easFile)) {
  console.error('Missing eas.json');
  process.exit(1);
}

const envLines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
const envVars = {};

for (const line of envLines) {
  if (!line || line.startsWith('#')) {
    continue;
  }
  const idx = line.indexOf('=');
  if (idx <= 0) {
    continue;
  }
  const name = line.slice(0, idx).trim();
  if (!name.startsWith('EXPO_PUBLIC_')) {
    continue;
  }
  const value = line.slice(idx + 1).trim();
  if (value) {
    envVars[name] = value;
  }
}

const rcKey = envVars.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? '';
if (rcKey.startsWith('test_')) {
  console.warn('');
  console.warn('WARN: EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is a test_ key.');
  console.warn('      Store builds (TestFlight / App Store) need an appl_ key or billing stays disabled.');
  console.warn('      RevenueCat → Project → API keys → iOS public key');
  console.warn('');
}

const eas = JSON.parse(fs.readFileSync(easFile, 'utf8'));
const profiles = eas.build ?? {};
let updated = 0;

for (const profileName of Object.keys(profiles)) {
  const profile = profiles[profileName];
  if (!profile.env) {
    profile.env = {};
  }

  for (const [name, value] of Object.entries(envVars)) {
    if (profile.env[name] !== value) {
      profile.env[name] = value;
      updated += 1;
    }
  }

  if (STORE_PROFILES.has(profileName) && rcKey.startsWith('test_')) {
    console.warn(`WARN: ${profileName} profile will use test_ RevenueCat key from .env`);
  }
}

fs.writeFileSync(easFile, `${JSON.stringify(eas, null, 2)}\n`);
console.log(`Merged ${Object.keys(envVars).length} EXPO_PUBLIC vars into eas.json (${updated} updates).`);

if (STORE_PROFILES.has('production') && !rcKey) {
  console.error('');
  console.error('FAIL: EXPO_PUBLIC_REVENUECAT_IOS_API_KEY is missing from .env');
  console.error('      Add your appl_ key before building for TestFlight or App Store.');
  process.exit(1);
}

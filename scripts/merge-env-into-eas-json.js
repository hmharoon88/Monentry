#!/usr/bin/env node
/**
 * Secrets must NOT be written into eas.json (it is committed to git).
 * Use EAS Environment Variables instead:
 *
 *   bash scripts/sync-eas-env.sh
 *
 * Then EAS builds with "environment": "production" / "preview" receive the keys.
 * Local `expo start` still reads from .env.
 */
const path = require('path');

console.log('');
console.log('Monentry — secrets stay out of eas.json');
console.log('=======================================');
console.log('');
console.log('Do not paste Firebase / Google / RevenueCat keys into eas.json.');
console.log('GitHub will flag them as exposed secrets.');
console.log('');
console.log('Instead run:');
console.log('  bash scripts/sync-eas-env.sh');
console.log('');
console.log('That uploads EXPO_PUBLIC_* from .env to EAS.');
console.log('Store builds already use environment: production / preview.');
console.log('');
console.log(`Local .env is still used for: npm start (${path.join(__dirname, '..', '.env')})`);
console.log('');
process.exit(0);

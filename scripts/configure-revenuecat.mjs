#!/usr/bin/env node
/**
 * Wire Monentry Plus/Family products into RevenueCat monentry_plans offering via REST API.
 * Requires REVENUECAT_SECRET_API_KEY in .env (sk_… from RevenueCat → Project → API keys).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENV_FILE = path.join(ROOT, '.env');
const API = 'https://api.revenuecat.com/v2';

const PLUS_STORE_ID = 'monentry_plus_monthly';
const FAMILY_STORE_ID = 'monentry_family_monthly';
const OFFERING_KEY = 'monentry_plans';
const PLUS_PACKAGE_KEY = 'plus';
const FAMILY_PACKAGE_KEY = 'family';
const PLUS_ENTITLEMENT_KEYS = ['Monentry Pro', 'plus'];
const FAMILY_ENTITLEMENT_KEYS = ['family', 'Monentry Family'];

function loadEnv() {
  if (!fs.existsSync(ENV_FILE)) {
    return {};
  }
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

async function rc(method, urlPath, body) {
  const secret = process.env.REVENUECAT_SECRET_API_KEY ?? loadEnv().REVENUECAT_SECRET_API_KEY;
  if (!secret) {
    throw new Error(
      'Missing REVENUECAT_SECRET_API_KEY.\n' +
        'RevenueCat dashboard → Project settings → API keys → Secret key (sk_…)\n' +
        'Add to .env:\n  REVENUECAT_SECRET_API_KEY=sk_…',
    );
  }

  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (!res.ok) {
    const message = json?.message ?? json?.type ?? text ?? res.statusText;
    if (
      res.status === 403 &&
      /legacy API key.*API v2/i.test(String(message))
    ) {
      throw new Error(
        `${method} ${urlPath} failed (${res.status}): ${message}\n\n` +
          'Create a new V2 secret key:\n' +
          '  RevenueCat → Project settings → API keys → + New\n' +
          '  Version: V2 · Permissions: project_configuration (read/write)\n' +
          '  Update REVENUECAT_SECRET_API_KEY in .env and re-run npm run configure-revenuecat',
      );
    }
    throw new Error(`${method} ${urlPath} failed (${res.status}): ${message}`);
  }

  return json;
}

async function listAll(urlPath) {
  const items = [];
  let next = urlPath;
  while (next) {
    const page = await rc('GET', next);
    items.push(...(page.items ?? []));
    next = page.next_page ? page.next_page.replace(API, '') : null;
  }
  return items;
}

function findProject(projects) {
  const named = projects.find((p) => /monentry/i.test(p.name ?? ''));
  return named ?? projects[0];
}

function findStoreApp(apps) {
  return apps.find((a) => a.type === 'app_store') ?? apps.find((a) => a.type === 'test_store');
}

function findProductByStoreId(products, storeId) {
  return products.find((p) => p.store_identifier === storeId);
}

function findEntitlement(entitlements, keys) {
  for (const key of keys) {
    const match = entitlements.find((e) => e.lookup_key === key);
    if (match) return match;
  }
  return null;
}

async function ensureProduct(projectId, appId, products, storeId, displayName, title) {
  const existing = findProductByStoreId(products, storeId);
  if (existing) {
    console.log(`OK   product exists: ${storeId} (${existing.id})`);
    return existing;
  }

  console.log(`…    creating product: ${storeId}`);
  const created = await rc('POST', `/projects/${projectId}/products`, {
    store_identifier: storeId,
    app_id: appId,
    type: 'subscription',
    display_name: displayName,
    title,
    subscription: { duration: 'P1M' },
  });
  console.log(`OK   created product: ${storeId} (${created.id})`);
  return created;
}

async function ensureEntitlement(projectId, entitlements, lookupKey, displayName) {
  let entitlement = entitlements.find((e) => e.lookup_key === lookupKey);
  if (!entitlement) {
    console.log(`…    creating entitlement: ${lookupKey}`);
    entitlement = await rc('POST', `/projects/${projectId}/entitlements`, {
      lookup_key: lookupKey,
      display_name: displayName,
    });
    console.log(`OK   created entitlement: ${lookupKey}`);
  } else {
    console.log(`OK   entitlement exists: ${lookupKey}`);
  }
  return entitlement;
}

async function attachProductToEntitlement(projectId, entitlementId, productId) {
  await rc('POST', `/projects/${projectId}/entitlements/${entitlementId}/actions/attach_products`, {
    product_ids: [productId],
  });
}

async function ensurePackage(projectId, offeringId, packages, lookupKey, displayName, position) {
  const existing = packages.find((p) => p.lookup_key === lookupKey);
  if (existing) {
    console.log(`OK   package exists: ${lookupKey} (${existing.id})`);
    return existing;
  }

  console.log(`…    creating package: ${lookupKey}`);
  const created = await rc('POST', `/projects/${projectId}/offerings/${offeringId}/packages`, {
    lookup_key: lookupKey,
    display_name: displayName,
    position,
  });
  console.log(`OK   created package: ${lookupKey} (${created.id})`);
  return created;
}

async function setPackageProduct(projectId, pkg, productId) {
  const attached = pkg.products?.items ?? [];
  const already = attached.some((row) => row.product?.id === productId);
  if (already && attached.length === 1) {
    console.log(`OK   package ${pkg.lookup_key} already linked to product`);
    return;
  }

  for (const row of attached) {
    if (row.product?.id) {
      await rc('POST', `/projects/${projectId}/packages/${pkg.id}/actions/detach_products`, {
        product_ids: [row.product.id],
      });
    }
  }

  await rc('POST', `/projects/${projectId}/packages/${pkg.id}/actions/attach_products`, {
    products: [{ product_id: productId, eligibility_criteria: 'all' }],
  });
  console.log(`OK   package ${pkg.lookup_key} → product ${productId}`);
}

let projectId = '';

async function main() {
  console.log('Monentry — configure RevenueCat offering');
  console.log('=========================================\n');

  const projects = await listAll('/projects');
  const project = findProject(projects);
  if (!project) {
    throw new Error('No RevenueCat project found on this account.');
  }
  projectId = project.id;
  console.log(`OK   project: ${project.name} (${project.id})`);

  const apps = await listAll(`/projects/${projectId}/apps`);
  const app = findStoreApp(apps);
  if (!app) {
    throw new Error('No App Store or Test Store app found in RevenueCat.');
  }
  if (app.type === 'test_store') {
    console.warn('WARN: Using Test Store app — add an App Store app in RevenueCat for production.');
  }
  console.log(`OK   app: ${app.name ?? app.type} (${app.id}, ${app.type})`);

  const products = await listAll(`/projects/${projectId}/products`);
  const plusProduct = await ensureProduct(
    projectId,
    app.id,
    products,
    PLUS_STORE_ID,
    'Monentry Plus',
    'Monentry Plus',
  );
  const familyProduct = await ensureProduct(
    projectId,
    app.id,
    products,
    FAMILY_STORE_ID,
    'Monentry Family',
    'Monentry Family',
  );

  const entitlements = await listAll(`/projects/${projectId}/entitlements`);
  const plusEntitlement =
    findEntitlement(entitlements, PLUS_ENTITLEMENT_KEYS) ??
    (await ensureEntitlement(projectId, entitlements, 'plus', 'Monentry Plus'));
  const familyEntitlement =
    findEntitlement(entitlements, FAMILY_ENTITLEMENT_KEYS) ??
    (await ensureEntitlement(projectId, entitlements, 'family', 'Monentry Family'));

  await attachProductToEntitlement(projectId, plusEntitlement.id, plusProduct.id);
  console.log(`OK   entitlement ${plusEntitlement.lookup_key} → ${PLUS_STORE_ID}`);
  await attachProductToEntitlement(projectId, familyEntitlement.id, familyProduct.id);
  console.log(`OK   entitlement ${familyEntitlement.lookup_key} → ${FAMILY_STORE_ID}`);

  const offerings = await listAll(`/projects/${projectId}/offerings`);
  let offering = offerings.find((o) => o.lookup_key === OFFERING_KEY);
  if (!offering) {
    console.log(`…    creating offering: ${OFFERING_KEY}`);
    offering = await rc('POST', `/projects/${projectId}/offerings`, {
      lookup_key: OFFERING_KEY,
      display_name: 'Monentry Plans',
    });
  }
  console.log(`OK   offering: ${offering.lookup_key} (${offering.id})`);

  await rc('POST', `/projects/${projectId}/offerings/${offering.id}`, {
    display_name: offering.display_name ?? 'Monentry Plans',
    is_current: true,
  });
  console.log('OK   offering marked Current');

  const packages = await listAll(`/projects/${projectId}/offerings/${offering.id}/packages`);
  const plusPackage = await ensurePackage(
    projectId,
    offering.id,
    packages,
    PLUS_PACKAGE_KEY,
    'Monentry Plus',
    1,
  );
  const familyPackage = await ensurePackage(
    projectId,
    offering.id,
    packages,
    FAMILY_PACKAGE_KEY,
    'Monentry Family',
    2,
  );

  await setPackageProduct(projectId, plusPackage, plusProduct.id);
  await setPackageProduct(projectId, familyPackage, familyProduct.id);

  console.log('\nDone. Reload the app (npm start -- --clear, then force-quit Monentry).');
  console.log('Me tab should show Plus $1.99 and Family $4.99/mo.');
}

main().catch((error) => {
  console.error(`\nFAIL: ${error.message}`);
  process.exit(1);
});

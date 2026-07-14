import Constants from 'expo-constants';

/** Marketing version from app.json / native bundle. */
export function getAppVersion(): string {
  return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.3.0';
}

/** iOS build number / Android version code from the native binary. */
export function getAppBuildNumber(): string | null {
  const build =
    Constants.nativeBuildVersion ??
    Constants.expoConfig?.ios?.buildNumber ??
    Constants.expoConfig?.android?.versionCode;

  if (build === undefined || build === null || build === '') {
    return null;
  }

  return String(build);
}

/** e.g. 1.3.0 (2) — matches App Store Connect listing. */
export function getAppVersionLabel(): string {
  const version = getAppVersion();
  const build = getAppBuildNumber();
  return build ? `${version} (${build})` : version;
}

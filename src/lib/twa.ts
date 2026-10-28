/**
 * Digital Asset Links for the Android app (Trusted Web Activity built with Bubblewrap).
 * Android shows the site full-screen, without the browser address bar, only when
 * https://<domain>/.well-known/assetlinks.json lists the app's package name and the SHA-256
 * fingerprints of the keys that sign it. Both come from the environment, so no code changes
 * are needed when the key is created (see docs/ANDROID-ILOVA.md).
 */
const FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;
const PACKAGE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;

export type AssetLink = {
  relation: string[];
  target: { namespace: "android_app"; package_name: string; sha256_cert_fingerprints: string[] };
};

/** Returns null when the app is not configured (or the values are malformed). */
export function buildAssetLinks(packageName = "", fingerprints = ""): AssetLink[] | null {
  const pkg = packageName.trim();
  const prints = fingerprints
    .split(/[,\s]+/)
    .map((f) => f.trim().toUpperCase())
    .filter(Boolean);
  if (!PACKAGE.test(pkg) || prints.length === 0 || !prints.every((f) => FINGERPRINT.test(f))) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: pkg, sha256_cert_fingerprints: [...new Set(prints)] },
    },
  ];
}

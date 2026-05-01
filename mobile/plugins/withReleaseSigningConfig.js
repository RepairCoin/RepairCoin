const { withAppBuildGradle } = require("expo/config-plugins");

/**
 * Expo config plugin that injects the release signing config into build.gradle.
 * Credentials are read from ~/.gradle/gradle.properties (never committed).
 *
 * Required properties in ~/.gradle/gradle.properties:
 *   RELEASE_STORE_PASSWORD=...
 *   RELEASE_KEY_ALIAS=...
 *   RELEASE_KEY_PASSWORD=...
 *
 * The release.keystore file must be placed at android/app/release.keystore
 * (also gitignored).
 */
function withReleaseSigningConfig(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    // Skip if already applied
    if (contents.includes("signingConfigs.release")) {
      return mod;
    }

    // 1. Inject release signing config block after the debug block
    const releaseSigningBlock = [
      "        release {",
      "            storeFile file('release.keystore')",
      "            storePassword project.findProperty('RELEASE_STORE_PASSWORD') ?: ''",
      "            keyAlias project.findProperty('RELEASE_KEY_ALIAS') ?: ''",
      "            keyPassword project.findProperty('RELEASE_KEY_PASSWORD') ?: ''",
      "        }",
    ].join("\n");

    contents = contents.replace(
      /(signingConfigs\s*\{[\s\S]*?debug\s*\{[\s\S]*?\})\s*(\})/,
      `$1\n${releaseSigningBlock}\n    $2`,
    );

    // 2. Switch the release buildType's signingConfig from debug to release.
    //    Target: the line "signingConfig signingConfigs.debug" that appears
    //    inside "buildTypes { ... release { ... } }".
    //    Strategy: find the buildTypes block, then within it find the release
    //    block, then replace only that line.
    contents = contents.replace(
      /(buildTypes\s*\{[\s\S]*?)(release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug/,
      "$1$2signingConfigs.release",
    );

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = withReleaseSigningConfig;

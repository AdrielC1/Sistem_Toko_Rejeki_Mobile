const {
  withAppBuildGradle,
  withProjectBuildGradle,
} = require("expo/config-plugins");

const PROJECT_MARKER = "// withBluetoothClassicFix: enable BuildConfig";
const APP_MARKER = "// withBluetoothClassicFix: Windows short CMake staging";

/**
 * 1. AGP 8+/9+ disables `buildFeatures.buildConfig` by default for Android library
 *    modules, which causes `cannot find symbol: class BuildConfig` in
 *    `react-native-bluetooth-classic`.
 * 2. On Windows local builds, React Native New Architecture codegen object paths
 *    inside `android/app/.cxx` can exceed the 260-char MAX_PATH limit. Setting
 *    `buildStagingDirectory file("C:/cx")` inside `android/app/build.gradle` on
 *    Windows keeps all Ninja object paths under 250 chars.
 */
module.exports = function withBluetoothClassicFix(config) {
  config = withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(PROJECT_MARKER)) {
      return cfg;
    }

    const snippet = `
${PROJECT_MARKER}
subprojects { subproject ->
  if (subproject.name == "react-native-bluetooth-classic") {
    subproject.plugins.withId("com.android.library") {
      subproject.android {
        buildFeatures {
          buildConfig = true
        }
      }
    }
  }
}
`;

    cfg.modResults.contents = `${cfg.modResults.contents.trimEnd()}\n${snippet}`;
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(APP_MARKER)) {
      return cfg;
    }

    const stagingSnippet = `    ${APP_MARKER}
    if (org.gradle.internal.os.OperatingSystem.current().isWindows()) {
        externalNativeBuild {
            cmake {
                buildStagingDirectory file("C:/cx")
            }
        }
    }`;

    cfg.modResults.contents = cfg.modResults.contents.replace(
      /namespace\s+['"][^'"]+['"]/,
      (match) => `${match}\n${stagingSnippet}`
    );
    return cfg;
  });

  return config;
};

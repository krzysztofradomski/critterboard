// iOS 27 SDK apps must adopt the UIScene life cycle or iOS kills them at launch.
// Expo SDK 57's template doesn't yet, but ships ExpoAppSceneDelegate; wire it in.
// ponytail: delete this plugin once the Expo template adopts scenes itself.
const fs = require('fs');
const path = require('path');
const { withInfoPlist, withDangerousMod } = require('expo/config-plugins');

const SCENE_CLASS = '$(PRODUCT_MODULE_NAME).SceneDelegate';

const START_RN = /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n[^)]*\)\n#endif\n\n?/;

function patchAppDelegate(src) {
  if (src.includes('SceneDelegate')) return src;
  if (!START_RN.test(src) || !src.includes('class AppDelegate: ExpoAppDelegate {')) {
    throw new Error('withSceneDelegate: AppDelegate.swift layout changed, update the plugin');
  }
  return (
    src
      .replace(START_RN, '')
      .replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {') +
    '\n// The scene delegate creates the window and starts React Native into it.\nclass SceneDelegate: ExpoAppSceneDelegate {}\n'
  );
}

module.exports = (config) => {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: SCENE_CLASS },
        ],
      },
    };
    return c;
  });
  return withDangerousMod(config, [
    'ios',
    (c) => {
      const file = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName, 'AppDelegate.swift');
      fs.writeFileSync(file, patchAppDelegate(fs.readFileSync(file, 'utf8')));
      return c;
    },
  ]);
};

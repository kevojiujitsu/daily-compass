const path = require('path');
const xcode = require(require.resolve('xcode', { paths: [path.dirname(require.resolve('@capacitor/cli/package.json'))] }));
const fs = require('fs');
const projectPath = 'ios/App/App.xcodeproj/project.pbxproj';
const project = xcode.project(projectPath);
project.parseSync();
let count = 0;
for (const config of Object.values(project.pbxXCBuildConfigurationSection())) {
  const settings = config?.buildSettings;
  if (!settings?.PRODUCT_BUNDLE_IDENTIFIER || !String(settings.PRODUCT_BUNDLE_IDENTIFIER).includes('com.kevthedev.dailycompass.mobile')) continue;
  settings.DEVELOPMENT_TEAM = 'Z9BXH892FC';
  settings.CODE_SIGN_STYLE = 'Manual';
  settings.CODE_SIGN_IDENTITY = '"Apple Distribution"';
  settings.PROVISIONING_PROFILE_SPECIFIER = process.env.PROFILE_UUID;
  count++;
}
if (!count || !process.env.PROFILE_UUID) throw new Error('Missing app target or signing profile');
fs.writeFileSync(projectPath, project.writeSync());
console.log('Configured app target signing; package targets retain their own settings.');


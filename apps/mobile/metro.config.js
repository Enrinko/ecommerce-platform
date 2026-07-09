const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = false;
// @repo/api-client is exports-only (no "main"); enable package exports so Metro
// resolves its "exports" map (src/index.ts) instead of failing to find a main.
config.resolver.unstable_enablePackageExports = true;
// Prefer the CommonJS ("require") export condition over "import": zustand's ESM
// build uses `import.meta.env`, which Metro can't parse ("Cannot use 'import.meta'
// outside a module"). Its CJS build uses process.env instead.
config.resolver.unstable_conditionNames = ['require', 'react-native'];

// Force a single, version-correct React/React-DOM instance. The hoisted root has
// react@18.3.1 but react-dom@19 (from web/admin); react-hook-form also nests its
// own react. Resolving both from THIS app's dir collapses them to one instance
// each and picks apps/mobile's nested react-dom@18.3.1 (matching react@18.3.1),
// avoiding "Invalid hook call" / ReactDOM-19-vs-React-18 ("reading 'S'") crashes.
const isReactPkg = (name) =>
  name === 'react' ||
  name === 'react-dom' ||
  name.startsWith('react/') ||
  name.startsWith('react-dom/');
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (isReactPkg(moduleName)) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(projectRoot, 'index.js') },
      moduleName,
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

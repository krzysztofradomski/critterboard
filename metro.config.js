const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// AI SDK dependencies rely on modern "exports" package maps.
// Force Metro to resolve through exports instead of legacy "main" fields.
config.resolver.unstable_enablePackageExports = true;

// react-cartoon-planet ships bundled GeoJSON; treat as static assets on web.
if (!config.resolver.assetExts.includes('geojson')) {
  config.resolver.assetExts.push('geojson');
}

module.exports = config;

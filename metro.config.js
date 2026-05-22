const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// AI SDK dependencies rely on modern "exports" package maps.
// Force Metro to resolve through exports instead of legacy "main" fields.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;

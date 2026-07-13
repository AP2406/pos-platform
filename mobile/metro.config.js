// Metro config for the Surge monorepo. `mobile` is not an npm workspace of the
// web root (so the Vercel build never installs RN deps), but it consumes the
// shared TS packages via file: deps. Metro therefore must watch ../packages and
// resolve modules from both mobile/node_modules and the repo-root node_modules.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(monorepoRoot, "packages")];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = config;

// Metro configuration to avoid conflicts with other projects
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude the sibling Next.js project directory
config.resolver.blockList = [
  /.*\/\.next\/.*/,
  /.*\/src\/app\/layout\.tsx$/,
  /.*\/src\/app\/globals\.css$/,
];

// Ensure we only resolve from the current project
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;

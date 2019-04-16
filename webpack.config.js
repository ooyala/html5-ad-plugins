const path = require('path');

const globEntries = require('webpack-glob-entries');

module.exports = () => ({
  entry: globEntries('./js/*.js'),
  output: {
    path: path.resolve(__dirname, './build'),
    filename: '[name].min.js',
  },
  optimization: {
    minimize: true,
  },
  mode: 'development',
  devtool: 'source-map',
  devServer: {
    port: 9003,
    host: '0.0.0.0',
    compress: true,
  },
});

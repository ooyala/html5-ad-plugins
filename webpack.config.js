const path = require('path');
const webpack = require('webpack');

const globEntries = require('webpack-glob-entries');

module.exports = () => ({
  entry: globEntries('./js/*.js'),
  output: {
    path: path.resolve(__dirname, './build'),
    filename: '[name].min.js',
  },
  plugins: [
    new webpack.ProvidePlugin({
      OO: path.resolve(__dirname, './index.js'),
    }),
  ],
  optimization: {
    minimize: true,
  },
  devtool: 'source-map',
  devServer: {
    port: 9003,
    host: '0.0.0.0',
    compress: true,
    open: true,
  },
});

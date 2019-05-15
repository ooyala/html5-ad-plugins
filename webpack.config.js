const path = require('path');
const globEntries = require('webpack-glob-entries');

module.exports = (env, options) => ({
  entry: globEntries('./js/*.js'),
  output: {
    path: path.resolve('./build'),
    filename: '[name].min.js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'babel-loader',
        },
      },
    ],
  },
  watch: options.mode !== 'production',
  devtool: options.mode !== 'production' ? 'source-map' : false,
  devServer: {
    port: 9003,
    // webpack-dev-server client overrides sockjs-node location if host === '0.0.0.0'
    // to the window.location and it breaks live reload
    // if you want to make webpack-dev-server available from outside (e.g. to debug Android device)
    // change it to 0.0.0.0
    host: 'localhost',
    disableHostCheck: true,
    compress: true,
    inline: true,
  },
});

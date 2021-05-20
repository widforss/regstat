var nodeExternals = require('webpack-node-externals');
const path = require('path');

const serverConfig = {
  entry: './server/main.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.json$/,
        use: 'json-loader'
      }
    ],
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js', '.json' ],
  },
  output: {
    filename: 'server.js',
    path: path.resolve(__dirname),
  },
  target: 'node',
  node: {
    __dirname: false
  },
  externals: [nodeExternals()],
};

const clientConfig = {
  entry: './client/main.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [ '.tsx', '.ts', '.js' ],
  },
  output: {
    filename: 'static/js/main.js',
    path: path.resolve(__dirname),
  },
};


module.exports = [serverConfig, clientConfig];
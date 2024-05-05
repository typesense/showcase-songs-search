// https://github.com/k6io/template-es6/blob/master/webpack.config.js
var path = require("path");
/* eslint-disable-next-line no-unused-vars */
var webpack = require("webpack");
module.exports = {
  mode: "production",
  entry: "./index.js",
  output: {
    path: path.resolve(__dirname, "build"),
    libraryTarget: "commonjs",
    filename: "app.bundle.js",
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        loader: "babel-loader",
      },
    ],
  },
  stats: {
    colors: true,
  },
  target: "web",
  externals: /k6(\/.*)?/,
  devtool: "source-map",
};

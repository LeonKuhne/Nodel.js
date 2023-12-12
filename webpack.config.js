module.exports = {
  entry: './src/index.mjs',
  output: {
    filename: 'nodel.js',
    path: require('path').resolve(__dirname, 'dist'),
    library: 'Nodel',
    libraryTarget: 'umd',
  },
  mode: 'development', //'production',
  // use skeleton loader to load leader-line
  module: {
    rules: [
      {
        test: require('path').resolve(__dirname, 'node_modules/leader-line/'),
        use: [{
          loader: 'skeleton-loader',
          options: {procedure: content => `${content}export default LeaderLine`}
        }]
      }
    ]
  }
};
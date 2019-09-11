module.exports = {
  // 禁止生成js sourceMap文件
  productionSourceMap: false,
  // webpack 性能优化提示
  configureWebpack: {
    performance: {
      hints: 'warning',
      // 入口最大值
      maxEntrypointSize: 1024000,
      // 生成的资源文件最大值
      maxAssetSize: 1024000,
      // 只针对js文件给出性能优化提示
      assetFilter: function (assetFilename) {
        return assetFilename.endsWith(".js")
      }
    }
  },
  pages: {
    popup: {
      entry: 'src/modules/popup/main.js',
      template: 'public/popup.html',
      filename: 'popup.html',
      title: 'popup'
    },
    options: {
      entry: 'src/modules/options/main.js',
      template: 'public/options.html',
      filename: 'options.html',
      title: 'options'
    },
    background: {
      entry: 'src/main.js',
      template: 'public/background.html',
      filename: 'background.html',
      title: 'background'
    }
  }
}

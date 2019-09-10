module.exports = {
  // 禁止生成js sourceMap文件
  productionSourceMap: false,
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
    index: {
      entry: 'src/main.js',
      template: 'public/index.html',
      filename: 'index.html',
      title: 'index'
    }
  }
}

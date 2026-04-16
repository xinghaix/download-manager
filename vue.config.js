const {defineConfig} = require('@vue/cli-service')

class RemoveNewFunctionPlugin {
  apply(compiler) {
    const {Compilation, sources} = compiler.webpack

    compiler.hooks.thisCompilation.tap('RemoveNewFunctionPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'RemoveNewFunctionPlugin',
          stage: Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_INLINE
        },
        (assets) => {
          Object.keys(assets).forEach((filename) => {
            if (!filename.endsWith('.js')) {
              return
            }

            const asset = compilation.getAsset(filename)
            if (!asset) {
              return
            }

            const source = asset.source.source().toString().replace(
              /new Function\("return this"\)\(\)/g,
              '(function() { return typeof globalThis === "object" ? globalThis : typeof self === "object" ? self : typeof window === "object" ? window : this; })()'
            )

            compilation.updateAsset(filename, new sources.RawSource(source))
          })
        }
      )
    })
  }
}

module.exports = defineConfig({
  // 禁用 ESLint
  lintOnSave: false,

  // 使用 runtime-only 构建，禁用模板编译器
  runtimeCompiler: false,

  // 禁止生成js sourceMap文件
  productionSourceMap: false,

  // 修复 transpileDependencies 问题
  transpileDependencies: [],

  // webpack 性能优化提示
  configureWebpack: {
    // 禁用 source map 的 eval 模式，符合 Manifest V3 CSP
    devtool: false,
    output: {
      // 修复 CSP 问题：避免使用 new Function()
      globalObject: 'self'
    },
    resolve: {
      alias: {
        // 使用 runtime-only 版本的 Vue，避免模板编译器使用 eval
        'vue$': 'vue/dist/vue.runtime.esm-bundler.js'
      }
    },
    optimization: {
      minimizer: [
        (compiler) => {
          const TerserPlugin = require('terser-webpack-plugin');
          new TerserPlugin({
            terserOptions: {
              compress: {
                // 移除 new Function 调用
                pure_funcs: []
              },
              mangle: true
            }
          }).apply(compiler);
        }
      ]
    },
    performance: {
      hints: 'warning',
      // 入口最大值
      maxEntrypointSize: 1500000,
      // 生成的资源文件最大值
      maxAssetSize: 1500000,
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
    offscreen: {
      entry: 'src/offscreen.js',
      filename: 'offscreen.html',
    },
    background: {
      entry: 'src/background.js',
      filename: 'background.js'
    }
  },

  chainWebpack: config => {
    // 移除 background 的 HTML 插件，因为 Service Worker 不需要 HTML
    config.plugins.delete('html-background')
    config.plugins.delete('preload-background')
    config.plugins.delete('prefetch-background')

    // 确保 background.js 和 offscreen.js 输出到根目录且不带 hash
    config.output.filename(file => {
      if (file.chunk.name === 'background') {
        return 'background.js'
      }
      if (file.chunk.name === 'offscreen') {
        return 'offscreen.js'
      }
      return 'js/[name].[contenthash:8].js'
    })

    // 配置 splitChunks 排除 background，并进一步拆分 Vendor 以减小体积
    config.optimization.splitChunks({
      cacheGroups: {
        // 提取 Vue 基础库
        vue: {
          name: 'chunk-vue',
          test: /[\\/]node_modules[\\/](vue|vue-router|pinia|vuex)[\\/]/,
          priority: 20,
          chunks: (chunk) => chunk.name !== 'background' && chunk.name !== 'offscreen',
          enforce: true
        },
        // 提取 UI 库 (如 element-plus)
        ui: {
          name: 'chunk-ui',
          test: /[\\/]node_modules[\\/](element-plus|@element-plus)[\\/]/,
          priority: 15,
          chunks: (chunk) => chunk.name !== 'background' && chunk.name !== 'offscreen',
          enforce: true
        },
        // 默认的 vendor 分组
        vendors: {
          name: 'chunk-vendors',
          test: /[\\/]node_modules[\\/]/,
          priority: -10,
          chunks: (chunk) => chunk.name !== 'background' && chunk.name !== 'offscreen',
        },
        // 默认的 common 分组
        common: {
          name: 'chunk-common',
          minChunks: 2,
          priority: -20,
          chunks: (chunk) => chunk.name !== 'background' && chunk.name !== 'offscreen',
          reuseExistingChunk: true
        }
      }
    })

    // 添加自定义插件移除 new Function
    config.plugin('remove-new-function').use(RemoveNewFunctionPlugin)
  }
})

const fs = require('fs')
const path = require('path')
const webpack = require('webpack')
const { ConcatSource, OriginalSource } = require('webpack-sources')
const transXml = require('./transxml')
const { get: getAppJson } = require('../helpers/app')

module.exports = class BdPluginHelper {
  constructor (miniPlugin) {
    this.$plugin = miniPlugin
  }

  apply (compiler) {
    new webpack.DefinePlugin({
      wx: 'swan'
      // App: '_afAppx.App',
      // Page: 'global.Page',
      // getApp: `
      // (function () {
      //   const app = _afAppx.getApp() || {}
      //   global.globalData = app.globalData = Object.assign({}, app.globalData, global.globalData)
      //   Object.assign(app, global)
      //   return Object.assign(global, app)
      // })
      // `,
      // __wxConfig: JSON.stringify(null),
      // Component: `global.Component`,
      // Behavior: '(function (args) { return args })'
    }).apply(compiler)
  }

  setCompilation (compilation) {
    // const header = '/******/ const _afAppx = __webpack_require__(/*! @alipay/af-appx */ "@alipay/af-appx");\n'
    // const global = '/******/ var global = _afAppx.bridge.global = _afAppx.bridge.global || {};\n'

    // compilation.hooks.optimizeChunkAssets.tapAsync('MiniPlugin', (chunks, callback) => {
    //   chunks.forEach(chunk => {
    //     chunk.files.forEach(file => {
    //       compilation.assets[file] = new ConcatSource(
    //         header,
    //         global,
    //         compilation.assets[file]
    //       )
    //     })
    //   })
    //   callback()
    // })


    compilation.hooks.buildModule.tap('MiniPlugin', module => {
      // console.log(module.source())
      // modules.forEach(module => {
      // let code = module.source()
      // code = code.replace(/this\.setData/g, 'this.setAliData')
      // module._source = new OriginalSource(code)
      // })
    })
  }

  getAppJsonCode () {
    return new ConcatSource(JSON.stringify(getAppJson(), null, 2))
  }

  getAppJsCode (content) {
    return content;
  }

  emitHook (compilation, callback) {
    transXml(compilation, this.$plugin)
      .then(() => callback())
      .catch(err => console.log(err))
  }
}

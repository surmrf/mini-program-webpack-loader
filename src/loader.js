// const fs = require('fs')
const path = require('path')
const utils = require('./utils')
const FileTree = require('./FileTree')
const WXLoaderHelper = require('./wx/loader')
const AliLoaderHelper = require('./ali/loader')
const BdLoaderHelper = require('./bd/loader')
const { toTargetPath } = require('./helpers/path')
const { resolveFilesForLoader } = require('./helpers/component')
const { reslovePagesFiles } = require('./helpers/page')
const { update: setAppJson } = require('./helpers/app')

const tree = new FileTree()
const isInvaildExt = ext => ['.wxml', '.wxss', '.scss', '.pcss', '.less', '.wxs'].indexOf(ext) === -1

class MiniLoader {
  constructor (loader, code) {
    this.loader = loader
    this.source = code
    this.callback = loader.async()
    this.context = loader.context

    if (!this.$plugin) throw new Error('该 loader 必须和插件配合使用')

    // 获取文件信息
    this.fileMeta = tree.getFile(loader.resourcePath)

    this.targetHelper = this.getTargetHelper()

    this.resolve = (context, request) => new Promise((resolve, reject) => {
      loader.resolve(context, request, (err, result) => err ? reject(err) : resolve(result))
    })

    this.parser()
  }

  getTargetHelper() {
    const helper = {
      ali: AliLoaderHelper,
      bd: BdLoaderHelper,
      wx: WXLoaderHelper
    }[this.$plugin.options.target]

    return helper ? new helper(this.loader.resourcePath, this.$plugin) : {};
  }

  parser () {
    /**
     * json 文件使用 jsonParser 获取依赖，其他文件使用通用获取依赖的方法
     */
    const parserPromise = !this.fileMeta.isJson
      ? this.normalParser()
      : this.jsonParser()

    /**
     * 返回最终这个文件的内容
     */
    parserPromise.then(
      code => this.callback(null, code),
      this.callback
    )
  }

  async jsonParser () {
    if (!this.source) {
      console.log('仿佛接受到了一个空 json 文件，记得写数据哦!'.yellow)
      return this.source
    }

    let json = JSON.parse(this.source)
    let { componentGenerics, usingComponents, pages = [], subPackages = [] } = json

    /**
     * 应用配置文件，如 app.json，通知插件，对这里面的内容处理
     */
    if (pages.length || subPackages.length) {
      json = await this.$plugin.getEntryConfig(this.fileMeta.source, json)

      let newFiles = reslovePagesFiles(json, this.context, this.$plugin.options)

      await this.addFilesToComplier(newFiles)

      usingComponents = json.usingComponents

      setAppJson(json, this.fileMeta.source)
    }

    /**
     * 配置文件中没有配置自定义组件，不处理
     */
    if (!usingComponents && !componentGenerics) return this.source

    /**
     * 否则获取该配置文件所依赖的文件，在这里面有做一些处理，如 alias 处理，会修改 json 内容
     */
    let assets = await resolveFilesForLoader(
      this.resolve,
      this.fileMeta.source,
      json,
      this.getDepPath.bind(this),
      this.$plugin.options
    )

    this.addFilesToComplier(assets)
    return JSON.stringify(json, null, 2)
  }

  addFilesToComplier (files) {
    // let promises = []

    /**
     * 怎么速度更快待考证
     */
    // let jsFiles = files.filter(file => {
    //   let isJS = /\.js$/.test(file)

    //   /**
    //    * 非 js 文件直接添加到编译处理
    //    */
    //   !isJS && promises.push(
    //     this.addDepsModule(file)
    //   )

    //   return isJS
    // })

    /**
     * 通知插件，下次编译的时候要把这些文件加到编译中，这些文件必须通过插件添加，js
     * 文件必须是入口文件，其他类型文件通过 loadmodule 不能再次被相应
     */
    files.length && this.$plugin.newFilesEntryFromLoader(files)
  }

  async normalParser (reg) {
    return this.loadNormalFileDeps(reg).then(map => {
      let deps = []
      let code = this.source
      let promises = []

      for (const value of map.values()) {
        let reg = `('|")${value.origin}('|")`
        code = code.replaceAll(reg, `"${value.replace}"`)

        /**
         * 动态添加依赖，使用 promise 是为了在所有依赖添加完成后
         * 再调用 callback，否则后添加的依赖不会被监听
         */
        promises.push(
          this.addDepsModule(value.sourcePath)
        )

        deps.push(value.sourcePath)
      }

      /**
       * 依赖的文件添加到文件树中
       */
      tree.addDeps(this.fileMeta.source, deps)

      /**
       * 新文件添加到监听，不要用，这个会导致很慢
       */
      // this.$plugin.newFilesEntryFromLoader(deps)

      /**
       * 看看是不是需要对 wxml 文件进行处理，目前 支付宝小程序 需要处理
       */
      if (this.fileMeta.isWxml && this.targetHelper.transformWxml) {
        code = this.targetHelper.transformWxml(code)
      }

      return Promise.all(promises).then(() => code)
    })
  }

  addDepsModule (request) {
    return new Promise((resolve, reject) => {
      this.loader.loadModule(request, (err, src) => {
        if (!err) return resolve(src)
        // 如果添加依赖失败，把他从文件树中去除
        reject(err)
        tree.removeFile(request)
      })
    })
  }

  async loadNormalFileDeps () {
    let map = new Map()
    let { isWxml, isWxss, isWxs } = this.fileMeta

    if (!isWxml && !isWxs && !isWxss) {
      console.log('webpack 配置不对哦，该插件只支持 wxml, wxss, wxs, json 的'.red)
      return map
    }

    /**
     * 根据文件类型获取依赖匹配的正则表达式
     */
    const wxmlDepsReg = /src=('|")([^"]*)('|")/g
    const wxssDepsReg = /@import ('|")([^"].+?)('|");/g
    const wxsDepsReg = /require\(('|")([^)]*.wxs)('|")\)/g
    const reg = isWxml ? wxmlDepsReg : isWxss ? wxssDepsReg : wxsDepsReg

    let matched = null

    /**
     * 依赖查找
     */
    while ((matched = reg.exec(this.source)) !== null) {
      let dep = matched[2]
      let ext = path.extname(dep)

      /**
       * 检查文件引用的文件是否有效
       */
      if (isInvaildExt(ext)) {
        // 可以在这里对很多东西限制，比如 base 64
        // console.log('引用了一个不认识的文件类型', ext)
        continue
      }

      // 依赖文件的绝对路径
      let depFile = await this.getAbsolutePath(this.context, dep)

      // 文件真实路径相对当前文件的路径
      let depPath = this.getDepPath(depFile)

      if (!map.has(dep)) {
        map.set(dep, {
          origin: dep, // 原来代码中的依赖路径
          replace: toTargetPath(depPath), // 替换路径
          sourcePath: depFile // 依赖文件，用于动态添加依赖
        })
      }
    }

    return map
  }

  /**
   * 根据当前文件打包后的路径以及依赖文件的路径打包路径计算依赖的相对路径
   * @param {*} dep
   */
  getDepPath (dep) {
    const resolveDistPath = utils.getDistPath

    let outPath = resolveDistPath(this.fileMeta.source)
    let depOutPath = resolveDistPath(dep)

    return utils.relative(outPath, depOutPath)
  }

  async getAbsolutePath (context, dep) {
    /**
     * 绝对路径则把前面的 / 去掉，需要在 resolve.alias 中做相应配置，主要是兼容有赞小程序历史写法，相对路径则使用相对路径
     *
     * 如果配置的 alias 和 / 后面的第一个目录不是指向同一个目录，这里获取到的路径就是错了
     */
    dep = path.isAbsolute(dep) ? dep.substr(1) : dep

    let absPath = await this.resolve(context, dep)
    return absPath
  }
}

module.exports = function (content) {
  this.cacheable && this.cacheable()

  return new MiniLoader(this, content)
}

module.exports.$applyPluginInstance = function (plugin) {
  MiniLoader.prototype.$plugin = plugin
}

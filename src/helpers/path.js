const { extname } = require('path')
const CONFIG = {
  ali: {
    TWxs (path) {
      return path.replace('.wxs', '.sjs')
    },

    TWxml (path) {
      return path.replace('.wxml', '.axml')
    },

    TWxss (path) {
      return path.replace('.wxss', '.acss')
    },

    TScss (path) {
      return path.replace('.scss', '.acss')
    },

    TPcss (path) {
      return path.replace('.pcss', '.acss')
    }
  },

  wx: {
    TScss (path) {
      return path.replace('.scss', '.wxss')
    },

    TPcss (path) {
      return path.replace('.pcss', '.wxss')
    }
  },

  bd: {
    TWxs (path) {
      return path.replace('.wxs', '.js')
    },

    TWxss (path) {
      return path.replace('.wxss', '.css')
    },

    TScss (path) {
      return path.replace('.scss', '.css')
    },

    TWxml (path) {
      return path.replace('.wxml', '.swan')
    },
  }
}

module.exports.toTargetPath = function (file) {
  let target = process.env.TARGET || 'wx'
  let TARGET = CONFIG[target]
  let ext = extname(file)

  if (!ext) throw new Error('接受到一个不正常的文件')

  let method = 'T' + ext.substr(1, 1).toUpperCase() + ext.substr(2)
  return method && TARGET[method] ? TARGET[method](file) : file
}

module.exports = class BdLoaderHelper {
  constructor (file) {
    this.file = file
    this.componentPath = file.replace('.wxml', '.json')
  }

  transformWxss (content) {
    return content
  }

  transformWxml (content) {
    // 更换指令前缀
    content = content.replace(/wx:/g, 's-')

    // 更换解构语法
    content = content.replace(/(?<=(?:<template[^>]*))\bdata\b\s*=\s*[\'\"]?{{\s*([^\'\"]*)\s*}}[\'\"]?/gi, `data="{{{$1}}}"`)

    // 替换模板函数
    content = content.replace(/<wxs/g, '<filter')
    content = content.replace(/wxs>/g, 'filter>')
    content = content.replace(/module\.exports\s{0,}=/, 'export default')

    return content
  }
}

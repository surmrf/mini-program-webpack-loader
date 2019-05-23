module.exports = class BdLoaderHelper {
  constructor (file) {
    this.file = file
    this.componentPath = file.replace('.wxml', '.json')
  }

  transformWxss (content) {
    return content
  }

  transformWxml (content) {
    // let start;
    // let code = content;

    // wx:for="{{ list }}" => s-for="list"
    // while(code) {
    //   start = code.indexOf('wx:for')

    //   if (start > -1) {
    //     code = code.slice(start + 6)
    //     start = code.indexOf('{{')
    //   }

    //   start = code.indexOf('{{')

    //   if (start > -1) {

    //   }
    // }

    // 更换指令前缀
    content = content.replace(/wx:/g, 's-')

    // 替换模板函数
    content = content.replace(/<wxs/g, '<filter')
    content = content.replace(/wxs>/g, 'filter>')

    return content
  }
}

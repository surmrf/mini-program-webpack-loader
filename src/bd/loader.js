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

    // 百度 filter 使用的是 es6 模块规范
    content = this.transformWxs(content);

    return content
  }

  transformWxs(str) {
    let newStr = '';
    let filterOpenName = '';
    let filterCloseName = '';
    let codeBody = '';
    let filterOpenStart = -1;
    let filterOpenEnd = -1;
    let filterCloseStart = -1;
    let filterCloseEnd = -1;
    let code = str;
    let seg = [];
    const wxs = [];

    while(code) {
      seg = [];
      filterOpenStart = code.indexOf('<filter');

      if (filterOpenStart > -1) {
        seg.push(code.slice(0, filterOpenStart));

        filterOpenEnd = code.indexOf('>', filterOpenStart) + 1;
        filterOpenName = code.slice(filterOpenStart, filterOpenEnd);

        seg.push(filterOpenName);
        seg.push('\nvar exportFunc = {};\n');
        code = code.slice(filterOpenEnd);

        filterCloseStart = code.indexOf('</filter>');

        if (filterCloseStart > -1) {
          codeBody = code.slice(0, filterCloseStart);
          codeBody = codeBody.replace(/module\.exports/g, 'exportFunc');
          seg.push(codeBody);
          seg.push('\nexport default = exportFunc;\n');

          filterCloseEnd = filterCloseStart + 9;
          filterCloseName = code.slice(filterCloseStart, filterCloseEnd);
          seg.push(filterCloseName);

          code = code.slice(filterCloseEnd);
        }

        wxs.push(seg);
      } else {
        wxs.push([code]);
        break;
      }
    }

    wxs.forEach(seg => {
      newStr += `${seg.join('')}\n`;
    });

    return newStr;
  }
}

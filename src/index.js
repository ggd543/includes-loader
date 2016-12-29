const fs = require('fs');
const path = require('path');

const defaultOptions = {
  pattern: {
    re: /#include\s+?"(.+?)";*?/,
    index: 1
  },
  extensions: []
};

function prepareOptions(filepath, loader) {
  const filepathParse = path.parse(filepath);
  const options = Object.assign({}, defaultOptions, loader.options.includes);

  if (typeof options.pattern === 'function') {
    options.pattern = options.pattern(filepath)
  }

  if (!options.pattern) {
    options.pattern = defaultOptions.pattern;
  } else if (!(options.pattern.re instanceof RegExp &&
    Number.isInteger(options.pattern.index) &&
    options.pattern.index > -1)) {
    throw new Error('include-text-loader: pattern is invalid');
  }

  options.pattern.re = new RegExp(options.pattern.re, 'g');

  if (typeof options.extensions === 'function') {
    options.extensions = options.extensions(filepath)
  }

  if (Array.isArray(options.extensions) && options.extensions.length === 0) {
    options.extensions = [filepathParse.ext]
  } else if (!(Array.isArray(options.extensions) &&
    options.extensions.length > 0)) {
    throw new Error('include-text-loader: extensions is invalid')
  }
  return options;
}

module.exports = function (source) {

  const loader = this;
  loader.cacheable();

  try {
    // target resource abosulte path
    const filepath = loader.resourcePath;
    const options = prepareOptions(filepath, loader, source);
    // const includes = [];

    const params = {
      source,
      filepath,
      options
    };

    // console.log(source, filepath);

    const text = parseFile(params);
    loader.callback(null, `module.exports = ${JSON.stringify(text)}`);

  } catch (err) {
    loader.callback(err);
  }
};


function parseFile(params) {
  const {options, filepath} = params;
  if (!options.pattern.re.test(params.source)) {
    // console.log(params.source);
    return params.source;
  }

  const index = options.pattern.index;  

  // replace the include pattern by DFS algorithm
  const newSource = params.source.replace(options.pattern.re, (...p) => {
    let includedFilePath;
    const basePath = path.join(path.parse(filepath).dir, p[index]);    

    for (const ext of options.extensions) {
      const fp = basePath + ext;      
      if (fs.existsSync(fp) && fs.lstatSync(fp).isFile()) {
        includedFilePath = fp;
        break;
      }              
    }
    if (!includedFilePath) {
      throw new Error(`Not found included file in base path '${basePath}' with extensions ${JSON.stringify(options.extensions)}`);
    }
    const source = fs.readFileSync(includedFilePath, { encoding: 'utf-8' });
    const o = { filepath: includedFilePath, options, source };
    const includedFileSource = parseFile(o);
    return includedFileSource;
  });
  return newSource;
}

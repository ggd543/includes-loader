'use strict';

var fs = require('fs');
var path = require('path');

var defaultOptions = {
  pattern: {
    re: /#include\s+?"(.+?)";*?/,
    index: 1
  },
  extensions: []
};

function prepareOptions(filepath, loader) {
  var filepathParse = path.parse(filepath);
  var options = Object.assign({}, defaultOptions, loader.options.includes);

  if (typeof options.pattern === 'function') {
    options.pattern = options.pattern(filepath);
  }

  if (!options.pattern) {
    options.pattern = defaultOptions.pattern;
  } else if (!(options.pattern.re instanceof RegExp && Number.isInteger(options.pattern.index) && options.pattern.index > -1)) {
    throw new Error('include-text-loader: pattern is invalid');
  }

  options.pattern.re = new RegExp(options.pattern.re, 'g');

  if (typeof options.extensions === 'function') {
    options.extensions = options.extensions(filepath);
  }

  if (Array.isArray(options.extensions) && options.extensions.length === 0) {
    options.extensions = [filepathParse.ext];
  } else if (!(Array.isArray(options.extensions) && options.extensions.length > 0)) {
    throw new Error('include-text-loader: extensions is invalid');
  }
  return options;
}

module.exports = function (source) {

  var loader = this;
  loader.cacheable();

  try {
    // target resource abosulte path
    var filepath = loader.resourcePath;
    var options = prepareOptions(filepath, loader, source);
    // const includes = [];

    var params = {
      source: source,
      filepath: filepath,
      options: options
    };

    // console.log(source, filepath);

    var text = parseFile(params);
    loader.callback(null, 'module.exports = ' + JSON.stringify(text));
  } catch (err) {
    loader.callback(err);
  }
};

function parseFile(params) {
  var options = params.options,
      filepath = params.filepath;

  if (!options.pattern.re.test(params.source)) {
    // console.log(params.source);
    return params.source;
  }

  var index = options.pattern.index;

  // replace the include pattern by DFS algorithm
  var newSource = params.source.replace(options.pattern.re, function () {
    for (var _len = arguments.length, p = Array(_len), _key = 0; _key < _len; _key++) {
      p[_key] = arguments[_key];
    }

    var includedFilePath = void 0;
    var basePath = path.join(path.parse(filepath).dir, p[index]);

    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = options.extensions[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var ext = _step.value;

        var fp = basePath + ext;
        if (fs.existsSync(fp) && fs.lstatSync(fp).isFile()) {
          includedFilePath = fp;
          break;
        }
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    if (!includedFilePath) {
      throw new Error('Not found included file in base path \'' + basePath + '\' with extensions ' + JSON.stringify(options.extensions));
    }
    var source = fs.readFileSync(includedFilePath, { encoding: 'utf-8' });
    var o = { filepath: includedFilePath, options: options, source: source };
    var includedFileSource = parseFile(o);
    return includedFileSource;
  });
  return newSource;
}
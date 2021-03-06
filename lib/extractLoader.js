"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _vm = require("vm");

var _vm2 = _interopRequireDefault(_vm);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

var _loaderUtils = require("loader-utils");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @name LoaderContext
 * @property {function} cacheable
 * @property {function} async
 * @property {function} addDependency
 * @property {function} loadModule
 * @property {string} resourcePath
 * @property {object} options
 */

/**
 * Random placeholder. Marks the location in the source code where the result of other modules should be inserted.
 * @type {string}
 */
var rndPlaceholder = "__EXTRACT_LOADER_PLACEHOLDER__" + rndNumber() + rndNumber();

/**
 * Executes the given module's src in a fake context in order to get the resulting string.
 *
 * @this LoaderContext
 * @throws Error
 * @param {string} content - the module's src
 */
function extractLoader(content) {
    var _this = this;

    var callback = this.async();
    var options = (0, _loaderUtils.getOptions)(this) || {};
    var publicPath = options.publicPath === undefined ? this.options.output.publicPath : options.publicPath;
    var dependencies = [];
    var script = new _vm2.default.Script(content, {
        filename: this.resourcePath,
        displayErrors: true
    });
    var sandbox = {
        require: function (_require) {
            function require(_x) {
                return _require.apply(this, arguments);
            }

            require.toString = function () {
                return _require.toString();
            };

            return require;
        }(function (resourcePath) {
            var absPath = _path2.default.resolve(_path2.default.dirname(_this.resourcePath), resourcePath).split("?")[0];

            // If the required file is a css-loader helper, we just require it with node's require.
            // If the required file should be processed by a loader we do not touch it (even if it is a .js file).
            if (/^[^!]*node_modules[/\\]css-loader[/\\].*\.js$/i.test(absPath)) {
                // Mark the file as dependency so webpack's watcher is working for the css-loader helper.
                // Other dependencies are automatically added by loadModule() below
                _this.addDependency(absPath);

                return require(absPath); // eslint-disable-line import/no-dynamic-require
            }

            dependencies.push(resourcePath);

            return rndPlaceholder;
        }),
        module: {},
        exports: {}
    };

    this.cacheable();

    sandbox.module.exports = sandbox.exports;
    script.runInNewContext(sandbox);

    Promise.all(dependencies.map(loadModule, this)).then(function (sources) {
        return sources.map(
        // runModule may throw an error, so it's important that our promise is rejected in this case
        function (src, i) {
            return runModule(src, dependencies[i], publicPath);
        });
    }).then(function (results) {
        return sandbox.module.exports.toString().replace(new RegExp(rndPlaceholder, "g"), function () {
            return results.shift();
        });
    }).then(function (content) {
        return callback(null, content);
    }).catch(callback);
}

/**
 * Loads the given module with webpack's internal module loader and returns the source code.
 *
 * @this LoaderContext
 * @param {string} request
 * @returns {Promise<string>}
 */
function loadModule(request) {
    var _this2 = this;

    return new Promise(function (resolve, reject) {
        // LoaderContext.loadModule automatically calls LoaderContext.addDependency for all requested modules
        _this2.loadModule(request, function (err, src) {
            return err ? reject(err) : resolve(src);
        });
    });
}

/**
 * Executes the given CommonJS module in a fake context to get the exported string. The given module is expected to
 * just return a string without requiring further modules.
 *
 * @throws Error
 * @param {string} src
 * @param {string} filename
 * @param {string} [publicPath]
 * @returns {string}
 */
function runModule(src, filename) {
    var publicPath = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : "";

    var script = new _vm2.default.Script(src, {
        filename,
        displayErrors: true
    });
    var sandbox = {
        module: {},
        __webpack_public_path__: publicPath // eslint-disable-line camelcase
    };

    script.runInNewContext(sandbox);

    return sandbox.module.exports.toString();
}

/**
 * @returns {string}
 */
function rndNumber() {
    return Math.random().toString().slice(2);
}

// For CommonJS interoperability
module.exports = extractLoader;
exports.default = extractLoader;
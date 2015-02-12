"use strict";

var snippetUtils = require("./../snippet").utils;
var _            = require("lodash");
var http         = require("http");
var https        = require("https");
var utils        = require("./utils");
var foxy         = require("foxy");

/**
 * @param {BrowserSync} bs
 * @param {String} scripts
 * @returns {*}
 */
module.exports = function createProxyServer (bs, scripts) {

    var options = bs.options;

    checkProxyTarget(options.getIn(["proxy", "target"]), function (err) {
        if (err) {
            bs.events.emit("config:warn", {msg: err});
        }
    });

    var pluginMw = bs.pluginManager.hook("server:middleware", snippetUtils.getProxyMiddleware(scripts, options.getIn(["scriptPaths", "versioned"])));

    var snippetOptions = options.get("snippetOptions").toJS();
    var foxyServer = foxy(options.getIn(["proxy", "target"]), {
            rules:       snippetUtils.getRegex(options.get("snippet"), options.get("snippetOptions")),
            whitelist:   snippetOptions.whitelist,
            blacklist:   snippetOptions.blacklist,
            middleware:  pluginMw,
            errHandler:  function (err) {
                bs.logger.debug("{red:[proxy error]} %s", err.message);
            }
        }
    );

    return {
        server: (function (app) {
            return options.get("scheme") === "https"
                ? https.createServer(utils.getKeyAndCert(options), app)
                : http.createServer(app);
        })(foxyServer),
        app: foxyServer
    };
};

/**
 * @param {Object} target
 * @param {Function} cb
 */
function checkProxyTarget (target, cb) {

    var chunks  = [];
    var errored = false;

    function logError() {
        if (!errored) {
            cb("Proxy address not reachable - is your server running?");
            errored = true;
        }
    }

    require("http").get(target, function (res) {
        res.on("data", function (data) {
            chunks.push(data);
        });
    }).on("error", function (err) {
        if (_.contains(["ENOTFOUND", "ECONNREFUSED"], err.code)) {
            logError();
        }
    }).on("close", function () {
        if (!chunks.length) {
            logError();
        }
    });
}
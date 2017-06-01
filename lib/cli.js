var fs = require('fs');

var log = require('loglevel');
var sprintf = require('sprintf-js').sprintf;
var _ = require('underscore');

var chalk = require('./chalk');
var config = require('./config');

// We are expecting a tier configuration like:
// global config < local config < cli params
// Color is a tricky one so we manually handle it here.
function setColorMode() {
  var useColor = config.USE_COLOR || false;
  if (process.argv.indexOf('--color') >= 0) useColor = true;
  if (process.argv.indexOf('--no-color') >= 0) useColor = false;

  chalk.enabled = useColor;
  chalk.setTheme(config.COLOR_THEME);
}

function setLogLevel() {
  var level = log.levels.INFO;
  if (process.argv.indexOf('-v') >= 0) level = log.levels.DEBUG;
  if (process.argv.indexOf('-vv') >= 0) level = log.levels.TRACE;

  log.setLevel(level);

  log.fail = function(e) {
    log.error(chalk.red(sprintf('[ERROR] %s [%d]', (e.msg || e), (e.statusCode || 0))));
  };

  _.each(['debug', 'trace'], function(level) {
    log[level] = _.wrap(log[level], function(func) {
      var args = Array.prototype.slice.call(arguments);
      args[0] = '[' + level.toUpperCase() + ']';
      func.apply(null, _.map(args, function(arg) {
        return chalk.gray(arg);
      }));
    });
  });

  if (level === log.levels.TRACE) {
    var request = require('request');
    request.debug = true;
    // FIXME: hack request log, hope no one else use it...
    console.error = _.wrap(console.error, function(func) {
      var args = Array.prototype.slice.call(arguments);
      args.shift();
      if (args.length > 0 && args[0].indexOf('REQUEST ') === 0) {
        args.unshift('[TRACE]');
      }
      console.log.apply(null, _.map(args, function(arg) {
        return chalk.gray(arg);
      }));
    });
  }
}

function checkCache() {
  var h = require('./helper');
  var cacheDir = h.getCacheDir();

  if (!fs.existsSync(cacheDir))
    fs.mkdirSync(cacheDir);
}

var cli = {};

cli.run = function() {
  config.init();

  checkCache();
  setColorMode();
  setLogLevel();

  process.stdout.on('error', function(e) {
    if (e.code === 'EPIPE') process.exit();
  });

  require('yargs')
    .commandDir('commands')
    .completion()
    .help()
    .strict()
    .argv;
};

module.exports = cli;

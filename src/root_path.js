const path = require('path');

module.exports = (function () {
  return path.dirname(require.main.filename || process.mainModule.filename);
})();
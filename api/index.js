const appModule = require('../dist/app.js');
const app = appModule.default || appModule.app || appModule;

module.exports = (req, res) => {
  return app(req, res);
};

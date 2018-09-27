/* eslint-disable import/no-dynamic-require */

/**
 * @Author Ken
 * @CreateDate 2017-09-05 10:45
 * @LastUpdateDate 2017-09-05 10:45
 * @desc 加载中间件, 统一管理, 方便调用
 * @params
 * @return
 */

const walk = require('walk');
const path = require('path');
const fs = require('fs');
const Promise = require('bluebird');
const rootPath = require('./root_path');

function LoadModule(moduleName) {
  return fs.existsSync(moduleName) ? require(moduleName) : false;
}

module.exports = () => {
  return new Promise((resolve, reject) => {
    const walker = walk.walk(path.join(rootPath, '/middleware/'));
    const middlewares = {};

    walker.on('files', (root, dirStatsArray, next) => {
      dirStatsArray.forEach((dir) => {
        const url = root + dir.name;
        const filename = dir.name.substring(0, dir.name.length - '.js'.length);
        // console.info('load middleware: ' + dir.name, url, filename);
        console.info(`load middleware: ${filename}`);
        middlewares[filename] = LoadModule(url);
      });
      next();
    });

    walker.on('errors', (root, nodeStatsArray) => {
      console.error('middleware folder error', nodeStatsArray);
      reject(new Error('middleware folder error'));
    });

    walker.on('end', () => {
      console.info('---------------------');
      resolve(middlewares);
    });
  });
};


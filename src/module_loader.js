
/**
 * @Author Ken
 * @CreateDate 2017-09-05 10:44
 * @LastUpdateDate 2017-09-05 10:44
 * @desc 加载后台module模式, 根据conf文件自动绑定路由
 * @params
 * @return
 */

const walk = require('walk');
const path = require('path');
const fs = require('fs');
const rootPath = require('./root_path');

const METHODS = ['GET', 'POST', 'DELETE', 'PUT', 'ALL'];

// like lodash: _.get
function GetValue(obj, attr) {
  if (!obj || !attr) {
    return null;
  }
  const attrs = attr.split('.');
  let ret = obj;
  for(let i = 0; i < attrs.length; ++i) {
    ret = ret[attrs[i]];
    // 不是很严谨的写法, 不过在这个模块中的业务下, 足够用了
    if (ret === undefined) {
      throw new Error(`can't find '${attr}' 'in ${obj}'`);
    }
  }
  return ret;
}

function bind(middlewares, moduleName, router, conf, controller) {
  if (!conf.route) {
    throw new Error(`no "route" found in ${moduleName}.conf.json`);
  }
  conf.route.forEach((route) => {
    if (!route) {
      throw new Error(`no 'route' found in route config, module = ${moduleName}`);
    }

    const [method, pathTmp, middlewareFunc] = route.replace(/\s+/g, ' ').split(' ');
    if (!method || !pathTmp || !middlewareFunc || !METHODS.includes(method)) {
      throw new Error(`route config has wrong format, module = ${moduleName}`);
    }

    const middlewareNames = middlewareFunc.replace(/\s/g, '').split('|');
    const func = middlewareNames.pop();
    if (!controller[func]) {
      throw new Error(`no '${func}' found in controller, module = ${moduleName}`);
    }

    const args = [pathTmp];

    // Ken 2018-09-26 16:04 有中间件再处理
    if (middlewareNames && middlewareNames.length > 0) {
      const tmpMiddlewareFunctionArr = [];
      middlewareNames.forEach((middlewareName) => {
        const middleware = GetValue(middlewares, middlewareName);
        if (middleware) {
          console.info(`[${moduleName}] has middleware (${middlewareName})`);
          tmpMiddlewareFunctionArr.push(middleware);
        } else {
          console.error(`[${moduleName}] has middleware (${middlewareName}), but not found`);
        }
      });

      // Ken 2018-09-25 16:46 中间件的调用链, 实现了洋葱皮模型
      const generator = (ctx, next, i) => {
        return async () => {
          const nextFunc = tmpMiddlewareFunctionArr[i];
          if (nextFunc) {
            await nextFunc(ctx, generator(ctx, next, i + 1));
          } else {
            await next();
          }
        };
      };

      args.push(async (ctx, next) => {
        await tmpMiddlewareFunctionArr[0](ctx, generator(ctx, next, 1));
      });
    }
    args.push(controller[func].bind(controller));
    router[method.toLowerCase()](...args);
  });
}

function LoadModule(moduleName) {
  return fs.existsSync(moduleName) ? require(moduleName) : false;
}

module.exports = (middlewares, router) => {
  middlewares = middlewares || [];
  const walker = walk.walk(path.join(rootPath, '/module/api/'));
  let configs = [];
  configs.push('---------------------');

  walker.on('errors', (root, nodeStatsArray) => {
    console.error('module folder error', nodeStatsArray);
  });

  walker.on('end', () => {
    configs.forEach((c) => {
      console.debug(c);
    });
  });

  walker.on('directories', (root, dirStatsArray, next) => {
    dirStatsArray.forEach((dir) => {
      const url = `${root + dir.name}/${dir.name}`;
      console.info(`load module: ${dir.name}`);
      const conf = LoadModule(`${url}.conf.json`);
      const controller = LoadModule(`${url}.controller.js`);
      if (root !== (rootPath + '/module/api/')) {
        // module 下的子文件夹, 忽略, 目前只处理一层
      } else if (conf && controller) {
        try {
          configs.push(`Module: [${dir.name}]`);
          configs = configs.concat(conf.route);
          configs.push('---------------------');
          bind(middlewares, dir.name, router, conf, controller);
          next();
        } catch (err) {
          console.error(err, `file = ${dir.name}`);
        }
      } else {
        // console.warn(`Require '${dir.name}.conf.json' and '${dir.name}.controller.js' in module [${dir.name}]`);
      }
    });
  });
};


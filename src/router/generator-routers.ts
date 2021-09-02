import { adminMenus } from '@/api/system/menu';
import { constantRouterIcon } from './router-icons';
import router from '@/router/index';
import { constantRouter } from '@/router/index';
import { RouteRecordRaw } from 'vue-router';
import { Layout, ParentLayout } from '@/router/constant';
import type { AppRouteRecordRaw } from '@/router/types';

const Iframe = () => import('@/views/iframe/index.vue');
const LayoutMap = new Map<string, () => Promise<typeof import('*.vue')>>();

LayoutMap.set('LAYOUT', Layout);
LayoutMap.set('IFRAME', Iframe);

/**
 * 格式化 后端 结构信息并递归生成层级路由表
 * 
 * 将后端返回的路由列表按按照前端定义的格式化，并处理一下内容：
 * 1、层级路由，path拼合父级path
 * 2、路由重定向处理：如果存在redirect且children长度大于0，则redirect替换为children[0].path
 * 
 * @param routerMap
 * @param parent
 * @returns {*}
 */
export const routerGenerator = (routerMap, parent?): any[] => {
  return routerMap.map((item) => {
    const currentRouter: any = {
      // 路由地址 动态拼接生成如 /dashboard/workplace
      path: `${(parent && parent.path) || ''}/${item.path}`,
      // 路由名称，建议唯一
      name: item.name || '',
      // 该路由对应页面的 组件
      component: item.component,
      // meta: 页面标题, 菜单图标, 页面权限(供指令权限用，可去掉)
      meta: {
        ...item.meta,
        label: item.meta.title,
        icon: constantRouterIcon[item.meta.icon] || null,
        permissions: item.meta.permissions || null,
      },
    };

    // 为了防止出现后端返回结果不规范，处理有可能出现拼接出两个 反斜杠
    currentRouter.path = currentRouter.path.replace('//', '/');
    // 重定向
    item.redirect && (currentRouter.redirect = item.redirect);
    // 是否有子菜单，并递归处理
    if (item.children && item.children.length > 0) {
      //如果未定义 redirect 默认第一个子路由为 redirect
      !item.redirect && (currentRouter.redirect = `${item.path}/${item.children[0].path}`);
      // Recursion
      currentRouter.children = routerGenerator(item.children, currentRouter);
    }
    return currentRouter;
  });
};

/**
 * 从后端获取动态路由列表，格式化并添加到路由列表中，然后返回路由配置列表
 * 1、获取服务端的用户路由权限配置
 * 2、按前端路由格式生成层级路由routeList
 * 3、routeList合并constantRouter，生成完整的asyncRoutesList  —— constantRouter是路由初始化的默认配置，重复添加有意义吗
 * 4、asyncRoutesList逐个添加到router.addRoute中   ———— 这个步骤多余，因为在router-guards.ts又添加了一次(这个位置是不同权限模式都添加，更加合理)，
 * 
 * @returns {Promise<Router>}
 */
export const generatorDynamicRouter = (): Promise<RouteRecordRaw[]> => {
  return new Promise((resolve, reject) => {
    adminMenus()
      .then((result) => {
        const routeList = routerGenerator(result);

        asyncImportRoute(routeList);

        const asyncRoutesList = [...routeList, ...constantRouter];
        asyncRoutesList.forEach((item) => {
          router.addRoute(item);
        });
        resolve(asyncRoutesList);
      })
      .catch((err) => {
        reject(err);
      });
  });
};

/**
 * 查找views中对应的组件文件
 * 1、使用vite导入views下的所有视图对象返回给viewsModules = {'../views/xx/x.vue/tsx': () => import('../views/xx/x.vue/tsx'), ...} 
 * 2、对传入的路由对象进行map遍历，修改内容如下：
 * 2.1、是frame的路由，设置item.component = 'IFRAME';
 * 2.2、item.componet 是否存在？
 * 2.2.1、存在： 在LayoutMap查找是否存在对应的路由组件，存在item.component=对应的路由组件对象；不存在，在viewsModules中查找对应的item.component，存在则更新item.component，不存在则输出警告并返回undefined
 * 2.2.2、存在在：item.component = ParentLayout
 * 2.3、item.children是否存在？存在：递归查找item.children；不存在则继续2的下一个元素
 *
 */
let viewsModules: Record<string, () => Promise<Recordable>>;
export const asyncImportRoute = (routes: AppRouteRecordRaw[] | undefined): void => {
  viewsModules = viewsModules || import.meta.glob('../views/**/*.{vue,tsx}');
  if (!routes) return;
  routes.forEach((item) => {
    if (!item.component && item.meta?.frameSrc) {
      item.component = 'IFRAME';
    }
    const { component, name } = item;
    const { children } = item;
    if (component) {
      const layoutFound = LayoutMap.get(component as string);
      if (layoutFound) {
        item.component = layoutFound;
      } else {
        item.component = dynamicImport(viewsModules, component as string);
      }
    } else if (name) {
      item.component = ParentLayout;
    }
    children && asyncImportRoute(children);
  });
};

/**
 * 动态导入
 * 1、获取传入的viewsModules的keys，单个格式为：'../views/xx/x.vue/tsx'
 * 2、matchKeys = 过滤所有的keys：先删除key中的../views，如果key的路径名(不包含.后缀)==component，则保留；
 * 3、如果matchKeys刚好为1，则返回结果；否则返回undefined
 * 
 */
export const dynamicImport = (
  viewsModules: Record<string, () => Promise<Recordable>>,
  component: string
) => {
  const keys = Object.keys(viewsModules);
  const matchKeys = keys.filter((key) => {
    let k = key.replace('../views', '');
    const lastIndex = k.lastIndexOf('.');
    k = k.substring(0, lastIndex);
    return k === component;
  });
  if (matchKeys?.length === 1) {
    const matchKey = matchKeys[0];
    return viewsModules[matchKey];
  }
  if (matchKeys?.length > 1) {
    console.warn(
      'Please do not create `.vue` and `.TSX` files with the same file name in the same hierarchical directory under the views folder. This will cause dynamic introduction failure'
    );
    return;
  }
};

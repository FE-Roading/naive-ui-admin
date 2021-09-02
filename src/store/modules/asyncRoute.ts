import { toRaw, unref } from 'vue';
import { defineStore } from 'pinia';
import { RouteRecordRaw } from 'vue-router';
import { store } from '@/store';
import { asyncRoutes, constantRouter } from '@/router/index';
import { generatorDynamicRouter } from '@/router/generator-routers';
import { useProjectSetting } from '@/hooks/setting/useProjectSetting';

interface TreeHelperConfig {
  id: string;
  children: string;
  pid: string;
}

const DEFAULT_CONFIG: TreeHelperConfig = {
  id: 'id',
  children: 'children',
  pid: 'pid',
};

const getConfig = (config: Partial<TreeHelperConfig>) => Object.assign({}, DEFAULT_CONFIG, config);

export interface IAsyncRouteState {
  menus: RouteRecordRaw[];
  routers: any[];
  addRouters: any[];
  keepAliveComponents: string[];
  isDynamicAddedRoute: boolean;
}

function filter<T = any>(
  tree: T[],
  func: (n: T) => boolean,
  config: Partial<TreeHelperConfig> = {}
): T[] {
  config = getConfig(config);
  const children = config.children as string;

  function listFilter(list: T[]) {
    return list
      .map((node: any) => ({ ...node }))
      .filter((node) => {
        node[children] = node[children] && listFilter(node[children]);
        return func(node) || (node[children] && node[children].length);
      });
  }

  return listFilter(tree);
}

export const useAsyncRouteStore = defineStore({
  id: 'app-async-route',
  state: (): IAsyncRouteState => ({
    menus: [],
    routers: constantRouter,
    addRouters: [],
    keepAliveComponents: [],
    // Whether the route has been dynamically added
    isDynamicAddedRoute: false,
  }),
  getters: {
    getMenus(): RouteRecordRaw[] {
      return this.menus;
    },
    getIsDynamicAddedRoute(): boolean {
      return this.isDynamicAddedRoute;
    },
  },
  actions: {
    getRouters() {
      return toRaw(this.addRouters);
    },
    setDynamicAddedRoute(added: boolean) {
      this.isDynamicAddedRoute = added;
    },
    // 设置动态路由
    setRouters(routers) {
      this.addRouters = routers;
      // constantRouter重复多次添加
      this.routers = constantRouter.concat(routers);
    },
    setMenus(menus) {
      // 设置动态路由
      this.menus = menus;
    },
    setKeepAliveComponents(compNames) {
      // 设置需要缓存的组件
      this.keepAliveComponents = compNames;
    },
    /**
     * 根据权限管理模式，获取用户的路由列表
     * @param data object  用户登录时返回的用户信息
     * @returns 用户的路由列表accessedRouters
     * 1、获取用户权限列表：permissionsList = data.permissions || []
     * 2、获取项目的权限管理模式permissionMode：保存在setting/projectSetting.ts中，值为：菜单权限模式 FIXED 前端固定路由  BACK 动态获取
     * 2.1、动态获取（permissionMode==BACK），动态路由列表并添加到路由中，保存路由列表到accessedRouters中
     * 2.2、前端固定（permissionMode==FIXED），根据用户权限及路由权限配置来动态生成该用户的路由列表accessedRouters
     * 3、根据用户权限及路由权限配置来动态生成该用户的路由列表accessedRouters ———— 跟2.2有重复的点，应该没必要了
     * 4、保存accessedRouters到addRouters、routers、menus中
     * 5、返回accessedRouters
     * 
     */
    async generateRoutes(data) {
      let accessedRouters;
      const permissionsList = data.permissions || [];
      const routeFilter = (route) => {
        const { meta } = route;
        const { permissions } = meta || {};
        if (!permissions) return true;
        return permissionsList.some((item) => permissions.includes(item.value));
      };
      const { getPermissionMode } = useProjectSetting();
      const permissionMode = unref(getPermissionMode);
      if (permissionMode === 'BACK') {
        // 动态获取菜单
        try {
          accessedRouters = await generatorDynamicRouter();
        } catch (error) {
          console.log(error);
        }
      } else {
        try {
          //过滤账户是否拥有某一个权限，并将菜单从加载列表移除
          accessedRouters = filter([...asyncRoutes, ...constantRouter], routeFilter);
        } catch (error) {
          console.log(error);
        }
      }
      accessedRouters = accessedRouters.filter(routeFilter);
      this.setRouters(accessedRouters);
      this.setMenus(accessedRouters);
      return toRaw(accessedRouters);
    },
  },
});

// Need to be used outside the setup
export function useAsyncRouteStoreWidthOut() {
  return useAsyncRouteStore(store);
}

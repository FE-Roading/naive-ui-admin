import type { RouteRecordRaw } from 'vue-router';
import { isNavigationFailure, Router } from 'vue-router';
import { useUserStoreWidthOut } from '@/store/modules/user';
import { useAsyncRouteStoreWidthOut } from '@/store/modules/asyncRoute';
import { ACCESS_TOKEN } from '@/store/mutation-types';
import { storage } from '@/utils/Storage';
import { PageEnum } from '@/enums/pageEnum';
import { ErrorPageRoute } from '@/router/base';

const LOGIN_PATH = PageEnum.BASE_LOGIN;

const whitePathList = [LOGIN_PATH]; // no redirect whitelist

export function createRouterGuards(router: Router) {
  // 用户信息保存的store
  const userStore = useUserStoreWidthOut(); 
  // 用户权限相关信息的store
  const asyncRouteStore = useAsyncRouteStoreWidthOut();

  /**
   * 进入之前所做的工作如下：
   * 1、页面的loading状态开启
   * 2、如果从登录页进入errorPage，则强制跳转到主页————return
   * 3、如果页面不需要权限，则直接进入————return
   * 4、获取登录的token？已存在
   * >  4.1、该路由meta.ignoreAuth=true，则直接进入页面————return
   * >  4.2、页面replace to登录页面，保存URL的query参数并添加redirect为to.path————return
   * 5、已挂载过动态路由数据useAsyncRouteStore.isDynamicAddedRoute，直接进行登录————return
   * 6、获取useUserStoreWidthOut中的当前登录用户信息，把有权限的菜单和动态路由数据保存到useAsyncRouteStore
   * 7、将所有的动态路由逐个挂载router上
   * 8、如果已定义的路由表中没有404页面，则自动添加404
   * 9、跳转页面from.query.redirect || to.path
   * 10、将useAsyncRouteStore.isDynamicAddedRoute=true
   * 11、页面的loading状态关闭
   * 
   */
  router.beforeEach(async (to, from, next) => {
    const Loading = window['$loading'] || null;
    Loading && Loading.start();
    if (from.path === LOGIN_PATH && to.name === 'errorPage') {
      next(PageEnum.BASE_HOME);
      return;
    }

    // Whitelist can be directly entered
    if (whitePathList.includes(to.path as PageEnum)) {
      next();
      return;
    }

    const token = storage.get(ACCESS_TOKEN);

    if (!token) {
      // You can access without permissions. You need to set the routing meta.ignoreAuth to true
      if (to.meta.ignoreAuth) {
        next();
        return;
      }
      // redirect login page
      const redirectData: { path: string; replace: boolean; query?: Recordable<string> } = {
        path: LOGIN_PATH,
        replace: true,
      };
      if (to.path) {
        redirectData.query = {
          ...redirectData.query,
          redirect: to.path,
        };
      }
      next(redirectData);
      return;
    }

    if (asyncRouteStore.getIsDynamicAddedRoute) {
      next();
      return;
    }

    const userInfo = await userStore.GetInfo();

    const routes = await asyncRouteStore.generateRoutes(userInfo);

    // 动态添加可访问路由表
    routes.forEach((item) => {
      router.addRoute(item as unknown as RouteRecordRaw);
    });

    //添加404
    const isErrorPage = router.getRoutes().findIndex((item) => item.name === ErrorPageRoute.name);
    if (isErrorPage === -1) {
      router.addRoute(ErrorPageRoute as unknown as RouteRecordRaw);
    }

    const redirectPath = (from.query.redirect || to.path) as string;
    const redirect = decodeURIComponent(redirectPath);
    const nextData = to.path === redirect ? { ...to, replace: true } : { path: redirect, replace: true };
    asyncRouteStore.setDynamicAddedRoute(true);
    next(nextData);
    Loading && Loading.finish();
  });

  /**
   * 进入页面所做的工作如下：
   * 1、设置页面的title= (to?.meta?.title as string) || document.title
   * 2、如果从登录页进入errorPage，则强制跳转到主页————return
   * 3、如果页面不需要权限，则直接进入————return
   * 4、获取已被KeepAlive的所有路由列表：keepAliveComponents = asyncRouteStore.keepAliveComponents
   * 5、在当前路由匹配表中，查找当前页面的路由配置信息？
   * >  已找到 && 尚未被缓存 && to.meta?.keepAlive路由被被配置为需要缓存————存放到keepAliveComponents中
   * >  !to.meta?.keepAlive不需要缓存 || to.name == 'Redirect'————从缓存列表中找到并删除
   * 6、更新asyncRouteStore.keepAliveComponents
   * 7、页面的loading状态关闭
   * 
   */
  router.afterEach((to, _, failure) => {
    document.title = (to?.meta?.title as string) || document.title;
    if (isNavigationFailure(failure)) {
      //console.log('failed navigation', failure)
    }
    const asyncRouteStore = useAsyncRouteStoreWidthOut();
    // 在这里设置需要缓存的组件名称
    const keepAliveComponents = asyncRouteStore.keepAliveComponents;
    const currentComName: any = to.matched.find((item) => item.name == to.name)?.name;
    if (currentComName && !keepAliveComponents.includes(currentComName) && to.meta?.keepAlive) {
      // 需要缓存的组件
      keepAliveComponents.push(currentComName);
    } else if (!to.meta?.keepAlive || to.name == 'Redirect') {
      // 不需要缓存的组件
      const index = asyncRouteStore.keepAliveComponents.findIndex((name) => name == currentComName);
      if (index != -1) {
        keepAliveComponents.splice(index, 1);
      }
    }
    asyncRouteStore.setKeepAliveComponents(keepAliveComponents);
    const Loading = window['$loading'] || null;
    Loading && Loading.finish();
  });

  router.onError((error) => {
    console.log(error, '路由错误');
  });
}

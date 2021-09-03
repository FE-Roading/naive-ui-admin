## 1. 登录路由
挂载app时，最好等到路由初始化完成后挂载app。
```javascript
    // 挂载路由
  await setupRouter(app);
  // 路由准备就绪后挂载APP实例
  await router.isReady();

  app.mount('#app', true);
```
动态添加路由：
```javascript
  routes.forEach((route) => {
      router.addRoute(route as unknown as RouteRecordRaw);
  });
```
登录后，replace路由以防止通过浏览器回退到登录页面
```js
await router.replace(userInfo.homePath || PageEnum.BASE_HOME)
```

## 2. 退出登录
```javascript
// 清楚store的相关内容
userStore.logout().then(() => {
  message.success('成功退出登录');
  // 移除标签页
  localStorage.removeItem(TABS_ROUTES);
  router
    .replace({
      name: 'Login',
      query: {
        redirect: route.fullPath,
      },
    })
    .finally(() => location.reload());
});
```

## 亮点
### 路由页面重定向
1、页面定义： redirect.vue
```jsx
<script lang="tsx">
  import { defineComponent, onBeforeMount } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { NEmpty } from 'naive-ui';

  export default defineComponent({
    name: 'Redirect',
    setup() {
      const route = useRoute();
      const router = useRouter();
      onBeforeMount(() => {
        const { params, query } = route;
        const { path } = params;
        router.replace({
          path: '/' + (Array.isArray(path) ? path.join('/') : path),
          query,
        });
      });
      return () => <NEmpty />;
    },
  });
</script>
```
2、路由定义
```ts
export const RedirectRoute: AppRouteRecordRaw = {
  path: '/redirect',
  name: RedirectName,
  component: Layout,
  meta: {
    title: RedirectName,
    hideBreadcrumb: true,
  },
  children: [
    {
      path: '/redirect/:path(.*)',
      name: RedirectName,
      component: () => import('@/views/redirect/index.vue'),
      meta: {
        title: RedirectName,
        hideBreadcrumb: true,
      },
    },
  ],
};
```
3、跳转示例
```jsx
const reloadPage = () => {
  router.push({
    path: '/redirect' + unref(route).fullPath,
  });
};
```

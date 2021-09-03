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

# Hermes MVP（Android / Termux / PRoot）

这是一个在手机浏览器中使用的 Android + Termux + PRoot 垂直切片，不是 APK。

## 构建

在源码机器上执行：

```bash
npm run build
```

将构建产物 `dist/`、`server.mjs` 和 `server/` 复制到 Debian 的 `/root/hermes-mvp`。前置条件是 Debian 已安装 Node，且已有安装并完成供应商配置的 Hermes；不要从源码机复制 Hermes 配置、`.env` 或任何密钥。

## 在 Debian 中启动

在 Termux 中进入 Debian 后以前台方式启动：

```bash
proot-distro login debian12
cd /root/hermes-mvp
PORT=8787 HERMES_TIMEOUT_MS=90000 node server.mjs
```

服务只绑定回环地址。浏览器访问：`http://127.0.0.1:8787`。

打开第二个 Termux 会话后，可在 Termux 主机执行健康检查：

```bash
curl http://127.0.0.1:8787/health
```

预期响应 JSON 必须为：

```json
{"status":"ok"}
```

## 浏览器流程

1. 输入目标。
2. 回答问题。
3. 生成并等待真实计划返回。
4. 保存计划。
5. 刷新页面确认结果。

超时、非 JSON 响应或网络错误会显示可重试的中文错误；系统不会伪造兜底计划。

为满足已验证的 DeepSeek 直连路由要求，继承的代理变量只会对 Hermes 子进程被清除。不要复制或泄露配置与密钥。

## 限制

服务运行在前台 PRoot 中，Android 可能杀掉进程，此时需要重新启动。真实手机上的完整验证必须单独执行。

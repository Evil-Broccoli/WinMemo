# Windows Memo

Windows Memo 是一款本地优先的 Windows 桌面便签应用，用于快速记录文本和图片。

## 环境要求

- Node.js `20.17+` 或 `22+`
- npm `11+`
- Windows

## 开发

安装依赖：

```powershell
npm install
```

使用 Vite 开发服务器启动 Electron 应用：

```powershell
npm run dev
```

运行基础检查：

```powershell
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

应用项目格式化规则：

```powershell
npm run format
```

创建未打包的桌面构建：

```powershell
npm run package
```

源代码按照桌面应用职责分层：

```text
src/
  main/       Electron 生命周期与原生窗口管理
  preload/    安全的渲染进程桥接层
  renderer/   React 用户界面
  shared/     跨层共享常量与类型
```

## 本地数据库

Electron 主进程会在打开主窗口前初始化本地 SQLite 数据库。数据库文件位于：

```text
<Electron userData>/windows-memo.sqlite3
```

初始化流程使用 Electron 内置的 `node:sqlite` 模块，并通过
`PRAGMA user_version` 记录仅追加的迁移版本。v1 迁移规则请参阅
`src/main/persistence/README.md`。

在隔离开发或 QA 验证中，可以设置 `WINDOWS_MEMO_USER_DATA_PATH`，将数据库写入临时目录。

## 托管图片资源

插入的位图会复制到 `<Electron userData>/assets/`，并在 Markdown 中使用稳定的
`windows-memo-asset://local/...` URL 引用。主进程资源服务会在存储前校验 PNG、JPEG、
GIF 和 WebP 文件内容。路径和降级规则请参阅 `src/main/assets/README.md`。

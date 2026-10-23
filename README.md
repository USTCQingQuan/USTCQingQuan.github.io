# 权益广场

中国科学技术大学 校团委青年权益服务中心官方网站

- 线上地址：https://ustcqingquan.github.io/
- 收录内容：权益反馈渠道、校园报修、部门直拨电话、教学服务、校园平台
- 技术形态：单文件 `index.html`（内联 CSS + JS）+ 4 个 JSON 数据文件，无构建依赖
- 数据维护：改 `channels.json` / `news.json` / `issues.json` 即可，不用碰代码；
  改 `resources.json` 后需运行 `node tools/build-index.mjs` 重新内嵌

## 目录

| 路径 | 说明 |
|---|---|
| `index.html` | 整个站点 |
| `resources.json` | 校园平台资源（页面只显示「校内平台」那 6 条） |
| `channels.json` | 权益渠道 / 报修 / 部门电话 / 教学服务 |
| `news.json` | 工作动态 |
| `issues.json` | 典型问题处理 |
| `tools/build-index.mjs` | 把 resources.json 打进 index.html |
| `tests/` | 7 个测试套件，`npm test` |

## 测试

```bash
npm test
```

## 维护文档

见同级目录《维护说明.md》。

# 备份：分类条（subnav）与内页入口

> 2026-10-21 按要求把「学生权益反馈渠道」页上的**分类条**和**顶部说明框**删掉了。
> 本文留存相关代码与恢复方法。
>
> **代码没有被删除，只是用开关关掉了。** 恢复改一个变量即可。

---

## 一、删掉的是什么

原来「学生权益反馈渠道」页顶部：

```
[首页] [学生权益反馈渠道] [校园报修] [部门直拨电话] [教学服务]     ← 顶部导航（保留）
─────────────────────────────────────────────────────────────
 主渠道 6 | 全部渠道 23 | 校内平台 30 | 校园信息 5                ← 分类条（已隐藏）
─────────────────────────────────────────────────────────────
 这三条是最直接的学生权益反馈渠道 —— 按你所属的组织选一个…          ← 说明框（已去掉）
─────────────────────────────────────────────────────────────
 青权中心 · 权益反馈平台 / 校学生会 · 研究生会 / 高新园区团工委      ← 内容（保留）
```

## 二、副作用（重要）

分类条是「全部渠道」「校内平台」「校园信息」**唯一**的入口。关掉后：

| 页面 | 路由 | 状态 |
|---|---|---|
| 全部渠道（27 条 / 8 组） | `#/rights/channels` | 代码与路由都在，**页面上没入口**，手动输网址可访问 |
| 校内平台（30 个） | `#/rights/platforms` | 同上 |
| 校园信息（5 条） | `#/rights/campus` | 同上 |

`parseRoute()` 读的是 SECTIONS，SECTIONS 没动，所以深链接仍然有效。

## 三、恢复方法

### 恢复分类条
`index.html` 里搜 `SHOW_SUBNAV`：

```js
var SHOW_SUBNAV = false;   // 改成 true
```

### 恢复说明框

**注意：说明框已从四个快捷页全部移除**（学生权益反馈渠道 / 校园报修 / 部门直拨电话 / 教学服务），
不是只去掉了精简页那一处。`QUICK_PAGES` 里四条 `intro` 现在都是 `null`，
想恢复哪一页就把哪一页改回对应常量：

| 页面 | 改回 |
|---|---|
| 学生权益反馈渠道 | `INTRO_KEY` |
| 校园报修 | `INTRO_REPAIR` |
| 部门直拨电话 | `INTRO_DEPT` |
| 教学服务 | `INTRO_TEACH` |

（「全部渠道」完整页仍然保留说明框，用的是 `INTRO_FULL`，没动。）
`QUICK_PAGES` 里 key 这一条的 `intro`：

```js
key: { el: viewKey, catIds: KEY_CAT_IDS, intro: INTRO_KEY },   // 原来是 null
```

---

## 四、相关代码存档

### 4.1 分类条的渲染代码（在 `renderModebar()` 末尾）

```js
  // 二级：当前分区下的子视图
  /* 分类条暂时隐藏。
     它是「全部渠道 / 校内平台 / 校园信息」唯一的入口，关掉后这三个页面没有入口，
     但代码与路由都还在，手动输网址（#/rights/channels 等）仍可访问。
     恢复只需把这里改成 true，详见《备份-分类条与内页入口.md》。 */
  subnav.innerHTML = "";
  var sec = SHOW_SUBNAV ? currentSection() : null;
  if (sec) {
    subnav.hidden = false;
    for (var k = 0; k < sec.subs.length; k++) {
      (function (sub) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "sub-btn" + (route.sub === sub.id ? " active" : "");
        b.textContent = sub.label;
        if (sub.n) {
          var sp = document.createElement("span");
          sp.className = "n";
          sp.textContent = sub.n();
          b.appendChild(sp);
        }
        b.addEventListener("click", function () { go(sec.id, sub.id); });
        subnav.appendChild(b);
      })(sec.subs[k]);
    }
  } else {
    subnav.hidden = true;
  }
}

```

### 4.2 分类条的 DOM 容器

```html
<div class="wrap subnav" id="subnav" hidden></div>
```

### 4.3 `#subnav` 的样式（CSS 里搜 `.subnav` / `.sub-btn`）

```css
.subnav { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 0 12px; }
.subnav[hidden] { display: none; }
.sub-btn { border: 1px solid var(--border); background: #fff; border-radius: 999px;
           padding: 5px 14px; font-size: 13px; color: var(--muted); cursor: pointer; }
.sub-btn:hover { color: var(--primary); background: #eef4fc; }
.sub-btn.active { color: #fff; background: var(--primary); border-color: var(--primary); }
.sub-btn .n { font-weight: 400; opacity: .7; margin-left: 4px; }
```

### 4.4 四个子视图的定义（SECTIONS 里 rights 那一段）

```js
    id: "rights", label: "学生权益反馈渠道",
    subs: [
      { id: "key", label: "主渠道", n: function () { return countChannelsIn(KEY_CAT_IDS); } },
      { id: "channels", label: "全部渠道", n: function () { return CHANNELS ? CHANNELS.count : "…"; } },
      { id: "platforms", label: "校内平台", n: function () { return countIn(["校内平台"]); } },
      { id: "campus", label: "校园信息", n: function () { return countIn(["校园信息"]); } },
    ],
  },

```

### 4.5 说明文案

```js
var INTRO_FULL =
  "遇到问题不知道找谁？这里汇总了校内的反馈渠道 —— " +
  "<b>网页、QQ 群、电话、邮箱、公众号都有</b>，按你的习惯选一个。部分渠道还在收集中，已标注「待补充」。";

```

---

## 五、如果想彻底删除（不再恢复）

1. 删 `index.html` 里 `<div class="wrap subnav" id="subnav" hidden></div>`
2. 删 `renderModebar()` 里「二级：当前分区下的子视图」那一段
3. 删 `const subnav = document.getElementById("subnav");`
4. 删 SECTIONS 里 rights 的 `channels` / `platforms` / `campus` 三个 sub
5. 删 CSS 里 `.subnav` / `.sub-btn` 相关规则
6. 删 `view-channels` / `view-resources` 里 campus / platforms 的渲染分支

**注意**：第 4 步之后 `#/rights/channels` 这类深链接会失效（parseRoute 找不到 sub，回落首页）。

---

*备份时间：2026-10-21*

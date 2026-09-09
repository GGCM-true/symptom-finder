# 省医 · 症状导诊查询工具（科普参考版）

以 **四川省医学科学院·四川省人民医院（本部）** 为范例的「症状 → 挂号科室」导诊知识库与查询页面。

- 收录 **105 条**高频症状导诊条目、**31 个**科室/门诊
- 电脑 / 手机自适应（响应式网页）
- 数据与界面分离：`data.js` 即结构化数据库，改数据不用动页面

## 一、文件结构

| 文件 | 作用 |
|---|---|
| `index.html` | 主查询页面（症状查询 / 科室浏览 / 组合分诊 三个页签 + 人体部位点选，样式与逻辑内联） |
| `guahao.html` | **模拟挂号页**：科室位置/挂号费/医生排班/就诊时段序号，由导诊结果卡「去挂号」直达 |
| `data.js` | **数据层**：`TRIAGE_DATA` 全局对象（科室目录 + 症状条目 + 挂接映射） |
| `backend/` | **Spring Boot + MyBatis API 版后端**：网页可从 MySQL 实时取数（详见 backend/README.md） |
| `tools/export_mysql.js` | data.js → MySQL SQL 自动转换脚本（扩展数据后重跑刷新） |
| `tools/export_oracle.js` | data.js → **Oracle 23ai** SQL 自动转换脚本（同一数据源双库导出） |
| `sql/import_all.sql` | MySQL 一键导入脚本（建库 + 建表 + 数据，推荐） |
| `sql/schema.sql` | 仅建库建表（供单独学习 DDL） |
| `sql/data.sql` | 仅数据 INSERT（供单独学习 DML） |
| `sql/dml_practice.sql` | MySQL 版**数据变更练习脚本**：增删改全流程示例，整体包在事务里，可 ROLLBACK 反复练 |
| `sql/oracle/00_create_user.sql` | Oracle 建用户脚本（system 账号在 freepdb1 中执行） |
| `sql/oracle/01_schema.sql` | Oracle 建表 DDL（VARCHAR2/CLOB/原生 JSON 类型） |
| `sql/oracle/02_data.sql` | Oracle 数据导入（INSERT ALL 批量写法） |
| `sql/oracle/import_all_oracle.sql` | Oracle 一键导入（01+02 合并，建好用户后执行） |
| `sql/oracle/dml_practice_oracle.sql` | Oracle 版数据变更练习脚本（含 JSON_TRANSFORM 用法） |
| `data-entry-guide.md` | **数据录入方式指南**：改 data.js 一键重导 / Excel 导入 DBeaver / 表格直接编辑 / SQL 批量造数 四招 |

> 纯静态、零依赖，无需安装任何环境，双击 `index.html` 即可使用；也可通过 WorkBuddy「发布为应用」一键生成在线链接。

## 二、页面功能

1. **症状查询**：输入"肚子疼 / 发烧 / 拉肚子"等口语词 → 即时联想标准症状名 → 回车或点选查看结果卡片
2. **结果卡片**：分诊级别色标（🟢门诊 / 🟡尽快 / 🔴急诊）→ 可能的专业诊断 → 建议挂号科室 + 备选/转诊 → 疾病科普 → 就诊提示 → 急诊红线
3. **科室浏览**：31 个科室按 内科 / 外科 / 妇产儿科 / 五官口腔皮肤 / 急诊与中心 分组，点某科下的症状可反向跳转查询
4. **诊断反查**：结果卡片的「可能的专业诊断」为可点击词条，点开会弹层列出该诊断在库中关联的所有症状条目（按名称自动匹配跨条目），再点某条即可跳转并高亮对应卡片
5. **人体部位点选**：首页可展开人体示意图，点头/眼/耳/胸/腹/腰背/四肢/皮肤等部位 → 显示该部位常见症状 → 点症状即查询（仿官方智能导诊交互）
6. **多症状组合分诊**：可同时勾选多个症状，按「首诊 +3 / 备选 +1 / 共享诊断 +1」加权给科室排名，输出综合挂号建议；含急危征兆（红级）独立提醒
7. **模拟挂号**：结果卡「去挂号」直达对应科室模拟挂号页，含楼层诊室、挂号费、支付方式、医生排班、就诊日期/时段/序号（数据虚构、仅演示）

## 三、数据模型（data.js 字段）

每条症状记录结构：

| 字段 | 说明 | 示例 |
|---|---|---|
| `id` | 唯一标识 | `"fever"` |
| `name` | 标准症状名 | `"发热"` |
| `keywords` | 同义词/口语词（搜索命中用） | `["发烧","体温高","低热"]` |
| `population` | 适用人群（通用则不显示） | `"儿童（≤14 岁）"` |
| `diagnoses` | 可能的专业诊断方向 | `["上呼吸道感染","流感"]` |
| `dept` | 首诊科室（医院门诊名） | `"感染科门诊（发热门诊）"` |
| `deptNote` | 科室补充说明（可空） | `"本部发热门诊 24 小时开诊"` |
| `alts` | 备选 / 转诊科室（数组） | `["儿科门诊（≤14 岁）"]` |
| `level` | 分诊级别 `green/yellow/red` | `"yellow"` |
| `science` | 疾病科普（100–200 字） | … |
| `tips` | 就诊提示（数组，自动编号） | `["先量体温…"]` |
| `redline` | 急诊红线（何时必须去急诊） | … |
| `cat` | 卡片上的分类标签 | `"发热与感染"` |

## 四、如何扩展数据

直接在 `data.js` 的 `entries` 数组末尾追加一条即可（仿照现有条目补全字段）：

```js
{
  id: "your-id", name: "症状名", cat: "分类标签",
  keywords: ["别名1", "别名2"],
  population: "通用",
  diagnoses: ["可能诊断A", "可能诊断B"],
  dept: "科室名（需能在 deptKeys 或 departments.name 中匹配）",
  deptNote: "",
  alts: ["备选科室"],
  level: "green",
  science: "科普文字…",
  tips: ["提示1", "提示2"],
  redline: "急诊红线提示…"
}
```

**科室匹配规则**：条目里的科室名先去掉括号注释（如 `儿科门诊（≤14 岁）→ 儿科门诊`），再到 `deptKeys` 里查 key；查不到就按名称包含关系兜底。若你写了新科室，需要在 `departments` 数组补一条（含 `key/name/group/intro`），需要时再在 `deptKeys` 补一行映射。

## 五、导入 MySQL（已生成现成脚本）

数据与界面分离，`data.js` 是唯一数据源；已提供自动转换脚本，**无需手写 SQL**。

### 5.1 一键导入（首次）

```bash
# 在项目根目录(shengyi-triage/)执行,按提示输入 MySQL root 密码
mysql --default-character-set=utf8mb4 -uroot -p < sql/import_all.sql
```

脚本会执行：建库 `shengyi_triage`(utf8mb4) → 建 5 张表 → 灌入全部数据。**注意：同名库会先删除再重建**（`DROP DATABASE IF EXISTS`），只影响 `shengyi_triage` 这一个库。

### 5.2 数据库结构（5 张表）

| 表 | 作用 | 关键字段 |
|---|---|---|
| `departments` | 科室目录(31) | `dept_key` PK、`name`、`dept_group`、`intro` |
| `triage_levels` | 分诊级别字典(3) | `level_key` = green/yellow/red、`label`、`hint` |
| `triage_meta` | 元信息(医院/地址/免责声明等 8 项) | `meta_key`、`meta_value` |
| `triage_entries` | 症状导诊条目(57) | `entry_id` PK、`name`、`category`、`population`、`dept_key`(FK)、`dept_display`、`dept_note`、`level_key`(FK)、`diagnoses`/`alts`/`tips`(JSON)、`science`、`redline` |
| `triage_keywords` | 搜索词展开表(772) | `(entry_id, keyword)` 联合 PK，keyword 带索引便于 `LIKE` |

### 5.3 常用查询示例

```sql
USE shengyi_triage;

-- 按口语词搜症状(如"肚子疼"→ 腹痛)
SELECT e.name, e.dept_display, l.label
FROM triage_keywords k
JOIN triage_entries e ON e.entry_id = k.entry_id
JOIN triage_levels l ON l.level_key = e.level_key
WHERE k.keyword LIKE '%肚子疼%';

-- 每个科室负责哪些症状
SELECT d.name, GROUP_CONCAT(e.name SEPARATOR '、') AS symptoms, COUNT(*) AS cnt
FROM triage_entries e JOIN departments d ON d.dept_key = e.dept_key
GROUP BY d.dept_key ORDER BY cnt DESC;

-- 红色(立即急诊)警示条目
SELECT name, dept_display, redline FROM triage_entries WHERE level_key = 'red';

-- 某一科的症状详情(JSON 里的 tips 取出)
SELECT name, diagnoses, tips FROM triage_entries
WHERE JSON_CONTAINS(diagnoses, '"上呼吸道感染"');
```

### 5.4 扩展数据后如何刷新数据库

1. 在 `data.js` 追加/修改条目（规则见第四节）
2. 重新生成 SQL：`node tools/export_mysql.js`（覆盖 `sql/` 下三个文件）；若同步维护了 Oracle 版，再执行 `node tools/export_oracle.js`（覆盖 `sql/oracle/`）
3. 重新执行 5.1 的导入命令即可

### 5.5 导出 Excel（备选）

用 Python/Node 解析 `data.js` 后一行一条导出；`keywords`/`alts`/`tips` 用「、」分隔。也可在 MySQL 里用 `SELECT ... INTO OUTFILE` 或直接连 DBeaver/Excel 导出。

### 5.6 可选：同一份数据导入 Oracle 23ai（练 Oracle 方言）

如果本机装的是 Oracle 23ai Free（默认 PDB 为 `freepdb1`），可用同一数据源建一套 Oracle 库，对照学习两库差异。生成脚本在 `sql/oracle/`，由 `tools/export_oracle.js` 产出：

```bash
node tools/export_oracle.js   # data.js 变更后重跑即可刷新 Oracle 脚本
```

导入三步（DBeaver 图形化操作）：

1. **建用户**：用 `system` 账号连接 `freepdb1`，执行 `sql/oracle/00_create_user.sql`（建 `shengyi_triage` 用户，默认密码 `oracle123`，可自行修改）
2. **建表 + 导数据**：新建连接（localhost:1521 / 服务名 freepdb1 / shengyi_triage），打开 `sql/oracle/import_all_oracle.sql` 全选执行；或分步执行 `01_schema.sql` → `02_data.sql`
3. **验证**：`SELECT COUNT(*) FROM triage_entries;` 应为 105；练习增删改用 `sql/oracle/dml_practice_oracle.sql`

与 MySQL 版的核心差异（脚本内注释均已标注）：`VARCHAR2(n CHAR)`/`CLOB` 代替 `VARCHAR`/`TEXT`；**原生 JSON 类型**（文本自动包装）；批量插入用 `INSERT ALL`（MySQL 的多行 `VALUES` 不支持）；改 JSON 用 `JSON_TRANSFORM`；注释用 `COMMENT ON`；外键列需手动建索引；**默认不自动提交，需显式 `COMMIT`**；报错码为 `ORA-xxxx`。

## 六、医疗合规

- 科室与门诊名称整理自省医院官网（samsph.cn）科室公示，**2026-09 核对**，实际以医院当日开诊为准
- 症状→科室对应为三甲医院通行分诊惯例的**科普参考**，不能替代医生面诊
- 页面页脚已内置免责声明；正式对外使用前建议请院内医生/信息中心复核一遍

## 七、附录：同类导诊产品参考

| 产品 | 形态 | 特点 | 与本工具差异 |
|---|---|---|---|
| **省医院官方公众号/小程序** | 微信小程序 | 官方「智能导诊」（人体图点症状→推荐科室→选医生），另接 DeepSeek「智慧客服」 | 官方实时号源，可挂号；本工具是离线科普知识库，可任意改、可学习 |
| 微医（WeDoctor） | APP / 小程序 | 智能分诊、预约挂号、报告解读 | 全国通用线上问诊平台 |
| 丁香医生 | APP | 「症状自查」问答式，偏科普 | 不绑定具体医院科室排布 |
| 百度健康 | 网页/APP | 症状查询 + 挂号聚合 | 信息量大但科室名非省医口径 |
| 各大医院院内自助机"导诊台" | 线下 | 简单部位—科室映射 | 无科普内容 |

> 结论：你的需求可以自建实现（即本工具），且数据口径比通用 APP 更贴合省医院实际科室命名；如要上线对外，建议参考省医院官方小程序做交互升级。

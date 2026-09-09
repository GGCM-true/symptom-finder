# 往数据库录数据:别一条条敲,先选对方式

> 适用:省医导诊知识库(MySQL 版 `sql/` 与 Oracle 版 `sql/oracle/` 通用)
> 核心思想:**同样的活,90% 情况不需要手写 INSERT**。

## 一、先搞清你的场景属于哪一种

| 场景 | 推荐方式 | 工具 | 一句话 |
|---|---|---|---|
| ① 给"网页查询工具"加/改症状、科室(长期维护) | **方式 A** | 记事本/编辑器 + node | 只改 `data.js`,一条命令刷新全部 |
| ② 一批几十条一次性数据,只进数据库 | **方式 B** | Excel/WPS + DBeaver | 像填表一样排好,导入向导灌进去 |
| ③ 就改 1–3 条 / 新增零星几行 | **方式 C** | DBeaver | 表格视图里直接像 Excel 一样编辑 |
| ④ 要几百行"测试数据"练手 | **方式 D** | DBeaver | 一条 SQL 生成 50、500 行 |

---

## 方式 A:只改 data.js,一条命令重导 ⭐(本项目的"正门")

这套工具的设计初衷就是:**`data.js` 是唯一录入口,SQL 永远由程序生成,不手写。**

**例子:想给"发热"下面加一条新症状「寒战」:**

1. 用记事本/编辑器打开 `data.js`,找到 `entries: [` 数组,在末尾仿照任意一条现有条目追加(字段名完全一样即可):

```js
{
  id: "chill",
  name: "寒战",
  cat: "发热与感染",
  population: "通用",
  keywords: ["发抖", "打摆子", "怕冷发抖"],
  diagnoses: ["上呼吸道感染", "败血症(待排查)"],
  dept: "感染科门诊（发热门诊）",
  deptNote: "寒战多为感染引起的高热前兆,建议尽快查明原因。",
  level: "yellow",
  alts: ["急诊医学科（急症）"],
  tips: ["先量体温,寒战后多伴随高热。", "注意保暖,记录发作时间。"],
  science: "寒战是身体在体温调定点升高时通过骨骼肌收缩产热的表现,常提示感染…",
  redline: "寒战后体温骤升伴意识模糊、抽搐、呼吸困难,立即急诊。"
}
```

> 字段对照表见 `README.md` 第三节;`id` 取英文短词即可(如 `chill`),不能与现有重复。

2. 在项目根目录开终端(CMD/PowerShell/Git Bash 均可),执行:

```bash
node tools/export_mysql.js    # 刷新 MySQL 脚本(sql/)
node tools/export_oracle.js   # 刷新 Oracle 脚本(sql/oracle/)
```

3. 把新生成的 SQL 重新导入一次即可(MySQL: `sql/import_all.sql`;Oracle: `sql/oracle/import_all_oracle.sql`,执行方式见 README 5.1 / 5.6)。

4. 完成。**网页、MySQL、Oracle 三处数据永远一致**,而且同义词自动进搜索词表,不用你手动维护第二张表。

---

## 方式 B:Excel/CSV 排好 → DBeaver 导入向导(一次性批量)

适合手里本来就有一张表(比如从别的系统导出的清单、Excel 整理好的数据)。

**以 `departments` 表为例(4 列纯文本):**

1. 在 Excel/WPS 里新建一列一列排好,**表头必须与表列名完全一致**:

```csv
dept_key,name,dept_group,intro
demo1,示例科室1,内科,演示用科室
demo2,示例科室2,外科,演示用科室
```

2. 另存为 **CSV UTF-8** 或直接保存为 `.xlsx`。

3. DBeaver 左侧展开表 → **右键表名 → 导入数据(Import Data)** → 选文件 → 下一步。

4. 关键两步:
   - 勾选 **「首行为列名 / First row is header」**
   - 在列映射页核对每一列对应(通常自动匹配,人工扫一眼)

5. 点完成 → 底部提示导入了多少行。**Oracle 连接记得点一下「提交」**(默认不自动提交)。

**如果导的是 `triage_entries`(含 JSON 列):** 单元格里直接写 `["上呼吸道感染","流行性感冒"]` 这种文本即可,MySQL 和 Oracle 都会自动识别为 JSON,不用任何特殊处理。列多就横向拉宽慢慢填,总比改 SQL 字符串舒服。

> 小技巧:几十行内容相似的记录,先在 Excel 里输入 1 行 → 鼠标拖右下角**下拉填充**,再逐个改不同处(比在 SQL 里改快得多,也不容易弄坏引号)。

---

## 方式 C:就改几条 —— DBeaver 表格视图直接编辑

1. DBeaver 左侧双击表名(如 `triage_entries`)→ 下方打开数据表格。
2. 想改哪格点哪格,直接输入(和 Excel 一样);
   想加行 → 滚到**表格最底部的空行**输入;
   想复制一行再改 → 点行首选中 → Ctrl+C → 在空行 Ctrl+V → 改关键单元格。
3. 点左上角 **保存 / Ctrl+S**;Oracle 连接再点**「提交」**。

> 适合:临时修一个错别字、改一条分诊级别、补一个搜索词。

---

## 方式 D:一条 SQL 生成几百行测试数据

练 SQL 想有大量数据时,不用手打:

**MySQL 8(递归 CTE):**

```sql
-- 给 entry_id='fever' 批量造 50 个测试搜索词(仅测试,做完记得删)
INSERT INTO triage_keywords (entry_id, keyword)
WITH RECURSIVE seq AS (
  SELECT 1 AS n
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 50
)
SELECT 'fever', CONCAT('测试同义词', n) FROM seq;
```

**Oracle(经典 CONNECT BY):**

```sql
INSERT INTO triage_keywords (entry_id, keyword)
SELECT 'fever', '测试同义词' || LEVEL
FROM dual
CONNECT BY LEVEL <= 50;
```

> ⚠️ 造完记得清理:`DELETE FROM triage_keywords WHERE keyword LIKE '测试同义词%';`(Oracle 下再 `COMMIT;`)
> 同款思路还能配合 `DBMS_RANDOM`/`RAND()` 生成随机体温、随机日期等,做报表练习很爽。

---

## 二、那什么时候才值得"手写 INSERT"?

只有一种情况:**只加 1 条、且只是临时试验**,手写最快(见 `dml_practice.sql` / `dml_practice_oracle.sql` 的写法)。

除此之外一律用 A / B / C / D——**复制例句后一条条改关键信息是又慢又容易出错的做法**,引号、逗号、JSON 格式错一个就整段报错,排查成本远高于上面任何一招。

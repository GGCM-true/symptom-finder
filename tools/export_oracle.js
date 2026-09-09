/* ============================================================
   省医 · 症状导诊知识库 — data.js 导出为 Oracle 23ai SQL 脚本
   用法:  node tools/export_oracle.js
   产物(sql/oracle/ 目录):
     00_create_user.sql        建用户(需以 system 管理员在 PDB 中执行)
     01_schema.sql             建表 DDL(Oracle 方言)
     02_data.sql               数据 INSERT(Oracle INSERT ALL 批量写法)
     import_all_oracle.sql     01+02 合并(建好用户后一键执行)
   数据扩展后重跑本脚本即可刷新,无需手写 INSERT。
   与 MySQL 版(sql/ 目录)共用同一份 data.js 数据源。
   ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const code = fs.readFileSync(path.join(root, "data.js"), "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code + "\nthis.__D = TRIAGE_DATA;", ctx);
const D = ctx.__D;

const outDir = path.join(root, "sql", "oracle");
fs.mkdirSync(outDir, { recursive: true });

/* ---------- 工具函数 ---------- */
function esc(v) { // Oracle 同样用 '' 转义单引号
  return String(v).replace(/\\/g, "\\\\").replace(/'/g, "''");
}
function q(v) { return "'" + esc(v) + "'"; }
function stripParen(s) {
  return String(s).replace(/[（(].*?[)）]/g, "").trim();
}
// 与 MySQL 版同款解析:科室显示名 → dept_key
function keyOf(displayName) {
  if (!displayName) return null;
  const depMap = D.deptKeys || {};
  const n = stripParen(displayName).replace(/\s*\/\s*/g, "/");
  if (depMap[n]) return depMap[n];
  const compact = n.replace(/\s+/g, "");
  if (compact.length > 1) {
    for (const mk in depMap) {
      const mk2 = String(mk).replace(/\s+/g, "");
      if (mk2.length > 1 && (compact.indexOf(mk2) > -1 || mk2.indexOf(compact) > -1)) return depMap[mk];
    }
  }
  for (const d of D.departments) {
    if (compact.indexOf(d.name) > -1) return d.key;
  }
  return null;
}
function jsonArr(arr) { return q(JSON.stringify(arr)); }

// Oracle 的 INSERT ALL:每 20 行拆一段,避免单条 SQL 过长
function insertAllChunks(table, columns, rows, chunkSize) {
  chunkSize = chunkSize || 20;
  const head = "INSERT ALL\n";
  const parts = [];
  for (let i = 0; i < rows.length; i += chunkSize) {
    let s = head;
    for (const r of rows.slice(i, i + chunkSize)) {
      s += "  INTO " + table + " (" + columns.join(", ") + ") VALUES (" + r.join(", ") + ")\n";
    }
    s += "SELECT 1 FROM DUAL;";
    parts.push(s);
  }
  return parts.join("\n\n");
}

/* ---------- 00_create_user.sql ---------- */
let userSql = "";
userSql += "-- ============================================================\n";
userSql += "-- 省医 · 症状导诊知识库 (Oracle 23ai 版)  第 0 步: 建用户\n";
userSql += "-- 前提: Oracle 23ai Free 默认的 PDB 名为 freepdb1\n";
userSql += "-- 执行: 用 system 账号连接到 freepdb1(命令行 sqlplus 或 DBeaver 均可)\n";
userSql += "-- 说明: MySQL 的「数据库」在 Oracle 里对应「用户(schema)」\n";
userSql += "-- ============================================================\n\n";
userSql += "-- 建用户(密码建议改成你自己的, 可用字母+数字, 长度 >= 8)\n";
userSql += "CREATE USER shengyi_triage IDENTIFIED BY oracle123;\n\n";
userSql += "-- 授权: 能登录 + 能建表 + 表空间不受限\n";
userSql += "GRANT CONNECT, RESOURCE, UNLIMITED TABLESPACE TO shengyi_triage;\n\n";
userSql += "-- 若以后要重建, 可先删除该用户(会连数据一起删):\n";
userSql += "-- DROP USER shengyi_triage CASCADE;\n\n";
userSql += "-- 之后 DBeaver 新建连接: 主机 localhost / 端口 1521 / 服务名 freepdb1\n";
userSql += "-- 用户名 shengyi_triage / 密码 oracle123, 再执行 01_schema.sql → 02_data.sql\n";

/* ---------- 01_schema.sql ---------- */
let schema = "";
schema += "-- ============================================================\n";
schema += "-- 省医 · 症状导诊知识库 (Oracle 23ai 版)  建表脚本 DDL\n";
schema += "-- 数据源: ../data.js(2026-09 核对省医院官网 samsph.cn)\n";
schema += "-- 前提: 已用 00_create_user.sql 建好 shengyi_triage 用户\n";
schema += "-- 用 shengyi_triage 账号连接后执行本脚本\n";
schema += "-- 对比 MySQL 版差异: VARCHAR2(n CHAR) / CLOB / 原生 JSON 类型 /\n";
schema += "-- 无 ENGINE/CHARSET 子句 / 注释用 COMMENT ON / 外键列需手动建索引\n";
schema += "-- ============================================================\n\n";
schema += "-- 清理旧表(顺序: 先删有外键依赖的子表; 23ai 支持 IF EXISTS)\n";
schema += "DROP TABLE IF EXISTS triage_keywords  CASCADE CONSTRAINTS;\n";
schema += "DROP TABLE IF EXISTS triage_entries   CASCADE CONSTRAINTS;\n";
schema += "DROP TABLE IF EXISTS departments      CASCADE CONSTRAINTS;\n";
schema += "DROP TABLE IF EXISTS triage_levels    CASCADE CONSTRAINTS;\n";
schema += "DROP TABLE IF EXISTS triage_meta      CASCADE CONSTRAINTS;\n\n";

schema += "-- 1) 科室/门诊目录\n";
schema += "CREATE TABLE departments (\n";
schema += "  dept_key    VARCHAR2(32 CHAR)  NOT NULL,\n";
schema += "  name        VARCHAR2(100 CHAR) NOT NULL,\n";
schema += "  dept_group  VARCHAR2(32 CHAR)  NOT NULL,\n";
schema += "  intro       CLOB,\n";
schema += "  CONSTRAINT pk_departments PRIMARY KEY (dept_key)\n";
schema += ");\n";
schema += "COMMENT ON TABLE  departments               IS '科室目录';\n";
schema += "COMMENT ON COLUMN departments.dept_key      IS '科室唯一键';\n";
schema += "COMMENT ON COLUMN departments.name          IS '科室显示名(官网口径)';\n";
schema += "COMMENT ON COLUMN departments.dept_group    IS '分组:内科/外科/妇产儿科/五官口腔皮肤/急诊与中心';\n";
schema += "COMMENT ON COLUMN departments.intro         IS '科室简介';\n\n";

schema += "-- 2) 分诊级别字典\n";
schema += "CREATE TABLE triage_levels (\n";
schema += "  level_key VARCHAR2(16 CHAR) NOT NULL,\n";
schema += "  label     VARCHAR2(32 CHAR) NOT NULL,\n";
schema += "  hint      VARCHAR2(64 CHAR) NOT NULL,\n";
schema += "  CONSTRAINT pk_levels PRIMARY KEY (level_key)\n";
schema += ");\n";
schema += "COMMENT ON TABLE  triage_levels              IS '分诊级别';\n";
schema += "COMMENT ON COLUMN triage_levels.level_key    IS 'green/yellow/red';\n";
schema += "COMMENT ON COLUMN triage_levels.label        IS '显示名';\n";
schema += "COMMENT ON COLUMN triage_levels.hint         IS '提示语';\n\n";

schema += "-- 3) 知识库元信息\n";
schema += "CREATE TABLE triage_meta (\n";
schema += "  meta_key   VARCHAR2(32 CHAR) NOT NULL,\n";
schema += "  meta_value CLOB,\n";
schema += "  CONSTRAINT pk_meta PRIMARY KEY (meta_key)\n";
schema += ");\n";
schema += "COMMENT ON TABLE  triage_meta                 IS '知识库元信息(医院/地址/更新日期等)';\n";
schema += "COMMENT ON COLUMN triage_meta.meta_key        IS '键名';\n";
schema += "COMMENT ON COLUMN triage_meta.meta_value      IS '键值';\n\n";

schema += "-- 4) 症状导诊条目主表(JSON 列为 Oracle 21c+ 原生 JSON 类型)\n";
schema += "CREATE TABLE triage_entries (\n";
schema += "  entry_id     VARCHAR2(48 CHAR)  NOT NULL,\n";
schema += "  name         VARCHAR2(64 CHAR)  NOT NULL,\n";
schema += "  category     VARCHAR2(32 CHAR)  NOT NULL,\n";
schema += "  population   VARCHAR2(32 CHAR)  NOT NULL,\n";
schema += "  dept_key     VARCHAR2(32 CHAR)  NOT NULL,\n";
schema += "  dept_display VARCHAR2(100 CHAR) NOT NULL,\n";
schema += "  dept_note    CLOB,\n";
schema += "  level_key    VARCHAR2(16 CHAR)  NOT NULL,\n";
schema += "  diagnoses    JSON               NOT NULL,\n";
schema += "  alts         JSON               NOT NULL,\n";
schema += "  tips         JSON               NOT NULL,\n";
schema += "  science      CLOB               NOT NULL,\n";
schema += "  redline      CLOB               NOT NULL,\n";
schema += "  CONSTRAINT pk_entries PRIMARY KEY (entry_id),\n";
schema += "  CONSTRAINT fk_entry_dept  FOREIGN KEY (dept_key)  REFERENCES departments (dept_key),\n";
schema += "  CONSTRAINT fk_entry_level FOREIGN KEY (level_key) REFERENCES triage_levels (level_key)\n";
schema += ");\n";
schema += "COMMENT ON TABLE  triage_entries                  IS '症状导诊条目';\n";
schema += "COMMENT ON COLUMN triage_entries.entry_id         IS '条目ID';\n";
schema += "COMMENT ON COLUMN triage_entries.name             IS '主症状名';\n";
schema += "COMMENT ON COLUMN triage_entries.category         IS '内容分类';\n";
schema += "COMMENT ON COLUMN triage_entries.population       IS '适用人群';\n";
schema += "COMMENT ON COLUMN triage_entries.dept_key         IS '首诊科室 key → departments';\n";
schema += "COMMENT ON COLUMN triage_entries.dept_display     IS '首诊科室显示名';\n";
schema += "COMMENT ON COLUMN triage_entries.dept_note        IS '科室就诊说明';\n";
schema += "COMMENT ON COLUMN triage_entries.level_key        IS '分诊级别 → triage_levels';\n";
schema += "COMMENT ON COLUMN triage_entries.diagnoses        IS '可能的专业病名数组';\n";
schema += "COMMENT ON COLUMN triage_entries.alts             IS '备选科室显示名数组';\n";
schema += "COMMENT ON COLUMN triage_entries.tips             IS '就诊提示数组';\n";
schema += "COMMENT ON COLUMN triage_entries.science          IS '疾病科普(100-200字)';\n";
schema += "COMMENT ON COLUMN triage_entries.redline          IS '急诊红线提示';\n";
schema += "-- Oracle 不会像 MySQL 那样为外键列自动建索引, 需手动建(利于 JOIN)\n";
schema += "CREATE INDEX idx_entries_dept  ON triage_entries (dept_key);\n";
schema += "CREATE INDEX idx_entries_level ON triage_entries (level_key);\n\n";

schema += "-- 5) 症状同义词/搜索词(展开表)\n";
schema += "CREATE TABLE triage_keywords (\n";
schema += "  entry_id VARCHAR2(48 CHAR) NOT NULL,\n";
schema += "  keyword  VARCHAR2(64 CHAR) NOT NULL,\n";
schema += "  CONSTRAINT pk_keywords PRIMARY KEY (entry_id, keyword),\n";
schema += "  CONSTRAINT fk_kw_entry FOREIGN KEY (entry_id) REFERENCES triage_entries (entry_id) ON DELETE CASCADE\n";
schema += ");\n";
schema += "COMMENT ON TABLE  triage_keywords              IS '症状搜索词';\n";
schema += "COMMENT ON COLUMN triage_keywords.entry_id    IS '所属条目 → triage_entries';\n";
schema += "COMMENT ON COLUMN triage_keywords.keyword     IS '搜索词(主症状名或同义词)';\n";
schema += "CREATE INDEX idx_keywords_kw ON triage_keywords (keyword);\n";
schema += "\n-- schema 完毕(可接着执行 02_data.sql)\n";

/* ---------- 02_data.sql ---------- */
let data = "";
data += "-- ============================================================\n";
data += "-- 省医 · 症状导诊知识库 (Oracle 23ai 版)  数据 INSERT\n";
data += "-- Oracle 批量插入用 INSERT ALL ... SELECT 1 FROM DUAL 写法\n";
data += "-- (MySQL 的 VALUES (...),(...) 多行写法在 Oracle 不支持)\n";
data += "-- 文本写入 JSON 列时 Oracle 会自动包装为 JSON 类型\n";
data += "-- ============================================================\n\n";

data += "-- 科室目录(31)\n";
data += insertAllChunks("departments", ["dept_key", "name", "dept_group", "intro"],
  D.departments.map(d => [q(d.key), q(d.name), q(d.group), q(d.intro || "")])) + "\n\n";

data += "-- 分诊级别(3)\n";
data += insertAllChunks("triage_levels", ["level_key", "label", "hint"],
  Object.keys(D.levels).map(k => [q(k), q(D.levels[k].label), q(D.levels[k].hint)])) + "\n\n";

data += "-- 元信息(8)\n";
data += insertAllChunks("triage_meta", ["meta_key", "meta_value"],
  Object.keys(D.meta).map(k => [q(k), q(D.meta[k])])) + "\n\n";

// 主科室 key 解析(与 MySQL 版一致,记录失败项)
const miss = [];
const entryRows = D.entries.map(en => {
  const k = keyOf(en.dept);
  if (!k) miss.push(en.name + " -> " + en.dept);
  return k;
});

data += "-- 症状导诊条目(" + D.entries.length + ")\n";
data += insertAllChunks("triage_entries",
  ["entry_id", "name", "category", "population", "dept_key", "dept_display", "dept_note", "level_key",
   "diagnoses", "alts", "tips", "science", "redline"],
  D.entries.map((en, i) => [q(en.id), q(en.name), q(en.cat), q(en.population), q(entryRows[i] || ""),
    q(en.dept), q(en.deptNote || ""), q(en.level),
    jsonArr(en.diagnoses), jsonArr(en.alts || []), jsonArr(en.tips || []),
    q(en.science), q(en.redline)])) + "\n\n";

data += "-- 搜索词(主症状名 + 同义词, " + (() => {
  let n = 0; D.entries.forEach(en => n += new Set([en.name].concat(en.keywords || [])).size); return n;
})() + ")\n";
const kwRows = [];
for (const en of D.entries) {
  const set = new Set([en.name].concat(en.keywords || []));
  for (const w of set) kwRows.push([q(en.id), q(w)]);
}
data += insertAllChunks("triage_keywords", ["entry_id", "keyword"], kwRows) + "\n\n";

data += "-- Oracle 默认不自动提交, 这里显式提交, 确保数据落库\n";
data += "COMMIT;\n";
data += "\n-- data 完毕\n";

/* ---------- 写出文件 ---------- */
const gen = "-- 生成自 tools/export_oracle.js · data.js 数据源\n";
fs.writeFileSync(path.join(outDir, "00_create_user.sql"), gen + userSql, "utf8");
fs.writeFileSync(path.join(outDir, "01_schema.sql"), gen + schema, "utf8");
fs.writeFileSync(path.join(outDir, "02_data.sql"), gen + data, "utf8");
fs.writeFileSync(path.join(outDir, "import_all_oracle.sql"),
  "-- ============================================================\n" +
  "-- 省医·症状导诊知识库 (Oracle 23ai 版) · 一键导入(建表 + 数据)\n" +
  "-- 前置: 已用 00_create_user.sql 建好用户并以该用户连接 freepdb1\n" +
  "-- 在 DBeaver 中打开本文件, Ctrl+A 全选后执行即可\n" +
  "-- ============================================================\n" +
  gen + schema + "\n" + data, "utf8");

/* ---------- 统计输出 ---------- */
console.log("Oracle 版导出完成");
console.log("科室:", D.departments.length, "| 级别:", Object.keys(D.levels).length,
            "| meta:", Object.keys(D.meta).length, "| 症状条目:", D.entries.length,
            "| 搜索词:", kwRows.length);
console.log("主科室解析失败:", miss.length ? miss : "无");
console.log("已生成: sql/oracle/00_create_user.sql, 01_schema.sql, 02_data.sql, import_all_oracle.sql");

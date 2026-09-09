/* ============================================================
   省医 · 症状导诊知识库 — data.js 导出为 MySQL SQL 脚本
   用法:  node tools/export_mysql.js
   产物:  sql/schema.sql 建库建表  |  sql/data.sql 数据  |  sql/import_all.sql 合并版(一条命令导入)
   数据扩展后重新运行本脚本即可刷新 SQL,无需手写 INSERT。
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

const outDir = path.join(root, "sql");
fs.mkdirSync(outDir, { recursive: true });

/* ---------- 工具函数 ---------- */
function esc(v) { // 转义 SQL 单引号与反斜杠
  return String(v).replace(/\\/g, "\\\\").replace(/'/g, "''");
}
function q(v) { return "'" + esc(v) + "'"; }
function stripParen(s) { // 去全角/半角括号备注
  return String(s).replace(/[（(].*?[)）]/g, "").trim();
}
// 与页面同款:科室显示名 → departments.key
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

/* ---------- 1) schema.sql ---------- */
let schema = "";
schema += "-- ============================================================\n";
schema += "-- 省医 · 症状导诊知识库  建库建表脚本 (MySQL 8.0+, utf8mb4)\n";
schema += "-- 数据源: ../data.js(2026-09 核对省医院官网 samsph.cn)\n";
schema += "-- 注意: 会先删除同名库 shengyi_triage 再重建,仅影响本库\n";
schema += "-- ============================================================\n";
schema += "DROP DATABASE IF EXISTS shengyi_triage;\n";
schema += "CREATE DATABASE shengyi_triage DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;\n";
schema += "USE shengyi_triage;\n\n";

schema += "-- 1) 科室/门诊目录\n";
schema += "CREATE TABLE departments (\n";
schema += "  dept_key   VARCHAR(32)  NOT NULL COMMENT '科室唯一键',\n";
schema += "  name       VARCHAR(100) NOT NULL COMMENT '科室显示名(官网口径)',\n";
schema += "  dept_group VARCHAR(32)  NOT NULL COMMENT '分组:内科/外科/妇产儿科/五官口腔皮肤/急诊与中心',\n";
schema += "  intro      TEXT         NULL     COMMENT '科室简介',\n";
schema += "  PRIMARY KEY (dept_key)\n";
schema += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='科室目录';\n\n";

schema += "-- 2) 分诊级别字典\n";
schema += "CREATE TABLE triage_levels (\n";
schema += "  level_key VARCHAR(16) NOT NULL COMMENT 'green/yellow/red',\n";
schema += "  label     VARCHAR(32) NOT NULL COMMENT '显示名',\n";
schema += "  hint      VARCHAR(64) NOT NULL COMMENT '提示语',\n";
schema += "  PRIMARY KEY (level_key)\n";
schema += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='分诊级别';\n\n";

schema += "-- 3) 知识库元信息\n";
schema += "CREATE TABLE triage_meta (\n";
schema += "  meta_key   VARCHAR(32) NOT NULL,\n";
schema += "  meta_value TEXT        NULL,\n";
schema += "  PRIMARY KEY (meta_key)\n";
schema += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='知识库元信息(医院/地址/更新日期等)';\n\n";

schema += "-- 4) 症状导诊条目主表\n";
schema += "CREATE TABLE triage_entries (\n";
schema += "  entry_id     VARCHAR(48)  NOT NULL COMMENT '条目ID',\n";
schema += "  name         VARCHAR(64)  NOT NULL COMMENT '主症状名',\n";
schema += "  category     VARCHAR(32)  NOT NULL COMMENT '内容分类(发热与感染/呼吸系统…)',\n";
schema += "  population   VARCHAR(32)  NOT NULL COMMENT '适用人群',\n";
schema += "  dept_key     VARCHAR(32)  NOT NULL COMMENT '首诊科室 key → departments',\n";
schema += "  dept_display VARCHAR(100) NOT NULL COMMENT '首诊科室显示名(保留括号备注)',\n";
schema += "  dept_note    TEXT         NULL     COMMENT '科室就诊说明',\n";
schema += "  level_key    VARCHAR(16)  NOT NULL COMMENT '分诊级别 → triage_levels',\n";
schema += "  diagnoses    JSON         NOT NULL COMMENT '可能的专业病名数组',\n";
schema += "  alts         JSON         NOT NULL COMMENT '备选科室显示名数组',\n";
schema += "  tips         JSON         NOT NULL COMMENT '就诊提示数组',\n";
schema += "  science      TEXT         NOT NULL COMMENT '疾病科普(100-200字)',\n";
schema += "  redline      TEXT         NOT NULL COMMENT '急诊红线提示',\n";
schema += "  PRIMARY KEY (entry_id),\n";
schema += "  KEY idx_dept (dept_key),\n";
schema += "  KEY idx_level (level_key),\n";
schema += "  CONSTRAINT fk_entry_dept  FOREIGN KEY (dept_key)  REFERENCES departments (dept_key),\n";
schema += "  CONSTRAINT fk_entry_level FOREIGN KEY (level_key) REFERENCES triage_levels (level_key)\n";
schema += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='症状导诊条目';\n\n";

schema += "-- 5) 症状同义词/搜索词(展开表,便于 LIKE / 全文检索)\n";
schema += "CREATE TABLE triage_keywords (\n";
schema += "  entry_id VARCHAR(48) NOT NULL,\n";
schema += "  keyword  VARCHAR(64) NOT NULL,\n";
schema += "  PRIMARY KEY (entry_id, keyword),\n";
schema += "  KEY idx_keyword (keyword),\n";
schema += "  CONSTRAINT fk_kw_entry FOREIGN KEY (entry_id) REFERENCES triage_entries (entry_id) ON DELETE CASCADE\n";
schema += ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='症状搜索词';\n";
schema += "\n-- schema 完毕\n";

/* ---------- 2) data.sql ---------- */
let data = "";
data += "USE shengyi_triage;\n\n";
data += "-- 科室目录\n";
data += "INSERT INTO departments (dept_key, name, dept_group, intro) VALUES\n";
data += D.departments.map(d =>
  "  (" + [q(d.key), q(d.name), q(d.group), q(d.intro || "")].join(", ") + ")"
).join(",\n") + ";\n\n";

data += "-- 分诊级别\n";
data += "INSERT INTO triage_levels (level_key, label, hint) VALUES\n";
data += Object.keys(D.levels).map(k =>
  "  (" + [q(k), q(D.levels[k].label), q(D.levels[k].hint)].join(", ") + ")"
).join(",\n") + ";\n\n";

data += "-- 元信息\n";
data += "INSERT INTO triage_meta (meta_key, meta_value) VALUES\n";
const metaRows = Object.keys(D.meta).map(k => "  (" + q(k) + ", " + q(D.meta[k]) + ")");
data += metaRows.join(",\n") + ";\n\n";

// 预先解析每个条目的主科室 key,记录解析失败的(不应有)
const miss = [];
const rows = D.entries.map(en => {
  const k = keyOf(en.dept);
  if (!k) miss.push(en.name + " -> " + en.dept);
  return k;
});

data += "-- 症状导诊条目(53)\n";
data += "INSERT INTO triage_entries\n";
data += "  (entry_id, name, category, population, dept_key, dept_display, dept_note, level_key,\n";
data += "   diagnoses, alts, tips, science, redline) VALUES\n";
data += D.entries.map((en, i) =>
  "  (" + [q(en.id), q(en.name), q(en.cat), q(en.population), q(rows[i] || ""),
          q(en.dept), q(en.deptNote || ""), q(en.level),
          jsonArr(en.diagnoses), jsonArr(en.alts || []), jsonArr(en.tips || []),
          q(en.science), q(en.redline)].join(", ") + ")"
).join(",\n") + ";\n\n";

data += "-- 搜索词(主症状名 + 同义词)\n";
data += "INSERT INTO triage_keywords (entry_id, keyword) VALUES\n";
const kwLines = [];
for (const en of D.entries) {
  const set = new Set([en.name].concat(en.keywords || []));
  for (const w of set) kwLines.push("  (" + q(en.id) + ", " + q(w) + ")");
}
data += kwLines.join(",\n") + ";\n";
data += "\n-- data 完毕\n";

/* ---------- 3) 写出文件 ---------- */
const header = (f) => "-- 生成自 tools/export_mysql.js · data.js 数据源\n";
fs.writeFileSync(path.join(outDir, "schema.sql"), header() + schema, "utf8");
fs.writeFileSync(path.join(outDir, "data.sql"), header() + data, "utf8");
fs.writeFileSync(path.join(outDir, "import_all.sql"),
  "-- ============================================================\n" +
  "-- 省医·症状导诊知识库 · 一键导入(合并版)\n" +
  "-- 执行: mysql --default-character-set=utf8mb4 -uroot -p < sql/import_all.sql\n" +
  "-- ============================================================\n" +
  header() + schema + "\n" + data, "utf8");

/* ---------- 统计输出 ---------- */
console.log("科室:", D.departments.length, "| 级别:", Object.keys(D.levels).length,
            "| meta:", metaRows.length, "| 症状条目:", D.entries.length,
            "| 搜索词:", kwLines.length);
console.log("主科室解析失败:", miss.length ? miss : "无");
console.log("已生成: sql/schema.sql, sql/data.sql, sql/import_all.sql");

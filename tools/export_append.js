/* ============================================================
   省医 · 症状导诊知识库 — 增量追加导出器(MySQL)
   用法:  node tools/export_append.js [旧条目数]
   产物:  sql/append_2026-09-09.sql
   特点:  与 export_mysql.js 的全量重建(DROP DATABASE)不同,
          本脚本生成「只追加、不删除、可重复执行」的增量脚本:
          · 全部使用 INSERT IGNORE,已存在的行自动跳过
          · 不触碰既有数据,可直接在已有 shengyi_triage 库上执行
   数据源: ../data.js(2026-09 扩充后 135 条)
   ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const oldCount = parseInt(process.argv[2] || "105", 10);

const code = fs.readFileSync(path.join(root, "data.js"), "utf8");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code + "\nthis.__D = TRIAGE_DATA;", ctx);
const D = ctx.__D;

function esc(v) { return String(v).replace(/\\/g, "\\\\").replace(/'/g, "''"); }
function q(v) { return "'" + esc(v) + "'"; }
function stripParen(s) { return String(s).replace(/[（(].*?[)）]/g, "").trim(); }
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

let out = "";
out += "-- ============================================================\n";
out += "-- 省医 · 症状导诊知识库  增量追加脚本 (MySQL 8.0+, utf8mb4)\n";
out += "-- 适用: 已导入过 105 条旧版数据的 shengyi_triage 库\n";
out += "-- 特性: 全部 INSERT IGNORE —— 已存在的行自动跳过,可重复执行,不删任何数据\n";
out += "-- 执行: mysql --default-character-set=utf8mb4 -uroot -p < sql/append_2026-09-09.sql\n";
out += "--        或在 DBeaver 中打开本文件后执行\n";
out += "-- ============================================================\n\n";
out += "USE shengyi_triage;\n\n";

/* 1) 科室目录(幂等:重复 key 跳过) */
out += "-- 1) 科室目录(幂等追加)\n";
out += "INSERT IGNORE INTO departments (dept_key, name, dept_group, intro) VALUES\n";
out += D.departments.map(d =>
  "  (" + [q(d.key), q(d.name), q(d.group), q(d.intro || "")].join(", ") + ")"
).join(",\n") + ";\n\n";

/* 2) 分诊级别字典(幂等) */
out += "-- 2) 分诊级别字典(幂等追加)\n";
out += "INSERT IGNORE INTO triage_levels (level_key, label, hint) VALUES\n";
out += Object.keys(D.levels).map(k =>
  "  (" + [q(k), q(D.levels[k].label), q(D.levels[k].hint)].join(", ") + ")"
).join(",\n") + ";\n\n";

/* 3) 元信息(幂等,保留旧更新时间,注释提示) */
out += "-- 3) 元信息(幂等追加; 注: 不覆盖已存在的 updated,若需更新请手动 UPDATE triage_meta)\n";
out += "INSERT IGNORE INTO triage_meta (meta_key, meta_value) VALUES\n";
out += Object.keys(D.meta).map(k => "  (" + q(k) + ", " + q(D.meta[k]) + ")").join(",\n") + ";\n\n";

/* 3b) 显式刷新「数据更新时间」元信息(仅当 meta 里确实有该键时) */
if (D.meta && D.meta.updated) {
  out += "-- 3b) 刷新数据更新时间(INSERT IGNORE 不会覆盖已存在的行,故单独 UPDATE)\n";
  out += "UPDATE triage_meta SET meta_value = " + q(D.meta.updated) +
         " WHERE meta_key = 'updated';\n\n";
}

/* 4) 症状条目(幂等:entry_id 已存在则跳过) */
const miss = [];
const rows = D.entries.map(en => {
  const k = keyOf(en.dept);
  if (!k) miss.push(en.name + " -> " + en.dept);
  return k;
});
out += "-- 4) 症状导诊条目(幂等追加,当前共 " + D.entries.length + " 条)\n";
out += "INSERT IGNORE INTO triage_entries\n";
out += "  (entry_id, name, category, population, dept_key, dept_display, dept_note, level_key,\n";
out += "   diagnoses, alts, tips, science, redline) VALUES\n";
out += D.entries.map((en, i) =>
  "  (" + [q(en.id), q(en.name), q(en.cat), q(en.population), q(rows[i] || ""),
          q(en.dept), q(en.deptNote || ""), q(en.level),
          jsonArr(en.diagnoses), jsonArr(en.alts || []), jsonArr(en.tips || []),
          q(en.science), q(en.redline)].join(", ") + ")"
).join(",\n") + ";\n\n";

/* 5) 搜索词(幂等) */
out += "-- 5) 症状搜索词(幂等追加)\n";
out += "INSERT IGNORE INTO triage_keywords (entry_id, keyword) VALUES\n";
const kwLines = [];
for (const en of D.entries) {
  const set = new Set([en.name].concat(en.keywords || []));
  for (const w of set) kwLines.push("  (" + q(en.id) + ", " + q(w) + ")");
}
out += kwLines.join(",\n") + ";\n";
out += "\n-- 增量脚本完毕(可安全重复执行)\n";

const outFile = path.join(root, "sql", "append_2026-09-09.sql");
fs.writeFileSync(outFile, out, "utf8");

const added = D.entries.length - oldCount;
console.log("已生成:", path.relative(root, outFile));
console.log("条目总数:", D.entries.length, "| 相对旧版(" + oldCount + ")新增:", added);
console.log("搜索词总行数:", kwLines.length);
console.log("主科室解析失败:", miss.length ? miss : "无");

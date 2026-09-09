/* ============================================================
   省医 · 症状导诊知识库 — 页面冒烟测试（mock DOM）
   用法:  node tools/smoke_test.js [index.html|guahao.html]
   作用:  在无浏览器环境用最小 DOM 桩运行页面内联脚本,
          验证 data.js 语法、条目/科室统计与主要交互函数不抛错。
   数据断言可在此追加(entries 数、BM 命中率等)。
   ============================================================ */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const htmlFile = process.argv[2] || "index.html";
const html = fs.readFileSync(path.join(root, htmlFile), "utf8");

/* ---------- 最小 DOM 桩 ---------- */
function makeEl() {
  const el = {
    _html: "",
    style: {},
    value: "",
    className: "",
    classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } },
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    setAttribute() {},
    getAttribute() { return null; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    closest() { return null; },
    focus() {}
  };
  Object.defineProperty(el, "innerHTML", {
    get() { return this._html; },
    set(v) { this._html = String(v); }
  });
  Object.defineProperty(el, "textContent", {
    get() { return this._html.replace(/<[^>]*>/g, ""); },
    set(v) { this._html = String(v); }
  });
  return el;
}
const elCache = {};
const documentStub = {
  getElementById(id) { return (elCache[id] = elCache[id] || makeEl()); },
  querySelectorAll() { return []; },
  querySelector() { return null; },
  addEventListener() {},
  createElement() { return makeEl(); },
  body: makeEl()
};

/* ---------- 提取内联 <script>（跳过 src= 外链） ---------- */
const scripts = [];
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html)) !== null) scripts.push(m[1]);

/* ---------- 在 vm 上下文运行 ---------- */
const sandbox = {
  console,
  window: { TRIAGE_DATA: null, addEventListener() {}, scrollTo() {}, location: { search: "", hash: "" } },
  document: documentStub,
  navigator: { userAgent: "node-smoke" },
  location: { search: "", hash: "" },
  setTimeout, clearTimeout,
  alert() {}, confirm() { return true; }
};
vm.createContext(sandbox);

// 先加载 data.js（设置 window.TRIAGE_DATA 与词法 TRIAGE_DATA）
const dataCode = fs.readFileSync(path.join(root, "data.js"), "utf8");
vm.runInContext(dataCode + "\nthis.TRIAGE_DATA = window.TRIAGE_DATA;", sandbox, { filename: "data.js" });

// 再运行内联脚本
for (const [i, code] of scripts.entries()) {
  vm.runInContext(code, sandbox, { filename: htmlFile + ":inline#" + i });
}

/* ---------- 数据断言 ---------- */
const D = sandbox.TRIAGE_DATA;
if (!D) throw new Error("TRIAGE_DATA 未定义");
const total = D.entries.length;
const missDept = D.entries.filter(e => {
  // 基本科室解析: deptKeys 里能直接或包含命中即算 OK（与页面 keyOf 一致简化判断）
  const n = String(e.dept || "").replace(/[（(].*?[)）]/g, "").trim().replace(/\s+/g, "");
  const keys = Object.keys(D.deptKeys || {});
  return !keys.some(k => n.indexOf(k) > -1 || k.indexOf(n) > -1) &&
         !(D.departments || []).some(d => n.indexOf(d.name) > -1);
});
const uniq = new Set(D.entries.map(e => e.id));
console.log("== 冒烟通过 ==");
console.log("页面:", htmlFile, "| 内联脚本:", scripts.length, "个，均无异常");
console.log("症状条目:", total, "| 科室:", (D.departments || []).length,
            "| 搜索词总数:", D.entries.reduce((s, e) => s + 1 + (e.keywords || []).length, 0));
console.log("entry id 重复:", total - uniq.size);
console.log("科室显示名无法解析:", missDept.length ? missDept.map(e => e.name + "→" + e.dept).join(" ; ") : "无");

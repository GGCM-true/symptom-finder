-- 生成自 tools/export_oracle.js · data.js 数据源
-- ============================================================
-- 省医 · 症状导诊知识库 (Oracle 23ai 版)  建表脚本 DDL
-- 数据源: ../data.js(2026-09 核对省医院官网 samsph.cn)
-- 前提: 已用 00_create_user.sql 建好 shengyi_triage 用户
-- 用 shengyi_triage 账号连接后执行本脚本
-- 对比 MySQL 版差异: VARCHAR2(n CHAR) / CLOB / 原生 JSON 类型 /
-- 无 ENGINE/CHARSET 子句 / 注释用 COMMENT ON / 外键列需手动建索引
-- ============================================================

-- 清理旧表(顺序: 先删有外键依赖的子表; 23ai 支持 IF EXISTS)
DROP TABLE IF EXISTS triage_keywords  CASCADE CONSTRAINTS;
DROP TABLE IF EXISTS triage_entries   CASCADE CONSTRAINTS;
DROP TABLE IF EXISTS departments      CASCADE CONSTRAINTS;
DROP TABLE IF EXISTS triage_levels    CASCADE CONSTRAINTS;
DROP TABLE IF EXISTS triage_meta      CASCADE CONSTRAINTS;

-- 1) 科室/门诊目录
CREATE TABLE departments (
  dept_key    VARCHAR2(32 CHAR)  NOT NULL,
  name        VARCHAR2(100 CHAR) NOT NULL,
  dept_group  VARCHAR2(32 CHAR)  NOT NULL,
  intro       CLOB,
  CONSTRAINT pk_departments PRIMARY KEY (dept_key)
);
COMMENT ON TABLE  departments               IS '科室目录';
COMMENT ON COLUMN departments.dept_key      IS '科室唯一键';
COMMENT ON COLUMN departments.name          IS '科室显示名(官网口径)';
COMMENT ON COLUMN departments.dept_group    IS '分组:内科/外科/妇产儿科/五官口腔皮肤/急诊与中心';
COMMENT ON COLUMN departments.intro         IS '科室简介';

-- 2) 分诊级别字典
CREATE TABLE triage_levels (
  level_key VARCHAR2(16 CHAR) NOT NULL,
  label     VARCHAR2(32 CHAR) NOT NULL,
  hint      VARCHAR2(64 CHAR) NOT NULL,
  CONSTRAINT pk_levels PRIMARY KEY (level_key)
);
COMMENT ON TABLE  triage_levels              IS '分诊级别';
COMMENT ON COLUMN triage_levels.level_key    IS 'green/yellow/red';
COMMENT ON COLUMN triage_levels.label        IS '显示名';
COMMENT ON COLUMN triage_levels.hint         IS '提示语';

-- 3) 知识库元信息
CREATE TABLE triage_meta (
  meta_key   VARCHAR2(32 CHAR) NOT NULL,
  meta_value CLOB,
  CONSTRAINT pk_meta PRIMARY KEY (meta_key)
);
COMMENT ON TABLE  triage_meta                 IS '知识库元信息(医院/地址/更新日期等)';
COMMENT ON COLUMN triage_meta.meta_key        IS '键名';
COMMENT ON COLUMN triage_meta.meta_value      IS '键值';

-- 4) 症状导诊条目主表(JSON 列为 Oracle 21c+ 原生 JSON 类型)
CREATE TABLE triage_entries (
  entry_id     VARCHAR2(48 CHAR)  NOT NULL,
  name         VARCHAR2(64 CHAR)  NOT NULL,
  category     VARCHAR2(32 CHAR)  NOT NULL,
  population   VARCHAR2(32 CHAR)  NOT NULL,
  dept_key     VARCHAR2(32 CHAR)  NOT NULL,
  dept_display VARCHAR2(100 CHAR) NOT NULL,
  dept_note    CLOB,
  level_key    VARCHAR2(16 CHAR)  NOT NULL,
  diagnoses    JSON               NOT NULL,
  alts         JSON               NOT NULL,
  tips         JSON               NOT NULL,
  science      CLOB               NOT NULL,
  redline      CLOB               NOT NULL,
  CONSTRAINT pk_entries PRIMARY KEY (entry_id),
  CONSTRAINT fk_entry_dept  FOREIGN KEY (dept_key)  REFERENCES departments (dept_key),
  CONSTRAINT fk_entry_level FOREIGN KEY (level_key) REFERENCES triage_levels (level_key)
);
COMMENT ON TABLE  triage_entries                  IS '症状导诊条目';
COMMENT ON COLUMN triage_entries.entry_id         IS '条目ID';
COMMENT ON COLUMN triage_entries.name             IS '主症状名';
COMMENT ON COLUMN triage_entries.category         IS '内容分类';
COMMENT ON COLUMN triage_entries.population       IS '适用人群';
COMMENT ON COLUMN triage_entries.dept_key         IS '首诊科室 key → departments';
COMMENT ON COLUMN triage_entries.dept_display     IS '首诊科室显示名';
COMMENT ON COLUMN triage_entries.dept_note        IS '科室就诊说明';
COMMENT ON COLUMN triage_entries.level_key        IS '分诊级别 → triage_levels';
COMMENT ON COLUMN triage_entries.diagnoses        IS '可能的专业病名数组';
COMMENT ON COLUMN triage_entries.alts             IS '备选科室显示名数组';
COMMENT ON COLUMN triage_entries.tips             IS '就诊提示数组';
COMMENT ON COLUMN triage_entries.science          IS '疾病科普(100-200字)';
COMMENT ON COLUMN triage_entries.redline          IS '急诊红线提示';
-- Oracle 不会像 MySQL 那样为外键列自动建索引, 需手动建(利于 JOIN)
CREATE INDEX idx_entries_dept  ON triage_entries (dept_key);
CREATE INDEX idx_entries_level ON triage_entries (level_key);

-- 5) 症状同义词/搜索词(展开表)
CREATE TABLE triage_keywords (
  entry_id VARCHAR2(48 CHAR) NOT NULL,
  keyword  VARCHAR2(64 CHAR) NOT NULL,
  CONSTRAINT pk_keywords PRIMARY KEY (entry_id, keyword),
  CONSTRAINT fk_kw_entry FOREIGN KEY (entry_id) REFERENCES triage_entries (entry_id) ON DELETE CASCADE
);
COMMENT ON TABLE  triage_keywords              IS '症状搜索词';
COMMENT ON COLUMN triage_keywords.entry_id    IS '所属条目 → triage_entries';
COMMENT ON COLUMN triage_keywords.keyword     IS '搜索词(主症状名或同义词)';
CREATE INDEX idx_keywords_kw ON triage_keywords (keyword);

-- schema 完毕(可接着执行 02_data.sql)

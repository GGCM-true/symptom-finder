-- 生成自 tools/export_mysql.js · data.js 数据源
-- ============================================================
-- 省医 · 症状导诊知识库  建库建表脚本 (MySQL 8.0+, utf8mb4)
-- 数据源: ../data.js(2026-09 核对省医院官网 samsph.cn)
-- 注意: 会先删除同名库 shengyi_triage 再重建,仅影响本库
-- ============================================================
DROP DATABASE IF EXISTS shengyi_triage;
CREATE DATABASE shengyi_triage DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE shengyi_triage;

-- 1) 科室/门诊目录
CREATE TABLE departments (
  dept_key   VARCHAR(32)  NOT NULL COMMENT '科室唯一键',
  name       VARCHAR(100) NOT NULL COMMENT '科室显示名(官网口径)',
  dept_group VARCHAR(32)  NOT NULL COMMENT '分组:内科/外科/妇产儿科/五官口腔皮肤/急诊与中心',
  intro      TEXT         NULL     COMMENT '科室简介',
  PRIMARY KEY (dept_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='科室目录';

-- 2) 分诊级别字典
CREATE TABLE triage_levels (
  level_key VARCHAR(16) NOT NULL COMMENT 'green/yellow/red',
  label     VARCHAR(32) NOT NULL COMMENT '显示名',
  hint      VARCHAR(64) NOT NULL COMMENT '提示语',
  PRIMARY KEY (level_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='分诊级别';

-- 3) 知识库元信息
CREATE TABLE triage_meta (
  meta_key   VARCHAR(32) NOT NULL,
  meta_value TEXT        NULL,
  PRIMARY KEY (meta_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='知识库元信息(医院/地址/更新日期等)';

-- 4) 症状导诊条目主表
CREATE TABLE triage_entries (
  entry_id     VARCHAR(48)  NOT NULL COMMENT '条目ID',
  name         VARCHAR(64)  NOT NULL COMMENT '主症状名',
  category     VARCHAR(32)  NOT NULL COMMENT '内容分类(发热与感染/呼吸系统…)',
  population   VARCHAR(32)  NOT NULL COMMENT '适用人群',
  dept_key     VARCHAR(32)  NOT NULL COMMENT '首诊科室 key → departments',
  dept_display VARCHAR(100) NOT NULL COMMENT '首诊科室显示名(保留括号备注)',
  dept_note    TEXT         NULL     COMMENT '科室就诊说明',
  level_key    VARCHAR(16)  NOT NULL COMMENT '分诊级别 → triage_levels',
  diagnoses    JSON         NOT NULL COMMENT '可能的专业病名数组',
  alts         JSON         NOT NULL COMMENT '备选科室显示名数组',
  tips         JSON         NOT NULL COMMENT '就诊提示数组',
  science      TEXT         NOT NULL COMMENT '疾病科普(100-200字)',
  redline      TEXT         NOT NULL COMMENT '急诊红线提示',
  PRIMARY KEY (entry_id),
  KEY idx_dept (dept_key),
  KEY idx_level (level_key),
  CONSTRAINT fk_entry_dept  FOREIGN KEY (dept_key)  REFERENCES departments (dept_key),
  CONSTRAINT fk_entry_level FOREIGN KEY (level_key) REFERENCES triage_levels (level_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='症状导诊条目';

-- 5) 症状同义词/搜索词(展开表,便于 LIKE / 全文检索)
CREATE TABLE triage_keywords (
  entry_id VARCHAR(48) NOT NULL,
  keyword  VARCHAR(64) NOT NULL,
  PRIMARY KEY (entry_id, keyword),
  KEY idx_keyword (keyword),
  CONSTRAINT fk_kw_entry FOREIGN KEY (entry_id) REFERENCES triage_entries (entry_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='症状搜索词';

-- schema 完毕

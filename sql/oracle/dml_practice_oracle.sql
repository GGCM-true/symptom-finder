-- ============================================================
-- 省医 · 症状导诊知识库 (Oracle 23ai 版) —— 数据变更(DML)练习
-- 前提: 已按 00/01/02 脚本建好用户并导入数据
-- 建议: DBeaver 连接 shengyi_triage@freepdb1 后逐段执行
-- 对比 MySQL 版练习(dml_practice.sql)重点看 5 个差异:
--   1. 没有 START TRANSACTION —— Oracle 第一条 DML 即自动开启事务
--   2. 不自动提交 —— 必须 COMMIT 才落库, ROLLBACK 可撤销
--   3. 多行插入用 INSERT ALL, 不是 VALUES (...),(...)
--   4. 改 JSON 用 JSON_TRANSFORM, 不是 JSON_SET/JSON_ARRAY_APPEND
--   5. 报错代码是 ORA-xxxxx, 不是 ERROR xxxx
-- 安全: 本脚本 DML 全部未 COMMIT, 结尾二选一, 放心练习
-- ============================================================

-- 先看当前库概况(确认连接与数据正确)
SELECT COUNT(*) AS 科室数 FROM departments;
SELECT COUNT(*) AS 症状数 FROM triage_entries;

-- ------------------------------------------------------------
-- 练习 1: 新增 (INSERT)
-- ------------------------------------------------------------

-- 1.1 单行插入(与 MySQL 几乎一样, 但没有反引号、VARCHAR2 按字符)
INSERT INTO departments (dept_key, name, dept_group, intro)
VALUES ('demo', '示例科室门诊', '内科', '仅用于演示 INSERT, 练习后可回滚。');

-- 1.2 Oracle 特色批量插入: INSERT ALL(MySQL 的多行 VALUES 在这里不可用)
INSERT ALL
  INTO triage_entries (entry_id, name, category, population, dept_key, dept_display, dept_note,
    level_key, diagnoses, alts, tips, science, redline)
  VALUES ('demo-itch', '皮肤瘙痒(演示)', '皮肤相关', '通用', 'demo', '示例科室门诊', '',
    'green', '["演示性瘙痒症","慢性荨麻疹(待排查)"]', '["皮肤科门诊"]',
    '["演示条目, 用于学习 Oracle 的 INSERT ALL。"]',
    '这是演示用示例条目, 并非真实医学内容。',
    '演示条目无真实急诊红线, 请勿当真。')
  INTO triage_keywords (entry_id, keyword)
  VALUES ('demo-itch', '皮肤瘙痒演示')
  INTO triage_keywords (entry_id, keyword)
  VALUES ('demo-itch', '痒演示')
SELECT 1 FROM DUAL;

-- 验证(注意: Oracle 里 JSON 文本存的是二进制 JSON, 查询用 JSON_VALUE / JSON_QUERY)
SELECT e.name,
       JSON_VALUE(e.diagnoses, '$[0]') AS 第一诊断,
       d.name AS 科室
FROM triage_entries e
JOIN departments d ON d.dept_key = e.dept_key
WHERE e.entry_id = 'demo-itch';

-- ------------------------------------------------------------
-- 练习 2: 修改 (UPDATE)
-- ------------------------------------------------------------

-- 2.1 改普通文本列(必须带 WHERE, 否则整表更新)
UPDATE departments
SET name = '示例科室门诊(已更名)'
WHERE dept_key = 'demo';

-- 2.2 改 JSON 整列: 直接给一段合法 JSON 文本(会自动包装成 JSON 类型)
UPDATE triage_entries
SET diagnoses = '["演示性瘙痒症","神经性皮炎(待排查)"]'
WHERE entry_id = 'demo-itch';

-- 2.3 只改 JSON 的局部: JSON_TRANSFORM(值, SET '路径' = 新值)
--     '$[0]' 表示数组第 1 个元素(下标从 0 开始)
UPDATE triage_entries
SET diagnoses = JSON_TRANSFORM(diagnoses, SET '$[0]' = '演示性皮肤瘙痒')
WHERE entry_id = 'demo-itch';

-- 2.4 删除 JSON 数组里的某个元素: REMOVE '路径'
UPDATE triage_entries
SET diagnoses = JSON_TRANSFORM(diagnoses, REMOVE '$[1]')
WHERE entry_id = 'demo-itch';

-- 2.5 改分诊级别(只能填字典里已有的 green/yellow/red)
UPDATE triage_entries
SET level_key = 'yellow'
WHERE entry_id = 'demo-itch';

-- 验证: 用 JSON_QUERY 取回整个数组看看改动结果
SELECT name, JSON_QUERY(diagnoses, '$') AS 诊断数组, level_key
FROM triage_entries
WHERE entry_id = 'demo-itch';

-- ------------------------------------------------------------
-- 练习 3: 删除 (DELETE)
-- ------------------------------------------------------------

-- 3.1 删一个搜索词
DELETE FROM triage_keywords
WHERE entry_id = 'demo-itch' AND keyword = '痒演示';

-- 3.2 删整条症状: 外键 fk_kw_entry 带 ON DELETE CASCADE, 搜索词自动连带删除
DELETE FROM triage_entries WHERE entry_id = 'demo-itch';

-- 验证级联: 应为 0 行
SELECT COUNT(*) AS 残留搜索词 FROM triage_keywords WHERE entry_id = 'demo-itch';

-- 3.3 删科室: 上面已删掉 demo-itch, 现在可以删 demo
--     若还有症状引用它, 会报 ORA-02292(违反完整性约束, 子记录已找到)
DELETE FROM departments WHERE dept_key = 'demo';

-- ------------------------------------------------------------
-- 常见报错速查(Oracle 代码, 只讲解不执行):
--   ORA-00001: 违反唯一约束 —— 主键重复(如重复插同 entry_id)
--   ORA-02291: 违反完整约束 —— 外键引用的父键不存在(科室/级别拼错)
--   ORA-02292: 违反完整约束 —— 仍有子记录引用, 父行删不掉
--   ORA-01400: 无法将 NULL 插入 —— NOT NULL 列没给值
--   ORA-40441: JSON 语法错误 —— 写入 JSON 列的文本不是合法 JSON
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 收尾二选一:
--   ROLLBACK → 撤销本脚本全部练习改动(推荐, 库保持原样)
--   COMMIT   → 真正保存(注意! Oracle 不自动提交, 不执行就关闭连接 = 自动回滚)
-- ------------------------------------------------------------
ROLLBACK;
-- COMMIT;

-- ============================================================
-- 省医 · 症状导诊知识库 —— 数据变更(DML)练习脚本
-- 适用: 已执行过 sql/import_all.sql 的 MySQL 8.0+ 环境
-- 建议: 在 DBeaver 中打开, 逐段选中后按 Ctrl+Enter 执行
-- 安全: 本脚本整体包在事务里, 结尾二选一(提交/回滚), 放心练习
-- ============================================================

USE shengyi_triage;

-- 开启事务: 之后的改动在 COMMIT 前都不会真正落库
START TRANSACTION;

-- ------------------------------------------------------------
-- 练习 1: 新增数据 (INSERT)
-- 口诀: 先插"被引用的字典表", 再插主表; 关键词表最后补
-- ------------------------------------------------------------

-- 1.1 新增一个科室(字典表 departments 没有任何依赖, 随时可加)
INSERT INTO departments (dept_key, name, dept_group, intro)
VALUES ('demo', '示例科室门诊', '内科', '仅用于演示 INSERT 的科室, 练习后可随事务回滚。');

-- 1.2 新增一条症状(挂在刚建的 demo 科室下)
--     dept_key / level_key 必须已存在于字典表, 否则报 ERROR 1452
--     diagnoses / alts / tips 三列是 JSON, 用 JSON_ARRAY() 生成
INSERT INTO triage_entries
  (entry_id, name, category, population, dept_key, dept_display, dept_note,
   level_key, diagnoses, alts, tips, science, redline)
VALUES
  ('demo-itch', '皮肤瘙痒(演示)', '皮肤相关', '通用',
   'demo', '示例科室门诊', '',
   'green',
   JSON_ARRAY('演示性瘙痒症', '慢性荨麻疹(待排查)'),
   JSON_ARRAY('皮肤科门诊'),
   JSON_ARRAY('演示条目, 用于学习 INSERT, 学完可删除。'),
   '这是演示用的示例条目, 并非真实医学内容, 用于展示如何插入完整记录。',
   '演示条目无真实急诊红线, 请勿当真。');

-- 1.3 症状要被搜索框命中, 必须同步写搜索词展开表
--     一张症状卡对应多个搜索词 → 这里体现 1:N
INSERT INTO triage_keywords (entry_id, keyword) VALUES
  ('demo-itch', '皮肤瘙痒演示'),
  ('demo-itch', '痒演示');

-- 验证: 三表 JOIN 看这条新症状(科室名、级别名都被"翻译"出来了)
SELECT e.entry_id, e.name, d.name AS 科室, l.label AS 分诊级别
FROM triage_entries e
JOIN departments  d ON d.dept_key = e.dept_key
JOIN triage_levels l ON l.level_key = e.level_key
WHERE e.entry_id = 'demo-itch';

-- ------------------------------------------------------------
-- 练习 2: 修改数据 (UPDATE)
-- 口诀: 必须带 WHERE! 不带 WHERE 会把整张表全改掉(高危)
-- ------------------------------------------------------------

-- 2.1 改普通文本列: 给科室改名
UPDATE departments
SET name = '示例科室门诊(已更名)'
WHERE dept_key = 'demo';

-- 2.2 改 JSON 整列: 直接整体替换 diagnoses
UPDATE triage_entries
SET diagnoses = JSON_ARRAY('演示性瘙痒症', '神经性皮炎(待排查)')
WHERE entry_id = 'demo-itch';

-- 2.3 只动 JSON 里的局部, 不覆盖其它元素
--     (a) 往 tips 数组末尾追加一条
UPDATE triage_entries
SET tips = JSON_ARRAY_APPEND(tips, '$', '这条提示是用 JSON_ARRAY_APPEND 追加的。')
WHERE entry_id = 'demo-itch';
--     (b) 修改 diagnoses 的第 0 个元素(索引从 0 开始)
UPDATE triage_entries
SET diagnoses = JSON_SET(diagnoses, '$[0]', '演示性皮肤瘙痒')
WHERE entry_id = 'demo-itch';

-- 2.4 改分诊级别: 只能填字典里存在的值(green/yellow/red), 否则报 ERROR 1452
UPDATE triage_entries
SET level_key = 'yellow'
WHERE entry_id = 'demo-itch';

-- 验证: 查看修改后的整条记录(JSON 列会原样显示)
SELECT entry_id, name, level_key, diagnoses, tips
FROM triage_entries
WHERE entry_id = 'demo-itch';

-- ------------------------------------------------------------
-- 练习 3: 删除数据 (DELETE)
-- 口诀: 同样必须带 WHERE; 注意外键的"牵连关系"
-- ------------------------------------------------------------

-- 3.1 删一个搜索词(比如某个同义词打错了)
DELETE FROM triage_keywords
WHERE entry_id = 'demo-itch' AND keyword = '痒演示';

-- 3.2 删除整条症状
--     由于 fk_kw_entry 定义了 ON DELETE CASCADE,
--     它的搜索词会"自动连带删除", 不会留下孤儿数据
DELETE FROM triage_entries WHERE entry_id = 'demo-itch';

-- 验证级联: 这条症状的搜索词应该已经是 0 行
SELECT COUNT(*) AS 残留搜索词 FROM triage_keywords WHERE entry_id = 'demo-itch';

-- 3.3 删除科室: 若还有症状引用它会报 ERROR 1451(外键阻止删除)
--     上面已经把 demo-itch 删了, 所以现在可以顺利删除
DELETE FROM departments WHERE dept_key = 'demo';

-- ------------------------------------------------------------
-- 常见报错速查(下面场景会报错, 只做讲解不执行):
--
--   ERROR 1451: 删除被引用的字典行(如删还有症状的科室)
--        → 先删/改掉引用它的子表行, 再删字典行
--   ERROR 1452: 插入/修改时引用了不存在的科室或级别
--        → 先确认 dept_key / level_key 拼写正确
--   ERROR 1062: 主键重复(如重复插入同 entry_id)
--        → 改用 UPDATE, 或先 DELETE 再 INSERT
--   ERROR 1048: NOT NULL 列没给值
--        → 对照建表语句把必填列补齐
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 收尾二选一:
--   ROLLBACK → 撤销上面所有练习改动(推荐先这样练, 库保持原样)
--   COMMIT   → 真正保存改动(想保留练习结果时用)
-- ------------------------------------------------------------
ROLLBACK;
-- COMMIT;

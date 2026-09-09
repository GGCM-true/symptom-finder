-- 生成自 tools/export_oracle.js · data.js 数据源
-- ============================================================
-- 省医 · 症状导诊知识库 (Oracle 23ai 版)  第 0 步: 建用户
-- 前提: Oracle 23ai Free 默认的 PDB 名为 freepdb1
-- 执行: 用 system 账号连接到 freepdb1(命令行 sqlplus 或 DBeaver 均可)
-- 说明: MySQL 的「数据库」在 Oracle 里对应「用户(schema)」
-- ============================================================

-- 建用户(密码建议改成你自己的, 可用字母+数字, 长度 >= 8)
CREATE USER shengyi_triage IDENTIFIED BY oracle123;

-- 授权: 能登录 + 能建表 + 表空间不受限
GRANT CONNECT, RESOURCE, UNLIMITED TABLESPACE TO shengyi_triage;

-- 若以后要重建, 可先删除该用户(会连数据一起删):
-- DROP USER shengyi_triage CASCADE;

-- 之后 DBeaver 新建连接: 主机 localhost / 端口 1521 / 服务名 freepdb1
-- 用户名 shengyi_triage / 密码 oracle123, 再执行 01_schema.sql → 02_data.sql

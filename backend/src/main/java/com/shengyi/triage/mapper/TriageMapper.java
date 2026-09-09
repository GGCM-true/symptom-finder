package com.shengyi.triage.mapper;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;
import java.util.Map;

/**
 * 症状导诊数据访问层（MyBatis 注解版 SQL）
 * 全部返回 Map：列名已用 SQL 别名规范化为驼峰风格，便于直接 JSON 输出
 */
@Mapper
public interface TriageMapper {

    /* ---------- 科室 ---------- */

    /** 全部科室目录 */
    @Select("SELECT dept_key AS `key`, name, dept_group AS `group`, intro " +
            "FROM departments ORDER BY dept_key")
    List<Map<String, Object>> listDepartments();

    /** 单个科室（用于确认 key 是否存在 / 反查显示名） */
    @Select("SELECT dept_key AS `key`, name, dept_group AS `group`, intro " +
            "FROM departments WHERE dept_key = #{key}")
    Map<String, Object> getDepartment(@Param("key") String key);

    /* ---------- 症状条目 ---------- */

    /** 关键词搜索：主名/同义词/诊断名 LIKE 匹配（先用搜索词表，再放宽到名称与诊断） */
    @Select("""
            <script>
            SELECT DISTINCT
              e.entry_id      AS id,
              e.name          AS name,
              e.category      AS category,
              e.population    AS population,
              e.dept_key      AS deptKey,
              e.dept_display  AS deptDisplay,
              e.dept_note     AS deptNote,
              e.level_key     AS levelKey,
              e.diagnoses     AS diagnoses,
              e.alts          AS alts,
              e.tips          AS tips,
              e.science       AS science,
              e.redline       AS redline,
              (SELECT k.keyword FROM triage_keywords k
                 WHERE k.entry_id = e.entry_id
                   AND (k.keyword LIKE CONCAT('%', #{kw}, '%'))
                 ORDER BY CASE WHEN k.keyword = #{kw} THEN 0
                               WHEN k.keyword LIKE CONCAT(#{kw}, '%') THEN 1 ELSE 2 END
                 LIMIT 1)     AS matchedKeyword
            FROM triage_entries e
            WHERE e.name LIKE CONCAT('%', #{kw}, '%')
               OR e.entry_id IN (SELECT entry_id FROM triage_keywords
                                 WHERE keyword LIKE CONCAT('%', #{kw}, '%'))
               OR JSON_SEARCH(e.diagnoses, 'one', CONCAT('%', #{kw}, '%')) IS NOT NULL
            ORDER BY CASE WHEN e.name = #{kw} THEN 0 ELSE 1 END, e.entry_id
            LIMIT 60
            </script>
            """)
    List<Map<String, Object>> searchSymptoms(@Param("kw") String kw);

    /** 全部条目（kw 为空时的兜底，供前端一次性加载/管理） */
    @Select("""
            SELECT entry_id AS id, name, category, population, dept_key AS deptKey,
                   dept_display AS deptDisplay, dept_note AS deptNote, level_key AS levelKey,
                   diagnoses, alts, tips, science, redline, NULL AS matchedKeyword
            FROM triage_entries ORDER BY entry_id
            """)
    List<Map<String, Object>> listAllSymptoms();

    /** 单条详情 */
    @Select("SELECT entry_id AS id, name, category, population, dept_key AS deptKey, " +
            "dept_display AS deptDisplay, dept_note AS deptNote, level_key AS levelKey, " +
            "diagnoses, alts, tips, science, redline, NULL AS matchedKeyword " +
            "FROM triage_entries WHERE entry_id = #{id}")
    Map<String, Object> getSymptom(@Param("id") String id);

    /** 某科室的症状：主科室=key，或备选科室(alts JSON) 中含该科室显示名 */
    @Select("""
            <script>
            SELECT entry_id AS id, name, category, population, dept_key AS deptKey,
                   dept_display AS deptDisplay, dept_note AS deptNote, level_key AS levelKey,
                   diagnoses, alts, tips, science, redline, NULL AS matchedKeyword
            FROM triage_entries
            WHERE dept_key = #{key}
               OR (#{deptName} IS NOT NULL AND #{deptName} != ''
                   AND JSON_SEARCH(alts, 'one', #{deptName}, NULL, '$') IS NOT NULL)
            ORDER BY entry_id
            </script>
            """)
    List<Map<String, Object>> listSymptomsByDept(@Param("key") String key,
                                                 @Param("deptName") String deptName);

    /* ---------- 统计 ---------- */

    @Select("SELECT (SELECT COUNT(*) FROM triage_entries)    AS entries, " +
            "(SELECT COUNT(*) FROM departments)              AS departments, " +
            "(SELECT COUNT(*) FROM triage_keywords)          AS keywords, " +
            "(SELECT COUNT(*) FROM triage_entries WHERE level_key='red') AS redCount")
    Map<String, Object> stats();
}

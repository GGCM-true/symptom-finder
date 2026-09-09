package com.shengyi.triage.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.shengyi.triage.mapper.TriageMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * 症状导诊 API 控制器
 * 说明：diagnoses / alts / tips 三列为 MySQL JSON，读取后统一解析为数组再输出；
 *       列名已规范化为驼峰，前端可直接使用。
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")   // 开发期放开跨域；生产环境请收窄为你的前端域名
public class TriageController {

    private static final List<String> JSON_FIELDS = List.of("diagnoses", "alts", "tips");

    private final TriageMapper mapper;
    private final ObjectMapper om = new ObjectMapper();

    public TriageController(TriageMapper mapper) {
        this.mapper = mapper;
    }

    /** 元信息/计数，便于前端页脚与调试 */
    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return mapper.stats();
    }

    /** 1) 全部科室目录 */
    @GetMapping("/departments")
    public List<Map<String, Object>> departments() {
        return mapper.listDepartments();
    }

    /** 2) 症状搜索（支持同义词/诊断名模糊匹配） GET /api/symptoms?kw=肚子疼 */
    @GetMapping("/symptoms")
    public List<Map<String, Object>> search(@RequestParam(required = false, defaultValue = "") String kw) {
        List<Map<String, Object>> rows = (kw == null || kw.isBlank())
                ? mapper.listAllSymptoms()
                : mapper.searchSymptoms(kw.trim());
        rows.forEach(this::unwrapJson);
        return rows;
    }

    /** 3) 单条症状详情 GET /api/symptoms/fever */
    @GetMapping("/symptoms/{id}")
    public ResponseEntity<Map<String, Object>> detail(@PathVariable String id) {
        Map<String, Object> row = mapper.getSymptom(id);
        if (row == null) {
            return ResponseEntity.notFound().build();
        }
        unwrapJson(row);
        return ResponseEntity.ok(row);
    }

    /** 4) 某科室的症状列表 GET /api/departments/fever/symptoms */
    @GetMapping("/departments/{key}/symptoms")
    public ResponseEntity<List<Map<String, Object>>> deptSymptoms(@PathVariable String key) {
        Map<String, Object> dept = mapper.getDepartment(key);
        if (dept == null) {
            return ResponseEntity.notFound().build();
        }
        String deptName = dept.get("name") == null ? "" : dept.get("name").toString();
        List<Map<String, Object>> rows = mapper.listSymptomsByDept(key, deptName);
        rows.forEach(this::unwrapJson);
        return ResponseEntity.ok(rows);
    }

    /** JSON 字符串列 → Java 对象（数组），保证响应里是真正的 JSON 数组 */
    private void unwrapJson(Map<String, Object> m) {
        for (String f : JSON_FIELDS) {
            Object v = m.get(f);
            if (v instanceof String s && !s.isBlank()) {
                try {
                    m.put(f, om.readValue(s, Object.class));
                } catch (Exception ignore) {
                    // 保留原字符串，避免接口因脏数据挂掉
                }
            } else if (v == null) {
                m.put(f, new ArrayList<>());
            }
        }
    }
}

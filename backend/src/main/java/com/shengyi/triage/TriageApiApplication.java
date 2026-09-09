package com.shengyi.triage;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 症状导诊查询 API 启动类
 * 依赖：本机 MySQL 已导入 shengyi_triage 库（见仓库 sql/import_all.sql）
 * 前端(前端静态页)可通过本接口从数据库取数
 */
@SpringBootApplication
@MapperScan("com.shengyi.triage.mapper")
public class TriageApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(TriageApiApplication.class, args);
    }
}

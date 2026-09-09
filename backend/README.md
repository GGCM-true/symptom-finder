# triage-api · 症状导诊后端（Spring Boot + MyBatis + MySQL）

把 `shengyi_triage` 库中的数据以 REST 接口暴露给网页/小程序等前端，
实现「前端只管展示、数据都在数据库、改库即生效」的数据库驱动模式。

> 技术栈与你的「办公用品管理系统」规划一致（Spring Boot 3 + MyBatis），
> 学这一份可同时用于两个项目。

## 0. 前置条件

| 项 | 要求 |
|---|---|
| JDK | 17（本机已装 Temurin 17） |
| MySQL | 8.0 已运行，且已执行过 `sql/import_all.sql`（见仓库根 README） |
| Maven | 本地 `mvn` 若报 classworlds 错，可用 IDEA 内置 Maven，或按仓库根 `git-cheatsheet` 修复 |

## 1. 运行

```bash
cd shengyi-triage/backend

# 方式 A：用环境变量注入数据库密码（推荐，密码不进代码库）
export DB_PASSWORD=你的mysql密码
mvn spring-boot:run

# 方式 B：直接改 src/main/resources/application.yml 里的 password 后运行
```

启动成功后访问 http://localhost:8080/api/stats 看到计数即成功。

> Windows CMD 设置环境变量：`set DB_PASSWORD=你的mysql密码` 再运行。

## 2. 接口一览

| 方法 | 路径 | 作用 | 示例 |
|---|---|---|---|
| GET | `/api/stats` | 统计（条目/科室/搜索词/红级数） | `curl http://localhost:8080/api/stats` |
| GET | `/api/departments` | 全部科室目录 | `curl http://localhost:8080/api/departments` |
| GET | `/api/symptoms?kw=` | **关键词搜症状**（同义词/诊断模糊匹配） | `curl "http://localhost:8080/api/symptoms?kw=肚子疼"` |
| GET | `/api/symptoms/{id}` | 单条症状详情 | `curl http://localhost:8080/api/symptoms/fever` |
| GET | `/api/departments/{key}/symptoms` | 某科室的症状（含备选科室命中） | `curl http://localhost:8080/api/departments/fever/symptoms` |

返回字段：`id / name / category / population / deptKey / deptDisplay / deptNote /
levelKey / diagnoses[] / alts[] / tips[] / science / redline / matchedKeyword`，
其中 `diagnoses / alts / tips` 是真正的 JSON 数组（后端已解析），前端可直接使用。

## 3. 前端如何切换为「数据库驱动」

静态页（index.html）目前读 `data.js`。切到 API 版的两条路径：

**路径一（轻量）**：在控制台验证接口后，将来写一个新页面把 `data.js` 换成 fetch：

```js
fetch("http://localhost:8080/api/symptoms?kw=" + encodeURIComponent("发烧"))
  .then(r => r.json())
  .then(list => console.log(list));
```

**路径二（完整）**：把接口调用封装成 `api.js`，替换 `searchEntries()` 等函数的数据来源，
即「静态版 → API 版」的无痛迁移。迁移时原样保留页面里 `keyOf/linkDepts` 逻辑即可
（接口已返回 `deptKey`，不再需要本地挂接映射）。

> ⚠️ 浏览器跨域：开发期接口已加 `@CrossOrigin("*")`；部署到同域（Nginx 反代 /api 到后端）
> 时前端与后端同源，无需 CORS。

## 4. 项目结构

```
backend/
├─ pom.xml                       # Spring Boot 3.3.5 + MyBatis 3.0.4 + mysql-connector
└─ src/main/
   ├─ java/com/shengyi/triage/
   │  ├─ TriageApiApplication.java   # 启动类（@MapperScan）
   │  ├─ controller/TriageController.java  # REST 接口 + JSON 列解析
   │  └─ mapper/TriageMapper.java          # MyBatis 注解 SQL（含 JSON_SEARCH 模糊匹配）
   └─ resources/application.yml    # 端口/数据源/密码占位
```

## 5. 常见问题

- **`Communications link failure`**：MySQL 没启动，或 application.yml 端口/密码不对。
- **`Unknown database 'shengyi_triage'`**：还没导入数据，先跑根目录 `sql/import_all.sql`。
- **`Public Key Retrieval is not allowed`**：url 已带 `allowPublicKeyRetrieval=true`，若仍报错检查 MySQL 8 caching_sha2_password 配置。
- **改数据后想立刻生效**：直接对库 UPDATE，前端刷新即新数据——这就是数据库版的意义。

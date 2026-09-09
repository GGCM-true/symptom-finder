# Git Bash 指令速查手册（symptom-finder 实战版）

> 记录自 2026-09-09 将本项目成功发布到 GitHub 的全过程，每条命令附当时踩过的坑。
> 仓库：https://github.com/GGCM-true/symptom-finder

---

## 一、首次发布全流程（按顺序执行）

```bash
cd ~/WorkBuddy/2026-09-04-17-16-22/shengyi-triage   # 0. 进入项目目录

git init                                            # 1. 初始化仓库
git config user.name  "GGCM-true"                   # 2. 设置提交者名字
git config user.email "你的邮箱"                     # 3. 设置提交者邮箱
git add .                                           # 4. 暂存全部文件
git commit -m "症状导诊查询工具:响应式网页 + 结构化数据 + MySQL/Oracle脚本"   # 5. 提交
git branch -M main                                  # 6. 分支改名为 main
git remote add origin https://github.com/GGCM-true/symptom-finder.git       # 7. 关联远程仓库
git push -u origin main                             # 8. 首次推送（-u 建立跟踪）
```

| 命令 | 作用 | 当时的坑 |
|---|---|---|
| `git init` | 在当前目录创建 `.git`，使其成为 Git 仓库 | ⚠️ **必须最先执行**。先跑 `git config user.name` 会报 `fatal: not in a git directory`（配置要写进仓库，仓库还不存在） |
| `git config user.name/email` | 设置提交者身份（写进每次提交记录） | 不带 `--global` 只对本仓库生效；想一劳永逸加 `--global` |
| `git add .` | 把当前目录**所有**变更放进"待提交区"（暂存区） | ⚠️ 漏写点号：`git add` 单独用 = "没说要加什么"，报 `Nothing specified` |
| `git commit -m "说明"` | 把暂存区内容正式存为一个版本 | `-m` 后面是本次改动说明，必写 |
| `git branch -M main` | 把当前分支重命名为 `main`（GitHub 默认主分支名） | 成功后提示符从 `(master)` 变 `(main)` |
| `git remote add origin <URL>` | 给远程仓库起别名 `origin` | 一条命令报 `remote origin already exists` = 已关联过，改用 `git remote set-url origin <URL>` |
| `git push -u origin main` | 推送到远程；`-u` = 记住对应关系 | 首次推送需认证：新版 Git 会自动弹**浏览器**完成 GitHub 授权 |

### 一次性的全局配置（可选，推荐）

```bash
git config --global user.name  "GGCM-true"    # 以后所有仓库共用，不用每个仓库重设
git config --global user.email "你的邮箱"
```

---

## 二、日常更新三连（最常用，背下来）

```bash
git add .                          # 1. 暂存改动
git commit -m "一句话说明改了什么"   # 2. 提交
git push                           # 3. 推送（已跟踪，不再需要 -u origin main）
```

推送成功的标志：`main -> main` + `Writing objects ... done`。
若显示 `Everything up-to-date` = 远程已是最新、无东西可推（无害，通常是重复 push）。

---

## 三、排障命令实录（按问题出现顺序）

### 问题 1：`git push` 报 `Empty reply from server`（连不上 GitHub）

```bash
# ① 探测能否直连 GitHub
curl -sS -o /dev/null -w "HTTP %{http_code}\n" --connect-timeout 8 https://github.com

# ② 查本机代理软件监听在哪个端口（找"开着的门"）
netstat -ano | grep "LISTENING" | grep "127.0.0.1:" | awk '{print $2, $NF}' | sort -u

# ③ 逐个候选端口试拨：能返回 HTTP 200 的就是代理端口
for p in 7890 7897 10081; do
  curl -x http://127.0.0.1:$p -sS -o /dev/null -w "端口 $p → HTTP %{http_code}\n" \
       --connect-timeout 5 https://github.com
done

# ④ 确认端口后，让 Git 走代理（本机实测 10081）
git config --global http.proxy  http://127.0.0.1:10081
git config --global https.proxy http://127.0.0.1:10081

# ⑤ 反查端口归属的程序（两步）
netstat -ano | grep 10081          # 拿到最后一列 PID
tasklist | grep 23744              # 用 PID 查程序名（Git Bash 用 grep）

# ⑥ 以后换了不需要代理的网络，取消代理配置
git config --global --unset http.proxy
git config --global --unset https.proxy
```

### 问题 2：`git push` 报 `401 Unauthorized`（认证失败）

```
remote: Invalid username or token. Password authentication is not supported.
```

原因与解决：

| 原因 | 解决 |
|---|---|
| 把 GitHub 登录密码当凭据 | GitHub 已禁用密码推送，必须用 **Token** 或**浏览器授权** |
| Token 无效/过期/没勾 `repo` 权限 | GitHub → Settings → Developer settings → Personal access tokens → 重新生成，勾选 `repo` |
| Windows 缓存了错误凭据，不再弹窗 | 控制面板 → 凭据管理器 → Windows 凭据 → 删除 `git:https://github.com` → 重新 push 触发浏览器授权 |

### 问题 3：不确定本地仓库当前状态

```bash
git status              # 查看工作区/暂存区状态（最常用）
git status --short      # 精简版：每行开头 A=已暂存 M=已修改 ??=未跟踪
git log --oneline       # 查看提交历史（一行一条）
git remote -v           # 查看已关联的远程仓库地址
```

---

## 四、Git Bash 与 CMD 的命令差异（同一个意思，两种写法）

| 用途 | Git Bash | CMD / PowerShell |
|---|---|---|
| 过滤文本 | `grep 关键词` | `findstr 关键词` |
| 精确按 PID 查进程 | `tasklist \| grep 23744` | `tasklist /FI "PID eq 23744"` |
| 历史命令 | `history` | `doskey /history` |

> ⚠️ 坑：`tasklist | findstr 4` 是**子串包含**匹配，会把 PID 含"4"的进程全捞出来；
> 精确过滤请用 `tasklist /FI "PID eq 4"` 或 PowerShell 的 `Get-Process -Id 4`。

---

## 五、错误与提示速查表

| 报错/提示 | 含义 | 处理 |
|---|---|---|
| `fatal: not in a git directory` | 当前目录不是仓库（还没 `git init`） | 先 `git init` |
| `Nothing specified, nothing added` | `git add` 后没写路径 | 补上点号：`git add .` |
| `warning: LF will be replaced by CRLF` | 换行符转换提示（Windows 常态） | **忽略**，无任何影响 |
| `Empty reply from server` | 连不上 GitHub（网络被阻断） | 走代理：见第三节问题 1 |
| `401 Unauthorized` | 用户名/token 无效 | 见第三节问题 2 |
| `Everything up-to-date` | 没有新改动可推 | 正常，无需处理 |
| `remote origin already exists` | 远程别名已存在 | 用 `git remote set-url origin <URL>` 改地址 |

---

## 六、本次用到的非 Git 命令（Shell 基础）

| 命令 | 作用 |
|---|---|
| `cd 目录` | 切换目录（`~` = 用户主目录） |
| `curl -sS -o /dev/null -w "..." URL` | 发 HTTP 请求，只看状态码不看正文 |
| `curl -x http://127.0.0.1:端口 URL` | 强制走指定代理端口访问 |
| `netstat -ano` | 列出网络连接（`-a` 全部 / `-n` 数字显示 / `-o` 附 PID） |
| `grep 关键词` | 按关键字过滤输出（配合 `\|` 管道使用） |
| `awk '{print $2, $NF}'` | 取每行第 2 列和最后一列 |
| `sort -u` | 排序去重 |
| `tasklist` | 列出全部进程（配合 `grep` 按 PID 查程序名） |

---

## 七、一张图记住流程

```
改动文件 → git add . → git commit -m "说明" → git push
   (工作区)      (暂存区)         (本地仓库)        (GitHub)
```

> 文档位置：`shengyi-triage/git-cheatsheet.md`；需要更新时按"日常更新三连"推送到 GitHub 即可。

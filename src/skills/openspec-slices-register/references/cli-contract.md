# OpenSpec CLI v1.4.1 契约

本文档记录 OpenSpec CLI v1.4.1 的精确契约，供 `openspec-slices-register` / `openspec-slices-track` 技能对齐。来源：`openspec --help` 与各子命令 `--help`、以及实际运行测试（验证日期见文末）。

## slice 技能实际使用的命令（首选阅读）

`openspec-slices-*` 三个技能**只使用**以下命令：

### init 命令（初始化 OpenSpec 工作空间）

**语法**：
```bash
openspec init [path] --tools <tools> --force --profile <profile>
```
- `path`：可选，目标目录；省略时初始化当前目录
- `--tools <tools>`：非交互配置 AI 工具，取 `all` / `none` / 逗号分隔列表（claude, codex, cursor, ...）
- `--force`：自动清理 legacy 文件，不交互提示
- `--profile <profile>`：覆盖全局 config profile（`core` 或自定义）
- `--json`：init **不接受** `--json`（已验证），输出为人类可读文本

**实际行为**（实跑验证）：在目标目录创建 in-repo 结构：
```
openspec/
  config.yaml          # schema: spec-driven 等项目级配置
  changes/
    archive/
  specs/
```
该结构位于目标 repo 内，**随 git 同步、可跨设备使用**——这是 `openspec-slices-register` 在 cross-repo 场景初始化集中工作空间使用的命令。

**openspec-slices-register 使用**：cross-repo 且 `workspace.init_status: required` 时，对 `workspace.path` 运行 `openspec init --tools none --force <path>`（或省略 path 时先 `cd`）。`--tools none` 避免在工作空间内安装 agent skills 副本。

---

### new change 命令（创建 change）

**语法**：
```bash
openspec new change <name> --goal <g> --areas <a1,a2> --initiative <id> --store <store> --store-path <path> --schema <schema> --json
```

**slice 技能只用以下参数**：
- `<name>`：必填，kebab-case，合法字符 `[a-z0-9-]`，不以 `-` 开头/结尾
- `--goal <g>`：可选，一行目标描述（repo-local 常用）
- `--json`：输出 JSON

> `--initiative` / `--store` / `--store-path` / `--areas` / `--schema` 属于 context-store / initiative / workspace 形态，**slice 技能不再使用**（见下文「降级段」）。slice 技能创建的 change 一律为 repo-local，不带 `--initiative`。

**输出**（`--json`，实跑验证）：
```json
{
  "change": {
    "id": "export-feature-01-foundation",
    "path": "/abs/openspec/changes/export-feature-01-foundation",
    "metadataPath": "/abs/openspec/changes/export-feature-01-foundation/.openspec.yaml",
    "schema": "spec-driven"
  }
}
```

**关键点**（实跑验证）：
- 创建时**只生成 `.openspec.yaml`**，**不生成 `proposal.md`**——`proposal.md` 需在登记阶段由 subagent 当轮写完（这是 `openspec-slices-register` 的硬约束）。
- 上例 `id` 是 `openspec-slices-plan` 三段命名 `{change-name}-{change-num}-{slice-change-name}` 的实例；CLI 本身只强制 kebab-case（见 §kebab-case），三段结构是 skill 层约定。
- change 已存在时报错（非 JSON 时输出 "Change '<name>' already exists"）；register 捕获视为成功（幂等）。

---

### list 命令（查询 active changes）

**语法**：
```bash
openspec list --json [--specs]
```
- 默认列 changes；`--specs` 列 specs

**输出**（`--json`，实跑验证）：
```json
{
  "changes": [
    {
      "name": "export-feature-01-foundation",
      "completedTasks": 0,
      "totalTasks": 0,
      "lastModified": "2026-07-28T01:42:41.476Z",
      "status": "no-tasks"
    }
  ]
}
```
`status` 可为 `no-tasks`（尚未生成 tasks.md）。

**实跑验证：`list` 只返回 active changes，已归档 change 不出现**。`openspec list` 也没有 `--archived`/`--all` 选项（仅 `--specs`/`--changes`/`--sort`/`--json`）。因此 `openspec-slices-track` 不能用 `list` 发现已归档切片——archived 检测须走文件系统（见下文 `archive` 命令与「archived 检测策略」）。`list --json` 用于 active change 列表与 task 计数（`completedTasks`/`totalTasks`/`lastModified`）。

---

### status 命令（查询单 change 状态）★ 实跑验证

**语法**：
```bash
openspec status --change <name> --schema <name> --json
```
- `--change <id>`：change 名称
- `--schema <name>`：schema 覆盖（默认从 config.yaml 自动检测）
- `--json`：输出 JSON

**输出**（`--json`，实跑验证 v1.4.1，比旧文档更丰富）：
```json
{
  "changeName": "export-feature-01-foundation",
  "schemaName": "spec-driven",
  "planningHome": {
    "kind": "repo",
    "root": "/abs/repo-root",
    "changesDir": "/abs/repo-root/openspec/changes",
    "defaultSchema": "spec-driven"
  },
  "changeRoot": "/abs/openspec/changes/export-feature-01-foundation",
  "artifactPaths": {
    "proposal": { "outputPath": "proposal.md", "resolvedOutputPath": "...", "existingOutputPaths": [] },
    "specs": { "outputPath": "specs/**/*.md", "resolvedOutputPath": "...", "existingOutputPaths": [] },
    "design": { "outputPath": "design.md", "resolvedOutputPath": "...", "existingOutputPaths": [] },
    "tasks": { "outputPath": "tasks.md", "resolvedOutputPath": "...", "existingOutputPaths": [] }
  },
  "isComplete": false,
  "applyRequires": ["tasks"],
  "nextSteps": ["Run openspec instructions proposal --change \"...\" --json ..."],
  "actionContext": {
    "mode": "repo-local",
    "sourceOfTruth": "repo",
    "planningArtifacts": ["proposal", "design", "specs", "tasks"],
    "linkedContext": [],
    "allowedEditRoots": ["/abs/repo-root"]
  },
  "artifacts": [
    { "id": "proposal", "outputPath": "proposal.md", "status": "ready" },
    { "id": "design", "outputPath": "design.md", "status": "blocked", "missingDeps": ["proposal"] },
    { "id": "specs", "outputPath": "specs/**/*.md", "status": "blocked", "missingDeps": ["proposal"] },
    { "id": "tasks", "outputPath": "tasks.md", "status": "blocked", "missingDeps": ["design", "specs"] }
  ]
}
```

**关键点**：
- `status` 侧重 artifact 完成度与 change 定位；进度字段（`completedTasks`/`totalTasks`）以 `openspec list --json` 为聚合入口。
- `planningHome.root` 给出工作空间根路径，可用于解析计划源相对位置。
- `actionContext.mode: repo-local` 可用来确认 change 未被错误 link 到 initiative。
- `artifacts[].status`（`ready`/`blocked`）与 `missingDeps` 表达 artifact 依赖，非切片级依赖（切片级依赖看 slice-plan.yaml 的 `depends_on`）。

#### status 对 archived change 的行为（★ 实跑验证 v1.4.1）

**实跑结论：archived change 用 `status --change <name>` 查询会报错，不返回 JSON**。

```bash
openspec archive "test-archived-01"                 # 归档
openspec status --change "test-archived-01" --json   # ✖ Error: Change 'test-archived-01' not found. (exit 1, 无 JSON)
```

- `openspec status --change <archived-name>` → 报错 `Change '<name>' not found`，exit code 1，**无 JSON 输出**。
- 用归档后的带日期前缀名 `2026-07-30-test-archived-01` 查询 → 报错 `Invalid change name ...: Change name must start with a letter`（日期前缀违反 kebab-case，CLI 拒绝）。
- **结论**：`status` 命令**不能**用来检测或查询 archived change。

**archived 检测策略（track 必须改用文件系统而非 CLI 查询）**：
- `openspec list --json` 不列 archived（见上 list 段）。
- archived change 落在文件系统 `<workspace>/openspec/changes/archive/<YYYY-MM-DD>-<name>/.openspec.yaml`（仅 `.openspec.yaml` 被移入 archive，proposal/specs/design/tasks 不复制）。
- **track 判定 archived**：对计划源中每个切片，若它不在 `list --json` 的 active 列表，则检查 `<workspace>/openspec/changes/archive/` 下是否存在目录名以 `-<slice-full-name>` 结尾（即 `<YYYY-MM-DD>-<slice-full-name>` 形态）。存在 → archived；既不在 active 也无 archive 目录 → 未登记或被删除（警告不一致）。
- 不再依赖 `status --change` 补查 archived。

### show 命令（★ 不可靠，slice 技能禁用）

```bash
openspec show [item-name] --json --type <change|spec> ...
```
**实跑验证**：`openspec show <change-name>` 返回 `Unknown item '<name>'`——`show` **不是**可靠的 per-change 状态查询入口。

**openspec-slices-track 禁用 `show`** 查询状态；改用 `openspec status --change <name> --json` 与 `openspec list --json`。

---

### validate 命令（校验 changes/specs）

**语法**：
```bash
openspec validate [item-name] --all --changes --specs --type <change|spec> --strict --json --concurrency <n> --no-interactive
```
- 不带 item-name 时配合 `--all` / `--changes` / `--specs`
- `--type`：歧义时指定 `change|spec`
- `--strict`：严格模式
- `--json`：输出 JSON 校验结果

**注意**：正确命令是 `openspec validate`，**不是** `openspec schema validate`。slice 技能当前不强制调用 `validate`；若 `openspec-slices-track` 需要健康检查可使用。

---

### archive 命令（归档 change）★ 实跑验证 v1.4.1

```bash
openspec archive <change-name> [--yes] [--skip-specs] [--no-validate]
```
- `-y/--yes`：跳过确认
- `--skip-specs`：跳过 spec 更新（infra/工具/纯文档 change）
- `--no-validate`：跳过校验（需确认）

**实跑行为**：归档后该 change 目录从 `openspec/changes/<name>/` 移入 `openspec/changes/archive/<YYYY-MM-DD>-<name>/`（**加日期前缀**）；archive 目录内仅保留 `.openspec.yaml`，proposal/specs/design/tasks 不被复制入 archive。

**对 track 的影响（已实跑）**：
- 归档后 `openspec list --json` 不再列该 change；`openspec status --change <name> --json` 报 `not found`。
- track 检测 archived 须扫 `<workspace>/openspec/changes/archive/` 下以 `-<slice-full-name>` 结尾的目录（见上文「archived 检测策略」）。
- slice 技能不主动调用 `archive`（归档属 apply/verify/archive 阶段）；track 只读 archive 目录判断依赖是否满足。

---

## kebab-case 校验规则

**合法字符**：`[a-z0-9-]`（小写字母、数字、连字符）

**禁止**：大写字母、下划线、以 `-` 开头/结尾、连续多个 `-`（技术上合法但不推荐）。

**CLI 行为**：
- `openspec new change "My-Change"` → 报错 "Invalid change name"
- `openspec new change "my_change"` → 报错
- `openspec new change "my-change"` → 成功

**slice 技能校验**：
- Slice Plan 的 `slices[].name`（第三段）必须 kebab-case
- `change_name`（第一段）+ `sequence`（`01`/`02`...，第二段）拼接的 `{change_name}-{sequence}-{name}` 整体须通过 kebab-case
- 不符合 → STOP 退回 change-slice

---

## 降级段：context-store / initiative / workspace setup（slice 技能不使用，仅备 CLI 全貌）

> ⚠️ **scope 横幅**：以下命令 `openspec-slices-plan/register/track` 三个技能**不再使用**。它们记录的是 OpenSpec CLI 提供的 context-store / initiative / machine-local workspace 能力的全貌，供其他 skill 或人工参考，不构成 slice 技能的登记/追踪路径。slice 技能统一走「单工作空间 repo-local」流（见各 SKILL.md）。

### context-store 命令（slice 技能不使用）

```bash
openspec context-store setup [id] --path <storeRoot> --init-git --json
openspec context-store list --json
openspec context-store doctor --json
```
`--path` 必填绝对路径；`--init-git` 与 `--no-init-git` 互斥；`--json` 输出 `{id,path,created}`。

### initiative 命令（slice 技能不使用）

```bash
openspec initiative create [id] --title <t> --summary <s> --store <store> --store-path <path> --json
openspec initiative show <id> --json
openspec initiative list --json
```
- `id` 必填 kebab-case，对应 `initiatives/<id>/` 目录
- `--store <id>` 与 `--store-path <path>` 二选一（后者绕过注册检查）

### set change 命令（slice 技能不使用）

```bash
openspec set change <name> --initiative <id> --store <store> --store-path <path> --json
```
为已存在 change 补/改 initiative 链接。**限制**：仅 repo-local change 可 link initiative；workspace change 不可（CLI 报错 "workspace changes cannot be linked to initiatives"）。

### workspace setup 命令（★ slice 技能明确弃用）

```bash
openspec workspace setup --name <name> --link <path> [--link <path>...] --opener <id> --tools <tools> --json --no-interactive
```
**实跑验证**：`--no-interactive` 时要求 `--name` 且至少一个 `--link`（否则报 `missing_setup_inputs`）。**创建的工作空间存于机器本地 `~/.local/share/openspec/workspaces/<name>/`**（`root`/`planning_path` 都在该机器本地目录下），**不在任何 git repo 内，不可 git 同步、不可跨设备使用**。

**slice 技能明确弃用 `openspec workspace setup`**：它违反「数据存储首选工作空间、可跨设备使用」要求。cross-repo 集中工作空间用 `openspec init` 在集成 repo 内创建（见上文「init 命令」）。

### --initiative 三形态（slice 技能不使用）

CLI 接受三种形态（优先级）：`--initiative <store>/<id>` → `--initiative <id> --store <store>` → `--initiative <id>`（单独，从当前目录推断 store）。slice 技能创建 change 时一律**不带** `--initiative`。

### progress 是只读计算，CLI 不写 checkbox

CLI 读取 `tasks.md` 的 `- [ ]`/`- [x]` 计算 `progress.{total,complete,remaining}`，**从不主动写入 checkbox**；checkbox 由 apply 技能手写。`openspec-slices-register` 不追踪进度，不调用 `status`/`instructions` 汇报进度。

### initiative tasks.md 创建后不再自动更新

`openspec initiative create` 创建时写一次模板，**无代码**在 apply/archive 后回写 initiative `tasks.md`。slice 技能不再依赖 initiative `tasks.md` 作计划源/协调索引；批次级计划真相统一由 `openspec/slice-plans/<change_name>.yaml` 承载（由 register 手动持久化，CLI 不创建/读取/更新该路径）。

---

## 快速自检清单

slice 技能执行常见误用的速查表。每条给出 ✅ 正确做法与 ❌ 错误做法及简短理由。

### 命令创建 change

- ✅ `openspec new change "<name>" --goal "<g>"`（repo-local，**不带** `--initiative`）
- ❌ `openspec new change "<name>" --initiative <id>`（slice 技能不使用 initiative/context-store）
- 理由：initiative 走机器本地 context-store，不可 git 同步、不可跨设备；slice 技能统一走「单工作空间 repo-local」流。

### 查询 change 状态

- ✅ `openspec list --json`（**仅 active changes** 聚合，含 `completedTasks`/`totalTasks`/`lastModified`）
- ✅ `openspec status --change <name> --json`（单 **active** change 的 artifact 完成度与定位）
- ✅ archived 检测：扫 `<workspace>/openspec/changes/archive/` 目录（`list`/`status` 都查不到 archived change）
- ❌ `openspec show <name>`（实跑返回 `Unknown item`，不可靠）
- ❌ 用 `openspec status --change <archived-name>` 查 archived（实跑报 `not found`，见上文）
- 理由：`list` 只列 active；archived change 已移到 `changes/archive/<date>-<name>/`，CLI 不提供按名查询入口。

### cross-repo 建集中工作空间

- ✅ `openspec init --tools none --force <resolved_path>`（in-repo，可 git 同步、可跨设备）
- ❌ `openspec workspace setup --name <name>`（存于机器本地 `~/.local/share/openspec/`，不可 git 同步）
- 理由：slice 技能要求计划与 changes 随 git 同步、可跨设备使用；`workspace setup` 违反此要求。
- 路径规则：`path` 推荐相对路径（如 `../integration-hub`），基于 `path_base`（默认 `target-project-root`）解析为绝对路径后执行 init。

### change 命名规则

- ✅ kebab-case：`[a-z0-9-]`，不以 `-` 开头/结尾（如 `export-feature-01-foundation`）
- ❌ 大写或下划线：`My-Change`、`my_change`（CLI 报错 "Invalid change name"）
- ❌ 日期前缀名（如 `2026-07-30-foo`）作为 `--change` 入参（报 "must start with a letter"）
- 三段命名：`{change_name}-{sequence}-{name}`，三段整体须通过 kebab-case 校验

### 计划源与进度

- ✅ 计划源：`<workspace>/openspec/slice-plans/<change_name>.yaml`（register 持久化，track 读取）
- ✅ active 实时状态：以 `openspec list --json` 为准（进度字段）
- ✅ archived 检测：扫 `<workspace>/openspec/changes/archive/`（非 CLI 查询）
- ❌ 用 initiative `tasks.md` 作计划源/协调索引
- 理由：CLI 不回写 initiative `tasks.md`；批次级计划真相由 slice-plan.yaml 承载，CLI 不创建/读取/更新该路径。
- ❌ 期望 CLI 写 task checkbox
- 理由：`progress` 是只读计算（读 `tasks.md` 的 `- [ ]`/`- [x]`），checkbox 由 apply 技能手写。

---

## 常见陷阱

| 陷阱 | 表现 | 正确做法 |
|------|------|----------|
| 误用 `openspec workspace setup` 建集中工作空间 | 工作空间落在 `~/.local/share/openspec/`，不可 git 同步 | 改用 `openspec init <path>` 在集成 repo 内初始化 |
| 给 slice change 带 `--initiative` | 走 context-store/initiative 路径，偏离单工作空间流 | slice 技能创建 change 一律不带 `--initiative` |
| 用 `openspec show <change>` 查状态 | 返回 "Unknown item" | 改用 `openspec status --change <name> --json`（仅 active） |
| 用 `status`/`list` 查 archived change | `status` 报 `not found`；`list` 不列 archived | 扫 `<workspace>/openspec/changes/archive/` 目录 |
| 把 `openspec schema validate` 当命令 | 不存在 | 正确命令是 `openspec validate` |
| 创建 change 后等 CLI 生成 proposal.md | 只有 `.openspec.yaml` | proposal.md 由 register subagent 当轮写完 |
| 大写/下划线/日期前缀命名 change | CLI 报错 "Invalid change name" | 强制 kebab-case，字母开头 |

---

## 契约版本

- **CLI 版本**：v1.4.1
- **来源**：`@fission-ai/openspec`（pnpm 安装），`openspec --help` / 各子命令 `--help`、实跑测试
- **验证日期**：2026-07-30（archived 行为补验证；init/new/list/status active 行为 2026-07-28 + 2026-07-30 复验）
- **后续版本变更**：若 CLI 升级，需重新核对本契约文档

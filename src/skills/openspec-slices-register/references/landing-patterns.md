# Change 登记落地模式

本文档提供 single-repo / cross-repo（集中工作空间）的登记流程示例、subagent 调用模式、完整 `proposal.md` 写法、幂等与冲突处理原则。

> 下文示例名（如 `export-feature`、`oauth-migration`）均为中性示意名，用于说明落地形态，不代表特定项目类型或技术栈。

---

## Single-Repo 登记流程

**场景**：单仓库多切片，无需跨仓协调，不建集中工作空间，直接用当前 repo 的 `openspec/`。

**输入**（Slice Plan 片段）：
```yaml
mode: single-workspace
workspace: null
change_name: export-feature
sequencing_rule: archive-N-before-N+1
slices:
  - sequence: "01"
    name: foundation
    goal: CSV export golden path
    depends_on: []
    context: "用户导出功能的基础主路径。属于数据导出 Epic。"
    dependencies: []
    scope:
      in: [CSV 格式导出, 同步查询, 下载触发]
      out: [进度条（交 02）, 取消操作（交 02）]
  - sequence: "02"
    name: progress-feedback
    goal: Add progress bar and cancel
    depends_on: ["01"]
    context: "进度反馈增强。依赖 export-feature-01-foundation 已归档。"
    dependencies: ["export-feature-01-foundation（必须已归档）"]
    scope:
      in: [进度条, 取消操作]
      out: [错误处理（交 03）]
```

**执行步骤**：

1. **校验 Slice Plan**：检查 `user_confirmed: true`、必填字段完整；`workspace: null` → 用当前 repo 的 `openspec/`。
2. **为每个切片整理 proposal 蓝图**：从 `goal / context / dependencies / scope / handoff` 生成完整 proposal 提纲，不只准备 stub。
3. **逐切片启动 subagent**（在当前 repo 内）：
   - 优先让 subagent 调用 `openspec-new-change`（创建 repo-local change，**不带 `--initiative`**）
   - 若该技能不可用，则让 subagent 调用命令 `/opsx:new`
   - 创建或复用 change 后，subagent **立即**写完整 `proposal.md`
4. **校验 proposal 完整性**：确认 `proposal.md` 至少包含 `Goal / Context / Dependencies / Scope / Requirements / Assumptions / Non-Goals`，并在 Slice Plan.handoff 为对象时额外包含与之语义一致的 `Handoff`；不得有 `TODO` / `TBD`。
5. **输出结果**：
   ```
   已登记切片（single-repo，workspace: null）：
   - export-feature-01-foundation: CSV export golden path
   - export-feature-02-progress-feedback: Add progress bar and cancel (depends on 01)

   proposal.md 已在登记阶段完成
   下一步：对第一个 ready change 继续下一个 artifact
   ```

### 推荐 subagent 提示词（single-repo）

```text
为 slice export-feature-02-progress-feedback 执行 OpenSpec change 创建（在当前 repo 内，repo-local，不带 --initiative）。
优先调用技能 openspec-new-change；若不可用则调用命令 /opsx:new。
change 名称必须是 export-feature-02-progress-feedback（{change-name}-{change-num}-{slice-change-name} = export-feature + 02 + progress-feedback），goal 是 "Add progress bar and cancel"。
创建或确认 change 后，立即完成 openspec/changes/export-feature-02-progress-feedback/proposal.md，至少写完：Goal、Context、Dependencies、Scope、Requirements、Assumptions、Non-Goals。
Context / Dependencies / Scope / Handoff 必须严格来自以下 Slice Plan：
- context: 用户导出功能的进度反馈增强。属于"数据导出 Epic"，依赖 export-feature-01-foundation 已归档的 CSV 导出主路径。
- depends_on: export-feature-01-foundation
- dependencies: export-feature-01-foundation（必须已归档）
- scope.in: 导出进度条、取消操作
- scope.out: 错误处理（交 03）
- handoff:
  - handoff_to: export-feature-03-error-resilience
  - artifacts/contracts: 导出状态结构新增 `progressPercent`、`processedRows`、`cancelledAt`；取消操作后状态值必须保持 `cancelled`
  - ready_signal: export-feature-02-progress-feedback 已归档，且导出状态字段已在主路径可读取
  - consumer_expectations: export-feature-03-error-resilience 可基于 `cancelled | failed | complete` 判断是否允许重试；不得改写 02 已确定的状态字段语义
若 Slice Plan.handoff 为对象，必须在 `proposal.md` 写非空 `## Handoff`，并直接物化其四个字段；若为 `null`，不得为了"完整"臆造 `## Handoff`。
禁止保留 TODO、TBD、空章节、或只写 stub 后交给 propose。
完成后返回：change 是否创建成功、调用方式、proposal 是否完整、`Handoff` 是否与 Slice Plan.handoff 一致、是否发现冲突。
```

---

## Cross-Repo 集中工作空间登记流程

**场景**：跨多仓库/多团队，先建集中工作空间（集成 repo），所有切片在其内以 repo-local change 登记；数据随 git 同步、可跨设备使用。**不使用** context-store / initiative / `--initiative`。

**输入**（Slice Plan 片段）：
```yaml
mode: single-workspace
workspace:
  kind: integration-repo
  path: ../oauth-migration  # 相对于目标项目根目录
  path_base: target-project-root
  init_status: required
  note: 切片代码分别落地 auth-service / api-gateway / web-frontend
change_name: oauth-migration
sequencing_rule: archive-N-before-N+1
slices:
  - sequence: "01"
    name: auth-service-provider
    goal: Implement OAuth2.0 provider in auth-service
    depends_on: []
    context: "认证系统升级 Epic 的基座。在 auth-service 仓库实现 OAuth2.0 provider。"
    dependencies: []
    scope:
      in: [OAuth2.0 authorization server, token endpoint, 用户迁移]
      out: [api-gateway 集成（交 02）, frontend 登录（交 03）]
    handoff:
      handoff_to: api-gateway / web-frontend
      artifacts/contracts: ["/oauth/token 契约", "用户迁移映射规则"]
      ready_signal: ["01 已归档并在目标环境可访问"]
      consumer_expectations: ["02 只依赖已发布端点", "03 只依赖授权流程与回调契约"]
  - sequence: "02"
    name: gateway-client
    goal: Integrate OAuth2.0 client in api-gateway
    depends_on: ["01"]
    context: "中间层。在 api-gateway 集成 OAuth2.0 client，依赖 01 已归档。"
    dependencies: ["oauth-migration-01-auth-service-provider（必须已归档）"]
    scope:
      in: [OAuth2.0 client middleware, token 验证]
      out: [frontend 登录（交 03）]
    handoff:
      handoff_to: oauth-migration-03-frontend-login
      artifacts/contracts: ["/api/verify 契约", "登录回调与会话校验路径"]
      ready_signal: ["02 已归档，且网关 OAuth client 已连通 auth-service"]
      consumer_expectations: ["03 只通过公开登录/校验入口接入", "不得绕过网关直接调用 auth-service 私有流程"]
```

**执行步骤**：

1. **校验 Slice Plan**：`workspace` 为对象、`path` / `kind` / `init_status` / `note` 完整。
2. **创建集中工作空间**（仅 `init_status: required`）：
   - 解析相对路径：若 `path` 为相对路径（如 `../oauth-migration`），基于 `path_base`（默认 `target-project-root`）解析为绝对路径
   - 对解析后的绝对路径运行：
   ```bash
   openspec init --tools none --force <resolved_path>
   ```
   实跑验证：在该路径创建 `openspec/{config.yaml,changes/,changes/archive/,specs/}`，in-repo、可 git 同步。`--tools none` 避免在工作空间内安装 agent skills 副本。
   `already-initialized` 时跳过，仅校验 `<resolved_path>/openspec/config.yaml` 存在。
3. **逐切片启动 subagent**：在集中工作空间内创建/复用 repo-local change（**不带 `--initiative`**），并当场完成 `proposal.md`；proposal 的 `Scope`/`Dependencies` 注明代码实际落地哪个 repo（来自 `workspace.note`）。
4. **校验**：每个 change 的 `.openspec.yaml` 存在且 `initiative` 字段**应缺省**（因未带 `--initiative`）；proposal 完整、`Handoff` 与 Slice Plan.handoff 一致、scope/dependencies 含落地 repo 标注。
5. **输出结果**：
   ```
   已登记切片（cross-repo，workspace: <resolved_path>）：
   - oauth-migration-01-auth-service-provider (auth-service): Implement OAuth2.0 provider
   - oauth-migration-02-gateway-client (api-gateway): Integrate OAuth2.0 client (depends on 01)

   proposal.md 已在登记阶段完成
   下一步：按 ready 状态继续后续 artifact
   ```

> **禁止**：用 `openspec workspace setup` 建集中工作空间——它把数据写到机器本地 `~/.local/share/openspec/`（不可 git 同步、不可跨设备，CLI 契约已验证）。集中工作空间必须用 `openspec init` 在集成 repo 内创建。

---

## Slice Plan YAML 持久化

**目的**：把 `openspec-slices-plan` 产出的**确认 Slice Plan YAML 原文**作为批次级计划真相落盘，供 `openspec-slices-track` 读取。`openspec-slices-plan` 的 boundary 是"零写文件"，落盘由本技能在登记时承担。

**唯一路径（两模式统一）**：

```
<workspace>/openspec/slice-plans/<change_name>.yaml
```

- `<workspace>`：single-repo 时为当前 repo；cross-repo 时为集中工作空间 repo（`workspace.path`）。
- 不进 context store；CLI 不创建/读取/更新此路径——它是 register 侧手动文件。

**写入动作**（register workflow step 5）：

1. 确认 step 1 已校验 `user_confirmed: true`（未确认不得落盘）。
2. 取确认的 Slice Plan YAML 原文（plan 技能产出的 `Slice Plan (user_confirmed: true)` 块，schema 见 `openspec-slices-plan` SKILL.md「Slice Plan Schema」）。
3. 写入 `<workspace>/openspec/slice-plans/<change_name>.yaml`；`<change_name>` 取 Slice Plan 的 `change_name` 字段（父批次名，kebab-case）。
4. 幂等与冲突判定见下文「幂等与冲突处理 → slice-plan.yaml 冲突」。

**carrier 职责区分（非副本，防误合并）**：

| 文件 | 内容 | 消费者 |
|------|------|--------|
| `<workspace>/openspec/slice-plans/<change_name>.yaml` | 批次级全量计划（change_name / mode / workspace / sequencing_rule / 全量 scope / goal / context / handoff / depends_on） | `openspec-slices-track`（计划源） |
| `<workspace>/openspec/changes/<change>/proposal.md` | 单切片 Goal/Context/Scope/Handoff（CLI 管理产物） | apply / verify |

两者粒度与消费者不同，不是同一信息的副本——不要为"合并"而删任一。`slice-plan.yaml` 与 `proposal.md` 的 scope/handoff 字段看似重叠，但前者是批次视角、后者是单 change CLI 视角，归档/迁移时各自独立演进。

---

## proposal.md 完整写作契约

`openspec-slices-register` 不再只落 `Context / Dependencies / Scope` 骨架。登记完成的最低标准是：`proposal.md` 在当前轮次已可直接作为 proposal 初稿继续推进。

### 必须完成的章节

```markdown
## Goal
## Context
## Dependencies
## Scope
## Requirements
## Assumptions
## Non-Goals
```

若存在真实跨切片交接契约，还必须额外补：

```markdown
## Handoff
```

### 写作规则

- `Goal`：使用 Slice Plan 的目标，一行即可，但不得缺失。
- `Context`：说明该切片在整体业务线中的位置与前后依赖；cross-repo 时注明代码落地哪个 repo。
- `Dependencies`：同时写明 `Depends on / Blocks / External`。
- `Scope`：明确 `In` 与 `Out`，`Out` 里优先标注交接切片。
- `Requirements`：给出 2–5 条可执行约束或验收方向，避免空泛口号。
- `Assumptions`：写当前登记阶段默认成立的前提，例如上游切片已归档、同步路径足够、无需引入新协议等。
- `Non-Goals`：明确本切片不解决什么，避免后续扩张边界。
- `Handoff`：仅在存在真实跨切片契约时出现，写清 `handoff_to`、`artifacts/contracts`、`ready_signal`、`consumer_expectations`；不要为了"看起来完整"机械增加。
- 不得保留 `TODO`、`TBD`、模板占位或空章节。

### 何时必须写 Handoff

注意区分两种同名结构：
- `proposal.md` 里的 `## Handoff`：描述切片之间的可消费契约
- 技能最终回答里的 `## Handoff`：描述登记完成后交给哪个后续流程

本节讨论的都是前者。

在 register 阶段，不再让 subagent 自行判断是否"看起来需要"交接：
- `Slice Plan.handoff` 为对象 → 必须写 `proposal.md` 的 `## Handoff`
- `Slice Plan.handoff` 为 `null` → 不得写 `proposal.md` 的 `## Handoff`
- 若现场已有 proposal 与 `Slice Plan.handoff` 不一致 → 视为冲突，STOP

以下任一情况成立，就必须在 Slice Plan 先产出 `handoff` 对象，并在当前切片的 `proposal.md` 中增加 `## Handoff`，而不是只靠 `depends_on` 或 `scope.out`：

- 下游切片要依赖当前切片暴露的新接口、事件、状态字段、错误码或数据结构
- 下游切片必须遵守当前切片定义的迁移顺序、feature flag 切换点或 rollout 前提
- 当前切片完成后，还需要人工执行的同步步骤，且这些步骤属于下游切片可开工前置条件
- cross-repo 场景下，需要明确"哪个仓库/团队拿什么工件继续做"

以下情况**不需要**独立交接文档，也不强制写 `Handoff`：

- 只有"先归档 01 再开始 02"这类顺序依赖
- `scope.out` 只是说明"这个内容留给下一片"，但没有可消费契约
- 当前切片对下游没有新增显式接口或操作要求

### 推荐标记

在 `Context / Dependencies / Scope` 顶部保留：

```markdown
<!-- from slice plan, completed during registration -->
```

这个标记表示边界来自已确认计划，且已在登记阶段完成，不需要再交给 propose 补写。

---

## 完整 proposal.md 示例

**场景**：切片 `export-feature-02-progress-feedback`（single-repo）

```markdown
# export-feature-02-progress-feedback

## Goal
Add progress bar and cancel operation to CSV export.

## Context
<!-- from slice plan, completed during registration -->
用户导出功能的进度反馈增强。属于"数据导出 Epic"的第二个切片，依赖 export-feature-01-foundation 已归档的 CSV 导出主路径，为后续错误处理与重试能力提供进度状态基础。

## Dependencies
<!-- from slice plan, completed during registration -->
- **Depends on**: export-feature-01-foundation（CSV 导出主路径必须已归档并可用）
- **Blocks**: export-feature-03-error-resilience（错误提示与重试依赖本切片暴露的进度状态）
- **External**: 无

## Scope
<!-- from slice plan, completed during registration -->

### In（本次做）
- 导出进度条（百分比 + 行数）
- 取消操作（中断查询）
- 进度状态持久化（供后续错误重试读取）

### Out（本次不做）
- 错误提示/重试逻辑（交 export-feature-03-error-resilience）
- JSON 格式导出（未来 Epic）
- 异步导出/大数据集分页（未来 Epic）

## Requirements
- 导出开始后，界面必须在可感知的时间内显示进度状态。
- 取消操作必须停止本次导出，不得继续生成下载结果。
- 进度状态字段必须足够让后续切片判断导出是否完成、取消或失败。
- 本切片不得改变 01 已确定的 CSV 文件格式与下载入口。

## Assumptions
- export-feature-01-foundation 已提供可调用的导出主路径。
- 当前导出仍以同步流程为主，不引入异步任务编排。
- 本切片允许在现有导出状态结构上增加进度字段。

## Non-Goals
- 不新增错误提示、自动重试或恢复逻辑。
- 不处理 JSON 或其他新导出格式。
- 不解决超大数据集的后台异步导出问题。

## Handoff
- **handoff_to**: export-feature-03-error-resilience
- **artifacts/contracts**:
  - 导出状态结构新增 `progressPercent`、`processedRows`、`cancelledAt`
  - 取消操作后不再生成下载结果，状态值必须保持 `cancelled`
- **ready_signal**:
  - 02 已归档，且导出状态字段已在主路径可读取
- **consumer_expectations**:
  - 03 可基于 `cancelled | failed | complete` 判断是否允许重试
  - 03 不得改写 02 已确定的状态字段语义
```

---

## 幂等与冲突处理

### change 已存在

- `already exists` 视为成功。
- 若 `proposal.md` 仍是模板或本技能先前生成的登记稿，可直接同步到当前 Slice Plan。
- 若 `proposal.md` 已完整且与当前 Slice Plan 一致，保持不变。

### proposal 冲突

以下情况视为冲突，必须 STOP：

- `proposal.md` 已有明显人工改写，且范围或依赖与当前 Slice Plan 不一致
- `proposal.md` 把 `scope.out` 的内容提前纳入本切片
- `proposal.md` 删除或弱化了必须归档的前序依赖

遇冲突时输出：

```md
## Warnings
- proposal conflict: existing proposal.md for export-feature-02-progress-feedback diverges from confirmed Slice Plan; manual confirmation required before overwrite
```

### slice-plan.yaml 冲突

判定采用**语义级**比较，不逐字节比对（防止无害重排误报）。比较字段：`change_name` / `mode` / `workspace` / `sequencing_rule` / 切片集合（每切片的 `sequence` + `name` + `goal` + `depends_on` + `scope` + `handoff`）。

| 情况 | 处理 |
|------|------|
| 文件不存在 | 写入（首次登记） |
| 文件存在且语义与当前确认 Slice Plan 一致 | no-op（幂等成功） |
| 文件存在且语义分叉（任一比较字段不一致） | **STOP**，要求人工确认是否覆盖；不得静默覆写 |

遇冲突时输出：

```md
## Warnings
- slice-plan conflict: existing <workspace>/openspec/slice-plans/export-feature.yaml diverges from confirmed Slice Plan (sequencing_rule / slice set / scope mismatch); manual confirmation required before overwrite
```

> 注意：`slice-plan.yaml` 的冲突与 `proposal.md` 的冲突是独立判定，互不代偿——proposal 一致不代表 yaml 一致，反之亦然。任一冲突即对该载体 STOP。

---

## 关键注意事项

1. **父流程负责编排，不负责代写**：真正的 change 创建与 proposal 完成必须在 subagent 内完成。
2. **优先技能，次选命令**：优先 `openspec-new-change`，不可用时用 `/opsx:new`，两者都不可用则 STOP。
3. **proposal 完整度是完成条件**：只创建 change 或只落 stub 都算未完成登记。
4. **交接默认内嵌在 proposal**：除非用户或现有流程明确要求沿用独立交接文档，否则不要额外创建 handoff 文件；有真实契约时在 `proposal.md` 写 `Handoff`。
5. **不要再交 `openspec-propose` 补 proposal**：proposal 已在登记阶段完成，下一步应继续后续 artifact。
6. **不用 initiative / context-store**：数据须落工作空间 repo 内；cross-repo 用 `openspec init` 建集中工作空间，**禁用** `openspec workspace setup`（机器本地存储，不可 git 同步）。

---

## 固定回答模版示例 1：single-repo

```md
## Result
- skill: openspec-slices-register
- status: registered
- boundary_check: registration only; no re-splitting, tracking, or implementation

## Core Output
- workspace: null
- registered_changes:
  - change: export-feature-01-foundation
    goal: CSV export golden path
    depends_on: []
    creation_mode: subagent-openspec-new-change
    status: created
  - change: export-feature-02-progress-feedback
    goal: Add progress bar and cancel
    depends_on: [01]
    creation_mode: subagent-opsx-new
    status: created
- proposal_status:
  - change: export-feature-01-foundation
    state: complete
  - change: export-feature-02-progress-feedback
    state: complete
- slice_plan_persisted: openspec/slice-plans/export-feature.yaml
- sequencing_hint: Archive 01 before starting 02

## Handoff
- handoff_to: openspec-continue
- handoff_input: registered changes with completed proposal.md + persisted slice-plan.yaml
- handoff_reason: proposal is already complete; downstream artifacts can continue directly

## Next Step
- recommended_action: continue with the next artifact for export-feature-01-foundation first
- requires_user_confirmation: no

## Warnings
- None
```

## 固定回答模版示例 2：cross-repo（集中工作空间）

```md
## Result
- skill: openspec-slices-register
- status: registered
- boundary_check: registration only; no re-splitting, tracking, or implementation

## Core Output
- workspace: {path: <resolved_absolute_path>, init_status: created}
- registered_changes:
  - change: oauth-migration-01-auth-service-provider
    goal: Implement OAuth2.0 provider in auth-service
    depends_on: []
    creation_mode: subagent-openspec-new-change
    status: created
  - change: oauth-migration-02-gateway-client
    goal: Integrate OAuth2.0 client in api-gateway
    depends_on: [01]
    creation_mode: subagent-openspec-new-change
    status: created
- proposal_status:
  - change: oauth-migration-01-auth-service-provider
    state: complete
  - change: oauth-migration-02-gateway-client
    state: complete
- slice_plan_persisted: <resolved_workspace_path>/openspec/slice-plans/oauth-migration.yaml
- sequencing_hint: Archive 01 before starting 02

## Handoff
- handoff_to: openspec-continue
- handoff_input: registered changes with completed proposal.md + persisted slice-plan.yaml
- handoff_reason: proposal is already complete; downstream artifacts can continue directly

## Next Step
- recommended_action: continue with the next artifact for oauth-migration-01-auth-service-provider before opening 02 work
- requires_user_confirmation: no

## Warnings
- None
```

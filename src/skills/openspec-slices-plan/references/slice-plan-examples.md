# Slice Plan 示例

本文档提供 3 个完整 Slice Plan few-shot 示例，涵盖：单仓单切片、单一项目的垂直业务切片、跨仓/多项目的技术层或仓库边界切片。

> 以下示例名（如 `export-feature`、`oauth-migration`、`request-id-logging`）均为**中性示意名**，用于说明 Slice Plan 形态，不代表特定项目类型或技术栈。技能本身与项目类型无关。

---

## 示例 1：单仓单切片（无需拆分）

**需求**：为 API 日志添加请求 ID 追踪。

**判定**：单一责任单元 + 文件影响 ≤5（middleware / logger / types / test）+ 代码 ≤150 行 → **无需拆分**。

```yaml
Slice Plan (user_confirmed: true)
mode: single-workspace
workspace: null
change_name: request-id-logging
sequencing_rule: parallel  # 单切片，无序列依赖
slices:
  - sequence: "01"
    name: trace-middleware
    goal: Add request ID to API logs for traceability
    areas: []  # repo-local，留空
    depends_on: []
    context: |
      为现有 API 日志系统增加请求 ID 追踪能力。独立功能，无前序依赖，无后续切片。
    dependencies: []
    scope:
      in:
        - 中间件生成/传递 request ID
        - 日志格式含 request ID
        - 单元测试覆盖
      out:
        - 分布式追踪集成（未来 Epic）
        - 前端展示 request ID（未来 Epic）
    handoff: null
```

**登记后**：
- `openspec new change "request-id-logging-01-trace-middleware" --goal "Add request ID to API logs for traceability"`
- 单切片，propose 快速生成 artifacts

---

## 示例 2：单仓多切片顺序依赖（用户导出功能）

**需求**：用户可导出数据为 CSV，含进度条、错误提示、取消操作。

**判定**：3 个用户可感知价值点（基础导出 / 进度反馈 / 错误韧性）→ **垂直切片，顺序依赖**。

```yaml
Slice Plan (user_confirmed: true)
mode: single-workspace
workspace: null
change_name: export-feature
sequencing_rule: archive-N-before-N+1
slices:
  - sequence: "01"
    name: foundation
    goal: CSV export golden path - button to download, no progress/cancel/error
    areas: []
    depends_on: []
    context: |
      用户导出功能的基础主路径（golden path）。属于"数据导出 Epic"，是后续进度条与错误处理的基座。
    dependencies: []
    scope:
      in:
        - CSV 格式导出
        - 同步查询（≤1000 行）
        - 下载触发
      out:
        - 进度条（交 export-feature-02-progress-feedback）
        - 取消操作（交 02）
        - 错误提示/重试（交 export-feature-03-error-resilience）
        - JSON 格式（未来 Epic）
    handoff: null

  - sequence: "02"
    name: progress-feedback
    goal: Add progress bar and cancel operation to CSV export
    areas: []
    depends_on: ["01"]
    context: |
      用户导出功能的进度反馈增强。依赖 export-feature-01-foundation 已归档的 CSV 导出主路径，为后续 export-feature-03-error-resilience 提供进度状态基础。
    dependencies:
      - "export-feature-01-foundation（CSV 导出主路径必须已归档）"
    scope:
      in:
        - 导出进度条（百分比 + 行数）
        - 取消操作（中断查询）
        - 进度状态持久化
      out:
        - 错误提示/重试（交 export-feature-03-error-resilience）
        - JSON 格式（未来 Epic）
    handoff:
      handoff_to: export-feature-03-error-resilience
      artifacts/contracts:
        - 导出状态结构新增 `progressPercent`、`processedRows`、`cancelledAt`
        - 取消操作后不再生成下载结果，状态值必须保持 `cancelled`
      ready_signal:
        - export-feature-02-progress-feedback 已归档，且导出状态字段已在主路径可读取
      consumer_expectations:
        - export-feature-03-error-resilience 可基于 `cancelled | failed | complete` 判断是否允许重试
        - 下游不得改写 02 已确定的状态字段语义

  - sequence: "03"
    name: error-resilience
    goal: Add error handling and retry to CSV export
    areas: []
    depends_on: ["01", "02"]
    context: |
      用户导出功能的错误韧性增强。依赖 export-feature-01-foundation 的主路径与 export-feature-02-progress-feedback 的进度状态，为导出流程补全错误处理。
    dependencies:
      - "export-feature-01-foundation（主路径）"
      - "export-feature-02-progress-feedback（进度状态）"
    scope:
      in:
        - 错误提示（网络/查询失败）
        - 重试逻辑（读取 02 的进度状态恢复）
        - 单元测试覆盖错误路径
      out:
        - JSON 格式（未来 Epic）
        - 异步导出/大数据集分页（未来 Epic）
    handoff: null
```

**登记后**：
- `openspec new change "export-feature-01-foundation" --goal "CSV export golden path ..."`
- `openspec new change "export-feature-02-progress-feedback" --goal "Add progress bar ..."`
- `openspec new change "export-feature-03-error-resilience" --goal "Add error handling ..."`
- 每个 change 的 proposal.md Dependencies 章节含前序切片标注（由 register 物化 `depends_on`）

**提示用户**："Archive 01 before starting 02"（仅提示，不强制）

---

## 示例 3：跨仓集中工作空间（认证系统升级）

**需求**：从 JWT 迁移到 OAuth2.0，涉及 3 个仓库（auth-service / api-gateway / web-frontend）+ 2 个团队（后端 / 前端）。

**判定**：跨仓 + 多团队 + 天然分离的服务职责面 → **按技术层/仓库边界切片**，声明集中工作空间，所有切片在其内以 repo-local change 登记。

```yaml
Slice Plan (user_confirmed: true)
mode: single-workspace
workspace:
  kind: integration-repo
  path: ../oauth-migration   # 相对于目标项目根目录；register 会解析并 openspec init
  path_base: target-project-root
  init_status: required
  note: 切片代码分别落地 auth-service / api-gateway / web-frontend（物化进 proposal 的 scope/dependencies）
change_name: oauth-migration
sequencing_rule: archive-N-before-N+1
slices:
  - sequence: "01"
    name: auth-service-provider
    goal: Implement OAuth2.0 provider in auth-service
    areas: []  # repo-local in integration workspace
    depends_on: []
    context: |
      认证系统升级 Epic 的基座。在 auth-service 仓库实现 OAuth2.0 provider，为后续 api-gateway 集成与 web-frontend 登录流程提供认证端点。
    dependencies: []
    scope:
      in:
        - OAuth2.0 authorization server
        - token endpoint /oauth/token
        - 现有用户迁移脚本
        - 单元测试 + 集成测试
      out:
        - api-gateway 集成（交 oauth-migration-02-gateway-client）
        - web-frontend 登录流程（交 oauth-migration-03-frontend-login）
        - JWT 移除（交后续 Phase 2）
    handoff:
      handoff_to: api-gateway / web-frontend
      artifacts/contracts:
        - 提供 `/oauth/token` 与授权端点契约
        - 迁移后用户账号映射规则可用于下游联调
      ready_signal:
        - oauth-migration-01-auth-service-provider 已归档并在目标环境可访问
      consumer_expectations:
        - oauth-migration-02-gateway-client 只依赖已发布的 OAuth2.0 端点，不绕过到内部实现
        - oauth-migration-03-frontend-login 只依赖授权流程与回调契约，不假设旧 JWT 登录仍可用

  - sequence: "02"
    name: gateway-client
    goal: Integrate OAuth2.0 client in api-gateway
    areas: []
    depends_on: ["01"]
    context: |
      认证系统升级 Epic 的中间层。在 api-gateway 仓库集成 OAuth2.0 client，依赖 oauth-migration-01-auth-service-provider 已归档的认证端点，为 oauth-migration-03-frontend-login 提供 token 验证能力。
    dependencies:
      - "oauth-migration-01-auth-service-provider（OAuth2.0 provider 必须已归档可用）"
    scope:
      in:
        - OAuth2.0 client middleware
        - token 验证 /api/verify
        - 与 auth-service 的 /oauth/token 对接
        - 单元测试
      out:
        - web-frontend 登录 UI（交 oauth-migration-03-frontend-login）
        - JWT 移除（交后续 Phase 2）
    handoff:
      handoff_to: oauth-migration-03-frontend-login
      artifacts/contracts:
        - 提供 token 验证入口 `/api/verify` 与网关侧 OAuth client 行为契约
        - 明确前端可依赖的登录回调与会话校验路径
      ready_signal:
        - oauth-migration-02-gateway-client 已归档，且网关 OAuth client 已在目标环境连通 auth-service
      consumer_expectations:
        - oauth-migration-03-frontend-login 只通过公开登录/校验入口接入，不假设网关内部中间件实现
        - 下游不得绕过网关直接调用 auth-service 私有流程

  - sequence: "03"
    name: frontend-login
    goal: Update web-frontend login flow to use OAuth2.0
    areas: []
    depends_on: ["01", "02"]
    context: |
      认证系统升级 Epic 的用户入口。在 web-frontend 仓库更新登录流程使用 OAuth2.0，依赖 oauth-migration-01-auth-service-provider 的认证端点与 oauth-migration-02-gateway-client 的 token 验证。
    dependencies:
      - "oauth-migration-01-auth-service-provider（OAuth2.0 provider）"
      - "oauth-migration-02-gateway-client（token 验证）"
    scope:
      in:
        - 登录页 OAuth2.0 授权流程
        - token 存储（localStorage）
        - 登录态保持
        - E2E 测试
      out:
        - SSO 多平台登录（未来 Epic）
        - JWT 完全移除（交后续 Phase 2）
    handoff: null
```

**登记后**（由 `openspec-slices-register` 执行）：
1. register 解析相对路径 `../oauth-migration` 为绝对路径（基于目标项目根目录）
2. 对集成 repo 跑 `openspec init --tools none --force <resolved_path>`（`init_status: required` 时）
3. 在该工作空间 `openspec/` 下登记各切片（均 repo-local，不带 `--initiative`）：
   - `openspec new change "oauth-migration-01-auth-service-provider" --goal "..."`
   - `openspec new change "oauth-migration-02-gateway-client" --goal "..."`
   - `openspec new change "oauth-migration-03-frontend-login" --goal "..."`
4. 持久化 `openspec/slice-plans/oauth-migration.yaml`

每个 change 的 proposal.md 在 `Scope`/`Dependencies` 注明代码实际落地哪个 repo（来自 `workspace.note`）。

**提示用户**："Archive 01 before starting 02; archive 02 before starting 03"

---

## 固定回答模版示例 1：单仓单切片

```md
## Result
- skill: openspec-slices-plan
- status: pending-confirmation
- boundary_check: planning only; no registration, tracking, or implementation

## Core Output
- decision: do-not-split
- rationale: 单一责任单元，影响文件与代码规模都在单切片阈值内
- mode: single-workspace
- workspace: null
- sequencing_rule: parallel
- slices:
  - sequence: 01
    name: trace-middleware
    goal: Add request ID to API logs for traceability
    depends_on: []
    scope:
      in:
        - 中间件生成/传递 request ID
        - 日志格式含 request ID
        - 单元测试覆盖
      out:
        - 分布式追踪集成（未来 Epic）
        - 前端展示 request ID（未来 Epic）
    handoff: null
- confirmation_status: user_confirmed: false

```yaml
Slice Plan (user_confirmed: false)
mode: single-workspace
workspace: null
change_name: request-id-logging
sequencing_rule: parallel
slices:
  - sequence: "01"
    name: trace-middleware
    goal: Add request ID to API logs for traceability
    areas: []
    depends_on: []
    context: |
      为现有 API 日志系统增加请求 ID 追踪能力。独立功能，无前序依赖，无后续切片。
    dependencies: []
    scope:
      in:
        - 中间件生成/传递 request ID
        - 日志格式含 request ID
        - 单元测试覆盖
      out:
        - 分布式追踪集成（未来 Epic）
        - 前端展示 request ID（未来 Epic）
    handoff: null
```

## Handoff
- handoff_to: none
- handoff_input: confirmed Slice Plan
- handoff_reason: registration starts only after confirmation

## Next Step
- recommended_action: confirm or adjust the Slice Plan
- requires_user_confirmation: yes

## Warnings
- None
```

## 固定回答模版示例 2：跨仓顺序依赖

```md
## Result
- skill: openspec-slices-plan
- status: pending-confirmation
- boundary_check: planning only; no registration, tracking, or implementation

## Core Output
- decision: split
- rationale: 跨三仓与两团队协作，且职责天然按服务边界分离，适合按技术层/仓库边界切片并声明集中工作空间
- mode: single-workspace
- workspace: {kind: integration-repo, path: ../oauth-migration, path_base: target-project-root, init_status: required, note: 切片代码分别落地 auth-service/api-gateway/web-frontend}
- sequencing_rule: archive-N-before-N+1
- slices:
  - sequence: 01
    name: auth-service-provider
    goal: Implement OAuth2.0 provider in auth-service
    depends_on: []
    scope:
      in: [OAuth2.0 authorization server, token endpoint, 用户迁移]
      out: [api-gateway 集成（交 02）, web-frontend 登录流程（交 03）]
    handoff: {handoff_to: api-gateway / web-frontend, artifacts/contracts: [...], ready_signal: [...], consumer_expectations: [...]}
  - sequence: 02
    name: gateway-client
    goal: Integrate OAuth2.0 client in api-gateway
    depends_on: [01]
    scope:
      in: [OAuth2.0 client middleware, token 验证]
      out: [web-frontend 登录 UI（交 03）]
    handoff: {handoff_to: oauth-migration-03-frontend-login, artifacts/contracts: [...], ready_signal: [...], consumer_expectations: [...]}
- confirmation_status: user_confirmed: false

```yaml
Slice Plan (user_confirmed: false)
mode: single-workspace
workspace: {kind: integration-repo, path: ../oauth-migration, path_base: target-project-root, init_status: required, note: ...}
change_name: oauth-migration
...
```

## Handoff
- handoff_to: none
- handoff_input: confirmed Slice Plan
- handoff_reason: registration starts only after confirmation; register will openspec init the workspace and register all slices inside it

## Next Step
- recommended_action: 确认 workspace、序列与范围边界后再交 register
- requires_user_confirmation: yes

## Warnings
- None
```

---

## 快速验证场景

以下场景用于快速检查本技能是否会走新规则；目标不是产出完整 Slice Plan，而是先验证“切片维度选择”是否正确。示例名均为中性示意，不代表特定项目类型。

### 验证场景 1：单一项目应走垂直业务切片

**输入**：
- 一个单仓应用
- 需求：为某页面增加"导出 + 导出进度 + 导出失败重试"
- 影响：frontend、API handler、query builder 都在同一仓内

**期望判断**：
- decision: split
- mode: single-workspace
- workspace: null
- slice_strategy: vertical-business
- rationale: 虽跨 UI / API / query，但仍属于单一项目，应该按用户可感知价值端到端切，而不是先拆 frontend/backend/db
- example_slices:
  - export-feature-01-export-foundation
  - export-feature-02-export-progress
  - export-feature-03-export-retry

### 验证场景 2：多项目应走技术层或仓库边界切片（声明集中工作空间）

**输入**：
- 三个仓库：`web-frontend`、`api-gateway`、`billing-service`
- 需求：把结算登录从旧 token 改成新的 OAuth flow
- 前端、网关、认证服务分别由不同团队维护

**期望判断**：
- decision: split
- mode: single-workspace
- workspace: {kind: integration-repo, path: ..., init_status: required, note: 切片分别落地 billing-service/api-gateway/web-frontend}
- slice_strategy: repo-boundary
- rationale: 需求天然跨 repo 与团队职责面，应该按仓库/服务边界切片并在集中工作空间内登记，而不是把每个业务故事横跨三个仓库
- example_slices:
  - oauth-billing-01-billing-service-oauth-provider
  - oauth-billing-02-api-gateway-oauth-client
  - oauth-billing-03-web-frontend-login-flow

### 快速自检

- 如果单一项目场景被拆成 `frontend-ui` / `backend-api` / `db-query`，说明仍在误用技术层切片。
- 如果多项目场景被拆成同时修改多个仓库的 `login-story` / `session-story`，说明仍在误用单仓垂直切片。
- 只有当 `slice_strategy` 与项目形态一致、且 cross-repo 用 `workspace:` 而非 `initiative:` 时，才继续输出完整 Slice Plan。

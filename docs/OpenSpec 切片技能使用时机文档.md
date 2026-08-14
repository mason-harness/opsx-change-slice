# OpenSpec 切片技能使用时机文档

## 一、文档定位

本文档面向**本仓库开发者**，说明 `openspec-slices-{plan,register,track}` 三个 skill 在 OpenSpec change 工作流中的**使用时机**与**调用窗口串联**。

重点回答：

- 这三个 skill 各自在 openspec change 流程的哪个环节被调用
- 它们之间如何通过 Slice Plan YAML 单向交接
- 各自的进入条件、STOP 退回点、交接物去向

**与 `docs/OpenSpec Change 拆分策略文档.md` 的分工**：彼文档讲"Change 应如何拆"（拆分方法论、决策树、维度选择、依赖管理、误区），并在 L12 明确声明"不讨论具体工具、技能、登记流程或执行分工"。本文档正好补这条缝——专讲三 skill 何时调用、在流程哪个窗口、交接什么。两文档主题不同、不互引正文、各自维护。

**不复制 skill 正文**：本文档只做"调用窗口串联"的工程视角理解。具体触发条件（如拆分阈值、Use When 清单、STOP 原文措辞、Response Template 字段表、CLI Command Map）一律以"见 `src/skills/<skill>/SKILL.md` 或 `references/*.md`"引用带过，遵循 `repository/modules.md:15` 既定边界。下文每章给出关键引用行号作为正文真源锚点。

## 二、三个 skill 的调用窗口总览

把三个 slice skill 钉进 OpenSpec change 主流程（提案 → new change → apply → verify → archive）：

```
提案/需求澄清 ──> [plan] ──> new change ──> [register] ──> apply ──> verify ──> archive
                                              │            │          │           │
                                              └────────────┴──────────┴───────────┴──> [track] 可反复
```

| skill | 调用窗口 | 单向交接 |
|---|---|---|
| `openspec-slices-plan` | new change **之前**（提案/需求阶段） | 产出经用户确认的 Slice Plan，交 register |
| `openspec-slices-register` | plan 确认**之后**、apply **之前** | 消费 confirmed Slice Plan，持久化 Slice Plan YAML 交 track |
| `openspec-slices-track` | register **之后**、apply/verify/archive **之间或之后**，跨会话可反复 | 读 register 落盘的 YAML，交出"下一个推荐 slice"给 openspec-continue/apply/archive |

**核心关系**：

- 三者单向 `plan → register → track`，交接物是 **Slice Plan YAML**（register 写、track 读的唯一计划来源）。
- plan 与 register 的交接物是 **confirmed Slice Plan 文本**（plan 零写文件，只产出文本交 register）。
- register 与 track 的交接物是 **持久化的 Slice Plan YAML**（register 写到 `<workspace>/openspec/slice-plans/<change_name>.yaml`，track 以该文件为唯一计划真相源与实时状态对账）。
- track 不进入 apply/verify/archive 的执行链，只读状态给建议；apply/verify/archive 由 openspec 标准流程（`openspec-continue`/`openspec-apply`/`openspec-archive`）承担。

## 三、openspec-slices-plan 的使用时机

**时机定性**：`openspec new change` **之前**的强制前置；Change 拆分的唯一决策出口。

**调用窗口**：在"需求已澄清"之后、`openspec new change` 之前。本技能是唯一允许做拆分决策的技能，其他技能不得自行拆分。

**进入条件（语义，非触发条件细节原文）**：需求过大、需要选拆分策略、或横跨单仓/多仓边界时调用。

**输入**：从 `openspec-explore` 结晶结果或用户需求读取目标范围与现有行为；运行 `openspec list --json` 避免重复 change。范围不清或来源冲突时 STOP。

**输出**：经用户确认的 Slice Plan 文本（固定模版），含 `mode`/`workspace`/`change_name`/`sequencing_rule`/`slices[]`。**零写文件**——cross-repo 时只在 Slice Plan 中声明 `workspace`（路径与初始化状态），不负责实际创建（创建由 register 用 `openspec init` 承担）。

**交接**：用户确认后交 `openspec-slices-register`；未确认时保持在 plan 阶段，不进入登记。

**正文真源锚点**：`src/skills/openspec-slices-plan/SKILL.md`
- description 触发语（before registration）：L3
- 零写文件、cross-repo 只声明 workspace：L16、L76
- new change 前强制前置、无例外：L34
- 唯一拆分决策出口：L36
- 输入来源 + `openspec list --json`：L61
- Slice Plan Schema：L81-124
- Response Template：L130-177
- 交接 register（handoff）：L165-168
- 接收 explore/交给 register：L182-187

## 四、openspec-slices-register 的使用时机

**时机定性**：持已确认 Slice Plan（`user_confirmed: true`）后触发；把 Slice Plan 落地为多个 changes，每 slice 当轮写完整 `proposal.md`，并持久化 Slice Plan YAML 供 track 读取。

**调用窗口**：plan 确认**之后**、apply **之前**。

**进入门禁（语义）**：

- 只处理已确认 Slice Plan（`user_confirmed: true`）；缺字段或未确认 STOP。
- 遇带 `initiative:` 字段的遗留 Slice Plan → STOP，要求退回 `openspec-slices-plan` 重新产出 `workspace:` 形态（register 不重做 plan 决策）。

**输入**：confirmed Slice Plan 的 `mode`/`workspace`（含 `path`/`path_base`/`init_status`/`note`）/`change_name`/`slices[]`（`goal`/`context`/`dependencies`/`scope`/`handoff`/`depends_on`）。

**输出**：

- 在工作空间内为每个 slice 创建 repo-local change（**不带 `--initiative`**），由 subagent 在当轮写完整 `proposal.md`（`Goal/Context/Dependencies/Scope/Requirements/Assumptions/Non-Goals`，必要时含 `Handoff`）。
- cross-repo 且 `init_status: required` 时，对解析后的绝对路径跑 `openspec init --tools none --force <path>` 建集中工作空间；`already-initialized` 则仅校验 `openspec/config.yaml` 存在。
- 持久化 **Slice Plan YAML 原文**到 `<workspace>/openspec/slice-plans/<change_name>.yaml`（register workflow step 5，唯一路径）。

**交接**：接收自 plan 的 confirmed Slice Plan；产出的 YAML 是 **track 唯一计划源**；登记完成后交 `openspec-continue` 或后续 apply/verify/archive。

**正文真源锚点**：`src/skills/openspec-slices-register/SKILL.md`
- Use When 段（含 `user_confirmed: true` 前置）：L14-21
- 门禁必须 `user_confirmed: true`：L25、L40
- 遗留 `initiative:` STOP 退回 plan：L26、L62
- 每 slice subagent 当轮写完整 proposal：L27-29
- 输入字段：L40-48
- cross-repo `openspec init --tools none --force`：L45
- 持久化 YAML 路径：L49
- 交接 openspec-continue/apply/verify/archive：L51、L125-128
- `references/cli-contract.md`：init 命令（L31）、archived 检测策略（L92、L162-166）
- `references/landing-patterns.md`：Slice Plan YAML 持久化段（L157-168）

## 五、openspec-slices-track 的使用时机

**时机定性**：多切片 Slice Plan 已存在、需要跨会话进度看板时调用；只读不写。

**调用窗口**：register **之后**、任意 apply/verify/archive **之间或之后**，跨会话可反复调用。

**前置（Read Before Track）**：先读计划源，再取 active changes，再扫 archive 目录补齐 archived；缺任一必需输入 STOP。

**STOP 退回点（即不该用本 skill / 缺源时）**：

- memory 无 Slice Plan 且用户未提供，且 `openspec/slice-plans/` 无 yaml → STOP，提示先运行 `openspec-slices-register`。
- `openspec/slice-plans/` 存在 ≥2 个候选 yaml 且 CLI active change 无法唯一解析到单族 → STOP，要求用户指定当前批次。
- active 列表与 archive 目录任一获取失败且无法确认状态 → STOP。

**输入**：

- **计划源（唯一真相源）**：`<workspace>/openspec/slice-plans/<change_name>.yaml`（register 持久化的全量确认 Slice Plan）；无 yaml 时回退 auto-memory 或用户提供的 plan。
- **实时状态两来源合并**：active 取 `openspec list --json`；archived 取文件系统扫描 `<workspace>/openspec/changes/archive/`（CLI 不列不查 archived）。

**输出**：固定 Response Template——`plan_source`/`live_status_source`/ASCII progress board/`summary`（archived/in_progress/ready/blocked 计数）/`recommendation`（下一个推荐 slice）/`blocked_items`/`consistency_check`。分类规则为 archived/in-progress/ready/blocked，依赖满足只认 `archived`。

**边界**：不执行登记、不做拆分决策、不执行 apply/verify/archive；不修改 Slice Plan（只读）、不自动启动下一个切片（只建议，由用户决策）。

**交接**：接收 register 持久化的 YAML；缺计划源时 STOP 指向先跑 register；交给 `openspec-continue`/`openspec-apply`/`openspec-archive`，`handoff_input` 为"recommended next slice"。

**正文真源锚点**：`src/skills/openspec-slices-track/SKILL.md`
- description 触发语（multi-slice plan already exists）：L3
- Read Before Track：L29
- 无 plan STOP 指向 register：L44、L158
- ≥2 yaml STOP：L45
- 状态获取失败 STOP：L46
- 计划源与回退：L59-63、L99-101
- 实时状态双源（active + archive 扫描）：L64-67、L86-97
- Response Template：L103-141
- 边界（不登记/不拆分/不 apply-verify-archive）：L52-55
- 交接 openspec-continue/apply/archive：L131、L149-152
- `references/progress-tracking.md`：依赖满足只认 archived（L69-75）、状态映射规则（L16-67）
- `references/memory-schema.md`：无 openspec 目录时的回退源（L59-64）

> 注：track 的 archived 检测策略与 CLI 行为细节，引用的是 `openspec-slices-register/references/cli-contract.md`（`list`/`status`/`archive` 段与「archived 检测策略」），见该文件 L92、L162-166。

## 六、不该用的时机（反向边界汇总）

本节只做三 skill 各自"不做"的工程视角汇总；**具体禁止项清单仍以各 SKILL.md 的 `Boundaries` / `MUST NOT` 段为准**（引用，不复制）。

- **plan**：未获用户确认时不得将 Slice Plan 交给 register；不跳过拆分评估直接 new change；不执行 `openspec init`/`new change`/`workspace setup`；不写 proposal/specs/design/tasks 正文与业务代码。
- **register**：未确认不进入登记；不重做 plan 决策；遇遗留 `initiative:` 退回 plan；不直接裸跑多次 `openspec new change` 循环、不给 slice change 带 `--initiative`、不用 `openspec workspace setup` 建集中工作空间、不做进度跟踪。
- **track**：无计划源 STOP 指向 register；不重新切分、不重新注册 change、不执行 apply/verify/archive；不修改 Slice Plan、不自动启动下一个切片（只建议）。

**三个 skill 共同封堵的旧机制**：均不使用 context-store / initiative / `--initiative`——数据须落在工作空间 repo 内（可 git 同步、可跨设备）；cross-repo 集中工作空间统一用 `openspec init` 创建，弃用机器本地的 `openspec workspace setup`。

## 七、与拆分策略文档的分工（重申）

- `docs/OpenSpec Change 拆分策略文档.md`（L3-12）讲"Change 如何拆"：拆分原则、决策树、维度选择、依赖管理、常见误区、合理判定。L12 明确声明"不讨论具体工具、技能、登记流程或执行分工"。
- 本文档讲"三 skill 何时用"：调用窗口、进入门禁、STOP 退回点、交接物去向、反向边界。
- 两文档不互引正文：策略文档讲方法论（该不该拆、按什么维度拆），时机文档讲执行窗口（三 skill 在流程哪里调用、何时 STOP、交接什么）。

需要理解"一个需求要不要拆、按什么维度拆"时读拆分策略文档；需要理解"plan/register/track 在 openspec 流程哪个环节调用、交接什么"时读本文档。

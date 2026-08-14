---
name: openspec-slices-plan
description: Use when a request is too large for one Change, needs slice strategy selection, or spans single-repo vs cross-repo boundaries - produces the approved Slice Plan by choosing vertical business slices for single-project work and technical or repo-boundary slices for multi-project or multi-team delivery; for cross-repo it declares a centralized workspace (created later by register) so all data stays in the git-syncable workspace and is usable across devices, before registration
---

# OpenSpec Change 拆分决策

## Overview

**唯一的 Change 拆分决策技能。** 先判一个需求是否需要拆分，再按项目形态选切片维度：单一项目优先垂直业务切片，多项目/多仓分离交付可按技术层或仓库边界切。产出经用户确认的 **Slice Plan**，再交 `openspec-slices-register` 登记。

**数据存储原则**：所有计划与登记产物（`slice-plan.yaml` 与 changes）永远落在执行项目工作空间内（single-repo 用当前 repo 的 `openspec/`；cross-repo 用先创建的集中工作空间 repo），使其可随 git 同步、跨设备使用。**不使用** context-store / initiative / `--initiative`——那是机器本地或跨仓外部协调机制，不满足工作空间内存储要求。

**核心原则**：以“可独立推进、依赖清晰、owner 明确”为标准。先判项目形态，再定切法；拿不准时先合后拆。

**边界**：只产 Slice Plan 文本，零写文件——cross-repo 时只在 Slice Plan 中**声明** `workspace`（路径与初始化状态），不负责实际创建。完整"不做"清单见下方 `Boundaries`。

## Quick Reference

决策锚点（执行细节见下方 Workflow）：

| 锚点 | 判定 |
|------|------|
| **该不该拆** | 单一责任单元 + 文件 ≤5 + 代码 ≤150 行 → 单切片；否则拆分 |
| **项目形态** | 单一项目/单仓 → 垂直业务切片；多项目/多仓分离 → 技术层或仓库边界切 |
| **mode/workspace** | 单一项目 → `workspace: null`；跨仓/多团队 → `workspace:{kind:integration-repo,path,init_status,note}` |
| **请求确认** | 输出固定模版；未确认不得交给 register |

## Critical Rules

**Read Before Decide**：读取 explore 结晶结果或用户需求、`openspec list --json`（避免重复 change）、相关现有行为。范围不清或来源冲突时 **STOP**。

**MUST（本技能是唯一拆分决策者）**:
- 任何 `openspec new change` 之前必须经本技能拆分评估并产出经用户确认的 Slice Plan，无例外
- 不得以“需求不大”“已知道怎么拆”“用户催促开始”跳过拆分评估
- 本技能是 Change 拆分的唯一决策出口；其他技能不得自行拆分
- 最终回答必须使用本技能固定模版，不得改成自由摘要或执行日志

**MUST NOT（封堵回退旧机制）**:
- **不得**在 Slice Plan 中产出 `initiative:` 块或要求使用 `context-store` / `--initiative`——数据必须落在工作空间 repo 内（可 git 同步）
- **不得**用 `openspec workspace setup` 建集中工作空间——机器本地存储，不可 git 同步（CLI 契约已验证）；cross-repo 集中工作空间由 register 用 `openspec init` 创建

**STOP**:
- 未持有用户确认的 Slice Plan 时不得进入 Change 登记环节
- 跨仓场景遇 workspace change（非 repo-local）需求 → STOP，要求改 repo-local 或退回用户决策

**Hardness**：本技能处于 L1-L2（Explore/Proposal 区间）——拆分决策是结构化建议，但触发条件与确认门禁是硬约束。

## Boundaries

**不做**（单一完整清单）:
- 不执行 `openspec init` / `openspec new change` / `openspec workspace setup`（集中工作空间由 `openspec-slices-register` 用 `openspec init` 创建）
- 不写 proposal.md / specs / design / tasks 完整内容
- 不写业务代码
- 不勾选或跟踪 task 进度
- 不修改 config.yaml / managed skills
- 未获用户确认时不得将 Slice Plan 交给 register

## Workflow

1. **接收上下文** — 从 `openspec-explore` 结晶结果或用户需求读取目标范围与现有行为；运行 `openspec list --json` 避免重复；范围不清或来源冲突时 STOP。
2. **判断是否需要拆分** — 单一责任单元 + 文件影响 ≤5 + 代码 ≤150 行 → 单切片；否则进入拆分。详见 `references/split-strategy.md`。
3. **判断项目形态并选维度** — 单一项目/单仓优先按用户可感知价值做垂直业务切片；若需求天然跨多个项目、仓库或职责面（如前端 / 后端 / 数据库分离交付），可按技术层或仓库边界切，但每片必须有清晰 owner 与依赖。
4. **生成切片与序号** — 每切片使用 `{change-name}-{change-num}-{slice-change-name}` 命名：`change-name` 为本批次的父批次名（同批次所有切片共享），`change-num` 为两位序号 `01`/`02`/...（按依赖顺序递增），`slice-change-name` 为切片描述名；三段均为 kebab-case。定义 `goal`、`areas`、`depends_on`。
5. **依赖序列** — 选择 `sequencing_rule`：`archive-N-before-N+1` / `parallel` / `merge-first-split-later`。
6. **定 mode 与 workspace** — 单一项目/单仓 → `mode: single-workspace`，`workspace: null`（用当前 repo 的 `openspec/`）。跨仓/多团队协作 → `mode: single-workspace`，`workspace:` 为对象：
   - `kind`: 恒为 `integration-repo`
   - `path`: 集成 repo 根路径（**推荐相对路径**，相对于目标项目根目录，如 `../oauth-integration-hub`、`./workspaces/integration`；也支持绝对路径如 `~/projects/integration-hub`）。相对路径保证计划随项目迁移/克隆时无需改路径，数据可移植
   - `path_base`: `target-project-root`（默认值，可省略）
   - `init_status`: 判定规则:
     - **优先询问用户**: "集成工作空间 `<path>` 是否已初始化（存在 openspec/config.yaml）?"
     - 用户回答 "是" → `already-initialized`
     - 用户回答 "否" 或 "需要创建" → `required`
     - 用户不确定 → 技能可探测: 解析 path 为绝对路径后，检查 `<resolved_path>/openspec/config.yaml` 是否存在；存在 → `already-initialized`；不存在 → `required`
   - `note`: 切片代码实际落地哪些 repo（cross-repo 时必填，由 register 物化进 proposal 的 scope/dependencies）
   **本技能只声明 workspace，不创建它**。
7. **起草骨架** — 为每切片起草 `context`、`dependencies`、`scope`，并判断 `handoff`（是否需下游显式消费契约，规则见 `Slice Plan Schema` 的 handoff 字段规则）；cross-repo 时在 `workspace.note` 标注每片代码落地哪个 repo；只定义边界，不落盘任何文件、不跑 `openspec init`。
8. **使用固定模版输出 Slice Plan** — 按 `Response Template` 原样输出，保留 `Slice Plan` 作为唯一交接契约。
9. **请求确认并交接** — 用户确认后，交 `openspec-slices-register`；未确认时保持在 plan 阶段。register 将据此创建 workspace（若 cross-repo）、登记切片、持久化 `openspec/slice-plans/<change_name>.yaml`。

## Slice Plan Schema

本 schema 是 slice → register 的唯一交接契约。register 只可据此登记，不得重新决策；字段缺失即 STOP 退回本技能。

**mode 与 workspace 规则**：
- `mode` 恒为 `single-workspace`（single-repo 与 cross-repo 都走单工作空间形态）
- `workspace: null` → single-repo，用当前 repo 的 `openspec/`
- `workspace:` 为对象 → cross-repo，所有切片在 `workspace.path` 这个集成 repo 内以 repo-local change 登记；register 会 `openspec init` 该路径（当 `init_status: required`）
- **不得**产出 `initiative:` 块或使用 context-store / `--initiative`

**handoff 字段规则**：
- 仅有顺序依赖、scope 边界、归档前置条件时，填 `null`
- 需要下游显式消费接口、状态字段、事件、迁移顺序、feature flag 切换点、人工步骤时，填结构化对象
- `handoff` 的内容由 `openspec-slices-register` 物化为 `proposal.md` 中的 `## Handoff`

```yaml
Slice Plan (user_confirmed: true)
mode: single-workspace          # 唯一取值；single-repo 与 cross-repo 都用此值
workspace: null | {             # null=single-repo（用当前 openspec/）；对象=cross-repo（集成 repo）
  kind: integration-repo
  path: <path>                  # 集成 repo 根路径；推荐相对路径（相对于目标项目根目录，如 ../integration-hub）
                                # — 相对路径保证计划随项目一起迁移/克隆时无需改路径，数据可移植
  path_base: target-project-root  # 路径基准（默认值，可省略）；相对路径以目标项目根目录为解析基准
  init_status: required | already-initialized
  note: <切片代码实际落地哪些 repo，写入 proposal 的 scope/dependencies>
}
change_name: <kebab>  # 父批次名，同批次所有切片共享，用于合成 change 名
sequencing_rule: archive-N-before-N+1 | parallel | merge-first-split-later
slices:
  - sequence: "01"           # 两位序号，按依赖顺序递增
    name: <kebab>             # 切片描述名
    goal: <one line>
    areas: []                 # repo-local，留空
    depends_on: []            # 列前序 sequence（如 ["01"]）
    context: <1-2 行故事线定位>
    dependencies: [<前序 change 名 / 外部依赖>]
    scope: { in: [...], out: [...] }
    handoff: null | {
      handoff_to: <downstream slice or repo/team>
      artifacts/contracts: [<interface, state field, event, migration note, manual step>]
      ready_signal: [<what must be true before downstream starts>]
      consumer_expectations: [<what downstream may rely on and must not change>]
    }
```

**change 名合成规则**：`{change_name}-{sequence}-{name}`（如 `change_name=export-feature` + `sequence=01` + `name=foundation` → `export-feature-01-foundation`）。`change_name` 在批次内唯一，`sequence` 与 `name` 共同区分各切片；合成名必须整体通过 kebab-case 校验。

完整 few-shot 示例见 `references/slice-plan-examples.md`（示例名为中性示意，不代表特定项目类型）。

## Response Template

最终回答必须使用以下固定结构与顺序；无警告时也必须保留 `## Warnings` 并写 `- None`。

```md
## Result
- skill: openspec-slices-plan
- status: pending-confirmation | confirmed | stop
- boundary_check: planning only; no registration, tracking, or implementation

## Core Output
- decision: split | do-not-split | merge-first-split-later
- rationale: <why>
- mode: single-workspace
- workspace: null | {kind, path, init_status, note}
- sequencing_rule: <rule>
- slices:
  - sequence: 01
    name: <kebab>
    goal: <one line>
    depends_on: []
    scope:
      in: [...]
      out: [...]
    handoff: null | {handoff_to, artifacts/contracts, ready_signal, consumer_expectations}
- confirmation_status: user_confirmed: false | true

```yaml
Slice Plan (user_confirmed: true|false)
mode: single-workspace
workspace: null | {kind, path, init_status, note}
change_name: <kebab>
...
```

## Handoff
- handoff_to: openspec-slices-register | none
- handoff_input: confirmed Slice Plan
- handoff_reason: registration starts only after confirmation; for cross-repo, register creates the centralized workspace declared here and registers all slices inside it

## Next Step
- recommended_action: confirm or adjust the Slice Plan
- requires_user_confirmation: yes
- tracking_plan_source: openspec/slice-plans/<change_name>.yaml (both modes, persisted by register)

## Warnings
- <missing scope, unclear boundary, workspace limitation, or None>
```

## Handoffs

- **接收自**:
  - `openspec-explore`
  - 用户直接请求拆分
  - `harness-openspec-setup`
- **交给**:
  - `openspec-slices-register`
  - 登记完成后继续 `openspec-continue` 或后续 apply / verify / archive 流程

## Failure Handling

| Failure | Action |
|---------|--------|
| 需求范围不清 | STOP；要求用户或 explore 澄清后再决策 |
| 来源冲突（需求 vs 现有 spec） | STOP 并报告冲突 |
| 单一项目却误按技术层过早横切 | 改为垂直业务切片；引用 references Wrong/Right 示例 |
| 多项目/多仓协作却硬套垂直业务切片 | 改按技术层或仓库边界切，并补清 owner / depends_on / workspace.note |
| 只写了 scope.out，却遗漏下游必须消费的契约 | 补 `handoff` 字段；不要把接口/状态/迁移前提藏在自然语言里 |
| 拿不准是否拆 | 选 `merge-first-split-later`，先合成单 Change |
| 跨仓但遇 workspace change 需求 | STOP；workspace change 不属 repo-local 单工作空间流，改 repo-local 或退回用户决策 |
| 切片过多（过度拆分） | 合并；坚持“可独立交付”标准 |
| 单 Change tasks 超 50 项（拆分不足） | 检查可否独立为子 Change |

## References

- **references/split-strategy.md**：拆分决策树、按项目形态选择切片维度的 Wrong/Right 示例、切片命名规则、merge-first-split-later、Proposal storyline 策略、跨仓集中工作空间机制与 workspace-change 限制
- **references/slice-plan-examples.md**：完整 Slice Plan few-shot 与固定回答模版示例（示例名为中性示意，不代表特定项目类型）

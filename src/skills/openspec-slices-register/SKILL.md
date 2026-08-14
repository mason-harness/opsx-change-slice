---
name: openspec-slices-register
description: Use when a confirmed Slice Plan needs OpenSpec change registration, especially for multi-slice or cross-repo work where a centralized workspace must be created first - registers each slice via subagents using openspec-new-change or /opsx:new inside the workspace (repo-local, no initiative), completes proposal.md during registration, persists the Slice Plan YAML for downstream tracking, and avoids re-splitting, direct new-change loops, --initiative, or progress tracking
---

# OpenSpec Change 登记执行

## Overview

将**已确认**的 Slice Plan 落地为一个或多个 OpenSpec changes。父流程负责校验、工作空间准备（cross-repo 时 `openspec init`）、结果汇总；**每个 slice 必须由 subagent 创建 change 并在当次写完整 `proposal.md`**。

**数据存储原则**：所有产物（`slice-plan.yaml` 与 changes）永远落在执行项目工作空间内——single-repo 用当前 repo 的 `openspec/`，cross-repo 用先 `openspec init` 创建的集中工作空间 repo——使其随 git 同步、跨设备可用。**不使用** context-store / initiative / `--initiative`。

## Use When

- 已有 `openspec-slices-plan` 产出的 Slice Plan，且 `user_confirmed: true`
- 需要把多切片登记成 changes
- 需要处理 single-repo（`workspace: null`）或 cross-repo（`workspace:` 为对象，需先建集中工作空间）
- 需要避免直接裸跑 `openspec new change` 多次循环
- 需要在登记阶段完成 `proposal.md`，而不是只落 stub

## Core Rules

**登记纪律（register 独有的门禁，执行步骤见 Workflow）**:
- 只处理**已确认** Slice Plan（`user_confirmed: true`）；缺字段或未确认就 STOP
- **遇带 `initiative:` 字段的遗留 Slice Plan → STOP，要求退回 `openspec-slices-plan` 重新产出 `workspace:` 形态**——register 不重做 plan 决策
- 每个 slice 必须由 subagent 创建 change 并在**当轮**写完整 `proposal.md`——不允许只创建 change、只落 stub、或把 proposal 留给后续补写
- `proposal.md` 至少完成 `Goal / Context / Dependencies / Scope / Requirements / Assumptions / Non-Goals`；`Handoff` 章节仅当 Slice Plan 的 `handoff` 为对象时才写并物化其四字段（契约见 `references/landing-patterns.md`）
- cross-repo 时把 `workspace.note` 物化进 proposal 的 `Scope`/`Dependencies`
- 最终回答只输出登记结果，不重做拆分、不汇报进度

**MUST NOT（封堵回退旧机制，CLI 契约见 `references/cli-contract.md`）**:
- **不得**使用 `context-store setup` / `initiative create` / `set change --initiative`——数据须落工作空间 repo 内（可 git 同步）
- **不得**给 slice change 带 `--initiative`（一律 repo-local）
- **不得**用 `openspec workspace setup` 建集中工作空间——机器本地 `~/.local/share/openspec/`，不可 git 同步（CLI 契约已验证）；改用 `openspec init`
- **不得**同步/维护 initiative `tasks.md`——批次计划真相统一由 `openspec/slice-plans/<change_name>.yaml` 承载

## Workflow

1. 校验 Slice Plan 与必填字段，**且必须 `user_confirmed: true`**（未确认不得进入登记或持久化，防绕过 `openspec-slices-plan` 的确认门禁）。遇 `initiative:` 字段 → STOP 退回 plan。
2. 判断 `workspace`：
   - `workspace: null` → single-repo，用当前 repo 的 `openspec/`
   - `workspace:` 为对象 → cross-repo：
     - **解析路径**：若 `path` 为相对路径（如 `../integration-hub`），基于 `path_base`（默认 `target-project-root`，即当前目标项目根目录）解析为绝对路径
     - 若 `init_status: required`，对解析后的绝对路径跑 `openspec init --tools none --force <resolved_path>` 建集中工作空间
     - `already-initialized` 则仅校验 `<resolved_path>/openspec/config.yaml` 存在
3. 为每个 slice 整理 `goal / context / dependencies / scope / handoff`（cross-repo 附 `workspace.note` 指明代码落地 repo）。
4. 启动 subagent 在工作空间内创建或复用 change，并在同轮完成 `proposal.md`；严格按 Slice Plan 的 `handoff` 字段决定是否写 `Handoff` 章节。`new change` **不带 `--initiative`**。
5. 持久化 Slice Plan YAML：把**确认的全量 Slice Plan YAML 原文**写入 `<workspace>/openspec/slice-plans/<change_name>.yaml`（`<workspace>` 为当前 repo 或集中工作空间 repo；CLI 不管理此子目录；仅当 step 1 已确认 `user_confirmed: true`）。幂等与冲突规则见 `references/landing-patterns.md`「Slice Plan YAML 持久化」。
6. 校验 proposal 完整度、`Handoff` 与 Slice Plan.handoff 的一致性、slice-plan.yaml 已持久化且与 Slice Plan 一致、cross-repo 时各 proposal 的 scope/dependencies 已含落地 repo 标注，以及整体边界是否仍与 Slice Plan 对齐。
7. 输出固定结果；下一步交 `openspec-continue` 或后续 apply / verify / archive。

## Quick Reference

| Case | Action |
|---|---|
| single-repo（`workspace: null`） | 直接在当前 repo 的 `openspec/` 下 subagent 创建 change → 完成 proposal |
| cross-repo（`workspace:` 对象, `init_status: required`） | 先 `openspec init --tools none --force <path>` 建集中工作空间 → 再在其内逐 slice 创建 repo-local change（不带 `--initiative`） |
| cross-repo（`init_status: already-initialized`） | 校验 `openspec/config.yaml` 存在 → 直接逐 slice 创建 |
| already exists | 视为成功；检查 proposal 是否已完整 |
| proposal 冲突 | STOP，要求人工确认是否覆盖 |
| 遗留 `initiative:` Slice Plan | STOP，退回 `openspec-slices-plan` 重新产出 `workspace:` 形态 |
| command unavailable | `openspec-new-change` → `/opsx:new` → 都不可用则 STOP |

## Subagent Contract

subagent 输入至少包含：
- `sequence` / `name` / `goal`
- `context` / `dependencies` / `scope.in` / `scope.out`
- `handoff`：直接读取 Slice Plan 中的 `handoff` 字段；`null` 表示不写 `proposal.md` 的 `Handoff`，对象表示必须物化为 `proposal.md` 的 `Handoff`
- `workspace`（cross-repo 适用）：`path`（已解析为绝对路径）、`note`（代码落地 repo，物化进 proposal 的 scope/dependencies）
- 工作目录指针：subagent 必须在 `<workspace>`（当前 repo 或集中工作空间 repo）内运行 CLI

subagent 输出必须保证：
- change 已创建或确认存在（repo-local，不带 `--initiative`）
- `proposal.md` 已完整
- `handoff` 为对象时，`proposal.md` 含非空 `Handoff` 章节，且字段语义与 Slice Plan 保持一致；`handoff: null` 时，不得为了“完整”额外创建 `Handoff`
- cross-repo 时 proposal 的 `Scope`/`Dependencies` 含落地 repo 标注（来自 `workspace.note`）
- 不含 `TODO` / `TBD` / 空章节 / stub-only 内容

## Subagent Failure Handling

**核心原则**：
- 任一 slice 失败 → 立即 STOP，不继续后续 slices（避免依赖链断裂后继续登记）
- `status: partially-registered` 时，已登记的 slices 不回滚；幂等重试时跳过已成功的
- 用户修复后重新调用 register，已成功的 slices 视为幂等（`already exists` 视为成功）

**失败处理表**：

| 失败 | 父流程动作 | 输出示例 |
|---------|---------------|---------|
| subagent 创建 change 失败（CLI 错误） | **STOP 整个 register**，报告失败 slice + CLI 错误详情 | `status: stop`; `failed_slice: export-feature-02-progress`; `reason: CLI error: Invalid change name` |
| subagent 未写完整 proposal | **STOP**，列出缺失章节与该 slice | `status: stop`; `failed_slice: ...`; `reason: proposal incomplete, missing: Requirements, Assumptions` |
| proposal.Handoff 与 Slice Plan.handoff 不一致 | **STOP**，报告不一致详情 | `status: stop`; `reason: proposal Handoff mismatch for ...: plan.handoff is object but proposal has no Handoff section` |
| `openspec-new-change` 与 `/opsx:new` 都不可用 | **STOP**，报告无可用创建入口 | `status: stop`; `reason: neither openspec-new-change nor /opsx:new available` |
| subagent 超时（无响应） | **STOP**，建议手动完成该 slice 登记 | `status: stop`; `failed_slice: ...`; `reason: subagent timeout after 300s; suggest manual registration` |
| 已处理部分 slices，当前 slice 失败 | **STOP**，`status: partially-registered`，列出已成功与失败的 slices | `status: partially-registered`; `registered: [01]`; `failed: [02]` |

> 不支持断点续传参数：register 通过 CLI 的 `already exists` 响应自动实现幂等。完整 subagent 调用模式与 proposal 写作契约见 `references/landing-patterns.md`。

## Response Template

注意：下面回答模版里的 `## Handoff` 指的是**本技能对后续流程的交接**，不是 `proposal.md` 内部的切片契约章节。只有存在真实跨切片契约时，才要求在 `proposal.md` 内新增 `## Handoff`。

```md
## Result
- skill: openspec-slices-register
- status: registered | partially-registered | stop
- boundary_check: registration only; no re-splitting, tracking, or implementation

## Core Output
- workspace: null | {path: <workspace>, init_status: created | already-initialized}
- registered_changes:
  - change: export-feature-01-foundation   # {change-name}-{change-num}-{slice-change-name}
    goal: <one line>
    depends_on: []
    creation_mode: subagent-openspec-new-change | subagent-opsx-new | already-existed
    status: created | already-existed
- proposal_status:
  - change: export-feature-01-foundation
    state: complete | already-complete | synced-from-plan | stop-on-conflict
- slice_plan_persisted: <workspace>/openspec/slice-plans/<change_name>.yaml | none  # 未持久化或仅确认前快照为 none
- sequencing_hint: <archive or parallel reminder>

## Handoff
- handoff_to: openspec-continue | apply/verify/archive flow
- handoff_input: registered changes + persisted Slice Plan YAML
- handoff_reason: proposal is already complete, and tracking can read the persisted slice-plan.yaml directly

## Next Step
- recommended_action: continue with the next artifact for the next ready change
- requires_user_confirmation: no

## Warnings
- <missing field, workspace limitation, proposal conflict, CLI failure, or None>
```

## Handoff Decision Rule

| Situation | What to do |
|---|---|
| 仅有先后顺序、scope 边界、前序归档要求 | 只写 `Dependencies / Scope / Assumptions`，不新建交接文档 |
| 下游只需知道“这个切片做完了” | 只在 `Dependencies` 标明 `Blocks`/`Depends on` |
| Slice Plan 的 `handoff` 为对象 | 在当前 `proposal.md` 增加 `Handoff` 章节，并直接物化 `handoff_to / artifacts/contracts / ready_signal / consumer_expectations` |
| Slice Plan 的 `handoff` 为 `null` | 不创建 `proposal.md` 的 `Handoff`；只保留 `Dependencies / Scope / Assumptions` |
| 已存在人工维护的独立交接文档且当前流程明确要求沿用 | 在 `Handoff` 章节引用该文档；不要静默新建第二份 |
| cross-repo（`workspace.note` 非空） | 在 proposal 的 `Scope`/`Dependencies` 标注切片代码实际落地哪个 repo |

## References

- `references/cli-contract.md`：CLI 语法（`init` / `new change` / `list` / `status` / `validate` 等）、init/workspace-setup 限制、kebab-case 规则
- `references/landing-patterns.md`：single-repo / cross-repo 集中工作空间示例、完整 proposal 写法、幂等与冲突处理

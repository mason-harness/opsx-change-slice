---
name: openspec-slices-track
description: Use when a multi-slice OpenSpec plan already exists and someone needs a cross-session progress board - compares the persisted Slice Plan YAML (the single plan source, in the workspace openspec/slice-plans/) with live OpenSpec status from active and archived changes, classifies archived/in-progress/ready/blocked items, and returns the next recommended slice in fixed response sections without re-splitting or registering changes
---

# OpenSpec 多切片进度追踪

## Overview

**多切片 Slice Plan 的进度管理器。** 跨 session 追踪所有切片状态，基于依赖关系识别哪些可以启动、哪些被阻塞，主动建议下一步推进目标。

**核心价值**：把"多个切片分散在 active change 列表与已归档状态中"的局面整理成"整体进度地图 + 推进建议"，让用户跨 session 无缝衔接工作。

**边界**：只做进度追踪与建议，不执行登记、不做拆分决策、不执行 apply/verify/archive。

## Quick Reference

| Task | Key Actions |
|------|-------------|
| **读取 Slice Plan** | 首选 `<workspace>/openspec/slice-plans/<change_name>.yaml`（两模式统一计划源）；无 yaml 时回退 auto-memory 或用户提供的 plan |
| **查询实时状态** | `openspec list --json` 取 active changes；archived 走文件系统扫描（CLI 不列不查 archived，见 CLI Command Map） |
| **对比分析** | 合并 active 列表 + archive 目录扫描结果，分类为 archived / in-progress / ready / blocked |
| **生成进度图** | 使用固定 ASCII progress board |
| **建议下一步** | 优先继续进行中的切片，否则启动 ready 切片 |
| **固定输出** | 只输出追踪模版，不登记、不重做拆分 |

## Critical Rules

**Read Before Track**：先读取计划源，再取 active changes，再扫 archive 目录补齐 archived；计划源优先级：`<workspace>/openspec/slice-plans/<change_name>.yaml`（两模式首选，由 `openspec-slices-register` 持久化）→ auto-memory 或用户提供的 Slice Plan（无 openspec 目录/历史兼容）；缺任一必需输入时 STOP。

**判定语义**（唯一权威，详见 `references/progress-tracking.md`）：
- 依赖判断只认 `archived`：前序切片 `in-progress`/`no-tasks`/不存在都视为未满足。
- archived 判定 = **不在 active 列表 + archive 目录有匹配切片**（CLI 不提供 archived 查询入口，见 CLI Command Map）。
- 建议优先级：进行中 > ready > blocked，不得建议 blocked 切片直接启动。
- 多 yaml 自动聚焦：按 `{change-name}-{seq}-{name}` 前缀匹配活跃 change 族（详见下方「多 yaml 聚焦」）。
- 最终回答必须用固定模版，不输出登记命令或重新拆分建议。

**MUST NOT（封堵回退旧机制 + 错误 CLI 用法）**:
- **不得**用 `openspec status --change <name>` 查 archived——实跑报 `not found`，不返回 JSON（CLI 契约已验证）；archived 只走文件系统
- **不得**用 `openspec show <change>` 查状态（实跑返回 "Unknown item"）
- **不得**把 initiative `tasks.md` 当计划源——slice 技能不再使用 initiative

**STOP**:
- memory 中无 Slice Plan 且用户未提供，且 `openspec/slice-plans/` 无 yaml → STOP；提示先运行 `openspec-slices-register`
- `openspec/slice-plans/` 存在 ≥2 个候选 yaml 且 CLI active change 集无法唯一解析到单族（`{change_name}` 前缀）→ STOP，要求用户指定当前批次
- active 列表与 archive 目录任一获取失败且无法确认状态 → STOP

**Hardness**：L1（信息聚合与建议），输出只供追踪与决策参考。

## Boundaries

**不做**:
- 不执行 `openspec init` / `openspec new change` / `openspec apply` / `openspec archive`
- 不做拆分决策（交 `openspec-slices-plan`）、不做登记落地（交 `openspec-slices-register`）
- 不修改 Slice Plan（只读）、不自动启动下一个切片（只建议，由用户决策）

## Workflow

1. **读取计划源并聚焦当前批次** — 优先扫 `<workspace>/openspec/slice-plans/*.yaml`（`<workspace>` = 当前 repo 或集中工作空间 repo；workspace 为相对路径时基于 `path_base` 解析为绝对路径）：
   - 唯一 yaml → 直接读取为计划源，解析 `change_name` / `slices` / `depends_on` / `sequencing_rule` / 全量 `scope` / `goal` / `context` / `handoff` / `workspace`。
   - 多个 yaml → 执行下方「多 yaml 自动聚焦」判定当前批次。
   - 无 yaml → 回退 auto-memory 或用户提供的 Slice Plan。
   - cross-repo 读 yaml 后可取 `workspace.note` 获知切片代码落地哪个 repo（只读参考，不影响状态判定）。
2. **查询实时状态** — 用两条独立来源合并，至少覆盖 `name / status / completedTasks / totalTasks / lastModified` 与是否 archived：
   - **active**：`openspec list --json` 取 active changes（含 task 计数）。`list` 不列 archived。
   - **archived**（CLI 查不到）：扫 `<workspace>/openspec/changes/archive/` 目录，匹配目录名以 `-<slice-full-name>` 结尾（归档形为 `<YYYY-MM-DD>-<slice-full-name>`，见 CLI 契约「archive 命令」）。命中 → archived。
   - 切片既不在 active 列表、也无 archive 目录匹配 → 未登记或被删除，记入一致性检查。
3. **依赖分析** — 对每个 slice 基于计划源 `depends_on` 与合并后的状态分类为 archived / in-progress / ready / blocked。
4. **生成进度图** — 使用固定 ASCII progress board，逐行展示切片状态。
5. **建议下一步** — 优先继续进行中的切片；如无进行中，则建议启动 ready 切片；blocked 只报告原因。
6. **输出固定模版** — 按 `Response Template` 原样输出，包含 progress board、summary、recommendation、consistency check。

### 多 yaml 自动聚焦

当 `slice-plans/` 存在 ≥2 个 yaml，自动判断当前追踪哪个批次：

1. 解析每个 yaml 的 `change_name`（父批次名，三段命名第一、二段拼接的前缀）。
2. 取 step 2 已得的 `openspec list --json` active change 名称，对每个名称提取三段前缀（取到第二个 `-` 前，如 `oauth-migration-01-provider` → `oauth-migration`）；不足三段的不匹配。
3. 统计每个 yaml 的 `change_name` 命中的 active change 数：
   - 唯一 yaml 计数 >0 → 聚焦该 yaml。
   - ≥2 yaml 计数 >0 → **STOP**，列出候选族 + 计数，让用户指定当前批次。
   - 全部计数 =0 → 取最新 mtime 的 yaml，并警告"无活跃 change，基于最新计划追踪"。

完整场景示例与伪代码见 `references/progress-tracking.md`「多 yaml 聚焦示例」。

## CLI Command Map

| Action | Command / 方式 | 关键输出字段 |
|--------|----------------|-------------|
| 查询 active changes | `openspec list --json` | `changes[].{name,completedTasks,totalTasks,lastModified,status}`（**不列 archived**） |
| 查询单 **active** change 详情 | `openspec status --change <name> --json` | `changeName`、`planningHome.root`、`changeRoot`、`artifactPaths`、`artifacts[].status` |
| **检测 archived change** | 扫 `<workspace>/openspec/changes/archive/`，匹配 `-<slice-full-name>` 结尾目录 | 目录名形如 `<YYYY-MM-DD>-<slice-full-name>`，仅含 `.openspec.yaml` |
| 校验（可选健康检查） | `openspec validate [item-name] --changes --json` | 校验结果 |
| **禁止** | ~~`openspec show <change-name>`~~ | 实跑返回 "Unknown item"，不可靠 |
| **禁止** | ~~`openspec status --change <archived-name>`~~ | 实跑报 `Change '...' not found`，不返回 JSON |

> `openspec list --json` 的 `status` 可为 `no-tasks`（尚未生成 tasks.md）。**archived 检测不能靠 CLI**：`list` 不列 archived、`status --change <archived>` 报 not found。archived change 归档时移入 `<workspace>/openspec/changes/archive/<YYYY-MM-DD>-<name>/`，track 须扫该目录。CLI 行为细节见 `openspec-slices-register/references/cli-contract.md`（`list` / `status` / `archive` 段与「archived 检测策略」）。

## Plan Source Schema

`<workspace>/openspec/slice-plans/<change_name>.yaml`（由 `openspec-slices-register` 持久化的全量确认 Slice Plan）是两模式**首选**计划与依赖真相源，承载 `change_name`、`mode`、`workspace`、`slices`（含全量 `scope` / `goal` / `context` / `handoff`）、`depends_on`、`sequencing_rule`。计划源不承担实时状态；实时状态以两来源合并为准：**active** 取自 `openspec list --json`，**archived** 取自扫 `openspec/changes/archive/` 目录（CLI 不提供 archived 查询）。无 openspec 目录或历史兼容场景回退 Slice Plan memory（仅含最小必需 + 可选增强字段）。完整示例见 `references/memory-schema.md`。

## Response Template

最终回答必须使用以下固定结构与顺序；无警告时也必须保留 `## Warnings` 并写 `- None`。

```md
## Result
- skill: openspec-slices-track
- status: tracked | stop
- boundary_check: tracking only; no registration, re-splitting, or implementation

## Core Output
- plan_source: <workspace>/openspec/slice-plans/<change_name>.yaml | memory file | user-provided plan
- live_status_source: cli(list active) + filesystem(archive scan)
- progress_board: |
    <ASCII board>
- summary:
  - archived: 0/0
  - in_progress: 0/0
  - ready: 0/0
  - blocked: 0/0
- recommendation: <continue X | start Y | all archived>
- blocked_items:
  - name: sample-feature-03-foo      # {change-name}-{change-num}-{slice-change-name}
    waiting_on: [01, 02]
- consistency_check:
  - <plan/CLI mismatch, or none>

## Handoff
- handoff_to: openspec-continue | openspec-apply | openspec-archive | none
- handoff_input: recommended next slice
- handoff_reason: follow-up action depends on current progress state

## Next Step
- recommended_action: continue in-progress slice or start the first ready slice
- requires_user_confirmation: yes

## Warnings
- <missing plan source, CLI mismatch, source mismatch, or None>
```

## Handoffs

- **接收自**:
  - 用户主动调用
  - CLAUDE.md 指示"启动时检查进度"
  - 其他 skill 完成后建议"查看整体进度"
- **交给**:
  - `openspec-continue`
  - `openspec-apply`
  - `openspec-archive`

## Failure Handling

| Failure | Action |
|---------|--------|
| 无 plan source（yaml 不存在 + memory 无 + 用户未提供） | STOP；提示先运行 `openspec-slices-register` 持久化 slice-plan.yaml |
| active changes 为空且 archive 目录也无匹配切片 | STOP；提示先运行 `openspec-slices-register` |
| `openspec list --json` 返回错误 | 报告错误详情；检查是否在正确工作空间目录（`planningHome.root`） |
| archive 目录扫描失败（无权限/路径不存在） | 报告；archived 切片标记为"状态未知"，建议用户手动确认 |
| 依赖关系不一致 | 警告计划源与实际 changes 不匹配；列出缺失/多余项 |

## References

- **references/progress-tracking.md**：状态映射规则、依赖满足判定、优先级排序、ASCII 模版、固定回答示例、多 yaml 聚焦示例与伪代码
- **references/memory-schema.md**：Slice Plan memory 格式约定（无 openspec 目录时的回退源）、字段说明、示例

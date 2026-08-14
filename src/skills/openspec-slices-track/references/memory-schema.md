# Slice Plan Memory 格式（无 openspec 目录时的回退源）

## 目标

为 `openspec-slices-track` 提供跨 session 的依赖关系来源（当工作空间内无 `openspec/slice-plans/<change_name>.yaml` 时回退使用）。

`openspec list --json` 只能告诉我们“当前有哪些 active change、每个 change 的 task 状态”，但无法告诉我们“这些切片之间的依赖关系是什么”，也不会直接枚举已归档切片。

当工作空间内存在 slice-plan.yaml 时，它是首选计划源（全量确认 Slice Plan 的超集）；memory 仅在无 openspec 目录、历史兼容或显式降级时作为回退来源，因此只需持久化 Slice Plan 的最小必要信息。

## 推荐 memory 文件格式

```markdown
---
name: sample-feature-slice-plan
description: Sample Feature 多切片 Slice Plan，供 openspec-slices-track 跨 session 读取依赖关系（无 openspec 目录时回退）
metadata:
  type: project
---

Sample Feature 切片方案（7 个切片，中性示意名，不代表特定项目类型）。

**Why:** `openspec list --json` 只能返回 active change 状态，不能表达切片依赖关系，也不会直接枚举已归档切片；需要单独持久化 sequencing_rule 与 depends_on 供跨 session 推进使用。
**How to apply:** 新 session 中如要判断下一步该推进哪个切片，先确定计划源——首选工作空间内 `openspec/slice-plans/<change_name>.yaml`；仅当无 openspec 目录或历史降级时读取本 memory，然后结合 `openspec list --json` 与对缺失切片逐个补查的状态结果，判断 archived / in-progress / ready / blocked。

**Sequencing Rule:** archive-N-before-N+1

**Slices:**
- sample-feature-01-project-bootstrap: []
- sample-feature-02-content-core: [sample-feature-01-project-bootstrap]
- sample-feature-03-checking-engine: [sample-feature-01-project-bootstrap, sample-feature-02-content-core]
- sample-feature-04-state-machine: [sample-feature-02-content-core, sample-feature-03-checking-engine]
- sample-feature-05-volume-management: [sample-feature-02-content-core]
- sample-feature-06-destiny-weaving: [sample-feature-05-volume-management]
- sample-feature-07-archive-and-export: [sample-feature-04-state-machine, sample-feature-05-volume-management, sample-feature-06-destiny-weaving]
```

## 最小必需字段

- `Sequencing Rule`
- `Slices`
- 每个切片的完整 change 名称
- 每个切片对应的 `depends_on`

> 以上四项**全部包含在 `<workspace>/openspec/slice-plans/<change_name>.yaml`** 中（该 yaml 是最小集的严格超集，另含 `mode` / `workspace` / `goal` / `context` / `scope` / `handoff`）。故 yaml 存在时，memory 不再是最低必需来源——memory 退为可选增强字段载体或无 openspec 目录时的回退。

## 可选增强字段

可以按需增加：

- `Current recommendation`: 当前推荐先做哪个
- `Archived milestones`: 某切片何时归档
- `Parallel groups`: 哪些切片可以并行

但这些都不是 `openspec-slices-track` 的最低要求。

## 读取策略

`openspec-slices-track` 的计划源读取顺序应为：

1. `<workspace>/openspec/slice-plans/<change_name>.yaml`（两模式首选，`openspec-slices-register` 持久化的全量确认 Slice Plan）
2. 无 openspec 目录 / 历史兼容 / 显式降级：读取 memory

当 yaml 存在时，memory 不再承担最小必需字段（yaml 是其严格超集），仅作为可选增强字段的载体或无 openspec 目录时的回退源。仅当退到 memory 时才解析。

不要把 memory 当作实时状态来源。

实时状态始终以 `openspec list --json` 与 `openspec status --change <name> --json` 为准。

## 更新时机

建议在以下时机更新该 memory：

1. `openspec-slices-register` 完成初次登记后（仅当工作空间内无 slice-plan.yaml 作为首选计划源时）
2. 切片被新增、合并、重命名后
3. sequencing rule 被修改后

不建议在每次 task 完成后更新，因为 task 级进度不应写入 memory。

## 边界

这个 memory 只存：
- 切片关系
- 推进顺序
- 非显而易见的流程约束

不要存：
- 每个切片当前 task 完成百分比
- 临时实现细节
- 具体代码路径
- 一次性 session 对话内容

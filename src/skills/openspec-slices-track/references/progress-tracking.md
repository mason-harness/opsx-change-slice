# 进度追踪规则

> 下文示例名（如 `sample-feature`）为中性示意名，不代表特定项目类型。

## 状态映射

基于 `openspec list --json` 的 active change 列表与对 `openspec/changes/archive/` 目录扫描得到的 archived 集合合并结果，将每个切片映射为以下四类状态：

- `archived` → **已归档**
- `in-progress` → **进行中**
- `ready` → **可启动**
- `blocked` → **被阻塞**

> archived 检测不靠 CLI：`list` 不列 archived、`status --change <archived>` 报 `not found`。archived change 归档时移入 `<workspace>/openspec/changes/archive/<YYYY-MM-DD>-<name>/`，track 扫该目录按目录名后缀 `-<slice-full-name>` 匹配。

## 判定规则

### 1. archived

满足全部条件：
- 该 change 不在 `openspec list --json` 的 active 列表中
- 且在 `<workspace>/openspec/changes/archive/` 下存在目录名以 `-<slice-full-name>` 结尾（即 `<YYYY-MM-DD>-<slice-full-name>` 形态）

显示格式：
```text
✅ sample-feature-01-project-bootstrap      [archived]
```

### 2. in-progress

满足任一条件：
- `totalTasks > 0`
- 或 `completedTasks > 0`
- 且不是 `archived`

显示格式：
```text
🔄 sample-feature-02-content-core   [5/12 tasks, 41%]
```

百分比计算：
- `progress = floor(completedTasks / totalTasks * 100)`
- 若 `totalTasks = 0`，不显示百分比

### 3. ready

满足全部条件：
- 当前切片不是 `archived`
- 当前切片不是 `in-progress`
- `depends_on` 中所有前序切片都已 `archived`

显示格式：
```text
⏳ sample-feature-03-checking-engine   [ready, 依赖已满足]
```

### 4. blocked

满足全部条件：
- 当前切片不是 `archived`
- 当前切片不是 `in-progress`
- `depends_on` 中至少有一个前序切片未 `archived`

显示格式：
```text
🚫 sample-feature-04-state-machine          [blocked, 等待 02/03]
```

## 依赖满足判定

依赖判断只认合并状态中的 `archived`。

- 前序切片 `in-progress` → 仍视为未满足
- 前序切片 `no-tasks` → 仍视为未满足
- 前序切片不存在 → 视为不一致，需警告

## 优先级排序

输出建议时按以下顺序：

1. **继续进行中的切片**
   - 避免上下文切换成本
   - 如果有多个进行中，按 `lastModified` 最新优先

2. **启动 ready 的切片**
   - 依赖已满足，可以立即推进
   - 如果有多个 ready，按 Slice Plan 顺序优先

3. **提示 blocked 的切片**
   - 只报告阻塞原因，不建议直接启动

4. **全部 archived**
   - 输出完成提示，不再建议下一步

## ASCII 模板

```text
┌─────────────────────────────────────────────────┐
│     Sample Feature 切片进度（7 个切片）          │
├─────────────────────────────────────────────────┤
│ ✅ sample-feat-01-project-bootstrap [archived]   │
│ 🔄 sample-feat-02-content-core    [5/12 tasks]│
│ ⏳ sample-feat-03-checking-engine [ready]    │
│ 🚫 sample-feat-04-state-machine   [blocked by 02] │
│ 🚫 sample-feat-05-volume-management[blocked by 02]│
│ 🚫 sample-feat-06-destiny-weaving  [blocked by 05]│
│ 🚫 sample-feat-07-archive-and-export[blocked by 04]│
├─────────────────────────────────────────────────┤
│ 📊 整体进度: 1/7 归档, 1/7 进行中               │
└─────────────────────────────────────────────────┘
```

## 不一致检测

如计划源与合并后的 CLI 状态结果不一致，需要提示：

- 计划源中有切片，但 CLI 中缺失
- CLI 中有同族切片，但计划源中缺失
- `depends_on` 指向不存在的切片

输出格式建议：

```text
⚠️ 计划源与当前 changes 不完全一致：
- 计划源中声明了 sample-feature-06-destiny-weaving，但 CLI 未找到
- CLI 中存在 sample-feature-08-extra-change，但不在当前计划源中
```

## 固定回答模版示例

```md
## Result
- skill: openspec-slices-track
- status: tracked
- boundary_check: tracking only; no registration, re-splitting, or implementation

## Core Output
- plan_source: openspec/slice-plans/sample-feature.yaml
- live_status_source: cli(list active) + filesystem(archive scan)
- progress_board: |
    ┌─────────────────────────────────────────────────┐
    │     Sample Feature 切片进度（7 个切片）          │
    ├─────────────────────────────────────────────────┤
    │ ✅ sample-feat-01-project-bootstrap [archived]   │
    │ 🔄 sample-feat-02-content-core    [5/12 tasks]│
    │ ⏳ sample-feat-03-checking-engine [ready]    │
    │ 🚫 sample-feat-04-state-machine   [blocked by 02] │
    └─────────────────────────────────────────────────┘
- summary:
  - archived: 1/7
  - in_progress: 1/7
  - ready: 1/7
  - blocked: 4/7
- recommendation: continue sample-feature-02-content-core
- blocked_items:
  - name: sample-feature-04-state-machine
    waiting_on: [02, 03]
- consistency_check:
  - None

## Handoff
- handoff_to: openspec-continue
- handoff_input: sample-feature-02-content-core
- handoff_reason: 当前已有进行中的切片，优先减少上下文切换

## Next Step
- recommended_action: continue the in-progress slice before starting any ready slice
- requires_user_confirmation: yes

## Warnings
- None
```

## 多 yaml 聚焦示例

`<workspace>/openspec/slice-plans/` 存在 ≥2 个 yaml 时，按三段命名前缀自动匹配当前活跃族。前缀提取：取 change 名到第二个 `-` 之前（`oauth-migration-01-provider` → `oauth-migration`）；不足三段不匹配。

### 场景 1：唯一匹配 → 聚焦

```
slice-plans/: export-feature.yaml, oauth-migration.yaml
list 返回: export-feature-01-foundation, export-feature-02-progress, other-single-change
前缀: export-feature×2, oauth-migration×0
→ 聚焦 export-feature.yaml
```

### 场景 2：多个匹配 → STOP

```
list 返回: export-feature-01-foundation, oauth-migration-01-provider, oauth-migration-02-client
统计: export-feature=1, oauth-migration=2
→ STOP，列出候选族让用户指定当前批次
```

### 场景 3：零匹配 → 取最新 mtime

```
list 返回: other-legacy-change（无三段前缀）
统计: 全部 =0
→ 取 mtime 最大的 yaml，警告"无活跃 change 匹配，基于最新计划追踪"
```

### 前缀提取伪代码

```python
def extract_prefix(change_name):
    """三段命名取前两段作为 change_name 前缀"""
    parts = change_name.split('-')
    return f"{parts[0]}-{parts[1]}" if len(parts) >= 3 else None

def auto_focus_yaml(yaml_files, active_changes):
    if len(yaml_files) == 1:
        return yaml_files[0]
    yaml_map = {parse_yaml(f)['change_name']: f for f in yaml_files}
    prefixes = [p for p in (extract_prefix(n) for n in active_changes) if p]
    counts = {cn: prefixes.count(cn) for cn in yaml_map}
    matched = {cn: c for cn, c in counts.items() if c > 0}
    if len(matched) == 1:
        return yaml_map[next(iter(matched))]
    if len(matched) >= 2:
        raise StopError(f"多个活跃批次: {matched}")
    return max(yaml_files, key=lambda f: os.path.getmtime(f))  # 零匹配取最新
```

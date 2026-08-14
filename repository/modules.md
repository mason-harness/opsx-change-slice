# 模块边界与技能流水线

> 本文件只写三个 skill 的**职责边界**与**交接契约**，不复制 `SKILL.md` / `references` 正文。技能正文唯一真源：`src/skills/<skill>/SKILL.md` 及其 `references/`。

## 三个 skill 模块

物理位置：`src/skills/openspec-slices-{plan,register,track}/`，每个含 `SKILL.md` + `references/*.md`。

| 模块 | 职责边界（产出 / 消费） | 正文位置 |
|---|---|---|
| `openspec-slices-plan` | 消费用户需求；产出 Slice Plan（切片方案，含切片维度选择与边界声明） | `src/skills/openspec-slices-plan/SKILL.md` + `references/{split-strategy,slice-plan-examples}.md` |
| `openspec-slices-register` | 消费 Slice Plan；注册各 slice 为 OpenSpec changes（多 slice/跨仓时先建集中工作区）；落盘 Slice Plan YAML 供下游 | `src/skills/openspec-slices-register/SKILL.md` + `references/{cli-contract,landing-patterns}.md` |
| `openspec-slices-track` | 消费 Slice Plan YAML + OpenSpec 现状；产出跨会话进度看板与下一推荐 slice | `src/skills/openspec-slices-track/SKILL.md` + `references/{progress-tracking,memory-schema}.md` |

> 上表为边界摘要，非技能正文。具体触发条件、禁止项、返回结构见各 skill 的 `SKILL.md`。

## 流水线交接契约

- 顺序：`plan → register → track`，单向。
- 交接产物：**Slice Plan YAML**——`register` 写入、`track` 读取的唯一计划来源。register 将其持久化到工作区（`openspec/slice-plans/`），track 以该 YAML 为唯一计划来源与活跃/归档 change 状态对账。
- 该 YAML 的具体 schema、存储位置、字段语义**由 skill 内部定义**（见 `openspec-slices-track/references/memory-schema.md` 与 register skill），本文件**不复述**，只声明交接关系与单一来源原则。
- 反向约束（来自各 skill 描述，概要）：`track` 不重新切分、不重新注册 change；`register` 不重新切分、不直接 new-change 循环、不用 `--initiative`、不做进度跟踪。

## docs/ 与 references/ 的职责区分（不冲突）

- `docs/OpenSpec Change 拆分策略文档.md`：**skill 开发参考文件**，面向本仓库开发者，在本仓库内阅读，不随包安装到下游。
- `src/skills/<skill>/references/*.md`：**安装到目标项目、服务于 skill 运行**的说明文件，随 `install-skills.js` 复制到下游目标项目的 `.claude/skills/`，供 skill 执行时引用。
- 两者面向不同受众、不同生命周期，**不冲突**：docs 是开发期参考，references 是运行期产物的一部分。各自独立维护，不互为副本，无需合并去重或选定权威源。
- 写作约束：docs 章节可写开发期理解性内容（总纲、决策树解读）；references 章节必须写 skill 执行可直接引用的契约性内容。两者内容可能相似但用途不同，允许各自表述。

## 应避免

- 复制各 skill 的 `SKILL.md`/`references` 正文到本文件。
- 逐文件流水账（如逐一列举 references 每个文件内容）。
- 写 skill 内部实现细节（应留在 skill 自身）。
- 把 `docs/` 与 `references/` 当作同一内容的重复维护——它们职责不同（开发参考 vs 运行产物），各自独立维护。

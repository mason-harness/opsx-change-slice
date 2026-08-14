# repository/ — 仓库工程知识库

本知识库只记录**本仓库作为 npm 包如何运作、如何开发**的稳定工程知识。它**不重复承载 skill 产品内容**——三个 skill 的 `SKILL.md` 与 `references/*.md` 是产品产物，维护在 `src/skills/`，会被 `install-skills.js` 安装到下游目标项目的 `.claude/skills/`。产品正文不在本知识库内复制，避免双重维护。

## 文件索引

| 文件 | 内容 |
|---|---|
| `README.md`（本文件） | 入口、范围声明、与 `src/skills/` 的边界、阅读顺序 |
| `modules.md` | 三个 skill 的职责**边界**与 plan→register→track 交接契约；`docs/`（开发参考）与 `references/`（运行产物）职责区分 |
| `integrations.md` | 作为 npm 包的发布与安装契约（`files`/`bin`/`engines`、安装目标路径、`--global`/`--target` 行为、源目录不一致已知问题） |
| `decisions/` | 稳定设计决策（源码即产物无构建步骤、skill 布局决策） |

## 阅读顺序

1. 本文件（范围与边界）
2. `modules.md`（模块边界与流水线交接）
3. `integrations.md`（npm 发布/安装契约与已知不一致）
4. `decisions/`（布局与发布模式决策）

## 与 `src/skills/` 的边界

| 维度 | `repository/` 承载 | `src/skills/` 承载 |
|---|---|---|
| skill 正文 | ✗ 不复制 | ✓ `SKILL.md` / `references` 全文 |
| 模块边界与交接契约 | ✓ 简述 | ✗（skill 不自述边界关系） |
| 安装/发布工程契约 | ✓ | ✗ |
| skill 内部术语定义 | ✗（在 skill 内） | ✓ |

## 应避免

- 复制 `SKILL.md`/`references` 正文到本知识库（双重维护）。
- 记录今日 TODO、临时讨论、一次性需求、会话上下文。
- 记录私密凭据、token、私有 npm registry 地址。
- 写 git 依赖动作（本仓库非 git，无 commit/分支/PR）。

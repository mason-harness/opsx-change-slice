# opsx-change-slice-manager

一个把 OpenSpec Change 拆分技能安装到目标项目 `.claude/skills/` 的 npm 包。本包只负责**安装**三个 skill 源到你的项目，本身不含运行时依赖，安装后技能由目标项目的 Claude Code 会话按需调用。

## 包含的技能

安装后，以下三个 skill 会被复制到目标项目的 `.claude/skills/`：

| skill | 用途 |
|---|---|
| `openspec-slices-plan` | 当一个需求过大、需要拆分策略选择、或横跨单仓/多仓边界时，产出经用户确认的 Slice Plan |
| `openspec-slices-register` | 对已确认的 Slice Plan 注册各 slice 为 OpenSpec change；多 slice/跨仓时先建集中工作区 |
| `openspec-slices-track` | 对已存在的多 slice 计划做跨会话进度看板，返回下一个推荐 slice |

三者构成 `plan → register → track` 流水线，交接物是 Slice Plan YAML。各 skill 的触发条件与用法见安装后的 `SKILL.md`。

## 使用时机（在 openspec change 流程中）

这三个 skill 串在 openspec change 的标准流程（提案 → new change → apply → verify → archive）里，专门处理"一个需求需要拆成多片"的情况：

- **openspec-slices-plan**：在 `openspec new change` **之前**。当一个需求过大、需要选拆分策略、或横跨单仓/多仓边界时，先经它产出经你确认的 Slice Plan。它是拆分的唯一入口——不经它确认，不要直接 new change。
- **openspec-slices-register**：在 plan 确认**之后**、apply **之前**。把已确认的 Slice Plan 落地为多个 changes，每片在当轮写完整 `proposal.md`，并把 Slice Plan YAML 持久化到工作空间供追踪读取；多仓/跨仓时它会先建集中工作空间。
- **openspec-slices-track**：在 register **之后**、任意 apply/verify/archive **之间或之后**，可跨会话反复调用。它读 register 落盘的 Slice Plan YAML 与 openspec 现状，给出进度看板和下一个推荐 slice，自身不做拆分、不做登记、不做 apply/verify/archive。

之后每个 slice 按正常 openspec 流程推进（apply → verify → archive）。具体每个 skill 的触发条件、输入输出、固定回答模版见安装后的 `SKILL.md`。

## 安装

需要 Node.js >= 18。

### 安装到当前项目（默认）

```sh
npx install-claude-skills
```

技能会被复制到 `./.claude/skills`（当前工作目录下）。

### 安装到全局

```sh
npx install-claude-skills --global
```

技能会被复制到 `~/.claude/skills`。

### 安装到自定义目录

```sh
npx install-claude-skills --target /path/to/dir
```

### 在本仓库内运行

```sh
npm run install-skills -- --target /tmp/verify
```

`--global` 与 `--target` 不可同时使用。运行 `install-claude-skills --help` 查看完整用法。

## 安装后验证

安装成功会输出 `Installed 3 skills to <target>`。检查目标目录应包含三个 skill 子目录，每个含 `SKILL.md` 与 `references/`。

## 仓库结构

```
├── README.md                 # 本文件（人类上手）
├── package.json              # npm 包定义
├── scripts/install-skills.js # 安装脚本（复制 src/skills 到目标）
├── src/skills/               # 三个 skill 源（安装产物）
│   ├── openspec-slices-plan/
│   ├── openspec-slices-register/
│   └── openspec-slices-track/
├── docs/                     # skill 开发期参考（拆分策略、使用时机等，不随包安装）
└── repository/               # 仓库工程知识（开发者参考）
```

- `src/skills/` 下的 `SKILL.md` 与 `references/` 是会随包安装到目标项目的运行产物。
- `docs/` 是开发期参考（拆分策略、使用时机等），只在本仓库内阅读，不安装到目标项目。

## 开发者参考

- `CLAUDE.md`：Claude Code 在本仓库工作时的执行规则。
- `repository/`：仓库工程知识（模块边界、发布安装契约、设计决策）。
- `docs/`：skill 开发期参考（拆分策略、使用时机等）。

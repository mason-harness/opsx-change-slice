# ADR-0001：源码即产物，无构建步骤

- 状态：Accepted
- 日期：2026-08-14

## 背景

本包是技能工厂，产品 = `src/skills/` 下三个 skill 目录（`openspec-slices-{plan,register,track}/`）。`install-skills.js` 直接用 `fs.copyFileSync` 复制源文件到目标 `.claude/skills/`（install-skills.js L82-105、L102），不经过任何 transpile/compile。脚本仅用 Node 内置 `fs`/`path`/`os`（install-skills.js L3-5），`package.json` 无 `dependencies` 字段。技能内容是 Markdown 文档，无需编译。

## 决策

源码即产物。不引入构建/转译步骤。`package.json` 的 `files` 清单直接发布源文件（`README.md`、`scripts/install-skills.js`、`skills`，package.json L12-15）。`engines.node>=18`（package.json L17-18）。

## 后果

- 任何对 `src/skills/` 的编辑**即**产品变更，下次安装即传播到下游目标项目——改 skill 须按 `CLAUDE.md` 的 Dangerous Operations 走 STOP。
- 不存在 build 产物可忽略/可重生成的缓冲区；产物与源同生命。
- 与 ADR-0002 的张力：若用"加构建步骤同步 `src/skills/→skills/`"修路径不一致，将破坏本决策；故 ADR-0002 的修法倾向 (a)（改脚本与清单指向 `src/skills`，不加构建），见 `../integrations.md` 已知问题 1。

## 避免

- 把本决策写成"禁止任何脚本"——它只约束"无构建/转译步骤"，不排除未来新增 test/lint 脚本。
- 把本决策写成禁止未来引入工具链——它记录的是当前无构建的事实，不禁止未来经评审新增。

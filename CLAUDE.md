# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## 项目概览

- 这是一个**技能工厂 npm 包** `opsx-change-slice-manager`（v0.1.0，UNLICENSED，证据：package.json L2-5），**不是应用**，也**不是被 OpenSpec 管理的项目**。
- 它把仓库内 3 个 OpenSpec slice 技能源（`src/skills/openspec-slices-{plan,register,track}/`）打包，通过 `scripts/install-skills.js` 复制到目标项目的 `.claude/skills/` 目录。
- 零运行时依赖（package.json 无 `dependencies` 字段）；安装脚本仅用 Node 内置 `fs`/`path`/`os`（install-skills.js L3-5）。`engines.node>=18`（package.json L17-19）。
- 发布模式：**源码即产物**——无构建步骤，`src/skills/` 下的 `SKILL.md` 与 references 即发布内容，经安装脚本原样复制。详见 `repository/decisions/`。
- 产品知识（skill 正文）在 `src/skills/`；本仓库的工程知识（如何作为包运作/如何开发）在根目录 `repository/`。两者不重复维护。

## 常用命令

> 命令来源：package.json L9-10（`scripts` 仅 `install-skills` 一条）、L6-8（`bin`）。**本仓库无 test / lint / build 脚本**——不要捏造这些命令。

### 安装与运行

- `npm run install-skills` —— 等价于 `node scripts/install-skills.js`（package.json L10）。也可经 bin 调用：`npx install-claude-skills`（package.json L6-8）。
  - 目标路径解析（证据 install-skills.js `resolveTargetDirectory` L62-72）：
    - `--global` → `~/.claude/skills`（L67-68）
    - `--target <path>` → 自定义绝对路径（L63-64）
    - 默认 → `当前工作目录/.claude/skills`（L71）
    - `--global` 与 `--target` 互斥，同传抛错（L55-57）
    - 未知参数抛 `Unknown argument`（L52）；`--target` 缺值抛 `Missing value for --target`（L44-46）；`--help`/`-h` 显示用法（L32-34）
  - 源目录：install-skills.js L8 为 `path.join(repoRoot, 'src', 'skills')`，package.json `files` 为 `src/skills`——已对齐实际布局（2026-08-14 修复，见 `repository/decisions/0002`）。

### 未配置的脚本（如实记录，非事实命令）

- 无 `test` / `lint` / `build` / `format` / `typecheck` 脚本（证据：package.json L9-11 仅一条 script，项目内无 eslint/prettier/tsconfig 配置）。需要时不要假设其存在，先 STOP 与用户确认是否新增。

## 架构

### 入口点

- 唯一可执行 JS：`scripts/install-skills.js`（`bin` 与 `scripts.install-skills` 都指向它，证据 package.json L7、L10）。流程：`main()`（L119）→ 解析参数（L25-60）→ 解析目标目录（L62-72）→ 列源 skill 目录（L107-117）→ 递归复制每个 skill（L82-105），跳过 `.DS_Store`（L74-76），末尾输出 `Installed N skills to TARGET`（L132）。

### 模块划分（技能流水线）

- 三个 skill 模块构成 `plan → register → track` 流水线（物理位置 `src/skills/openspec-slices-{plan,register,track}/`）：
  - `plan`：产 Slice Plan（切片方案，含切片维度选择与边界声明）。
  - `register`：消费 Slice Plan，注册各 slice 为 OpenSpec changes，持久化 Slice Plan YAML 供下游。
  - `track`：读 Slice Plan YAML 与 OpenSpec 现状，产出跨会话进度看板与下一推荐 slice。
- **交接契约**：模块间通过 Slice Plan YAML 交接（register 写、track 读）。该 YAML 的 schema/位置由 skill 内部定义——**不在此复述**，详见 `repository/modules.md` 的边界与交接契约。
- 各 skill 目录结构：`SKILL.md` + `references/*.md`（如 plan 的 `split-strategy.md`、`slice-plan-examples.md`，已验证）。
- 注意：上述流水线是技能**产品所描述的能力**，不是本仓库运行时调用关系——本仓库运行时只有一个安装脚本，不调用这些技能。

### 发布模式

- **源码即产物**：无构建/转译步骤（证据：无 build 脚本、无 `dependencies`、install-skills.js L102 `copyFileSync` 直接复制源文件）。package.json L12-16 的 `files` 声明发布 `["README.md","scripts/install-skills.js","skills"]`。决策依据见 `repository/decisions/0001-source-is-artifact-no-build.md`。

## Do

- 改动 `src/skills/<skill>/` 内容后，先确认该 skill 是产品（会被 install-skills.js L126-129 复制到下游目标项目），保持 `SKILL.md + references/` 结构完整。
- 验证安装行为时，用临时目标目录（`--target /tmp/...`），避免污染本仓库自身的 `.claude/`（`.gitignore` 已忽略 `.claude/`，但本仓库非 git，忽略规则不生效——更应避免在仓库内创建 `.claude/`）。
- 理解 `docs/`（开发参考）与 `src/skills/<skill>/references/`（运行产物，随包安装到下游）职责不同、不冲突：docs 写开发期理解性内容，references 写 skill 执行可直接引用的契约性内容，各自独立维护。
- 引用 skill 行为时指到 `src/skills/<skill>/SKILL.md` 或具体 `references/*.md`，不在 CLAUDE.md/repository/ 里复述其正文。

## Don't

- 不要把 `src/skills/` 下 skill 的 `SKILL.md`/`references/*.md` 正文复制进 `repository/` 或 `CLAUDE.md`——那是产品内容，会双重维护；`repository/` 只写边界与工程知识。
- 不要把 `docs/` 开发参考与 `src/skills/<skill>/references/` 运行产物当作同一内容的重复维护——它们职责不同、不冲突，各自独立维护，无需选定权威源或合并（见 `repository/modules.md`）。
- 不要把代码格式化、import 排序、lint 自动修复等不影响功能的改动混入功能 diff；这类工作交给项目的 git commit hook / formatter / lint --fix 等外部工具，保持 diff 聚焦于功能性变更。**（模板级软规则）** 本项目当前无 lint/format 工具、无 VCS（非 git，故无 commit hook 可委派）；该规则当前无具体工具可委派，保留以备未来引入工具时生效。
- 不要对整个项目执行 lint / formatter / lint --fix 全量扫描或自动修复；只对本次变更涉及的文件运行。**（模板级软规则）** 本项目当前无此类工具，此条以备未来生效。
- 不要捏造 test/lint/build 命令（package.json L9-11 仅 `install-skills`）。
- 不要在本仓库工作目录默认安装到 `./.claude/skills`（install-skills.js L71 默认行为）——会污染本仓库；验证用 `--target` 指定临时目录。

## Before Finishing（每次完成前必须检查）

> 本项目无 test / lint / build 脚本（package.json L9-11），以下检查适配为手动验证项，证据来源已标注。

- [ ] 若本次修改了 `src/skills/` 下任何技能文件，确认三个 skill 目录结构完整：每个 skill 子目录均含 `SKILL.md`，`references/` 下文件齐全（plan：split-strategy.md + slice-plan-examples.md；register：cli-contract.md + landing-patterns.md；track：progress-tracking.md + memory-schema.md）。
- [ ] 实跑 `node scripts/install-skills.js --target /tmp/skills-verify`，期望输出 `Installed 3 skills to /tmp/skills-verify`（install-skills.js L132）并 exit 0，三个 skill 目录正确复制，`.DS_Store` 被跳过（L74-76）。源目录已对齐 `src/skills`（2026-08-14 修复）；若该命令再次失败，须 STOP 报告并先排查源目录是否被改回。
- [ ] 确认 `.DS_Store` 未被复制进目标：install-skills.js L74-76 `shouldSkip` 跳过 `.DS_Store`；但根目录与 `src/skills/`、`docs/` 实际存在 `.DS_Store`（已验证），打包前应清理（`.npmignore` 含 `**/.DS_Store` 在 `npm publish` 时排除）。
- [ ] 确认只修改了预期文件：**本仓库非 git 仓库**（已验证），`git status` 不可用；改用 `ls -laR src/skills/ scripts/ docs/` 对照预期改动范围，或与备份对比。
- [ ] 确认 diff 只含功能性变更；格式化/import 排序等非功能性清理已限定在变更文件范围内交外部工具。**本项目当前无此类工具也无 VCS**，此条当前为空操作，仅在未来引入工具后生效。
- [ ] 若本次新增/修改了 `repository/` 内容，确认未复制 `src/skills/` 正文（只写工程边界/契约/决策）。
- [ ] 若改动涉及发布清单，运行 `npm pack --dry-run` 确认产物含 `README.md` + `scripts/install-skills.js` + `src/skills/` 全部 9 文件，无缺失 warning。
- [ ] 若改动涉及 `install-skills.js` 源目录逻辑（L8）或 `package.json` `files`/`bin`/`engines`，确认已按 Dangerous Operations STOP 与用户确认。

## Dangerous Operations（STOP）

- 修改 `src/skills/<skill>/` 下任何已发布 skill 的 `SKILL.md` 或 `references/*.md` 内容 → **STOP，必须人工确认**：该内容是产品产物，会被 install-skills.js 复制逻辑（L82-105、L126-129）复制到下游目标项目的 `.claude/skills/`，修改将改变下游已安装副本行为；必须确认影响范围与是否有版本化/迁移路径。
- 修改 `scripts/install-skills.js` 的源目录逻辑（L8 `sourceRoot = path.join(repoRoot, 'src', 'skills')`）或复制/跳过逻辑（L74-105）→ **STOP，必须人工确认**：改变安装行为，可能让所有下游安装失败或漏装文件。布局决策见 `repository/decisions/0002`。
- 修改 `package.json` 的 `files`（L12-16）、`bin`（L6-8）、`scripts`（L9-11）、`engines`（L17-19）任一字段 → **STOP，必须人工 review**：影响发布产物范围与可执行入口。
- 执行 `npm publish` 或改 `version`（package.json L3）→ **STOP，必须人工确认**：发布不可逆；发布前先运行 `npm pack --dry-run` 核对产物清单（`README.md` + `scripts/install-skills.js` + `src/skills/` 全部文件）无缺失。
- 删除 `src/skills/` 下任何文件或 skill 子目录 → **STOP，必须人工确认**：减少发布产物内容，影响下游。
- 在非 git 仓库下做大批量文件移动/删除 → **STOP，必须人工确认**：无 git 兜底回滚。

> 如需把以上高风险操作升级为模型无法绕过的硬门禁，可配置 Claude Code PreToolUse Hooks（settings.json）。非功能性委派类软约束不入 Hook。本仓库当前未配 Hook，以上仅为会话注入软约束。

## 禁止的自我合理化（MUST NOT）

- 不得以"只改了 skill 文档一个字"为由跳过实跑 `install-skills.js` 验证复制结果。
- 不得以"路径看起来对"代替实际运行验证——改 install 行为后必须实跑确认输出 `Installed N skills to ...`。
- 不得以"install 命令以前能跑"假设改源目录后仍可用——必须重新实跑验证。
- 不得在 `npm pack --dry-run` 未核对产物清单的情况下执行 `npm publish`。
- 不得以"本项目无测试所以不用验证"为由跳过 Before Finishing 的实跑检查。
- 不得以"install-skills 源目录只是改回 skills/"为由自行改 install-skills.js L8——源目录已对齐 `src/skills`（见 `repository/decisions/0002`），任何反向改动属 Dangerous Operations 需人工确认。

## Context Management（推荐章节）

- 探索三个 skill 的 `references/` 内容只为得结论 → 委派 subagent，主上下文只收结论 + `文件:行`；references 正文是产品内容，较长，不收原文。
- 本仓库非 git、非 OpenSpec 管理项目（无 `tasks.md`/`verify.md`/`openspec/`，证据：`.gitignore` 忽略 `openspec/`，磁盘无该目录），压缩/清空前把进度以文字落盘或写临时记录，不依赖 `tasks.md` 落盘。
- 切换 skill 主题（plan→register→track）且旧上下文已重 → 可 `/clear` 开新会话，避免旧上下文污染。
- 压缩/清空前必须确认本次产出的文件已落盘；缺失则视为未完成，先补再压缩。
- 委派的 subagent 只回依据（`文件:行` / 命令+摘要+时间戳），不持 task lifecycle / checkoff / STOP 裁决（决策留在主上下文）。

## Notes for Claude Code

- 在本仓库工作时，你在**编辑技能工厂**，不是在运行 slice 流水线。`src/skills/` 下的三个 skill 是面向**目标项目**的产品，除非用户明确要求，不要在本仓库内调用 `openspec-slices-*` 流程。
- 本仓库自身不被 OpenSpec 管理（无 `openspec/` 目录，`.gitignore` 忽略之）。
- 本仓库当前非 git 仓库（已验证）；不要假设可用 `git diff`/`git status`/`git commit` 回滚，改用 `ls -laR` 对照文件范围。

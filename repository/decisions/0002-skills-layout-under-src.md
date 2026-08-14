# ADR-0002：skill 布局位于 src/skills/

- 状态：Accepted
- 日期：2026-08-14（修复对齐于同日）

## 背景

磁盘实际布局：skill 位于 `src/skills/openspec-slices-{plan,register,track}/`（每个含 `SKILL.md` + `references/*.md`，已验证）。

修复前存在不一致：`install-skills.js` L8 曾令 `sourceRoot = path.join(repoRoot, 'skills')`、`package.json` `files` 也列 `"skills"`，二者都引用顶层 `skills/`，而该目录不存在，导致 `npm run install-skills` 失败（install-skills.js L108-109 抛 `Skills source directory not found`，L139 exit 1）。

## 规范意图

skill 的权威布局为 `src/skills/`——与 `src/` 工程目录约定一致（源码根 `src/`、工厂脚本 `scripts/` 分离）。

## 已执行的修复（方案 a）

install 脚本与发布清单已对齐 `src/skills/`：

- `install-skills.js` L8 改为 `sourceRoot = path.join(repoRoot, 'src', 'skills')`。
- `package.json` `files` 改为 `src/skills`。

最小改动，保留 ADR-0001 的无构建原则。曾考虑的另两条：(b) 把 `src/skills/` 移到顶层 `skills/`——破坏本 ADR 规范意图；(c) 加 preinstall/构建步骤同步——与 ADR-0001 冲突。均不采用。

## 验证

`node scripts/install-skills.js --target /tmp/skills-verify` 输出 `Installed 3 skills to /tmp/skills-verify`，exit 0，三个 skill 目录正确复制，`.DS_Store` 被跳过。详见 `../integrations.md`「已修复问题 1」。

## 避免

- 在本 ADR 内记录 skill 内容设计决策（技能流程设计留在 `src/skills/` 各 SKILL.md）。
- 写 git 依赖动作（本仓库非 git）。

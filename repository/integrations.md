# npm 包发布与安装契约

> 本文件记录 `opsx-change-slice-manager` 作为可分发 npm 包的契约与已知不一致，不含 skill 内容。

## 包元数据

证据：`package.json`。

| 字段 | 值 | 行号 |
|---|---|---|
| name | `opsx-change-slice-manager` | package.json L2 |
| version | `0.1.0` | package.json L3 |
| description | Install this repository's Claude Code skills into a target .claude/skills directory. | package.json L4 |
| license | UNLICENSED | package.json L5 |
| engines.node | `>=18` | package.json L17-19 |
| 零运行时依赖 | 无 `dependencies`/`devDependencies` 字段 | package.json |

## 可执行入口

- `bin.install-claude-skills` → `scripts/install-skills.js`（package.json L6-8）
- `scripts.install-skills` → `node scripts/install-skills.js`（package.json L9-10），**仅此一条 script**

## 发布模式：源码即产物

- 无构建步骤（package.json L9-11 无 build/prepare 脚本）。
- 发布清单 `files`（package.json L12-16）声明发布 `["README.md","scripts/install-skills.js","src/skills"]`——即发布物是源文件本身，无编译/打包中间产物。
- 决策依据见 `decisions/0001-source-is-artifact-no-build.md`。

## 安装行为契约

证据：`scripts/install-skills.js`。

- 入口：`scripts/install-skills.js`（L1 shebang；L3-5 仅用 fs/path/os 内置模块）。
- 源目录解析：`repoRoot = path.resolve(__dirname, '..')`（L7），`sourceRoot = path.join(repoRoot, 'src', 'skills')`（L8）——指向仓库根 `src/skills/`。
- 目标路径解析（`resolveTargetDirectory` L62-72）：
  - `--target <path>` → `path.resolve(target)`（L63-64）
  - `--global` → `~/.claude/skills`（L67-68）
  - 默认 → `当前工作目录/.claude/skills`（L71）
  - `--global` 与 `--target` 互斥，同传抛错（L55-57）
- 参数校验：未知参数抛 `Unknown argument`（L52）；`--target` 缺值抛 `Missing value for --target`（L44-46）；`--help`/`-h` 显示用法（L32-34）。
- 复制行为：递归复制每个源 skill 子目录（L82-105、L119-133），跳过名为 `.DS_Store` 的条目（`shouldSkip` L74-76），不跳过其他点文件。
- 输出：成功打印 `Installed N skills to <target>`（L132）；失败 `console.error(error.message)` + exit 1（L135-140）。

## 已修复问题

### 1. 源目录不一致：已修复（方案 a）

- **原现象**：install-skills.js L8 令 `sourceRoot = path.join(repoRoot, 'skills')`，package.json L15 的 `files` 也列 `skills`，但实际技能源文件在 `src/skills/`，磁盘上不存在顶层 `skills/` 目录 → `npm run install-skills` 抛 `Skills source directory not found` 并退出码 1。
- **修复（2026-08-14，方案 a）**：install-skills.js L8 改为 `path.join(repoRoot, 'src', 'skills')`；package.json L15 的 `files` 改为 `src/skills`。保留 ADR-0001 无构建原则。
- **验证**：`node scripts/install-skills.js --target /tmp/skills-verify` 输出 `Installed 3 skills to /tmp/skills-verify`，exit 0，三个 skill 目录正确复制，`.DS_Store` 被跳过（shouldSkip L74-76）。

### 2. README.md 缺失：已补建

- **原现象**：package.json L13 的 `files` 声明发布 `README.md`，但仓库根目录无该文件 → `npm publish` 会生成缺 README 的发布物。
- **修复（2026-08-14）**：补建仓库根 `README.md`（人类上手说明，不含 Claude 专用规则——那是 `CLAUDE.md` 职责）。
- **验证**：`npm pack --dry-run` 产物清单含 `README.md`（2.7kB）+ `scripts/install-skills.js` + `src/skills/` 全部 9 文件，共 12 文件，无缺失 warning。

## 仓库状态

### 非 git 仓库

- **事实**：本仓库无 `.git`（已验证），非 git 仓库。
- **影响**：`.gitignore`（`.DS_Store` / `.claude/` / `openspec/`）不生效；`.npmignore`（`**/.DS_Store`）在 `npm publish` 时仍生效（npm 打包用 `.npmignore`）。
- **措辞约束**：本知识库不写"提交后""分支""PR"等 git 依赖动作；commit hook 类委派标注"本项目无 VCS，无 commit hook 可委派"。

## 应避免

- 记录私密凭据、npm token、私有 registry 地址。
- 捏造未确认的修法结论（应为待确认项）。
- 复制 skill 执行逻辑或技能内部引用结构（进 `modules.md` 也只写边界）。

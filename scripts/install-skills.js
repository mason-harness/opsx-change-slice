#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const repoRoot = path.resolve(__dirname, '..');
const sourceRoot = path.join(repoRoot, 'src', 'skills');

function printHelp() {
  console.log(`Usage: install-claude-skills [--global | --target <path>]

Copies skills from this package into a target directory.

Options:
  --global         Install into ~/.claude/skills
  --target <path>  Install into a custom directory
  --help           Show this help message

Default target:
  ./.claude/skills relative to the current working directory
`);
}

function parseArgs(argv) {
  let useGlobal = false;
  let target = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--global') {
      useGlobal = true;
      continue;
    }

    if (arg === '--target') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('Missing value for --target');
      }
      target = next;
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (useGlobal && target) {
    throw new Error('Cannot use --global and --target together');
  }

  return { useGlobal, target };
}

function resolveTargetDirectory(options) {
  if (options.target) {
    return path.resolve(options.target);
  }

  if (options.useGlobal) {
    return path.join(os.homedir(), '.claude', 'skills');
  }

  return path.resolve(process.cwd(), '.claude', 'skills');
}

function shouldSkip(name) {
  return name === '.DS_Store';
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function copyDirectory(sourceDir, targetDir) {
  ensureDirectory(targetDir);

  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldSkip(entry.name)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile()) {
      ensureDirectory(path.dirname(targetPath));
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function listSkillDirectories() {
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Skills source directory not found: ${sourceRoot}`);
  }

  return fs
    .readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !shouldSkip(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const targetRoot = resolveTargetDirectory(options);
  const skills = listSkillDirectories();

  ensureDirectory(targetRoot);

  for (const skillName of skills) {
    const sourcePath = path.join(sourceRoot, skillName);
    const targetPath = path.join(targetRoot, skillName);
    copyDirectory(sourcePath, targetPath);
  }

  console.log(`Installed ${skills.length} skills to ${targetRoot}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

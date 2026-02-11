#!/usr/bin/env node

/**
 * Create JARVIS Plugin CLI
 * 
 * Scaffold new JARVIS plugins with one command:
 *   npx create-jarvis-plugin my-plugin
 */

import { program } from 'commander';
import inquirer from 'inquirer';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_DIR = path.join(__dirname, '..', '..', '..', 'templates');

const TEMPLATES = {
  'command': {
    name: 'Command Plugin',
    description: 'Voice command handler with natural language processing',
    permissions: ['system:notification', 'audio:output'],
  },
  'service': {
    name: 'Service Plugin',
    description: 'Background service with memory and scheduling',
    permissions: ['memory:read', 'memory:write', 'system:notification'],
  },
  'ui': {
    name: 'UI Plugin',
    description: 'React-based UI panel plugin',
    permissions: ['ui:panel', 'memory:read'],
  },
};

async function createPlugin(name, options) {
  const targetDir = path.resolve(process.cwd(), name);
  
  // Check if directory exists
  if (await fs.pathExists(targetDir)) {
    console.log(chalk.red(`❌ Directory "${name}" already exists`));
    process.exit(1);
  }
  
  // Get template
  let template = options.template;
  if (!template) {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'template',
        message: 'Choose a template:',
        choices: Object.entries(TEMPLATES).map(([key, t]) => ({
          name: `${t.name} - ${t.description}`,
          value: key,
        })),
      },
    ]);
    template = answers.template;
  }
  
  // Get plugin details
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'id',
      message: 'Plugin ID (e.g., my.awesome.plugin):',
      default: name.toLowerCase().replace(/\s+/g, '.'),
      validate: (input) => /^[a-z0-9][a-z0-9.-]*$/.test(input) || 'Invalid plugin ID format',
    },
    {
      type: 'input',
      name: 'description',
      message: 'Description:',
      default: `A JARVIS plugin`,
    },
    {
      type: 'input',
      name: 'author',
      message: 'Author:',
      default: process.env.USER || 'Anonymous',
    },
    {
      type: 'input',
      name: 'version',
      message: 'Version:',
      default: '1.0.0',
    },
  ]);
  
  console.log(chalk.blue('\n📦 Creating plugin...\n'));
  
  // Copy template
  const templateDir = path.join(TEMPLATES_DIR, `${template}-plugin`);
  await fs.copy(templateDir, targetDir);
  
  // Update package.json
  const pkgPath = path.join(targetDir, 'package.json');
  const pkg = await fs.readJson(pkgPath);
  pkg.name = name;
  pkg.description = answers.description;
  pkg.author = answers.author;
  pkg.version = answers.version;
  await fs.writeJson(pkgPath, pkg, { spaces: 2 });
  
  // Update manifest
  const manifestPath = path.join(targetDir, 'manifest.json');
  const manifest = await fs.readJson(manifestPath);
  manifest.id = answers.id;
  manifest.name = name;
  manifest.description = answers.description;
  manifest.author = answers.author;
  manifest.version = answers.version;
  await fs.writeJson(manifestPath, manifest, { spaces: 2 });
  
  // Update plugin.ts
  const pluginPath = path.join(targetDir, 'src', 'plugin.ts');
  if (await fs.pathExists(pluginPath)) {
    let pluginCode = await fs.readFile(pluginPath, 'utf-8');
    pluginCode = pluginCode.replace(/__PLUGIN_ID__/g, answers.id);
    pluginCode = pluginCode.replace(/__PLUGIN_NAME__/g, name);
    pluginCode = pluginCode.replace(/__PLUGIN_DESCRIPTION__/g, answers.description);
    await fs.writeFile(pluginPath, pluginCode);
  }
  
  console.log(chalk.green('✅ Plugin created successfully!\n'));
  console.log(chalk.white('Next steps:'));
  console.log(chalk.gray(`  cd ${name}`));
  console.log(chalk.gray('  npm install'));
  console.log(chalk.gray('  npm run dev'));
  console.log(chalk.gray('\nOr in JARVIS:'));
  console.log(chalk.gray(`  Install from: ${targetDir}`));
  console.log();
}

program
  .name('create-jarvis-plugin')
  .description('CLI to scaffold JARVIS plugins')
  .version('1.0.0')
  .argument('[name]', 'Plugin name')
  .option('-t, --template <type>', 'Template type (command|service|ui)')
  .action(async (name, options) => {
    if (!name) {
      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Plugin name:',
          validate: (input) => input.length > 0 || 'Name is required',
        },
      ]);
      name = answers.name;
    }
    await createPlugin(name, options);
  });

program.parse();

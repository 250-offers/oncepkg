#!/usr/bin/env node

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { program } = require("commander");
const os = require("os");

const GLOBAL_PACKAGE_FILE = path.join(__dirname, "installed_packages.json");
const ENV_VARIABLE_NAME = "GLOBAL_PACKAGES";
const PROJECT_DIRS = ["~/Projects", "~/workspace", "~/code", "~/dev"].map(p => path.resolve(os.homedir(), p));
const APP_TEMPLATES = {
    mern: ["express", "mongoose", "react", "redux", "cors", "dotenv"],
    mean: ["express", "mongoose", "angular", "cors", "dotenv"]
};

// Ensure global packages are tracked in an environment variable
function updateEnvVariable() {
    if (fs.existsSync(GLOBAL_PACKAGE_FILE)) {
        const installedPackages = JSON.parse(fs.readFileSync(GLOBAL_PACKAGE_FILE, "utf8"));
        process.env[ENV_VARIABLE_NAME] = JSON.stringify(installedPackages);
    }
}

function ensurePackage(packageName) {
    let installedPackages = {};
    if (fs.existsSync(GLOBAL_PACKAGE_FILE)) {
        installedPackages = JSON.parse(fs.readFileSync(GLOBAL_PACKAGE_FILE, "utf8"));
    }
    
    if (installedPackages[packageName]) {
        console.log(`✅ ${packageName} is already installed globally at version ${installedPackages[packageName]}.`);
        return;
    }
    
    console.log(`📦 Installing ${packageName} globally...`);
    try {
        execSync(`npm install -g ${packageName}`, { stdio: "inherit" });
        execSync(`npm link -g ${packageName}`, { stdio: "inherit" });
        updatePackageList();
        console.log(`✅ ${packageName} installed and linked globally.`);
    } catch (error) {
        console.error(`❌ Failed to install ${packageName}:`, error.message);
    }
}

function updatePackageList() {
    try {
        const packageData = execSync("npm list -g --depth=0 --json");
        const globalPackages = JSON.parse(packageData).dependencies || {};
        const packageList = Object.fromEntries(
            Object.entries(globalPackages).map(([pkg, details]) => [pkg, details.version])
        );
        fs.writeFileSync(GLOBAL_PACKAGE_FILE, JSON.stringify(packageList, null, 2));
        updateEnvVariable();
    } catch (error) {
        console.error("❌ Failed to update package list:", error.message);
    }
}

function watchNpmCommands() {
    console.log("👀 Watching npm commands for package installations...");
    const npmLogFile = path.join(os.homedir(), ".npm/_logs/latest.log");
    
    fs.watch(npmLogFile, (eventType, filename) => {
        if (eventType === "change") {
            console.log("🔄 Detected npm command execution. Updating package list...");
            updatePackageList();
        }
    });
}

function linkGlobalPackage(packageName, projectPath) {
    try {
        execSync(`npm link ${packageName}`, { cwd: projectPath, stdio: "inherit" });
        console.log(`🔗 Linked ${packageName} to ${projectPath}`);
    } catch (error) {
        console.error(`❌ Failed to link ${packageName}:`, error.message);
    }
}

function createProjectStructure(stack, scriptType) {
    const projectDir = path.join(process.cwd(), `${stack}-app`);
    if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
    }
    
    console.log(`📂 Creating ${stack.toUpperCase()} project structure in ${projectDir}...`);
    
    const folders = ["src", "routes", "models", "controllers", "config"];
    folders.forEach(folder => {
        const dirPath = path.join(projectDir, folder);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    });
    
    fs.writeFileSync(
        path.join(projectDir, `src/index.${scriptType}`), 
        `console.log("Welcome to your ${stack.toUpperCase()} application!");`
    );
    
    fs.writeFileSync(
        path.join(projectDir, "package.json"), 
        JSON.stringify({ name: `${stack}-app`, version: "1.0.0", main: `src/index.${scriptType}` }, null, 2)
    );
    
    if (stack in APP_TEMPLATES) {
        console.log("📦 Installing dependencies...");
        execSync(`npm init -y`, { cwd: projectDir, stdio: "inherit" });
        execSync(`npm install ${APP_TEMPLATES[stack].join(" ")}`, { cwd: projectDir, stdio: "inherit" });
    }
    
    Object.keys(APP_TEMPLATES[stack]).forEach(pkg => linkGlobalPackage(pkg, projectDir));
    console.log(`✅ ${stack.toUpperCase()} project setup complete.`);
}

// CLI setup with commander
program
    .version("1.0.0")
    .description("Global Package Installer")
    .argument("[packageName]", "Package to install globally")
    .option("-l, --list", "List all globally installed packages")
    .option("-s, --scan", "Scan old projects for missing packages and install globally")
    .option("-t, --template <stack>", "Create a project template (mern/mean)")
    .option("--js", "Use JavaScript for the project (default)")
    .option("--ts", "Use TypeScript for the project")
    .action((packageName, options) => {
        if (options.list) {
            listInstalledPackages();
        } else if (options.scan) {
            scanOldProjects();
        } else if (options.template) {
            const scriptType = options.ts ? "ts" : "js";
            createProjectStructure(options.template, scriptType);
        } else if (packageName) {
            checkSimilarPackage(packageName);
        } else {
            console.log("Usage: gpm <package-name> OR gpm --list OR gpm --scan OR gpm --template <mern/mean> --js/--ts");
        }
        watchNpmCommands();
    });

program.parse(process.argv);

module.exports = { checkSimilarPackage, listInstalledPackages, updatePackageList, watchNpmCommands, scanOldProjects, createProjectStructure, linkGlobalPackage };

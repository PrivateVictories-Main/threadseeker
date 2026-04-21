// Level 1 integration actions — per-source install/clone commands.
// Users can copy these directly into their terminal or workflow.
// Foundation for future Level 2+ (MCP add, IDE integration, CLI companion).

import type { UnifiedProject, SourceType } from "./sources";

export type ActionKind =
  | "install"
  | "clone"
  | "pull"
  | "snippet"
  | "visit";

export interface ProjectAction {
  kind: ActionKind;
  label: string;
  command: string;
  description?: string;
}

export function getProjectActions(project: UnifiedProject): ProjectAction[] {
  const actions: ProjectAction[] = [];

  switch (project.source) {
    case "github": {
      actions.push({
        kind: "clone",
        label: "git clone",
        command: `git clone https://github.com/${project.fullName}.git`,
      });
      actions.push({
        kind: "install",
        label: "gh repo clone",
        command: `gh repo clone ${project.fullName}`,
      });
      if (looksLikeMCPServer(project)) {
        // Plausible MCP server. Drop a ready-to-paste Claude Desktop
        // config entry — the exact command is a best guess (many repos
        // expose an `npx` or `uvx` entry), so we comment it clearly.
        const key = project.name.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
        const snippet = [
          `// Add to ~/Library/Application Support/Claude/claude_desktop_config.json`,
          `// under "mcpServers". Verify the command against the repo's README.`,
          `"${key}": {`,
          `  "command": "npx",`,
          `  "args": ["-y", "${project.fullName}"]`,
          `}`,
        ].join("\n");
        actions.push({
          kind: "snippet",
          label: "MCP config",
          command: snippet,
          description: "Add to Claude Desktop's MCP servers",
        });
      }
      break;
    }
    case "gitlab": {
      actions.push({
        kind: "clone",
        label: "git clone",
        command: `git clone https://gitlab.com/${project.fullName}.git`,
      });
      break;
    }
    case "codeberg": {
      actions.push({
        kind: "clone",
        label: "git clone",
        command: `git clone https://codeberg.org/${project.fullName}.git`,
      });
      break;
    }
    case "npm": {
      actions.push({
        kind: "install",
        label: "npm",
        command: `npm install ${project.name}`,
      });
      actions.push({
        kind: "install",
        label: "pnpm",
        command: `pnpm add ${project.name}`,
      });
      actions.push({
        kind: "install",
        label: "yarn",
        command: `yarn add ${project.name}`,
      });
      actions.push({
        kind: "install",
        label: "bun",
        command: `bun add ${project.name}`,
      });
      break;
    }
    case "pypi": {
      actions.push({
        kind: "install",
        label: "pip",
        command: `pip install ${project.name}`,
      });
      actions.push({
        kind: "install",
        label: "uv",
        command: `uv add ${project.name}`,
      });
      actions.push({
        kind: "install",
        label: "poetry",
        command: `poetry add ${project.name}`,
      });
      break;
    }
    case "crates": {
      actions.push({
        kind: "install",
        label: "cargo",
        command: `cargo add ${project.name}`,
      });
      actions.push({
        kind: "snippet",
        label: "Cargo.toml",
        command: `${project.name} = "*"`,
        description: "Add under [dependencies]",
      });
      break;
    }
    case "packagist": {
      actions.push({
        kind: "install",
        label: "composer",
        command: `composer require ${project.fullName}`,
      });
      break;
    }
    case "rubygems": {
      actions.push({
        kind: "install",
        label: "gem",
        command: `gem install ${project.name}`,
      });
      actions.push({
        kind: "snippet",
        label: "Gemfile",
        command: `gem "${project.name}"`,
        description: "Add to your Gemfile",
      });
      break;
    }
    case "huggingface": {
      actions.push({
        kind: "snippet",
        label: "transformers",
        command: `from transformers import AutoModel, AutoTokenizer\nmodel = AutoModel.from_pretrained("${project.fullName}")\ntokenizer = AutoTokenizer.from_pretrained("${project.fullName}")`,
        description: "Load model with HF transformers",
      });
      actions.push({
        kind: "install",
        label: "huggingface-cli",
        command: `huggingface-cli download ${project.fullName}`,
      });
      actions.push({
        kind: "clone",
        label: "git lfs clone",
        command: `git lfs clone https://huggingface.co/${project.fullName}`,
      });
      break;
    }
    case "hackernews":
    case "reddit":
    case "lobsters":
    case "stackoverflow": {
      actions.push({
        kind: "visit",
        label: "Open thread",
        command: project.url,
      });
      break;
    }
    case "dockerhub": {
      actions.push({
        kind: "pull",
        label: "docker pull",
        command: `docker pull ${project.fullName}`,
      });
      actions.push({
        kind: "snippet",
        label: "compose",
        command: `services:\n  ${project.name}:\n    image: ${project.fullName}`,
        description: "docker-compose.yml snippet",
      });
      break;
    }
    case "jsr": {
      actions.push({
        kind: "install",
        label: "deno",
        command: `deno add jsr:${project.fullName}`,
      });
      actions.push({
        kind: "install",
        label: "npx jsr",
        command: `npx jsr add ${project.fullName}`,
      });
      actions.push({
        kind: "install",
        label: "bunx jsr",
        command: `bunx jsr add ${project.fullName}`,
      });
      break;
    }
    case "flathub": {
      actions.push({
        kind: "install",
        label: "flatpak",
        command: `flatpak install flathub ${project.fullName}`,
      });
      actions.push({
        kind: "install",
        label: "run",
        command: `flatpak run ${project.fullName}`,
      });
      break;
    }
    case "devto":
    case "paperswithcode":
    case "arxiv": {
      actions.push({
        kind: "visit",
        label: "Open",
        command: project.url,
      });
      break;
    }
    case "homebrew": {
      const kind = project.topics.includes("cask") ? "--cask" : "";
      actions.push({
        kind: "install",
        label: "brew install",
        command: `brew install ${kind ? kind + " " : ""}${project.fullName}`.trim(),
      });
      actions.push({
        kind: "install",
        label: "upgrade",
        command: `brew upgrade ${project.fullName}`,
      });
      break;
    }
    case "fdroid": {
      actions.push({
        kind: "visit",
        label: "Open on F-Droid",
        command: project.url,
      });
      actions.push({
        kind: "snippet",
        label: "package id",
        command: project.fullName,
        description: "Use with F-Droid client or aurora store",
      });
      break;
    }
    case "aur": {
      actions.push({
        kind: "install",
        label: "yay",
        command: `yay -S ${project.name}`,
      });
      actions.push({
        kind: "install",
        label: "paru",
        command: `paru -S ${project.name}`,
      });
      actions.push({
        kind: "clone",
        label: "git clone",
        command: `git clone https://aur.archlinux.org/${project.name}.git`,
      });
      break;
    }
    case "openvsx": {
      actions.push({
        kind: "install",
        label: "code",
        command: `code --install-extension ${project.fullName.replace("/", ".")}`,
      });
      actions.push({
        kind: "install",
        label: "codium",
        command: `codium --install-extension ${project.fullName.replace("/", ".")}`,
      });
      break;
    }
    case "conda": {
      actions.push({
        kind: "install",
        label: "conda",
        command: `conda install -c conda-forge ${project.name}`,
      });
      actions.push({
        kind: "install",
        label: "mamba",
        command: `mamba install -c conda-forge ${project.name}`,
      });
      break;
    }
    case "nuget": {
      actions.push({
        kind: "install",
        label: "dotnet",
        command: `dotnet add package ${project.name}`,
      });
      actions.push({
        kind: "install",
        label: "Package Manager",
        command: `Install-Package ${project.name}`,
      });
      actions.push({
        kind: "snippet",
        label: "csproj",
        command: `<PackageReference Include="${project.name}" Version="*" />`,
        description: "Add inside <ItemGroup>",
      });
      break;
    }
    case "wordpress": {
      actions.push({
        kind: "install",
        label: "wp-cli",
        command: `wp plugin install ${project.name} --activate`,
      });
      actions.push({
        kind: "install",
        label: "composer",
        command: `composer require wpackagist-plugin/${project.name}`,
        description: "Requires wpackagist.org in repositories",
      });
      break;
    }
    case "maven": {
      // project.fullName is "group:artifact" (e.g. "com.fasterxml.jackson.core:jackson-core").
      const [group, artifact] = project.fullName.split(":");
      const version = project.version?.trim() || "LATEST";
      if (group && artifact) {
        actions.push({
          kind: "snippet",
          label: "Gradle (Kotlin)",
          command: `implementation("${group}:${artifact}:${version}")`,
          description: "Add to build.gradle.kts dependencies { }",
        });
        actions.push({
          kind: "snippet",
          label: "Gradle (Groovy)",
          command: `implementation '${group}:${artifact}:${version}'`,
          description: "Add to build.gradle dependencies { }",
        });
        actions.push({
          kind: "snippet",
          label: "Maven",
          command: `<dependency>\n  <groupId>${group}</groupId>\n  <artifactId>${artifact}</artifactId>\n  <version>${version}</version>\n</dependency>`,
          description: "Add inside <dependencies>",
        });
        actions.push({
          kind: "snippet",
          label: "sbt",
          command: `libraryDependencies += "${group}" % "${artifact}" % "${version}"`,
          description: "Add to build.sbt",
        });
      }
      break;
    }
    case "zenodo": {
      // Zenodo records are research artifacts, not packages. Best we can
      // do is hand the user the DOI — it's the canonical, citable link
      // and resolves anywhere.
      if (project.fullName && project.fullName !== `zenodo:${project.id}`) {
        actions.push({
          kind: "snippet",
          label: "DOI",
          command: project.fullName,
          description: "Cite this record by its DOI",
        });
      }
      break;
    }
  }

  actions.push({
    kind: "visit",
    label: "Open on " + project.source,
    command: project.url,
  });

  return actions;
}

// Return the single best "primary" action for compact UI surfaces.
export function getPrimaryAction(project: UnifiedProject): ProjectAction {
  const actions = getProjectActions(project);
  const installOrClone = actions.find(
    (a) => a.kind === "install" || a.kind === "clone"
  );
  return installOrClone || actions[0];
}

// Detect whether a GitHub repo looks like an MCP server (for future Level 2).
// Heuristic: topic includes "mcp" or name contains "mcp".
export function looksLikeMCPServer(project: UnifiedProject): boolean {
  if (project.source !== "github") return false;
  const haystack = [
    project.name,
    project.fullName,
    ...(project.topics || []),
    project.description || "",
  ]
    .join(" ")
    .toLowerCase();
  return /\bmcp\b/.test(haystack) || haystack.includes("model context protocol");
}

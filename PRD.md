# Product Requirements Document (PRD)
## Project Title: Project Manager MCP

**Version:** 1.0

**Date:** April 5, 2025

**Author:** [Your Name or Team]

## 1. Overview
"Project Manager MCP" is a system designed to integrate an MCP server with popular task management platforms—JIRA, GitLab, and GitHub. The primary use case is to persist tasks across Claude chat sessions, mirroring the functionality of the Claude Task Master project, but using JIRA, GitLab, or GitHub as the backend instead of a local tasks.json file. Users can choose their preferred platform for task management, and the system will provide seamless integration with Claude for AI-driven workflows.

## 2. Goals and Objectives
**Primary Goal:** Build a flexible task management system that integrates with JIRA, GitLab, and GitHub, persisting tasks across Claude chat sessions.

**Objectives:**
- Enable users to select JIRA, GitLab, or GitHub as the task management backend.
- Persist tasks on the chosen platform, retrievable in future Claude sessions.
- Provide a CLI tool for direct and AI-assisted task management.
- Ensure modularity and scalability for future platform integrations.

## 3. Key Features

### 3.1 MCP Server
The MCP server bridges Claude and the selected task management platform, exposing tools for task management.

- **Protocol:** Implements the MCP protocol, processing JSON requests via stdin and responding via stdout.
- **Tools:**
  - `create_issue`: Creates a new issue on the chosen platform.
  - `update_issue`: Updates an existing issue.
  - `search_issues`: Searches for issues using platform-specific queries.
- **Authentication:** Supports secure authentication for each platform using API tokens or personal access tokens.
- **Operation:** Runs as a background service, listening for Claude requests.

### 3.2 CLI Tool
The CLI tool allows developers to manage tasks directly or via AI-driven commands.

- **Direct Commands:**
  - `list`: Lists all issues in a project or repository.
- **AI-Driven Commands:**
  - `parse-prd <file>`: Parses a PRD file and uses Claude to create issues on the selected platform.
  - `expand <issueKey>`: Generates subtasks or related issues for a given issue using Claude.
- **Platform Selection:** Supports choosing the platform (JIRA, GitLab, or GitHub) via configuration or flags (e.g., `--platform jira`).
- **Integration:** For AI-driven commands, the CLI interacts with Claude, which uses the MCP server to manage tasks.

### 3.3 Shared Client Modules
Shared modules handle API interactions for each platform, ensuring consistency across the MCP server and CLI tool.

- **JIRA Client:** Manages JIRA issue creation, updates, and searches.
- **GitLab Client:** Manages GitLab issue operations.
- **GitHub Client:** Manages GitHub issue operations.

## 4. Technical Requirements

### 4.1 Environment
- **Node.js:** Version 14.0.0 or higher.
- **Dependencies:**
  - `jira-client`: For JIRA integration.
  - `gitlab`: For GitLab integration.
  - `@octokit/rest`: For GitHub integration.
  - `@anthropic-ai/sdk`: For Claude communication.
  - `commander`: For CLI development.
  - `dotenv`: For environment variable management.
- **Environment Variables:**
  - `JIRA_URL`, `JIRA_TOKEN`: JIRA credentials.
  - `GITLAB_URL`, `GITLAB_TOKEN`: GitLab credentials.
  - `GITHUB_TOKEN`: GitHub personal access token.
  - `ANTHROPIC_API_KEY`: Claude API key.

### 4.2 Project Structure
```
project-manager-mcp/
  lib/
    jira-client.js
    gitlab-client.js
    github-client.js
  mcp-server/
    index.js
  cli/
    index.js
  package.json
  .env
```

## 5. Development Phases
The project is divided into three phases, each adding functionality and integrations incrementally.

### Phase 1: Basic Integration with JIRA
**Objective:** Establish core functionality with JIRA as the initial task management platform.

**Features:**
- **MCP Server:**
  - Tools: `create_issue`, `update_issue`, `search_issues` for JIRA.
  - Authentication via JIRA API tokens.
- **CLI Tool:**
  - Commands: `list`, `parse-prd`, `expand`.
  - `parse-prd` parses a PRD file and creates JIRA issues via Claude.
  - `expand` generates JIRA subtasks using Claude.
- **Shared JIRA Client:**
  - Functions for JIRA issue management.

**Deliverables:**
- Functional MCP server for JIRA.
- CLI tool with basic JIRA commands.
- Setup and usage documentation.

### Phase 2: Add Support for GitLab
**Objective:** Extend the system to support GitLab, enabling multi-platform functionality.

**Features:**
- **MCP Server:**
  - Tools for GitLab issues (`create_issue`, `update_issue`, `search_issues`).
  - Authentication via GitLab personal access tokens.
- **CLI Tool:**
  - Update commands to support GitLab.
  - Add platform selection (e.g., `--platform gitlab` or config file).
- **Shared GitLab Client:**
  - Functions for GitLab issue management.

**Deliverables:**
- MCP server supporting JIRA and GitLab.
- CLI tool with platform selection.
- Updated documentation.

### Phase 3: Integrate with GitHub and Enhance Features
**Objective:** Complete integrations with GitHub and introduce advanced features.

**Features:**
- **MCP Server:**
  - Tools for GitHub issues (`create_issue`, `update_issue`, `search_issues`).
  - Authentication via GitHub personal access tokens.
- **CLI Tool:**
  - Update commands to support GitHub.
  - Add commands: `update` (modify issues), `analyze-complexity` (AI-driven complexity estimation).
- **Shared GitHub Client:**
  - Functions for GitHub issue management.
- **Enhanced Features:**
  - Task dependencies and priorities.
  - AI-driven task prioritization.
  - Complexity analysis for tasks.

**Deliverables:**
- MCP server supporting JIRA, GitLab, and GitHub.
- Enhanced CLI tool with advanced features.
- Comprehensive documentation and examples.

## 6. User Workflow

### 6.1 Setup
- Install dependencies:
  ```bash
  npm install
  ```
- Configure `.env` with platform credentials and Claude API key.
- Start the MCP server:
  ```bash
  node mcp-server/index.js
  ```

### 6.2 Using the CLI
- **Select Platform:** Use `--platform <name>` or a config file.
- **Direct Commands:**
  - List issues:
    ```bash
    node cli/index.js list --platform jira
    ```
- **AI-Driven Commands:**
  - Parse a PRD:
    ```bash
    node cli/index.js parse-prd prd.txt --platform jira
    ```
  - Expand an issue:
    ```bash
    node cli/index.js expand ISSUE-123 --platform jira
    ```

## 7. Security Considerations
- **Credentials:** Store API keys and tokens in `.env`, never hardcode.
- **Error Handling:** Prevent sensitive data leaks in error messages.
- **Access Control:** Restrict MCP server requests to authorized sources (e.g., localhost or Claude).

## 8. Edge Cases and Error Handling
- **Platform Differences:** Handle variations (e.g., JIRA subtasks vs. GitLab/GitHub related issues).
- **Rate Limits:** Implement retry logic for API rate limits.
- **Conflicts:** Manage concurrent task updates gracefully.

## 9. Future Enhancements
- Add support for Trello, Asana, or other platforms.
- Introduce NLP for natural language task creation.
- Develop a web interface for task management.

## 10. Implementation Notes
- **Modularity:** Keep platform clients independent for easy expansion.
- **Testing:** Write unit tests for each client and the MCP server.
- **Configuration:** Use a config file or flags for platform selection.

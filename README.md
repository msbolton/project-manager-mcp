# Project Manager MCP

An MCP server that integrates with JIRA, GitLab, and GitHub for task management across Claude chat sessions.

## Overview

Project Manager MCP is a system designed to integrate an MCP server with popular task management platforms—JIRA, GitLab, and GitHub. The primary use case is to persist tasks across Claude chat sessions, mirroring the functionality of the Claude Task Master project, but using JIRA, GitLab, or GitHub as the backend instead of a local tasks.json file.

## Project Structure

```
project-manager-mcp/
  lib/              # Shared client libraries
    jira-client.js  # JIRA API client
  mcp-server/       # MCP server implementation
    index.js        # Main server file
  cli/              # Command-line interface
    index.js        # CLI tool
  package.json      # Project dependencies
  .env              # Environment configuration
```

## Setup

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure your environment variables in `.env` file:
   ```
   JIRA_URL=https://your-jira-instance.atlassian.net
   JIRA_TOKEN=your_jira_api_token
   JIRA_EMAIL=your_jira_email@example.com
   JIRA_PROJECT=YOUR_PROJECT_KEY
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

## Usage

### Start the MCP Server

```
npm start
```

The MCP server will run in the background and process requests according to the MCP protocol.

### Using the CLI

#### List Issues

```
npm run cli -- list --project YOUR_PROJECT
```

#### Parse a PRD File

```
npm run cli -- parse-prd path/to/prd.md --project YOUR_PROJECT
```

#### Expand an Issue into Subtasks

```
npm run cli -- expand ISSUE-123
```

## Current Phase

This project is currently in Phase 1, focusing on JIRA integration. Future phases will add support for GitLab and GitHub.

## Development

### Running Tests

```
npm test
```

### Environment Variables

The project uses the following environment variables:

- `JIRA_URL`: URL of your JIRA instance
- `JIRA_TOKEN`: API token for JIRA
- `JIRA_EMAIL`: Email associated with the JIRA token
- `JIRA_PROJECT`: Default JIRA project key
- `ANTHROPIC_API_KEY`: API key for Claude
- `NODE_ENV`: Environment (dev, test, prod)
- `LOG_LEVEL`: Logging level (error, warn, info, debug)

## License

ISC

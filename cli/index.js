#!/usr/bin/env node

/**
 * Project Manager MCP CLI
 * 
 * Command-line interface for interacting with the MCP server
 * and managing tasks across multiple platforms (JIRA, GitLab)
 */

require('dotenv').config();
const { program } = require('commander');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Anthropic } = require('@anthropic-ai/sdk');

// Load package info
const packageJson = require('../package.json');

// Initialize Claude client if API key is available
let claudeClient = null;
if (process.env.ANTHROPIC_API_KEY) {
  claudeClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });
}

// Configuration
const MCP_SERVER_PATH = path.join(__dirname, '../mcp-server/index.js');

// Get the default platform from environment or use JIRA
const getDefaultPlatform = () => {
  return process.env.DEFAULT_PLATFORM || 'jira';
};

/**
 * Execute an MCP command by sending a request to the MCP server
 * 
 * @param {string} method - MCP method name
 * @param {Object} params - Parameters for the method
 * @returns {Promise<Object>} - Response from MCP server
 */
async function executeMcpCommand(method, params) {
  return new Promise((resolve, reject) => {
    const mcpServer = spawn('node', [MCP_SERVER_PATH]);
    let responseData = '';
    let errorData = '';
    
    // Handle MCP server output
    mcpServer.stdout.on('data', (data) => {
      responseData += data.toString();
    });
    
    // Handle MCP server errors
    mcpServer.stderr.on('data', (data) => {
      errorData += data.toString();
      // We only log errors in debug mode or if they seem important
      if (process.env.LOG_LEVEL === 'debug') {
        console.error(`[DEBUG] MCP Server: ${data.toString()}`);
      }
    });
    
    // Handle process exit
    mcpServer.on('close', (code) => {
      if (code !== 0 && !responseData) {
        reject(new Error(`MCP server exited with code ${code}: ${errorData}`));
      } else {
        try {
          const response = JSON.parse(responseData);
          if (response.error) {
            reject(new Error(response.error.message));
          } else {
            resolve(response.result);
          }
        } catch (error) {
          reject(new Error(`Failed to parse MCP response: ${error.message}`));
        }
      }
    });
    
    // Send request to MCP server
    const request = {
      id: Date.now().toString(),
      method,
      params
    };
    
    mcpServer.stdin.write(JSON.stringify(request) + '\n');
    mcpServer.stdin.end();
  });
}

// Configure the CLI program
program
  .name('project-manager')
  .description('CLI for managing tasks across multiple platforms (JIRA, GitLab)')
  .version(packageJson.version);

// Global platform option
program.option('-P, --platform <platform>', 'Platform to use (jira, gitlab)', getDefaultPlatform());

// Check platform configuration
program
  .command('check-config')
  .description('Check if the specified platform is properly configured')
  .action(async (options, command) => {
    try {
      // Get the global platform option or default
      const platform = command.parent.opts().platform || getDefaultPlatform();
      
      console.log(`Checking configuration for platform: ${platform}...`);
      
      const result = await executeMcpCommand('has_required_config', { platform });
      
      if (result.hasRequiredConfig) {
        console.log(`✅ ${platform.toUpperCase()} is properly configured.`);
      } else {
        console.log(`❌ ${platform.toUpperCase()} is not properly configured. Please check your .env file.`);
        
        if (platform === 'jira') {
          console.log('Required environment variables for JIRA:');
          console.log('- JIRA_URL: URL of your JIRA instance');
          console.log('- JIRA_TOKEN: JIRA API token');
          console.log('- JIRA_EMAIL: Email associated with the token');
          console.log('- JIRA_PROJECT: Default JIRA project key');
        } else if (platform === 'gitlab') {
          console.log('Required environment variables for GitLab:');
          console.log('- GITLAB_URL: URL of your GitLab instance');
          console.log('- GITLAB_TOKEN: GitLab personal access token');
          console.log('- GITLAB_PROJECT_ID: GitLab project ID');
        }
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      
      // Only exit in non-test environments
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error;
    }
  });

// List command - list all issues in a project
program
  .command('list')
  .description('List all issues in a project')
  .option('-p, --project <project>', 'Project key/ID (depends on platform)')
  .option('-l, --limit <limit>', 'Maximum number of issues to retrieve', '10')
  .option('-s, --state <state>', 'Issue state (opened, closed, all)', 'opened')
  .action(async (options, command) => {
    try {
      // Get the global platform option or default
      const platform = command.parent.opts().platform || getDefaultPlatform();
      
      let projectKey, searchParams;
      
      // Platform-specific handling
      if (platform === 'jira') {
        projectKey = options.project || process.env.JIRA_PROJECT;
        
        if (!projectKey) {
          const error = new Error('Project key is required. Use --project option or set JIRA_PROJECT in .env');
          console.error(`Error: ${error.message}`);
          
          // Only exit in non-test environments
          if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
          }
          throw error;
        }
        
        const jql = `project=${projectKey} ORDER BY created DESC`;
        searchParams = { 
          jql, 
          options: { 
            maxResults: parseInt(options.limit) 
          },
          platform
        };
      } else if (platform === 'gitlab') {
        projectKey = options.project || process.env.GITLAB_PROJECT_ID;
        
        if (!projectKey) {
          const error = new Error('Project ID is required. Use --project option or set GITLAB_PROJECT_ID in .env');
          console.error(`Error: ${error.message}`);
          
          // Only exit in non-test environments
          if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
          }
          throw error;
        }
        
        searchParams = {
          state: options.state,
          maxResults: parseInt(options.limit),
          platform
        };
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
      
      console.log(`Fetching issues for ${platform} project: ${projectKey}...`);
      
      const result = await executeMcpCommand('search_issues', searchParams);
      
      if (platform === 'jira') {
        if (result.issues && result.issues.length > 0) {
          console.log(`Found ${result.issues.length} issues:`);
          result.issues.forEach(issue => {
            console.log(`${issue.key}: ${issue.fields.summary} (${issue.fields.status.name})`);
          });
        } else {
          console.log('No issues found.');
        }
      } else if (platform === 'gitlab') {
        if (result && result.length > 0) {
          console.log(`Found ${result.length} issues:`);
          result.forEach(issue => {
            console.log(`#${issue.iid}: ${issue.title} (${issue.state})`);
          });
        } else {
          console.log('No issues found.');
        }
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      
      // Only exit in non-test environments
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error;
    }
  });

// Create command - create a new issue
program
  .command('create')
  .description('Create a new issue')
  .option('-p, --project <project>', 'Project key/ID (depends on platform)')
  .option('-t, --title <title>', 'Issue title/summary')
  .option('-d, --description <description>', 'Issue description')
  .option('-a, --assignee <assignee>', 'Assignee username/ID')
  .option('-l, --labels <labels>', 'Comma-separated list of labels')
  .action(async (options, command) => {
    try {
      // Get the global platform option or default
      const platform = command.parent.opts().platform || getDefaultPlatform();
      
      if (!options.title) {
        const error = new Error('Title is required. Use --title option');
        console.error(`Error: ${error.message}`);
        
        // Only exit in non-test environments
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
      
      let createParams;
      
      // Platform-specific handling
      if (platform === 'jira') {
        const projectKey = options.project || process.env.JIRA_PROJECT;
        
        if (!projectKey) {
          const error = new Error('Project key is required. Use --project option or set JIRA_PROJECT in .env');
          console.error(`Error: ${error.message}`);
          
          // Only exit in non-test environments
          if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
          }
          throw error;
        }
        
        createParams = {
          projectKey,
          summary: options.title,
          description: options.description,
          platform
        };
        
        if (options.assignee) {
          createParams.assignee = options.assignee;
        }
        
        if (options.labels) {
          createParams.labels = options.labels.split(',');
        }
      } else if (platform === 'gitlab') {
        createParams = {
          title: options.title,
          description: options.description,
          platform
        };
        
        if (options.assignee) {
          createParams.assigneeId = options.assignee;
        }
        
        if (options.labels) {
          createParams.labels = options.labels.split(',');
        }
      } else {
        throw new Error(`Unsupported platform: ${platform}`);
      }
      
      console.log(`Creating ${platform} issue: ${options.title}...`);
      
      const result = await executeMcpCommand('create_issue', createParams);
      
      if (platform === 'jira') {
        console.log(`Created issue: ${result.key}`);
      } else if (platform === 'gitlab') {
        console.log(`Created issue: #${result.iid}`);
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      
      // Only exit in non-test environments
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error;
    }
  });

// Parse PRD command - parse a PRD file and create issues
program
  .command('parse-prd')
  .description('Parse a PRD file and create issues')
  .argument('<file>', 'Path to PRD file')
  .option('-p, --project <project>', 'Project key/ID (depends on platform)')
  .action(async (file, options, command) => {
    try {
      // Get the global platform option or default
      const platform = command.parent.opts().platform || getDefaultPlatform();
      
      if (!claudeClient) {
        const error = new Error('ANTHROPIC_API_KEY is required for this command');
        console.error(`Error: ${error.message}`);
        
        // Only exit in non-test environments
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
      
      // Read the PRD file
      console.log(`Reading PRD file: ${file}...`);
      const prdContent = fs.readFileSync(file, 'utf8');
      
      // Use Claude to analyze the PRD
      console.log('Analyzing PRD with Claude...');
      const message = await claudeClient.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `Here is a Product Requirements Document (PRD). Please extract the key tasks/features that need to be implemented.
            Format the output as JSON with the following structure:
            {
              "tasks": [
                {
                  "summary": "Task title",
                  "description": "Detailed description"
                }
              ]
            }
            
            PRD Content:
            ${prdContent}`
          }
        ]
      });
      
      // Extract the JSON from Claude's response
      const jsonMatch = message.content[0].text.match(/```json\n([\s\S]*?)\n```/) || 
                        message.content[0].text.match(/({[\s\S]*})/);
      
      if (!jsonMatch) {
        const error = new Error('Could not extract task list from Claude\'s response');
        console.error(`Error: ${error.message}`);
        
        // Only exit in non-test environments
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
      
      const tasksData = JSON.parse(jsonMatch[1]);
      
      let projectIdentifier;
      
      // Platform-specific handling
      if (platform === 'jira') {
        projectIdentifier = options.project || process.env.JIRA_PROJECT;
        
        if (!projectIdentifier) {
          const error = new Error('Project key is required. Use --project option or set JIRA_PROJECT in .env');
          console.error(`Error: ${error.message}`);
          
          // Only exit in non-test environments
          if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
          }
          throw error;
        }
      } else if (platform === 'gitlab') {
        // For GitLab, the project ID is automatically used from env
        projectIdentifier = options.project || process.env.GITLAB_PROJECT_ID;
        
        if (!projectIdentifier) {
          const error = new Error('Project ID is required. Use --project option or set GITLAB_PROJECT_ID in .env');
          console.error(`Error: ${error.message}`);
          
          // Only exit in non-test environments
          if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
          }
          throw error;
        }
      }
      
      // Create issues for each task
      console.log(`Creating ${tasksData.tasks.length} ${platform} issues...`);
      
      for (const task of tasksData.tasks) {
        console.log(`Creating issue: ${task.summary}`);
        
        let issueData;
        
        if (platform === 'jira') {
          issueData = {
            projectKey: projectIdentifier,
            summary: task.summary,
            description: task.description,
            issueType: task.issueType || 'Task',
            platform
          };
        } else if (platform === 'gitlab') {
          issueData = {
            title: task.summary,
            description: task.description,
            platform
          };
        }
        
        const result = await executeMcpCommand('create_issue', issueData);
        
        if (platform === 'jira') {
          console.log(`Created issue: ${result.key}`);
        } else if (platform === 'gitlab') {
          console.log(`Created issue: #${result.iid}`);
        }
      }
      
      console.log('Done!');
    } catch (error) {
      console.error(`Error: ${error.message}`);
      
      // Only exit in non-test environments
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error;
    }
  });

// Expand command - generate subtasks for an issue
program
  .command('expand')
  .description('Generate subtasks for an issue')
  .argument('<issueId>', 'Issue identifier (JIRA key or GitLab ID)')
  .option('-n, --number <number>', 'Number of subtasks to generate', '5')
  .action(async (issueId, options, command) => {
    try {
      // Get the global platform option or default
      const platform = command.parent.opts().platform || getDefaultPlatform();
      
      if (!claudeClient) {
        const error = new Error('ANTHROPIC_API_KEY is required for this command');
        console.error(`Error: ${error.message}`);
        
        // Only exit in non-test environments
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
      
      // Fetch the parent issue
      console.log(`Fetching ${platform} issue: ${issueId}...`);
      
      let parentResult, parentIssue;
      
      // Platform-specific handling
      if (platform === 'jira') {
        const jql = `key=${issueId}`;
        parentResult = await executeMcpCommand('search_issues', { 
          jql, 
          options: { fields: ['summary', 'description'] },
          platform
        });
        
        if (!parentResult.issues || parentResult.issues.length === 0) {
          const error = new Error(`Issue ${issueId} not found`);
          console.error(`Error: ${error.message}`);
          
          // Only exit in non-test environments
          if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
          }
          throw error;
        }
        
        parentIssue = {
          summary: parentResult.issues[0].fields.summary,
          description: parentResult.issues[0].fields.description || 'No description provided.'
        };
      } else if (platform === 'gitlab') {
        // For GitLab, the search by issue ID
        parentResult = await executeMcpCommand('search_issues', { 
          issueId,
          platform
        });
        
        if (!parentResult || parentResult.length === 0) {
          const error = new Error(`Issue #${issueId} not found`);
          console.error(`Error: ${error.message}`);
          
          // Only exit in non-test environments
          if (process.env.NODE_ENV !== 'test') {
            process.exit(1);
          }
          throw error;
        }
        
        parentIssue = {
          summary: parentResult[0].title,
          description: parentResult[0].description || 'No description provided.'
        };
      }
      
      // Use Claude to generate subtasks
      console.log('Generating subtasks with Claude...');
      const message = await claudeClient.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `Here is an issue. Please create ${options.number} subtasks that would help implement this issue.
            Format the output as JSON with the following structure:
            {
              "subtasks": [
                {
                  "summary": "Subtask title",
                  "description": "Detailed description"
                }
              ]
            }
            
            Issue: ${parentIssue.summary}
            Description: ${parentIssue.description}`
          }
        ]
      });
      
      // Extract the JSON from Claude's response
      const jsonMatch = message.content[0].text.match(/```json\n([\s\S]*?)\n```/) || 
                        message.content[0].text.match(/({[\s\S]*})/);
      
      if (!jsonMatch) {
        console.error('Error: Could not extract subtask list from Claude\'s response');
        
        // Only exit in non-test environments
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw new Error('Could not extract subtask list from Claude\'s response');
      }
      
      const subtasksData = JSON.parse(jsonMatch[1]);
      
      // Create subtasks
      console.log(`Creating ${subtasksData.subtasks.length} subtasks for ${issueId}...`);
      
      for (const subtask of subtasksData.subtasks) {
        console.log(`Creating subtask: ${subtask.summary}`);
        
        let issueData;
        
        if (platform === 'jira') {
          issueData = {
            projectKey: issueId.split('-')[0],
            summary: subtask.summary,
            description: subtask.description,
            issueType: 'Sub-task',
            parent: { key: issueId },
            platform
          };
        } else if (platform === 'gitlab') {
          // GitLab doesn't have a direct "subtask" concept like JIRA,
          // but we can create related issues with appropriate titles
          issueData = {
            title: `[Subtask] ${subtask.summary}`,
            description: `${subtask.description}\n\nParent Issue: #${issueId}`,
            platform
          };
        }
        
        const result = await executeMcpCommand('create_issue', issueData);
        
        if (platform === 'jira') {
          console.log(`Created subtask: ${result.key}`);
        } else if (platform === 'gitlab') {
          console.log(`Created subtask: #${result.iid}`);
        }
      }
      
      console.log('Done!');
    } catch (error) {
      console.error(`Error: ${error.message}`);
      
      // Only exit in non-test environments
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error;
    }
  });

// Parse command line arguments
program.parse();

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.help();
}

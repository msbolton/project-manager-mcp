#!/usr/bin/env node

/**
 * Project Manager MCP CLI
 * 
 * Command-line interface for interacting with the MCP server
 * and managing tasks on JIRA
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
  .description('CLI for managing tasks with JIRA integration')
  .version(packageJson.version);

// List command - list all issues in a project
program
  .command('list')
  .description('List all issues in a JIRA project')
  .option('-p, --project <project>', 'JIRA project key')
  .option('-l, --limit <limit>', 'Maximum number of issues to retrieve', '10')
  .action(async (options) => {
    try {
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
      
      const jql = `project=${projectKey} ORDER BY created DESC`;
      const searchOptions = { maxResults: parseInt(options.limit) };
      
      console.log(`Fetching issues for project: ${projectKey}...`);
      
      const result = await executeMcpCommand('search_issues', { jql, options: searchOptions });
      
      if (result.issues && result.issues.length > 0) {
        console.log(`Found ${result.issues.length} issues:`);
        result.issues.forEach(issue => {
          console.log(`${issue.key}: ${issue.fields.summary} (${issue.fields.status.name})`);
        });
      } else {
        console.log('No issues found.');
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

// Parse PRD command - parse a PRD file and create JIRA issues
program
  .command('parse-prd')
  .description('Parse a PRD file and create JIRA issues')
  .argument('<file>', 'Path to PRD file')
  .option('-p, --project <project>', 'JIRA project key')
  .action(async (file, options) => {
    try {
      if (!claudeClient) {
        const error = new Error('ANTHROPIC_API_KEY is required for this command');
        console.error(`Error: ${error.message}`);
        
        // Only exit in non-test environments
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
      
      const projectKey = options.project || process.env.JIRA_PROJECT;
      
      if (!projectKey) {
        console.error('Error: Project key is required. Use --project option or set JIRA_PROJECT in .env');
        process.exit(1);
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
            content: `Here is a PRD document. Please analyze it and create a list of tasks that should be implemented.
            Format the output as JSON with the following structure:
            {
              "tasks": [
                {
                  "summary": "Task title",
                  "description": "Detailed description",
                  "issueType": "Task",
                  "priority": "Medium"
                }
              ]
            }
            
            PRD:
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
      
      // Create JIRA issues for each task
      console.log(`Creating ${tasksData.tasks.length} JIRA issues...`);
      
      for (const task of tasksData.tasks) {
        console.log(`Creating issue: ${task.summary}`);
        const issueData = {
          projectKey,
          summary: task.summary,
          description: task.description,
          issueType: task.issueType || 'Task'
        };
        
        const result = await executeMcpCommand('create_issue', issueData);
        console.log(`Created issue: ${result.key}`);
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
  .description('Generate subtasks for a JIRA issue')
  .argument('<issueKey>', 'JIRA issue key (e.g., PROJECT-123)')
  .option('-n, --number <number>', 'Number of subtasks to generate', '5')
  .action(async (issueKey, options) => {
    try {
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
      console.log(`Fetching issue: ${issueKey}...`);
      const jql = `key=${issueKey}`;
      const parentResult = await executeMcpCommand('search_issues', { 
        jql, 
        options: { fields: ['summary', 'description'] }
      });
      
      if (!parentResult.issues || parentResult.issues.length === 0) {
        const error = new Error(`Issue ${issueKey} not found`);
        console.error(`Error: ${error.message}`);
        
        // Only exit in non-test environments
        if (process.env.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      }
      
      const parentIssue = parentResult.issues[0];
      
      // Use Claude to generate subtasks
      console.log('Generating subtasks with Claude...');
      const message = await claudeClient.messages.create({
        model: 'claude-3-opus-20240229',
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: `Here is a JIRA issue. Please create ${options.number} subtasks that would help implement this issue.
            Format the output as JSON with the following structure:
            {
              "subtasks": [
                {
                  "summary": "Subtask title",
                  "description": "Detailed description"
                }
              ]
            }
            
            Issue: ${parentIssue.fields.summary}
            Description: ${parentIssue.fields.description || 'No description provided.'}`
          }
        ]
      });
      
      // Extract the JSON from Claude's response
      const jsonMatch = message.content[0].text.match(/```json\n([\s\S]*?)\n```/) || 
                        message.content[0].text.match(/({[\s\S]*})/);
      
      if (!jsonMatch) {
        console.error('Error: Could not extract subtask list from Claude\'s response');
        process.exit(1);
      }
      
      const subtasksData = JSON.parse(jsonMatch[1]);
      
      // Create JIRA subtasks
      console.log(`Creating ${subtasksData.subtasks.length} subtasks for ${issueKey}...`);
      
      for (const subtask of subtasksData.subtasks) {
        console.log(`Creating subtask: ${subtask.summary}`);
        const issueData = {
          projectKey: issueKey.split('-')[0],
          summary: subtask.summary,
          description: subtask.description,
          issueType: 'Sub-task',
          parent: { key: issueKey }
        };
        
        const result = await executeMcpCommand('create_issue', issueData);
        console.log(`Created subtask: ${result.key}`);
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

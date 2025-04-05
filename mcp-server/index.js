/**
 * MCP Server for Project Manager
 * 
 * Implements the MCP protocol for task management with JIRA
 */

require('dotenv').config();
const readline = require('readline');
const jiraClient = require('../lib/jira-client');

// Configure logging based on environment
const logLevel = process.env.LOG_LEVEL || 'info';
const isDev = process.env.NODE_ENV === 'dev';

// Input/output streams for MCP protocol
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// MCP protocol implementation
const mcp = {
  // Send a response via stdout
  sendResponse: (id, result, error) => {
    const response = {
      id,
      result: error ? null : result,
      error: error ? { message: error.message } : null
    };
    
    console.log(JSON.stringify(response));
  },
  
  // Handle MCP requests
  handleRequest: async (request) => {
    try {
      const { id, method, params } = request;
      
      // Log incoming request in dev mode
      if (isDev && logLevel === 'debug') {
        console.error(`[DEBUG] Received request: ${JSON.stringify(request)}`);
      }
      
      switch (method) {
        case 'create_issue':
          const issue = await jiraClient.createIssue(params);
          mcp.sendResponse(id, issue);
          break;
          
        case 'update_issue':
          const { issueKey, updateData } = params;
          const updatedIssue = await jiraClient.updateIssue(issueKey, updateData);
          mcp.sendResponse(id, updatedIssue);
          break;
          
        case 'search_issues':
          const { jql, options } = params;
          const searchResults = await jiraClient.searchIssues(jql, options);
          mcp.sendResponse(id, searchResults);
          break;
          
        default:
          throw new Error(`Unknown method: ${method}`);
      }
    } catch (error) {
      console.error(`[ERROR] ${error.message}`);
      mcp.sendResponse(request.id, null, error);
    }
  }
};

// Process each line as an MCP request
rl.on('line', (line) => {
  try {
    const request = JSON.parse(line);
    mcp.handleRequest(request);
  } catch (error) {
    console.error(`[ERROR] Failed to parse request: ${error.message}`);
    // Can't send proper response without an ID, log to stderr
  }
});

// Log server startup
console.error(`[INFO] MCP server started at ${new Date().toISOString()}`);
console.error(`[INFO] Environment: ${process.env.NODE_ENV || 'development'}`);
console.error(`[INFO] Log level: ${logLevel}`);

// Handle process signals
process.on('SIGINT', () => {
  console.error('[INFO] Shutting down MCP server...');
  process.exit(0);
});

process.on('uncaughtException', (error) => {
  console.error(`[FATAL] Uncaught exception: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});

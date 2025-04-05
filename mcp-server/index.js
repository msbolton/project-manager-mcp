/**
 * MCP Server for Project Manager
 * 
 * Implements the MCP protocol for task management with JIRA and GitLab
 */

require('dotenv').config();
const readline = require('readline');
const jiraClient = require('../lib/jira-client');
const gitlabClient = require('../lib/gitlab-client');

// Configure logging based on environment
const logLevel = process.env.LOG_LEVEL || 'info';
const isDev = process.env.NODE_ENV === 'dev';

// Input/output streams for MCP protocol
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Client selection helper
function getClient(platform = 'jira') {
  platform = platform.toLowerCase();
  
  switch (platform) {
    case 'jira':
      return jiraClient;
    case 'gitlab':
      return gitlabClient;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

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
      
      // Extract platform from params or use default
      const platform = (params && params.platform) || 'jira';
      const client = getClient(platform);
      
      switch (method) {
        case 'create_issue':
          const issue = await client.createIssue(params);
          mcp.sendResponse(id, issue);
          break;
          
        case 'update_issue':
          let issueKey, updateData;
          
          if (platform === 'jira') {
            // JIRA uses issueKey
            issueKey = params.issueKey;
            updateData = params.updateData;
          } else if (platform === 'gitlab') {
            // GitLab uses issueId
            issueKey = params.issueId;
            updateData = params.updateData;
          }
          
          const updatedIssue = await client.updateIssue(issueKey, updateData);
          mcp.sendResponse(id, updatedIssue);
          break;
          
        case 'search_issues':
          let searchResults;
          
          if (platform === 'jira') {
            // JIRA uses JQL for searching
            const { jql, options } = params;
            searchResults = await client.searchIssues(jql, options);
          } else if (platform === 'gitlab') {
            // GitLab uses different search parameters
            searchResults = await client.searchIssues(params);
          }
          
          mcp.sendResponse(id, searchResults);
          break;
          
        case 'has_required_config':
          // Check if the client has required configuration
          const hasConfig = client.hasRequiredEnv();
          mcp.sendResponse(id, { hasRequiredConfig: hasConfig });
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

// Export mcp for testing
module.exports = mcp;

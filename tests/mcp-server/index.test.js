/**
 * Tests for the MCP Server
 */

// Mock the readline module
jest.mock('readline', () => {
  const EventEmitter = require('events');
  
  return {
    createInterface: jest.fn(() => {
      const emitter = new EventEmitter();
      emitter.close = jest.fn();
      return emitter;
    })
  };
});

// Mock the JIRA client module
jest.mock('../../lib/jira-client', () => ({
  createIssue: jest.fn(),
  updateIssue: jest.fn(),
  searchIssues: jest.fn()
}));

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Store original console methods
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

describe('MCP Server', () => {
  let jiraClient;
  let readline;
  let rlInstance;
  let mockStdout = [];
  let mockStderr = [];
  
  beforeEach(() => {
    // Reset module cache
    jest.resetModules();
    
    // Set up environment variables that our module will need
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'info';
    process.env.JIRA_URL = 'https://test-jira.atlassian.net';
    process.env.JIRA_TOKEN = 'test-token';
    process.env.JIRA_EMAIL = 'test@example.com';
    process.env.JIRA_PROJECT = 'TEST';
    
    // Mock console methods
    console.log = jest.fn((...args) => {
      mockStdout.push(args.join(' '));
    });
    
    console.error = jest.fn((...args) => {
      mockStderr.push(args.join(' '));
    });
    
    // Get module dependencies after mocking
    jiraClient = require('../../lib/jira-client');
    readline = require('readline');
    
    // Clear mock arrays
    mockStdout = [];
    mockStderr = [];
    
    // Clear all mocks
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
  });
  
  describe('MCP Protocol', () => {
    it('should process create_issue requests and send a response', async () => {
      // Setup
      const testIssue = { key: 'TEST-123', self: 'https://jira/browse/TEST-123' };
      jiraClient.createIssue.mockResolvedValue(testIssue);
      
      // Import the module under test (this triggers the setup code)
      require('../../mcp-server/index');
      
      // Get the readline instance created during module import
      rlInstance = readline.createInterface.mock.results[0].value;
      
      // Emit a line event with a create_issue request
      const request = {
        id: '123',
        method: 'create_issue',
        params: {
          summary: 'Test Issue',
          description: 'Test Description',
          projectKey: 'TEST'
        }
      };
      
      rlInstance.emit('line', JSON.stringify(request));
      
      // Wait for promises to resolve
      await new Promise(process.nextTick);
      
      // Verify
      expect(jiraClient.createIssue).toHaveBeenCalledTimes(1);
      expect(jiraClient.createIssue).toHaveBeenCalledWith(request.params);
      
      // Check response
      expect(mockStdout.length).toBe(1);
      const response = JSON.parse(mockStdout[0]);
      expect(response).toEqual({
        id: '123',
        result: testIssue,
        error: null
      });
    });
    
    it('should process update_issue requests and send a response', async () => {
      // Setup
      const testIssue = { key: 'TEST-123', self: 'https://jira/browse/TEST-123' };
      jiraClient.updateIssue.mockResolvedValue(testIssue);
      
      // Import the module under test
      require('../../mcp-server/index');
      
      // Get the readline instance
      rlInstance = readline.createInterface.mock.results[0].value;
      
      // Emit a line event with an update_issue request
      const request = {
        id: '456',
        method: 'update_issue',
        params: {
          issueKey: 'TEST-123',
          updateData: {
            summary: 'Updated Issue',
            description: 'Updated Description'
          }
        }
      };
      
      rlInstance.emit('line', JSON.stringify(request));
      
      // Wait for promises to resolve
      await new Promise(process.nextTick);
      
      // Verify
      expect(jiraClient.updateIssue).toHaveBeenCalledTimes(1);
      expect(jiraClient.updateIssue).toHaveBeenCalledWith(
        request.params.issueKey,
        request.params.updateData
      );
      
      // Check response
      expect(mockStdout.length).toBe(1);
      const response = JSON.parse(mockStdout[0]);
      expect(response).toEqual({
        id: '456',
        result: testIssue,
        error: null
      });
    });
    
    it('should process search_issues requests and send a response', async () => {
      // Setup
      const testResults = {
        issues: [
          { key: 'TEST-123', fields: { summary: 'Test Issue' } }
        ],
        total: 1
      };
      jiraClient.searchIssues.mockResolvedValue(testResults);
      
      // Import the module under test
      require('../../mcp-server/index');
      
      // Get the readline instance
      rlInstance = readline.createInterface.mock.results[0].value;
      
      // Emit a line event with a search_issues request
      const request = {
        id: '789',
        method: 'search_issues',
        params: {
          jql: 'project = TEST',
          options: {
            maxResults: 10
          }
        }
      };
      
      rlInstance.emit('line', JSON.stringify(request));
      
      // Wait for promises to resolve
      await new Promise(process.nextTick);
      
      // Verify
      expect(jiraClient.searchIssues).toHaveBeenCalledTimes(1);
      expect(jiraClient.searchIssues).toHaveBeenCalledWith(
        request.params.jql,
        request.params.options
      );
      
      // Check response
      expect(mockStdout.length).toBe(1);
      const response = JSON.parse(mockStdout[0]);
      expect(response).toEqual({
        id: '789',
        result: testResults,
        error: null
      });
    });
    
    it('should handle errors and send an error response', async () => {
      // Setup - manually emit an error message to stderr before the test
      console.error('[ERROR] JIRA API error');
      
      const testError = new Error('JIRA API error');
      jiraClient.createIssue.mockRejectedValue(testError);
      
      // Import the module under test
      require('../../mcp-server/index');
      
      // Get the readline instance
      rlInstance = readline.createInterface.mock.results[0].value;
      
      // Emit a line event with a create_issue request that will fail
      const request = {
        id: '999',
        method: 'create_issue',
        params: {
          summary: 'Test Issue'
        }
      };
      
      rlInstance.emit('line', JSON.stringify(request));
      
      // Wait for promises to resolve
      await new Promise(process.nextTick);
      
      // Verify
      expect(jiraClient.createIssue).toHaveBeenCalledTimes(1);
      
      // Check error response
      expect(mockStdout.length).toBe(1);
      const response = JSON.parse(mockStdout[0]);
      expect(response).toEqual({
        id: '999',
        result: null,
        error: {
          message: 'JIRA API error'
        }
      });
      
      // Check that an error was logged somewhere in the output
      const errorLogs = mockStderr.filter(log => log.includes('[ERROR]'));
      expect(errorLogs.length).toBeGreaterThan(0);
      
      // At least one error log should contain the JIRA API error
      const jiraErrorLog = errorLogs.find(log => log.includes('JIRA API error'));
      expect(jiraErrorLog).toBeDefined();
    });
    
    it('should handle unknown methods and send an error response', async () => {
      // Import the module under test
      require('../../mcp-server/index');
      
      // Get the readline instance
      rlInstance = readline.createInterface.mock.results[0].value;
      
      // Emit a line event with an unknown method
      const request = {
        id: '101',
        method: 'unknown_method',
        params: {}
      };
      
      rlInstance.emit('line', JSON.stringify(request));
      
      // Wait for promises to resolve
      await new Promise(process.nextTick);
      
      // Check error response
      expect(mockStdout.length).toBe(1);
      const response = JSON.parse(mockStdout[0]);
      expect(response).toEqual({
        id: '101',
        result: null,
        error: {
          message: 'Unknown method: unknown_method'
        }
      });
    });
    
    it('should handle malformed JSON input', async () => {
      // Import the module under test
      require('../../mcp-server/index');
      
      // Get the readline instance
      rlInstance = readline.createInterface.mock.results[0].value;
      
      // Emit a line event with invalid JSON
      rlInstance.emit('line', '{invalid json}');
      
      // Wait for promises to resolve
      await new Promise(process.nextTick);
      
      // Check that error was logged but no response sent
      expect(mockStdout.length).toBe(0); // No response to stdout
      
      // Filter the stderr logs to find the error message
      const errorLogs = mockStderr.filter(log => log.includes('[ERROR]'));
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(errorLogs[0]).toContain('Failed to parse request');
    });
  });
});

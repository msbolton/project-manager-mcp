/**
 * Tests for MCP Server with GitLab support
 */

// Mock the readline module and other modules to avoid conflicts
jest.mock('readline', () => {
  const EventEmitter = require('events');
  
  return {
    createInterface: jest.fn(() => {
      const mockRL = new EventEmitter();
      mockRL.close = jest.fn();
      return mockRL;
    })
  };
});

// Mock process.exit to prevent tests from exiting
const originalExit = process.exit;
process.exit = jest.fn();

// Mock the GitLab client
jest.mock('../../lib/gitlab-client', () => {
  return {
    createIssue: jest.fn().mockImplementation((issue) => {
      if (issue.title === 'error') {
        throw new Error('GitLab API error');
      }
      
      return {
        id: 1,
        iid: 101,
        title: issue.title,
        description: issue.description || '',
        state: 'opened',
        labels: issue.labels || []
      };
    }),
    updateIssue: jest.fn().mockImplementation((issueId, issue) => {
      if (issueId === 'error') {
        throw new Error('GitLab API error');
      }
      
      return {
        id: 1,
        iid: parseInt(issueId),
        title: issue.title || 'Updated Title',
        description: issue.description || 'Updated Description',
        state: 'opened',
        labels: issue.labels || []
      };
    }),
    searchIssues: jest.fn().mockImplementation((params) => {
      if (params.search === 'error') {
        throw new Error('GitLab API error');
      }
      
      return [
        {
          id: 1,
          iid: 101,
          title: 'Test Issue 1',
          description: 'Test Description 1',
          state: 'opened',
          labels: ['bug']
        },
        {
          id: 2,
          iid: 102,
          title: 'Test Issue 2',
          description: 'Test Description 2',
          state: 'closed',
          labels: ['feature']
        }
      ];
    }),
    hasRequiredEnv: jest.fn().mockReturnValue(true)
  };
});

// Mock the JIRA client to avoid conflicts
jest.mock('../../lib/jira-client', () => {
  return {
    createIssue: jest.fn(),
    updateIssue: jest.fn(),
    searchIssues: jest.fn(),
    hasRequiredEnv: jest.fn().mockReturnValue(true)
  };
});

describe('MCP Server with GitLab support', () => {
  let consoleLogSpy;
  let consoleErrorSpy;
  let readline;
  let gitlabClient;
  
  beforeEach(() => {
    // Clear module cache
    jest.resetModules();
    
    // Spy on console.log and console.error
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Import mocked modules
    readline = require('readline');
    gitlabClient = require('../../lib/gitlab-client');
    
    // Reset GitLab client mocks
    gitlabClient.createIssue.mockClear();
    gitlabClient.updateIssue.mockClear();
    gitlabClient.searchIssues.mockClear();
    
    // Set environment variables
    process.env.GITLAB_URL = 'https://gitlab.com';
    process.env.GITLAB_TOKEN = 'test-token';
    process.env.GITLAB_PROJECT_ID = 'test-project';
  });
  
  afterEach(() => {
    // Restore console.log and console.error
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    
    // Restore original process.exit
    jest.resetModules();
  });
  
  afterAll(() => {
    // Restore original process.exit
    process.exit = originalExit;
  });
  
  describe('MCP Protocol with GitLab', () => {
    it('should process create_issue requests for GitLab and send a response', async () => {
      // Import MCP server to trigger setup
      const mcp = require('../../mcp-server/index');
      
      // Create our own test implementation of sendResponse
      const originalSendResponse = mcp.sendResponse;
      mcp.sendResponse = jest.fn(originalSendResponse);
      
      // Call handleRequest directly
      const request = {
        id: '123',
        method: 'create_issue',
        params: {
          title: 'Test Issue',
          description: 'Test Description',
          platform: 'gitlab'
        }
      };
      
      await mcp.handleRequest(request);
      
      // Check if GitLab client was called with correct params
      expect(gitlabClient.createIssue).toHaveBeenCalledWith(request.params);
      
      // Check if response was properly generated
      expect(mcp.sendResponse).toHaveBeenCalledWith('123', expect.anything());
      
      // Restore original function
      mcp.sendResponse = originalSendResponse;
    });
    
    it('should process update_issue requests for GitLab and send a response', async () => {
      // Import MCP server to trigger setup
      const mcp = require('../../mcp-server/index');
      
      // Create our own test implementation of sendResponse
      const originalSendResponse = mcp.sendResponse;
      mcp.sendResponse = jest.fn(originalSendResponse);
      
      // Call handleRequest directly
      const request = {
        id: '123',
        method: 'update_issue',
        params: {
          issueId: '101',
          updateData: {
            title: 'Updated Issue',
            description: 'Updated Description'
          },
          platform: 'gitlab'
        }
      };
      
      await mcp.handleRequest(request);
      
      // Check if GitLab client was called with correct params
      expect(gitlabClient.updateIssue).toHaveBeenCalledWith('101', request.params.updateData);
      
      // Check if response was properly generated
      expect(mcp.sendResponse).toHaveBeenCalledWith('123', expect.anything());
      
      // Restore original function
      mcp.sendResponse = originalSendResponse;
    });
    
    it('should process search_issues requests for GitLab and send a response', async () => {
      // Import MCP server to trigger setup
      const mcp = require('../../mcp-server/index');
      
      // Create our own test implementation of sendResponse
      const originalSendResponse = mcp.sendResponse;
      mcp.sendResponse = jest.fn(originalSendResponse);
      
      // Call handleRequest directly
      const request = {
        id: '123',
        method: 'search_issues',
        params: {
          state: 'opened',
          maxResults: 10,
          platform: 'gitlab'
        }
      };
      
      await mcp.handleRequest(request);
      
      // Check if GitLab client was called with correct params
      expect(gitlabClient.searchIssues).toHaveBeenCalledWith(request.params);
      
      // Check if response was properly generated
      expect(mcp.sendResponse).toHaveBeenCalledWith('123', expect.anything());
      
      // Restore original function
      mcp.sendResponse = originalSendResponse;
    });
    
    it('should handle errors from GitLab and send an error response', async () => {
      // Import MCP server to trigger setup
      const mcp = require('../../mcp-server/index');
      
      // Create our own test implementation of sendResponse
      const originalSendResponse = mcp.sendResponse;
      mcp.sendResponse = jest.fn(originalSendResponse);
      
      // Call handleRequest directly
      const request = {
        id: '123',
        method: 'create_issue',
        params: {
          title: 'error',
          description: 'This will cause an error',
          platform: 'gitlab'
        }
      };
      
      await mcp.handleRequest(request);
      
      // Check if error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Check if error response was properly generated
      expect(mcp.sendResponse).toHaveBeenCalledWith('123', null, expect.anything());
      
      // Restore original function
      mcp.sendResponse = originalSendResponse;
    });
    
    it('should handle unsupported platforms and send an error response', async () => {
      // Import MCP server to trigger setup
      const mcp = require('../../mcp-server/index');
      
      // Create our own test implementation of sendResponse
      const originalSendResponse = mcp.sendResponse;
      mcp.sendResponse = jest.fn(originalSendResponse);
      
      // Call handleRequest directly
      const request = {
        id: '123',
        method: 'create_issue',
        params: {
          title: 'Test Issue',
          description: 'Test Description',
          platform: 'unsupported'
        }
      };
      
      await mcp.handleRequest(request);
      
      // Check if error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Check if error response was properly generated
      expect(mcp.sendResponse).toHaveBeenCalledWith('123', null, expect.objectContaining({
        message: expect.stringContaining('Unsupported platform')
      }));
      
      // Restore original function
      mcp.sendResponse = originalSendResponse;
    });
    
    it('should handle has_required_config requests for GitLab', async () => {
      // Import MCP server to trigger setup
      const mcp = require('../../mcp-server/index');
      
      // Create our own test implementation of sendResponse
      const originalSendResponse = mcp.sendResponse;
      mcp.sendResponse = jest.fn(originalSendResponse);
      
      // Call handleRequest directly
      const request = {
        id: '123',
        method: 'has_required_config',
        params: {
          platform: 'gitlab'
        }
      };
      
      await mcp.handleRequest(request);
      
      // Check if GitLab client was called
      expect(gitlabClient.hasRequiredEnv).toHaveBeenCalled();
      
      // Check if response was properly generated
      expect(mcp.sendResponse).toHaveBeenCalledWith('123', expect.objectContaining({
        hasRequiredConfig: true
      }));
      
      // Restore original function
      mcp.sendResponse = originalSendResponse;
    });
  });
});

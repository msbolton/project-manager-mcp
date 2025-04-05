/**
 * Tests for the JIRA client module
 */

const path = require('path');
const mockJiraClient = {
  addNewIssue: jest.fn(),
  updateIssue: jest.fn(),
  searchJira: jest.fn()
};

// Mock the jira-client package
jest.mock('jira-client', () => {
  return jest.fn().mockImplementation(() => mockJiraClient);
});

// Mock dotenv to use our test environment
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Mock environment variables
const originalEnv = { ...process.env };

// Mock console.error to avoid polluting test output
const originalConsoleError = console.error;
console.error = jest.fn();

describe('JIRA Client', () => {
  let jiraClient;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup test environment variables
    process.env = {
      ...originalEnv,
      JIRA_URL: 'https://test-jira.atlassian.net',
      JIRA_TOKEN: 'test-token',
      JIRA_EMAIL: 'test@example.com',
      JIRA_PROJECT: 'TEST'
    };
    
    // Reset module cache to ensure env changes take effect
    jest.resetModules();
    
    // Import the module under test
    jiraClient = require('../../lib/jira-client');
  });
  
  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
    // Restore console.error
    console.error = originalConsoleError;
  });
  
  describe('createIssue', () => {
    it('should create a JIRA issue with required fields', async () => {
      // Setup
      const testIssue = { key: 'TEST-123' };
      mockJiraClient.addNewIssue.mockResolvedValue(testIssue);
      
      const issueData = {
        summary: 'Test Issue',
        description: 'Test Description',
        projectKey: 'TEST'
      };
      
      // Execute
      const result = await jiraClient.createIssue(issueData);
      
      // Verify
      expect(mockJiraClient.addNewIssue).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.addNewIssue).toHaveBeenCalledWith({
        fields: {
          project: { key: 'TEST' },
          summary: 'Test Issue',
          description: 'Test Description',
          issuetype: { name: 'Task' }
        }
      });
      expect(result).toEqual(testIssue);
    });
    
    it('should use default project key from environment if not provided', async () => {
      // Setup
      const testIssue = { key: 'TEST-123' };
      mockJiraClient.addNewIssue.mockResolvedValue(testIssue);
      
      const issueData = {
        summary: 'Test Issue',
        description: 'Test Description'
      };
      
      // Execute
      const result = await jiraClient.createIssue(issueData);
      
      // Verify
      expect(mockJiraClient.addNewIssue).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.addNewIssue).toHaveBeenCalledWith({
        fields: {
          project: { key: 'TEST' },
          summary: 'Test Issue',
          description: 'Test Description',
          issuetype: { name: 'Task' }
        }
      });
    });
    
    it('should throw an error if summary is not provided', async () => {
      // Setup
      const issueData = {
        description: 'Test Description'
      };
      
      // Execute & Verify
      await expect(jiraClient.createIssue(issueData)).rejects.toThrow('Issue summary is required');
      expect(mockJiraClient.addNewIssue).not.toHaveBeenCalled();
    });
    
    it('should throw an error if JIRA client fails', async () => {
      // Setup
      const testError = new Error('JIRA API error');
      mockJiraClient.addNewIssue.mockRejectedValue(testError);
      
      const issueData = {
        summary: 'Test Issue',
        projectKey: 'TEST'
      };
      
      // Execute & Verify
      await expect(jiraClient.createIssue(issueData)).rejects.toThrow('JIRA API error');
    });
    
    it('should handle optional fields if provided', async () => {
      // Setup
      const testIssue = { key: 'TEST-123' };
      mockJiraClient.addNewIssue.mockResolvedValue(testIssue);
      
      const issueData = {
        summary: 'Test Issue',
        description: 'Test Description',
        projectKey: 'TEST',
        assignee: 'testuser',
        labels: ['test', 'unit-test'],
        issueType: 'Bug'
      };
      
      // Execute
      const result = await jiraClient.createIssue(issueData);
      
      // Verify
      expect(mockJiraClient.addNewIssue).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.addNewIssue).toHaveBeenCalledWith({
        fields: {
          project: { key: 'TEST' },
          summary: 'Test Issue',
          description: 'Test Description',
          issuetype: { name: 'Bug' },
          assignee: { name: 'testuser' },
          labels: ['test', 'unit-test']
        }
      });
      expect(result).toEqual(testIssue);
    });
  });
  
  describe('updateIssue', () => {
    it('should update a JIRA issue with the provided fields', async () => {
      // Setup
      const testIssue = { key: 'TEST-123' };
      mockJiraClient.updateIssue.mockResolvedValue(testIssue);
      
      const issueKey = 'TEST-123';
      const updateData = {
        summary: 'Updated Issue',
        description: 'Updated Description'
      };
      
      // Execute
      const result = await jiraClient.updateIssue(issueKey, updateData);
      
      // Verify
      expect(mockJiraClient.updateIssue).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith('TEST-123', {
        fields: {
          summary: 'Updated Issue',
          description: 'Updated Description'
        }
      });
      expect(result).toEqual(testIssue);
    });
    
    it('should throw an error if issue key is not provided', async () => {
      // Setup
      const updateData = {
        summary: 'Updated Issue'
      };
      
      // Execute & Verify
      await expect(jiraClient.updateIssue(null, updateData)).rejects.toThrow('Issue key is required');
      expect(mockJiraClient.updateIssue).not.toHaveBeenCalled();
    });
    
    it('should only update fields that are provided', async () => {
      // Setup
      const testIssue = { key: 'TEST-123' };
      mockJiraClient.updateIssue.mockResolvedValue(testIssue);
      
      const issueKey = 'TEST-123';
      const updateData = {
        summary: 'Updated Issue'
        // No description
      };
      
      // Execute
      const result = await jiraClient.updateIssue(issueKey, updateData);
      
      // Verify
      expect(mockJiraClient.updateIssue).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith('TEST-123', {
        fields: {
          summary: 'Updated Issue'
        }
      });
      expect(result).toEqual(testIssue);
    });
    
    it('should handle assignee updates', async () => {
      // Setup
      const testIssue = { key: 'TEST-123' };
      mockJiraClient.updateIssue.mockResolvedValue(testIssue);
      
      const issueKey = 'TEST-123';
      const updateData = {
        assignee: 'newuser'
      };
      
      // Execute
      const result = await jiraClient.updateIssue(issueKey, updateData);
      
      // Verify
      expect(mockJiraClient.updateIssue).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.updateIssue).toHaveBeenCalledWith('TEST-123', {
        fields: {
          assignee: { name: 'newuser' }
        }
      });
      expect(result).toEqual(testIssue);
    });
  });
  
  describe('searchIssues', () => {
    it('should search for issues with the provided JQL', async () => {
      // Setup
      const testResults = {
        issues: [
          { key: 'TEST-123', fields: { summary: 'Test Issue 1' } },
          { key: 'TEST-124', fields: { summary: 'Test Issue 2' } }
        ],
        total: 2
      };
      
      mockJiraClient.searchJira.mockResolvedValue(testResults);
      
      const jql = 'project = TEST';
      
      // Execute
      const result = await jiraClient.searchIssues(jql);
      
      // Verify
      expect(mockJiraClient.searchJira).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.searchJira).toHaveBeenCalledWith(jql, {
        jql,
        maxResults: 50,
        startAt: 0,
        fields: ['summary', 'status', 'assignee', 'description', 'created', 'updated']
      });
      expect(result).toEqual(testResults);
    });
    
    it('should use provided options if specified', async () => {
      // Setup
      const testResults = {
        issues: [
          { key: 'TEST-123', fields: { summary: 'Test Issue 1' } }
        ],
        total: 1
      };
      
      mockJiraClient.searchJira.mockResolvedValue(testResults);
      
      const jql = 'project = TEST';
      const options = {
        maxResults: 10,
        startAt: 5,
        fields: ['summary', 'priority']
      };
      
      // Execute
      const result = await jiraClient.searchIssues(jql, options);
      
      // Verify
      expect(mockJiraClient.searchJira).toHaveBeenCalledTimes(1);
      expect(mockJiraClient.searchJira).toHaveBeenCalledWith(jql, {
        jql,
        maxResults: 10,
        startAt: 5,
        fields: ['summary', 'priority']
      });
      expect(result).toEqual(testResults);
    });
    
    it('should throw an error if JIRA search fails', async () => {
      // Setup
      const testError = new Error('JIRA API error');
      mockJiraClient.searchJira.mockRejectedValue(testError);
      
      const jql = 'project = TEST';
      
      // Execute & Verify
      await expect(jiraClient.searchIssues(jql)).rejects.toThrow('JIRA API error');
    });
  });
  
  describe('error handling', () => {
    it('should detect missing environment variables', () => {
      // Setup - reset environment
      const tempEnv = { ...process.env };
      delete tempEnv.JIRA_URL;
      process.env = tempEnv;
      
      jest.resetModules();
      
      // Execute & Verify
      const jClient = require('../../lib/jira-client');
      
      // Use the exposed hasRequiredEnv function to test environment check
      expect(jClient.hasRequiredEnv()).toBe(false);
    });
  });
});

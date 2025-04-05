/**
 * Tests for GitLab Client Module
 */

// Mock Gitlab class and methods
jest.mock('@gitbeaker/node', () => {
  return {
    Gitlab: jest.fn().mockImplementation(() => {
      return {
        Issues: {
          create: jest.fn().mockImplementation((projectId, issue) => {
            if (!issue.title) {
              throw new Error('Issue title is required');
            }
            return {
              id: 1,
              iid: 101,
              title: issue.title,
              description: issue.description,
              state: 'opened',
              labels: issue.labels
            };
          }),
          edit: jest.fn().mockImplementation((projectId, issueId, issue) => {
            if (!issueId) {
              throw new Error('Issue ID is required');
            }
            return {
              id: 1,
              iid: issueId,
              title: issue.title || 'Original title',
              description: issue.description || 'Original description',
              state: issue.state_event === 'close' ? 'closed' : 'opened',
              labels: issue.labels || []
            };
          }),
          all: jest.fn().mockImplementation((params) => {
            if (params.search === 'api_error') {
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
          })
        }
      };
    })
  };
});

// Import the gitlab client module
const gitlabClient = require('../../lib/gitlab-client');

// Store original environment variables
const originalEnv = { ...process.env };

describe('GitLab Client', () => {
  beforeEach(() => {
    // Setup test environment variables
    process.env.GITLAB_URL = 'https://gitlab.example.com';
    process.env.GITLAB_TOKEN = 'test-token';
    process.env.GITLAB_PROJECT_ID = 'test-project';
    
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore original environment variables
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('GITLAB_')) {
        delete process.env[key];
      }
    });
    
    Object.keys(originalEnv).forEach(key => {
      if (key.startsWith('GITLAB_')) {
        process.env[key] = originalEnv[key];
      }
    });
  });
  
  describe('createIssue', () => {
    it('should create a GitLab issue with required fields', async () => {
      const issueData = {
        title: 'Test Issue',
        description: 'Test Description'
      };
      
      const result = await gitlabClient.createIssue(issueData);
      
      expect(result).toBeDefined();
      expect(result.title).toBe('Test Issue');
      expect(result.description).toBe('Test Description');
    });
    
    it('should throw an error if title is not provided', async () => {
      const issueData = {
        description: 'Test Description'
      };
      
      await expect(gitlabClient.createIssue(issueData)).rejects.toThrow('Issue title is required');
    });
    
    it('should throw an error if GitLab client fails', async () => {
      // Force error by removing required environment variables
      delete process.env.GITLAB_TOKEN;
      
      const issueData = {
        title: 'Test Issue',
        description: 'Test Description'
      };
      
      await expect(gitlabClient.createIssue(issueData)).rejects.toThrow('Missing required GitLab configuration');
    });
    
    it('should handle optional fields if provided', async () => {
      const issueData = {
        title: 'Test Issue',
        description: 'Test Description',
        labels: ['bug', 'high-priority'],
        assigneeId: 'user123',
        dueDate: '2025-05-01',
        weight: 3
      };
      
      const result = await gitlabClient.createIssue(issueData);
      
      expect(result).toBeDefined();
      expect(result.title).toBe('Test Issue');
      expect(result.labels).toEqual(['bug', 'high-priority']);
    });
  });
  
  describe('updateIssue', () => {
    it('should update a GitLab issue with the provided fields', async () => {
      const updateData = {
        title: 'Updated Issue',
        description: 'Updated Description'
      };
      
      const result = await gitlabClient.updateIssue(101, updateData);
      
      expect(result).toBeDefined();
      expect(result.title).toBe('Updated Issue');
      expect(result.description).toBe('Updated Description');
    });
    
    it('should throw an error if issue ID is not provided', async () => {
      const updateData = {
        title: 'Updated Issue'
      };
      
      await expect(gitlabClient.updateIssue(null, updateData)).rejects.toThrow('Issue ID is required');
    });
    
    it('should only update fields that are provided', async () => {
      const updateData = {
        title: 'Updated Issue'
      };
      
      const result = await gitlabClient.updateIssue(101, updateData);
      
      expect(result).toBeDefined();
      expect(result.title).toBe('Updated Issue');
      expect(result.description).toBe('Original description');
    });
    
    it('should handle state updates', async () => {
      const updateData = {
        state: 'close'
      };
      
      const result = await gitlabClient.updateIssue(101, updateData);
      
      expect(result).toBeDefined();
      expect(result.state).toBe('closed');
    });
  });
  
  describe('searchIssues', () => {
    it('should search for issues with the provided parameters', async () => {
      const params = {
        state: 'opened'
      };
      
      const result = await gitlabClient.searchIssues(params);
      
      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('Test Issue 1');
      expect(result[1].title).toBe('Test Issue 2');
    });
    
    it('should use provided options if specified', async () => {
      const params = {
        state: 'opened',
        labels: ['bug'],
        author: 'testuser',
        assignee: 'assigneeuser',
        search: 'test',
        maxResults: 5,
        page: 2
      };
      
      const result = await gitlabClient.searchIssues(params);
      
      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
    });
    
    it('should throw an error if GitLab search fails', async () => {
      const params = {
        search: 'api_error'
      };
      
      await expect(gitlabClient.searchIssues(params)).rejects.toThrow('GitLab API error');
    });
  });
  
  describe('error handling', () => {
    it('should detect missing environment variables', () => {
      delete process.env.GITLAB_URL;
      delete process.env.GITLAB_TOKEN;
      delete process.env.GITLAB_PROJECT_ID;
      
      expect(gitlabClient.hasRequiredEnv()).toBe(false);
    });
  });
});

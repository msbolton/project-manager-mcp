/**
 * GitLab Client Module
 * 
 * Handles GitLab API interactions for issue management
 */

require('dotenv').config();
const { Gitlab } = require('@gitbeaker/node');

/**
 * Check if environment has all required GitLab configuration
 * @returns {boolean} True if all required variables are present
 */
function hasRequiredEnv() {
  return !!(process.env.GITLAB_URL && process.env.GITLAB_TOKEN && process.env.GITLAB_PROJECT_ID);
}

/**
 * Initialize GitLab client with authentication details
 */
function initializeClient() {
  // Validate required environment variables
  if (!hasRequiredEnv()) {
    throw new Error('Missing required GitLab configuration. Please check .env file.');
  }

  return new Gitlab({
    host: process.env.GITLAB_URL,
    token: process.env.GITLAB_TOKEN
  });
}

/**
 * Create a new issue in GitLab
 * 
 * @param {Object} issueData - Issue data including title, description, etc.
 * @returns {Promise<Object>} - Created issue
 */
async function createIssue(issueData) {
  try {
    // Check required env variables
    if (!hasRequiredEnv()) {
      throw new Error('Missing required GitLab configuration. Please check .env file.');
    }
    
    const gitlab = initializeClient();
    const projectId = process.env.GITLAB_PROJECT_ID;
    
    // Validate required fields
    if (!issueData.title) {
      throw new Error('Issue title is required');
    }
    
    const issue = {
      title: issueData.title,
      description: issueData.description || '',
      labels: issueData.labels || [],
    };
    
    // Add optional fields if provided
    if (issueData.assigneeId) {
      issue.assignee_id = issueData.assigneeId;
    }
    
    if (issueData.dueDate) {
      issue.due_date = issueData.dueDate;
    }
    
    if (issueData.weight) {
      issue.weight = issueData.weight;
    }
    
    return await gitlab.Issues.create(projectId, issue);
  } catch (error) {
    console.error('Error creating GitLab issue:', error.message);
    throw error;
  }
}

/**
 * Update an existing issue in GitLab
 * 
 * @param {string} issueId - The issue ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} - Updated issue
 */
async function updateIssue(issueId, updateData) {
  try {
    const gitlab = initializeClient();
    const projectId = process.env.GITLAB_PROJECT_ID;
    
    if (!issueId) {
      throw new Error('Issue ID is required');
    }
    
    const issue = {};
    
    // Map update fields
    if (updateData.title) {
      issue.title = updateData.title;
    }
    
    if (updateData.description) {
      issue.description = updateData.description;
    }
    
    if (updateData.assigneeId) {
      issue.assignee_id = updateData.assigneeId;
    }
    
    if (updateData.labels) {
      issue.labels = updateData.labels;
    }
    
    if (updateData.state) {
      issue.state_event = updateData.state === 'close' ? 'close' : 'reopen';
    }
    
    return await gitlab.Issues.edit(projectId, issueId, issue);
  } catch (error) {
    console.error('Error updating GitLab issue:', error.message);
    throw error;
  }
}

/**
 * Search for issues using GitLab API
 * 
 * @param {Object} params - Search parameters
 * @returns {Promise<Object>} - Search results
 */
async function searchIssues(params = {}) {
  try {
    const gitlab = initializeClient();
    const projectId = process.env.GITLAB_PROJECT_ID;
    
    const searchOptions = {
      // Default options
      scope: 'all',
      state: params.state || 'opened',
      per_page: params.maxResults || 20,
      page: params.page || 1
    };
    
    // Add optional search parameters
    if (params.labels) {
      searchOptions.labels = params.labels;
    }
    
    if (params.author) {
      searchOptions.author_username = params.author;
    }
    
    if (params.assignee) {
      searchOptions.assignee_username = params.assignee;
    }
    
    if (params.search) {
      searchOptions.search = params.search;
    }
    
    // Get project issues with the search parameters
    return await gitlab.Issues.all({ projectId, ...searchOptions });
  } catch (error) {
    console.error('Error searching GitLab issues:', error.message);
    throw error;
  }
}

module.exports = {
  createIssue,
  updateIssue,
  searchIssues,
  hasRequiredEnv
};

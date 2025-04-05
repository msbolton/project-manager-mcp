/**
 * JIRA Client Module
 * 
 * Handles JIRA API interactions for issue management
 */

require('dotenv').config();
const JiraClient = require('jira-client');

/**
 * Check if environment has all required JIRA configuration
 * @returns {boolean} True if all required variables are present
 */
function hasRequiredEnv() {
  return !!(process.env.JIRA_URL && process.env.JIRA_TOKEN && process.env.JIRA_EMAIL);
}

/**
 * Initialize JIRA client with authentication details
 */
function initializeClient() {
  // Validate required environment variables
  if (!hasRequiredEnv()) {
    throw new Error('Missing required JIRA configuration. Please check .env file.');
  }

  // Extract host from URL (removing protocol)
  const hostUrl = process.env.JIRA_URL.replace(/^https?:\/\//, '');

  return new JiraClient({
    protocol: 'https',
    host: hostUrl,
    username: process.env.JIRA_EMAIL,
    password: process.env.JIRA_TOKEN,
    apiVersion: '2',
    strictSSL: true
  });
}

/**
 * Create a new issue in JIRA
 * 
 * @param {Object} issueData - Issue data including summary, description, etc.
 * @returns {Promise<Object>} - Created issue
 */
async function createIssue(issueData) {
  try {
    // Check required env variables for testing
    if (!hasRequiredEnv()) {
      throw new Error('Missing required JIRA configuration. Please check .env file.');
    }
    
    const jira = initializeClient();
    
    // Default values and validation
    if (!issueData.projectKey) {
      issueData.projectKey = process.env.JIRA_PROJECT;
    }
    
    if (!issueData.summary) {
      throw new Error('Issue summary is required');
    }
    
    const issue = {
      fields: {
        project: {
          key: issueData.projectKey
        },
        summary: issueData.summary,
        description: issueData.description || '',
        issuetype: {
          name: issueData.issueType || 'Task'
        }
      }
    };
    
    // Add optional fields if provided
    if (issueData.assignee) {
      issue.fields.assignee = { name: issueData.assignee };
    }
    
    if (issueData.labels && Array.isArray(issueData.labels)) {
      issue.fields.labels = issueData.labels;
    }
    
    return await jira.addNewIssue(issue);
  } catch (error) {
    console.error('Error creating JIRA issue:', error.message);
    throw error;
  }
}

/**
 * Update an existing issue in JIRA
 * 
 * @param {string} issueKey - The issue key (e.g., "PROJECT-123")
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} - Updated issue
 */
async function updateIssue(issueKey, updateData) {
  try {
    const jira = initializeClient();
    
    if (!issueKey) {
      throw new Error('Issue key is required');
    }
    
    const issue = {
      fields: {}
    };
    
    // Map update fields
    if (updateData.summary) {
      issue.fields.summary = updateData.summary;
    }
    
    if (updateData.description) {
      issue.fields.description = updateData.description;
    }
    
    if (updateData.assignee) {
      issue.fields.assignee = { name: updateData.assignee };
    }
    
    if (updateData.status) {
      // Note: Status transitions require additional handling via transitions API
      // This is a placeholder for more complex implementation
      console.warn('Status updates require transition handling - not implemented directly');
    }
    
    return await jira.updateIssue(issueKey, issue);
  } catch (error) {
    console.error('Error updating JIRA issue:', error.message);
    throw error;
  }
}

/**
 * Search for issues using JQL
 * 
 * @param {string} jql - JQL query string
 * @param {Object} options - Additional options (maxResults, startAt, fields)
 * @returns {Promise<Object>} - Search results
 */
async function searchIssues(jql, options = {}) {
  try {
    const jira = initializeClient();
    
    const searchOptions = {
      jql: jql,
      maxResults: options.maxResults || 50,
      startAt: options.startAt || 0,
      fields: options.fields || ['summary', 'status', 'assignee', 'description', 'created', 'updated']
    };
    
    return await jira.searchJira(searchOptions.jql, searchOptions);
  } catch (error) {
    console.error('Error searching JIRA issues:', error.message);
    throw error;
  }
}

module.exports = {
  createIssue,
  updateIssue,
  searchIssues,
  // Export for testing
  hasRequiredEnv
};

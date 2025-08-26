#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Use environment variables for authentication
let credentials, serviceAccountEmail, analyticsDataClient;
try {
  if (process.env.GOOGLE_CREDENTIALS) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    serviceAccountEmail = credentials.client_email;
    analyticsDataClient = new BetaAnalyticsDataClient({
      projectId: credentials.project_id,
      credentials: credentials
    });
  } else {
    console.warn('GOOGLE_CREDENTIALS not set - authentication will fail when making actual API calls');
    serviceAccountEmail = 'not-configured@example.com';
  }
} catch (error) {
  console.error('Error parsing GOOGLE_CREDENTIALS:', error);
  serviceAccountEmail = 'invalid-config@example.com';
}

// Helper function to handle errors with helpful messages
async function executeWithErrorHandling(fn, propertyId) {
  // Check if analyticsDataClient is properly initialized
  if (!analyticsDataClient) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Google Analytics client not initialized',
          solution: 'Please ensure GOOGLE_CREDENTIALS environment variable is properly set with valid service account JSON',
          propertyId: propertyId
        }, null, 2)
      }]
    };
  }

  try {
    return await fn();
  } catch (error) {
    // Handle permission errors specifically
    if (error.code === 7 || error.message?.includes('permission')) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Permission denied for this Google Analytics property',
            propertyId: propertyId,
            solution: `Please grant access to the service account: ${serviceAccountEmail}`,
            steps: [
              '1. Go to Google Analytics (analytics.google.com)',
              '2. Navigate to Admin > Property Access Management',
              `3. Add ${serviceAccountEmail} with Viewer access`,
              '4. Try the query again'
            ],
            originalError: error.message
          }, null, 2)
        }]
      };
    }
    
    // Handle other errors
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Failed to fetch analytics data',
          message: error.message,
          propertyId: propertyId
        }, null, 2)
      }]
    };
  }
}

// Helper function to validate property ID
function validatePropertyId(propertyId) {
  if (!propertyId) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: 'Property ID is required. Please specify a propertyId parameter.',
          example: 'propertyId: "123456789"',
          instruction: 'Please provide the Google Analytics 4 property ID you want to query.'
        }, null, 2)
      }]
    };
  }
  return null;
}

// Create server function to instantiate fresh server for each session
const getServer = () => {
  const server = new McpServer({
    name: 'google-analytics-mcp',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {}
    }
  });

  // Main analytics query tool - can handle any type of report
  server.registerTool('analytics_report', {
    title: 'Analytics Report',
    description: 'Get comprehensive Google Analytics data with custom dimensions and metrics. Can create any type of report.',
    inputSchema: {
      propertyId: z.string().describe('Google Analytics property ID (e.g., 123456789). Required for all queries.'),
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      dimensions: z.array(z.string()).optional().describe('Dimensions to query (e.g., country, pagePath, sessionSource)'),
      metrics: z.array(z.string()).describe('Metrics to query (e.g., activeUsers, sessions, screenPageViews)'),
      dimensionFilter: z.record(z.any()).optional().describe('Filter by dimension values'),
      metricFilter: z.record(z.any()).optional().describe('Filter by dimension values'),
      orderBy: z.object({
        dimension: z.string().optional(),
        metric: z.string().optional(),
        desc: z.boolean().optional().default(true)
      }).optional().describe('Sort results by dimension or metric'),
      limit: z.number().optional().default(100).describe('Limit number of results')
    }
  }, async ({ propertyId, startDate, endDate, dimensions = [], metrics, dimensionFilter, metricFilter, orderBy, limit = 100 }) => {
    const validationError = validatePropertyId(propertyId);
    if (validationError) return validationError;

    return executeWithErrorHandling(async () => {
      const reportRequest = {
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: dimensions.map(name => ({ name })),
        metrics: metrics.map(name => ({ name })),
        limit
      };

      if (dimensionFilter) {
        reportRequest.dimensionFilter = dimensionFilter;
      }

      if (metricFilter) {
        reportRequest.metricFilter = metricFilter;
      }

      if (orderBy) {
        if (orderBy.metric) {
          reportRequest.orderBys = [{ metric: { metricName: orderBy.metric }, desc: orderBy.desc }];
        } else if (orderBy.dimension) {
          reportRequest.orderBys = [{ dimension: { dimensionName: orderBy.dimension }, desc: orderBy.desc }];
        }
      }

      const [response] = await analyticsDataClient.runReport(reportRequest);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    }, propertyId);
});

  // Real-time data tool
  server.registerTool('realtime_data', {
    title: 'Real-time Data',
    description: 'Get real-time analytics data for current active users and activity',
    inputSchema: {
      propertyId: z.string().describe('Google Analytics property ID (e.g., 123456789). Required for all queries.'),
      dimensions: z.array(z.string()).optional().describe('Dimensions for real-time data (e.g., country, city, pagePath)'),
      metrics: z.array(z.string()).optional().default(['activeUsers']).describe('Real-time metrics (default: activeUsers)'),
      limit: z.number().optional().default(50).describe('Limit number of results')
    }
  }, async ({ propertyId, dimensions = [], metrics = ['activeUsers'], limit = 50 }) => {
    const validationError = validatePropertyId(propertyId);
    if (validationError) return validationError;

    return executeWithErrorHandling(async () => {
      const [response] = await analyticsDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        dimensions: dimensions.map(name => ({ name })),
        metrics: metrics.map(name => ({ name })),
        limit
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    }, propertyId);
});

  // Quick insights tool for common reports
  server.registerTool('quick_insights', {
    title: 'Quick Insights',
    description: 'Get predefined analytics insights for common use cases',
    inputSchema: {
      propertyId: z.string().describe('Google Analytics property ID (e.g., 123456789). Required for all queries.'),
      startDate: z.string().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().describe('End date (YYYY-MM-DD)'),
      reportType: z.enum([
        'overview',
        'top_pages',
        'traffic_sources',
        'geographic',
        'user_demographics',
        'conversions',
        'us_states',
        'engagement_metrics',
        'ecommerce_overview',
        'device_technology'
      ]).describe('Type of quick insight report'),
      limit: z.number().optional().default(20).describe('Limit number of results')
    }
  }, async ({ propertyId, startDate, endDate, reportType, limit = 20 }) => {
    const validationError = validatePropertyId(propertyId);
    if (validationError) return validationError;

    return executeWithErrorHandling(async () => {
      let reportConfig = {};

      switch (reportType) {
        case 'overview':
          reportConfig = {
            dimensions: ['date'],
            metrics: ['activeUsers', 'sessions', 'screenPageViews', 'bounceRate', 'averageSessionDuration']
          };
          break;

        case 'top_pages':
          reportConfig = {
            dimensions: ['pagePath', 'pageTitle'],
            metrics: ['screenPageViews', 'activeUsers', 'bounceRate'],
            orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }]
          };
          break;

        case 'traffic_sources':
          reportConfig = {
            dimensions: ['sessionDefaultChannelGroup', 'sessionSource', 'sessionMedium'],
            metrics: ['sessions', 'activeUsers', 'newUsers', 'bounceRate'],
            orderBys: [{ metric: { metricName: 'sessions' }, desc: true }]
          };
          break;

        case 'geographic':
          reportConfig = {
            dimensions: ['country', 'region', 'city'],
            metrics: ['activeUsers', 'sessions', 'newUsers', 'bounceRate'],
            orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }]
          };
          break;

        case 'user_demographics':
          reportConfig = {
            dimensions: ['userAgeBracket', 'userGender', 'country'],
            metrics: ['activeUsers', 'sessions', 'averageSessionDuration', 'bounceRate']
          };
          break;

        case 'conversions':
          reportConfig = {
            dimensions: ['eventName', 'sessionDefaultChannelGroup'],
            metrics: ['conversions', 'eventCount', 'eventValue'],
            dimensionFilter: {
              filter: {
                fieldName: 'eventName',
                stringFilter: { matchType: 'CONTAINS', value: 'conversion' }
              }
            }
          };
          break;

        case 'us_states':
          reportConfig = {
            dimensions: ['region', 'city'],
            metrics: ['activeUsers', 'sessions', 'newUsers'],
            dimensionFilter: {
              filter: {
                fieldName: 'country',
                stringFilter: { matchType: 'EXACT', value: 'United States' }
              }
            },
            orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }]
          };
          break;

        case 'engagement_metrics':
          reportConfig = {
            dimensions: ['date'],
            metrics: ['bounceRate', 'engagementRate', 'engagedSessions', 'averageSessionDuration', 'screenPageViewsPerSession', 'userEngagementDuration']
          };
          break;

        case 'ecommerce_overview':
          reportConfig = {
            dimensions: ['date'],
            metrics: ['totalRevenue', 'transactions', 'averagePurchaseRevenue', 'itemRevenue', 'addToCarts', 'checkouts', 'ecommercePurchases']
          };
          break;

        case 'device_technology':
          reportConfig = {
            dimensions: ['deviceCategory', 'operatingSystem', 'browser'],
            metrics: ['activeUsers', 'sessions', 'bounceRate', 'averageSessionDuration'],
            orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }]
          };
          break;
      }

      const reportRequest = {
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate, endDate }],
        dimensions: reportConfig.dimensions.map(name => ({ name })),
        metrics: reportConfig.metrics.map(name => ({ name })),
        limit
      };

      if (reportConfig.dimensionFilter) {
        reportRequest.dimensionFilter = reportConfig.dimensionFilter;
      }

      if (reportConfig.orderBys) {
        reportRequest.orderBys = reportConfig.orderBys;
      }

      const [response] = await analyticsDataClient.runReport(reportRequest);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response, null, 2)
          }
        ]
      };
    }, propertyId);
});

  // Tool to get available dimensions and metrics
  server.registerTool('get_metadata', {
    title: 'Get Analytics Metadata',
    description: 'Get available dimensions and metrics for Google Analytics property',
    inputSchema: {
      propertyId: z.string().describe('Google Analytics property ID (e.g., 123456789). Required for all queries.'),
      type: z.enum(['dimensions', 'metrics', 'both']).optional().default('both').describe('Type of metadata to retrieve')
    }
  }, async ({ propertyId, type = 'both' }) => {
    const validationError = validatePropertyId(propertyId);
    if (validationError) return validationError;

    return executeWithErrorHandling(async () => {
      const [response] = await analyticsDataClient.getMetadata({
        name: `properties/${propertyId}/metadata`
      });

      let result = {};

      if (type === 'dimensions' || type === 'both') {
        result.dimensions = response.dimensions?.map(dim => ({
          apiName: dim.apiName,
          uiName: dim.uiName,
          description: dim.description,
          category: dim.category,
          customDefinition: dim.customDefinition
        })) || [];
      }

      if (type === 'metrics' || type === 'both') {
        result.metrics = response.metrics?.map(metric => ({
          apiName: metric.apiName,
          uiName: metric.uiName,
          description: metric.description,
          type: metric.type,
          category: metric.category,
          customDefinition: metric.customDefinition
        })) || [];
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }, propertyId);
});

  // Tool to search for specific dimensions or metrics
  server.registerTool('search_metadata', {
    title: 'Search Analytics Metadata',
    description: 'Search for specific dimensions or metrics by name or category',
    inputSchema: {
      propertyId: z.string().describe('Google Analytics property ID (e.g., 123456789). Required for all queries.'),
      query: z.string().describe('Search term to find dimensions/metrics'),
      type: z.enum(['dimensions', 'metrics', 'both']).optional().default('both').describe('Type of metadata to search'),
      category: z.string().optional().describe('Filter by category (e.g., "USER", "SESSION", "PAGE", "EVENT")')
    }
  }, async ({ propertyId, query, type = 'both', category }) => {
    const validationError = validatePropertyId(propertyId);
    if (validationError) return validationError;

    return executeWithErrorHandling(async () => {
      const [response] = await analyticsDataClient.getMetadata({
        name: `properties/${propertyId}/metadata`
      });

      const searchTerm = query.toLowerCase();
      let result = {};

      if (type === 'dimensions' || type === 'both') {
        result.dimensions = response.dimensions?.filter(dim => {
          const matchesSearch =
            dim.apiName?.toLowerCase().includes(searchTerm) ||
            dim.uiName?.toLowerCase().includes(searchTerm) ||
            dim.description?.toLowerCase().includes(searchTerm);

          const matchesCategory = !category || dim.category === category;

          return matchesSearch && matchesCategory;
        }).map(dim => ({
          apiName: dim.apiName,
          uiName: dim.uiName,
          description: dim.description,
          category: dim.category,
          customDefinition: dim.customDefinition
        })) || [];
      }

      if (type === 'metrics' || type === 'both') {
        result.metrics = response.metrics?.filter(metric => {
          const matchesSearch =
            metric.apiName?.toLowerCase().includes(searchTerm) ||
            metric.uiName?.toLowerCase().includes(searchTerm) ||
            metric.description?.toLowerCase().includes(searchTerm);

          const matchesCategory = !category || metric.category === category;

          return matchesSearch && matchesCategory;
        }).map(metric => ({
          apiName: metric.apiName,
          uiName: metric.uiName,
          description: metric.description,
          type: metric.type,
          category: metric.category,
          customDefinition: metric.customDefinition
        })) || [];
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }, propertyId);
});

  return server;
};

async function main() {
  const app = express();
  const PORT = process.env.PORT || 3000;
  
  app.use(cors());
  app.use(express.json());
  
  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  // MCP Streamable HTTP endpoint - supports both POST and GET
  app.all('/mcp', async (req, res) => {
    try {
      // Validate Origin header to prevent DNS rebinding attacks
      const origin = req.get('Origin');
      if (origin && !origin.startsWith('http://localhost') && !origin.startsWith('https://localhost')) {
        return res.status(403).json({
          jsonrpc: '2.0',
          error: {
            code: -32600,
            message: 'Invalid origin',
          },
          id: null,
        });
      }

      // For GET requests (SSE connection setup)
      if (req.method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Accept, Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        });
        
        // Keep connection alive
        res.write(': connected\n\n');
        
        // Handle connection close
        req.on('close', () => {
          res.end();
        });
        
        return;
      }

      // For POST requests - handle JSON-RPC messages
      if (req.method === 'POST') {
        // Validate Accept header
        const accept = req.get('Accept');
        if (!accept || (!accept.includes('application/json') && !accept.includes('text/event-stream'))) {
          return res.status(406).json({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Must accept application/json or text/event-stream',
            },
            id: null,
          });
        }

        // Handle JSON-RPC request
        const body = req.body;
        if (!body) {
          return res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Invalid Request',
            },
            id: null,
          });
        }

        // Create server and transport for this request
        const server = getServer();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID()
        });
        
        await server.connect(transport);
        await transport.handleRequest(req, res, body);
        return;
      }

      // Handle OPTIONS for CORS preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Accept, Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
        });
        res.end();
        return;
      }

      // Unsupported method
      res.status(405).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Method not allowed',
        },
        id: null,
      });
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error',
          },
          id: null,
        });
      }
    }
  });
  
  app.listen(PORT, () => {
    console.log(`MCP server running on port ${PORT}`);
    console.log(`Connect to: http://localhost:${PORT}/mcp`);
  });
}

main().catch(console.error);
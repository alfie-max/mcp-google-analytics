#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

// Support both service account file and individual environment variables
let analyticsDataClient;
if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
  // Use individual environment variables (better for deployment)
  analyticsDataClient = new BetaAnalyticsDataClient({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      project_id: process.env.GOOGLE_PROJECT_ID
    }
  });
} else {
  // Use service account file (for local development)
  analyticsDataClient = new BetaAnalyticsDataClient();
}

const defaultPropertyId = process.env.GA_PROPERTY_ID;

const server = new McpServer({
  name: 'google-analytics-mcp',
  version: '1.0.0',
});

// Main analytics query tool - can handle any type of report
server.registerTool('analytics_report', {
  title: 'Analytics Report',
  description: 'Get comprehensive Google Analytics data with custom dimensions and metrics. Can create any type of report.',
  inputSchema: {
    propertyId: z.string().optional().describe(`Google Analytics property ID (default: ${defaultPropertyId})`),
    startDate: z.string().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().describe('End date (YYYY-MM-DD)'),
    dimensions: z.array(z.string()).optional().describe('Dimensions to query (e.g., country, pagePath, sessionSource)'),
    metrics: z.array(z.string()).describe('Metrics to query (e.g., activeUsers, sessions, screenPageViews)'),
    dimensionFilter: z.record(z.any()).optional().describe('Filter by dimension values'),
    metricFilter: z.record(z.any()).optional().describe('Filter by metric values'),
    orderBy: z.object({
      dimension: z.string().optional(),
      metric: z.string().optional(),
      desc: z.boolean().optional().default(true)
    }).optional().describe('Sort results by dimension or metric'),
    limit: z.number().optional().default(100).describe('Limit number of results')
  }
}, async ({ propertyId = defaultPropertyId, startDate, endDate, dimensions = [], metrics, dimensionFilter, metricFilter, orderBy, limit = 100 }) => {
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
});

// Real-time data tool
server.registerTool('realtime_data', {
  title: 'Real-time Data',
  description: 'Get real-time analytics data for current active users and activity',
  inputSchema: {
    propertyId: z.string().optional().describe(`Google Analytics property ID (default: ${defaultPropertyId})`),
    dimensions: z.array(z.string()).optional().describe('Dimensions for real-time data (e.g., country, city, pagePath)'),
    metrics: z.array(z.string()).optional().default(['activeUsers']).describe('Real-time metrics (default: activeUsers)'),
    limit: z.number().optional().default(50).describe('Limit number of results')
  }
}, async ({ propertyId = defaultPropertyId, dimensions = [], metrics = ['activeUsers'], limit = 50 }) => {
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
});

// Quick insights tool for common reports
server.registerTool('quick_insights', {
  title: 'Quick Insights',
  description: 'Get predefined analytics insights for common use cases',
  inputSchema: {
    propertyId: z.string().optional().describe(`Google Analytics property ID (default: ${defaultPropertyId})`),
    startDate: z.string().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().describe('End date (YYYY-MM-DD)'),
    reportType: z.enum([
      'overview',
      'top_pages',
      'traffic_sources',
      'geographic',
      'user_demographics',
      'conversions',
      'us_states'
    ]).describe('Type of quick insight report'),
    limit: z.number().optional().default(20).describe('Limit number of results')
  }
}, async ({ propertyId = defaultPropertyId, startDate, endDate, reportType, limit = 20 }) => {
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
        metrics: ['activeUsers', 'sessions', 'newUsers'],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }]
      };
      break;

    case 'user_demographics':
      reportConfig = {
        dimensions: ['userAgeBracket', 'userGender', 'country'],
        metrics: ['activeUsers', 'sessions', 'averageSessionDuration']
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
});

// Tool to get available dimensions and metrics
server.registerTool('get_metadata', {
  title: 'Get Analytics Metadata',
  description: 'Get available dimensions and metrics for Google Analytics property',
  inputSchema: {
    propertyId: z.string().optional().describe(`Google Analytics property ID (default: ${defaultPropertyId})`),
    type: z.enum(['dimensions', 'metrics', 'both']).optional().default('both').describe('Type of metadata to retrieve')
  }
}, async ({ propertyId = defaultPropertyId, type = 'both' }) => {
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
});

// Tool to search for specific dimensions or metrics
server.registerTool('search_metadata', {
  title: 'Search Analytics Metadata',
  description: 'Search for specific dimensions or metrics by name or category',
  inputSchema: {
    propertyId: z.string().optional().describe(`Google Analytics property ID (default: ${defaultPropertyId})`),
    query: z.string().describe('Search term to find dimensions/metrics'),
    type: z.enum(['dimensions', 'metrics', 'both']).optional().default('both').describe('Type of metadata to search'),
    category: z.string().optional().describe('Filter by category (e.g., "USER", "SESSION", "PAGE", "EVENT")')
  }
}, async ({ propertyId = defaultPropertyId, query, type = 'both', category }) => {
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
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();

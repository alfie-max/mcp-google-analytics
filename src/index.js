#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const analyticsDataClient = new BetaAnalyticsDataClient();
const defaultPropertyId = process.env.GA_PROPERTY_ID;

const server = new McpServer({
  name: 'google-analytics-mcp',
  version: '1.0.0',
});

server.registerTool('query_analytics', {
  title: 'Query Analytics',
  description: 'Query Google Analytics data with custom dimensions and metrics',
  inputSchema: {
    propertyId: z.string().optional().describe(`Google Analytics property ID (default: ${defaultPropertyId})`),
    startDate: z.string().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().describe('End date (YYYY-MM-DD)'),
    dimensions: z.array(z.string()).optional().describe('Dimensions to query'),
    metrics: z.array(z.string()).describe('Metrics to query'),
    limit: z.number().optional().default(100).describe('Limit number of results')
  }
}, async ({ propertyId = defaultPropertyId, startDate, endDate, dimensions = [], metrics, limit = 100 }) => {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
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

server.registerTool('get_realtime_data', {
  title: 'Get Realtime Data',
  description: 'Get real-time analytics data',
  inputSchema: {
    propertyId: z.string().optional().describe(`Google Analytics property ID (default: ${defaultPropertyId})`),
    dimensions: z.array(z.string()).optional().describe('Dimensions to query'),
    metrics: z.array(z.string()).describe('Metrics to query')
  }
}, async ({ propertyId = defaultPropertyId, dimensions = [], metrics }) => {
  const [response] = await analyticsDataClient.runRealtimeReport({
    property: `properties/${propertyId}`,
    dimensions: dimensions.map(name => ({ name })),
    metrics: metrics.map(name => ({ name }))
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

server.registerTool('get_traffic_sources', {
  title: 'Get Traffic Sources',
  description: 'Get traffic sources data including referrers, channels, and campaigns',
  inputSchema: {
    propertyId: z.string().optional().describe(`Google Analytics property ID (default: ${defaultPropertyId})`),
    startDate: z.string().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().describe('End date (YYYY-MM-DD)'),
    limit: z.number().optional().default(50).describe('Limit number of results')
  }
}, async ({ propertyId = defaultPropertyId, startDate, endDate, limit = 50 }) => {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionDefaultChannelGroup' },
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
      { name: 'sessionCampaignName' }
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'bounceRate' }
    ],
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

server.registerTool('get_user_demographics', {
  title: 'Get User Demographics',
  description: 'Get user demographics including age, gender, and interests',
  inputSchema: {
    propertyId: z.string().optional().describe(`Google Analytics property ID (default: ${defaultPropertyId})`),
    startDate: z.string().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().describe('End date (YYYY-MM-DD)')
  }
}, async ({ propertyId = defaultPropertyId, startDate, endDate }) => {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'userAgeBracket' },
      { name: 'userGender' },
      { name: 'country' },
      { name: 'city' }
    ],
    metrics: [
      { name: 'activeUsers' },
      { name: 'newUsers' },
      { name: 'sessions' },
      { name: 'averageSessionDuration' }
    ]
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

server.registerTool('get_page_performance', {
  title: 'Get Page Performance',
  description: 'Get page performance metrics including pageviews, bounce rate, and session duration',
  inputSchema: {
    propertyId: z.string().optional().describe(`Google Analytics property ID (default: ${defaultPropertyId})`),
    startDate: z.string().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().describe('End date (YYYY-MM-DD)'),
    limit: z.number().optional().default(50).describe('Limit number of results')
  }
}, async ({ propertyId = defaultPropertyId, startDate, endDate, limit = 50 }) => {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'pagePath' },
      { name: 'pageTitle' }
    ],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
      { name: 'sessions' }
    ],
    orderBys: [
      {
        metric: { metricName: 'screenPageViews' },
        desc: true
      }
    ],
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

server.registerTool('get_conversion_data', {
  title: 'Get Conversion Data',
  description: 'Get conversion and goal completion data',
  inputSchema: {
    propertyId: z.string().optional().describe(`Google Analytics property ID (default: ${defaultPropertyId})`),
    startDate: z.string().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().describe('End date (YYYY-MM-DD)')
  }
}, async ({ propertyId = defaultPropertyId, startDate, endDate }) => {
  const [response] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'eventName' },
      { name: 'sessionDefaultChannelGroup' }
    ],
    metrics: [
      { name: 'conversions' },
      { name: 'eventCount' },
      { name: 'eventValue' },
      { name: 'sessions' }
    ],
    dimensionFilter: {
      filter: {
        fieldName: 'eventName',
        stringFilter: {
          matchType: 'CONTAINS',
          value: 'conversion'
        }
      }
    }
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

server.registerTool('get_custom_report', {
  title: 'Get Custom Report',
  description: 'Create a custom report with specified dimensions, metrics, and filters',
  inputSchema: {
    propertyId: z.string().optional().describe(`Google Analytics property ID (default: ${defaultPropertyId})`),
    startDate: z.string().describe('Start date (YYYY-MM-DD)'),
    endDate: z.string().describe('End date (YYYY-MM-DD)'),
    dimensions: z.array(z.string()).describe('Dimensions to query'),
    metrics: z.array(z.string()).describe('Metrics to query'),
    dimensionFilter: z.record(z.any()).optional().describe('Dimension filter object'),
    metricFilter: z.record(z.any()).optional().describe('Metric filter object'),
    orderBys: z.array(z.record(z.any())).optional().describe('Order by rules'),
    limit: z.number().optional().default(100).describe('Limit number of results')
  }
}, async ({ propertyId = defaultPropertyId, startDate, endDate, dimensions, metrics, dimensionFilter, metricFilter, orderBys, limit = 100 }) => {
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

  if (orderBys) {
    reportRequest.orderBys = orderBys;
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

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main();
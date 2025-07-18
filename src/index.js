#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import dotenv from 'dotenv';

dotenv.config();

const analyticsDataClient = new BetaAnalyticsDataClient();

const server = new Server(
  {
    name: 'google-analytics-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'query_analytics',
      description: 'Query Google Analytics data with custom dimensions and metrics',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: { type: 'string', description: 'Google Analytics property ID' },
          startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
          dimensions: { type: 'array', items: { type: 'string' }, description: 'Dimensions to query' },
          metrics: { type: 'array', items: { type: 'string' }, description: 'Metrics to query' },
          limit: { type: 'number', description: 'Limit number of results', default: 100 }
        },
        required: ['propertyId', 'startDate', 'endDate', 'metrics']
      }
    },
    {
      name: 'get_realtime_data',
      description: 'Get real-time analytics data',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: { type: 'string', description: 'Google Analytics property ID' },
          dimensions: { type: 'array', items: { type: 'string' }, description: 'Dimensions to query' },
          metrics: { type: 'array', items: { type: 'string' }, description: 'Metrics to query' }
        },
        required: ['propertyId', 'metrics']
      }
    },
    {
      name: 'get_traffic_sources',
      description: 'Get traffic sources data including referrers, channels, and campaigns',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: { type: 'string', description: 'Google Analytics property ID' },
          startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
          limit: { type: 'number', description: 'Limit number of results', default: 50 }
        },
        required: ['propertyId', 'startDate', 'endDate']
      }
    },
    {
      name: 'get_user_demographics',
      description: 'Get user demographics including age, gender, and interests',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: { type: 'string', description: 'Google Analytics property ID' },
          startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' }
        },
        required: ['propertyId', 'startDate', 'endDate']
      }
    },
    {
      name: 'get_page_performance',
      description: 'Get page performance metrics including pageviews, bounce rate, and session duration',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: { type: 'string', description: 'Google Analytics property ID' },
          startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
          limit: { type: 'number', description: 'Limit number of results', default: 50 }
        },
        required: ['propertyId', 'startDate', 'endDate']
      }
    },
    {
      name: 'get_conversion_data',
      description: 'Get conversion and goal completion data',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: { type: 'string', description: 'Google Analytics property ID' },
          startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' }
        },
        required: ['propertyId', 'startDate', 'endDate']
      }
    },
    {
      name: 'get_custom_report',
      description: 'Create a custom report with specified dimensions, metrics, and filters',
      inputSchema: {
        type: 'object',
        properties: {
          propertyId: { type: 'string', description: 'Google Analytics property ID' },
          startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
          endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
          dimensions: { type: 'array', items: { type: 'string' }, description: 'Dimensions to query' },
          metrics: { type: 'array', items: { type: 'string' }, description: 'Metrics to query' },
          dimensionFilter: { type: 'object', description: 'Dimension filter object' },
          metricFilter: { type: 'object', description: 'Metric filter object' },
          orderBys: { type: 'array', items: { type: 'object' }, description: 'Order by rules' },
          limit: { type: 'number', description: 'Limit number of results', default: 100 }
        },
        required: ['propertyId', 'startDate', 'endDate', 'dimensions', 'metrics']
      }
    }
  ]
}));

server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'query_analytics': {
        const { propertyId, startDate, endDate, dimensions = [], metrics, limit = 100 } = args;

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
      }

      case 'get_realtime_data': {
        const { propertyId, dimensions = [], metrics } = args;

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
      }

      case 'get_traffic_sources': {
        const { propertyId, startDate, endDate, limit = 50 } = args;

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
      }

      case 'get_user_demographics': {
        const { propertyId, startDate, endDate } = args;

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
      }

      case 'get_page_performance': {
        const { propertyId, startDate, endDate, limit = 50 } = args;

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
      }

      case 'get_conversion_data': {
        const { propertyId, startDate, endDate } = args;

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
      }

      case 'get_custom_report': {
        const {
          propertyId,
          startDate,
          endDate,
          dimensions,
          metrics,
          dimensionFilter,
          metricFilter,
          orderBys,
          limit = 100
        } = args;

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
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  process.exit(1);
});

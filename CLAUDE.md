# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Model Context Protocol (MCP) server for Google Analytics Data API. It provides Claude Desktop with tools to query Google Analytics 4 (GA4) data, including real-time analytics, custom reports, and metadata exploration.

## Architecture

The MCP server (`src/index.js`) implements 5 main tools:
- `analytics_report`: Custom analytics queries with dimensions/metrics
- `realtime_data`: Live user activity data
- `quick_insights`: Pre-built report types (overview, top pages, traffic sources, etc.)
- `get_metadata`: Lists available dimensions and metrics
- `search_metadata`: Searches for specific dimensions/metrics

The server uses:
- `@modelcontextprotocol/sdk` for MCP protocol implementation
- `@google-analytics/data` for GA4 API access
- Environment variables for credentials (`GOOGLE_CREDENTIALS` as JSON string, `GA_PROPERTY_ID`)

## Development Commands

```bash
# Run the MCP server
npm start

# Test the Google Analytics connection and all tools
node test-connection.js
```

## Configuration

The server requires two environment variables:
- `GA_PROPERTY_ID`: Google Analytics 4 property ID
- `GOOGLE_CREDENTIALS`: JSON string containing the complete Google service account credentials

These can be set in a `.env` file or passed directly when configuring the MCP server in Claude Desktop.

## Key Implementation Details

- All tools accept an optional `propertyId` parameter that defaults to the environment variable
- The server uses the BetaAnalyticsDataClient from Google's official SDK
- Report responses are returned as formatted JSON text
- The `quick_insights` tool provides 10 pre-configured report types for common analytics needs
- Error handling is minimal - errors from the Google Analytics API are passed through
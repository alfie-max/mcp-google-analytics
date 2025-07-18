#!/usr/bin/env node
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import dotenv from 'dotenv';

dotenv.config();

async function testConnection() {
  try {
    const analyticsDataClient = new BetaAnalyticsDataClient();
    
    const propertyId = process.env.GA_PROPERTY_ID;
    if (!propertyId) {
      throw new Error('GA_PROPERTY_ID not found in environment variables');
    }

    // Calculate dates for last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };

    console.log('Testing Google Analytics connection...');
    console.log(`Property ID: ${propertyId}`);
    console.log(`Date range: ${formatDate(startDate)} to ${formatDate(endDate)}`);
    console.log('---');

    // Test 1: Basic metrics
    const [basicReport] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        },
      ],
      dimensions: [
        { name: 'date' },
      ],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
      ],
    });

    console.log('✓ Connection successful!');
    console.log('\nLast 7 days summary:');
    
    let totalUsers = 0;
    let totalSessions = 0;
    let totalPageViews = 0;

    basicReport.rows?.forEach(row => {
      const users = parseInt(row.metricValues[0].value);
      const sessions = parseInt(row.metricValues[1].value);
      const pageViews = parseInt(row.metricValues[2].value);
      
      totalUsers += users;
      totalSessions += sessions;
      totalPageViews += pageViews;
    });

    console.log(`- Total Active Users: ${totalUsers}`);
    console.log(`- Total Sessions: ${totalSessions}`);
    console.log(`- Total Page Views: ${totalPageViews}`);

    // Test 2: Top pages
    console.log('\nTop 5 pages:');
    const [pagesReport] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        },
      ],
      dimensions: [
        { name: 'pagePath' },
      ],
      metrics: [
        { name: 'screenPageViews' },
      ],
      orderBys: [
        {
          metric: { metricName: 'screenPageViews' },
          desc: true,
        },
      ],
      limit: 5,
    });

    pagesReport.rows?.forEach((row, index) => {
      console.log(`${index + 1}. ${row.dimensionValues[0].value} - ${row.metricValues[0].value} views`);
    });

    // Test 3: Traffic sources
    console.log('\nTop traffic sources:');
    const [sourcesReport] = await analyticsDataClient.runReport({
      property: `properties/${propertyId}`,
      dateRanges: [
        {
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        },
      ],
      dimensions: [
        { name: 'sessionSource' },
      ],
      metrics: [
        { name: 'sessions' },
      ],
      orderBys: [
        {
          metric: { metricName: 'sessions' },
          desc: true,
        },
      ],
      limit: 5,
    });

    sourcesReport.rows?.forEach((row, index) => {
      console.log(`${index + 1}. ${row.dimensionValues[0].value} - ${row.metricValues[0].value} sessions`);
    });

    console.log('\n✅ All tests passed! Your Google Analytics connection is working properly.');

  } catch (error) {
    console.error('❌ Connection test failed:');
    console.error(error.message);
    
    if (error.code === 7) {
      console.error('\nPermission denied. Please check:');
      console.error('1. Your service account has access to the GA property');
      console.error('2. The GA_PROPERTY_ID is correct');
      console.error('3. The Google Analytics Data API is enabled in your Google Cloud project');
    } else if (error.code === 16) {
      console.error('\nAuthentication failed. Please check:');
      console.error('1. GOOGLE_APPLICATION_CREDENTIALS points to a valid service account JSON file');
      console.error('2. The file exists and is readable');
    }
    
    process.exit(1);
  }
}

testConnection();
#!/usr/bin/env node
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import dotenv from 'dotenv';

dotenv.config();

// Use environment variables for authentication
const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
const serviceAccountEmail = credentials.client_email;
const analyticsDataClient = new BetaAnalyticsDataClient({
  projectId: credentials.project_id,
  credentials: credentials
});

async function testConnection() {
  try {
    // Use command line argument or environment variable
    const propertyId = process.argv[2] || process.env.GA_PROPERTY_ID;
    if (!propertyId) {
      throw new Error('Property ID required. Either set GA_PROPERTY_ID environment variable or pass as command line argument: node test-connection.js 123456789');
    }

    // Calculate dates for last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };

    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);

    console.log('🔍 Testing Google Analytics MCP Server Connection...');
    console.log(`Property ID: ${propertyId}`);
    console.log(`Test date range: ${startDateStr} to ${endDateStr}`);
    console.log('=' .repeat(60));

    let testsPassed = 0;
    const totalTests = 5;

    // Test 1: Basic Analytics Report (custom dimensions/metrics)
    console.log('\n📊 Test 1: Analytics Report (Custom Query)');
    try {
      const [response1] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: startDateStr, endDate: endDateStr }],
        dimensions: [{ name: 'date' }, { name: 'country' }],
        metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
        limit: 10
      });

      console.log('✅ Analytics Report: SUCCESS');
      console.log(`   - Data rows: ${response1.rows?.length || 0}`);
      console.log(`   - Dimensions: date, country`);
      console.log(`   - Metrics: activeUsers, sessions`);
      testsPassed++;
    } catch (error) {
      console.log('❌ Analytics Report: FAILED');
      console.log(`   Error: ${error.message}`);
    }

    // Test 2: Real-time Data
    console.log('\n⚡ Test 2: Real-time Data');
    try {
      const [response2] = await analyticsDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'activeUsers' }],
        limit: 5
      });

      console.log('✅ Real-time Data: SUCCESS');
      console.log(`   - Active users by country: ${response2.rows?.length || 0} countries`);
      if (response2.rows?.[0]) {
        console.log(`   - Top country: ${response2.rows[0].dimensionValues[0].value} (${response2.rows[0].metricValues[0].value} users)`);
      }
      testsPassed++;
    } catch (error) {
      console.log('❌ Real-time Data: FAILED');
      console.log(`   Error: ${error.message}`);
    }

    // Test 3: Quick Insights - Overview
    console.log('\n📈 Test 3: Quick Insights (Overview)');
    try {
      const [response3] = await analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: startDateStr, endDate: endDateStr }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'activeUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'bounceRate' },
          { name: 'averageSessionDuration' }
        ]
      });

      let totalUsers = 0;
      let totalSessions = 0;
      let totalPageViews = 0;

      response3.rows?.forEach(row => {
        totalUsers += parseInt(row.metricValues[0].value);
        totalSessions += parseInt(row.metricValues[1].value);
        totalPageViews += parseInt(row.metricValues[2].value);
      });

      console.log('✅ Quick Insights (Overview): SUCCESS');
      console.log(`   - Total Users: ${totalUsers}`);
      console.log(`   - Total Sessions: ${totalSessions}`);
      console.log(`   - Total Page Views: ${totalPageViews}`);
      testsPassed++;
    } catch (error) {
      console.log('❌ Quick Insights (Overview): FAILED');
      console.log(`   Error: ${error.message}`);
    }

    // Test 4: Get Metadata
    console.log('\n🔍 Test 4: Get Metadata');
    try {
      const [response4] = await analyticsDataClient.getMetadata({
        name: `properties/${propertyId}/metadata`
      });

      console.log('✅ Get Metadata: SUCCESS');
      console.log(`   - Available dimensions: ${response4.dimensions?.length || 0}`);
      console.log(`   - Available metrics: ${response4.metrics?.length || 0}`);

      // Show some example dimensions and metrics
      const sampleDimensions = response4.dimensions?.slice(0, 3).map(d => d.apiName).join(', ');
      const sampleMetrics = response4.metrics?.slice(0, 3).map(m => m.apiName).join(', ');

      console.log(`   - Sample dimensions: ${sampleDimensions}`);
      console.log(`   - Sample metrics: ${sampleMetrics}`);
      testsPassed++;
    } catch (error) {
      console.log('❌ Get Metadata: FAILED');
      console.log(`   Error: ${error.message}`);
    }

    // Test 5: Search Metadata
    console.log('\n🔎 Test 5: Search Metadata');
    try {
      const [response5] = await analyticsDataClient.getMetadata({
        name: `properties/${propertyId}/metadata`
      });

      // Search for "country" related dimensions
      const countryDimensions = response5.dimensions?.filter(dim =>
        dim.apiName?.toLowerCase().includes('country') ||
        dim.uiName?.toLowerCase().includes('country')
      );

      // Search for "user" related metrics
      const userMetrics = response5.metrics?.filter(metric =>
        metric.apiName?.toLowerCase().includes('user') ||
        metric.uiName?.toLowerCase().includes('user')
      );

      console.log('✅ Search Metadata: SUCCESS');
      console.log(`   - Country-related dimensions: ${countryDimensions?.length || 0}`);
      console.log(`   - User-related metrics: ${userMetrics?.length || 0}`);

      if (countryDimensions?.length > 0) {
        console.log(`   - Example: ${countryDimensions[0].apiName} (${countryDimensions[0].uiName})`);
      }
      if (userMetrics?.length > 0) {
        console.log(`   - Example: ${userMetrics[0].apiName} (${userMetrics[0].uiName})`);
      }
      testsPassed++;
    } catch (error) {
      console.log('❌ Search Metadata: FAILED');
      console.log(`   Error: ${error.message}`);
    }

    // Test Summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 TEST SUMMARY');
    console.log('=' .repeat(60));

    if (testsPassed === totalTests) {
      console.log(`✅ ALL ${totalTests} TESTS PASSED! 🎉`);
      console.log('\nYour Google Analytics MCP Server is fully functional with:');
      console.log('📊 analytics_report - Custom analytics queries');
      console.log('⚡ realtime_data - Live user activity');
      console.log('📈 quick_insights - Pre-built reports');
      console.log('🔍 get_metadata - Available dimensions/metrics');
      console.log('🔎 search_metadata - Search for specific fields');
      console.log('\n🚀 Ready to use with Claude Desktop!');
    } else {
      console.log(`⚠️  ${testsPassed}/${totalTests} tests passed`);
      console.log('Some functionality may be limited. Check the failed tests above.');
    }

    // Additional connection info
    console.log('\n📋 CONNECTION DETAILS:');
    console.log(`   - Property ID: ${propertyId}`);
    console.log(`   - Service Account: ${serviceAccountEmail || '❌ Missing'}`);
    console.log(`   - Test Date Range: ${startDateStr} to ${endDateStr}`);
    
    // Test with an additional property ID if provided as second command line argument
    if (process.argv[3] && process.argv[3] !== propertyId) {
      console.log('\n🔄 Testing with additional property ID:', process.argv[3]);
      console.log('=' .repeat(60));
      
      try {
        const [testResponse] = await analyticsDataClient.runReport({
          property: `properties/${process.argv[3]}`,
          dateRanges: [{ startDate: startDateStr, endDate: endDateStr }],
          dimensions: [{ name: 'date' }],
          metrics: [{ name: 'activeUsers' }],
          limit: 1
        });
        
        console.log('✅ Access granted to property:', process.argv[3]);
        console.log(`   - Active users: ${testResponse.rows?.[0]?.metricValues[0].value || 0}`);
      } catch (error) {
        if (error.code === 7 || error.message?.includes('permission')) {
          console.log('❌ Permission denied for property:', process.argv[3]);
          console.log('\n🔧 TO FIX THIS:');
          console.log('1. Go to Google Analytics (analytics.google.com)');
          console.log('2. Navigate to Admin > Property Access Management');
          console.log(`3. Add ${serviceAccountEmail} with Viewer access`);
          console.log('4. Try the query again');
        } else {
          console.log('❌ Error accessing property:', process.argv[3]);
          console.log('   Error:', error.message);
        }
      }
    }

  } catch (error) {
    console.log('💥 CRITICAL ERROR:');
    console.log(error.message);

    if (error.code === 7) {
      console.log('\n🔧 PERMISSION ISSUE:');
      console.log('1. Ensure your service account has access to the GA property');
      console.log('2. Verify the GA_PROPERTY_ID is correct');
      console.log('3. Check that Google Analytics Data API is enabled');
    } else if (error.code === 16) {
      console.log('\n🔧 AUTHENTICATION ISSUE:');
      console.log('1. Check GOOGLE_CREDENTIALS environment variable');
      console.log('2. Verify the service account JSON is valid');
      console.log('3. Ensure the JSON contains all required fields');
    }

    process.exit(1);
  }
}

testConnection();

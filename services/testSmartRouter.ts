/**
 * Test script for Smart Context Router
 * Run this to verify routing is working correctly
 */

import { classifyQuery, fetchPersonalContext, getRoutingExplanation, smartContextRouter } from './smartContextRouter';

// Test queries
const testQueries = [
  "What's my name?",
  "What are my hobbies?",
  "What's my favorite movie?",
  "What's the temperature?",
  "Turn on the lights",
  "What did I do yesterday?",
  "Tell me about quantum physics"
];

console.log('=== Smart Context Router Test ===\n');

for (const query of testQueries) {
  console.log(`Query: "${query}"`);
  console.log(getRoutingExplanation(query));
  console.log('---\n');
}

// Test personal context fetch (this will depend on what's stored in memory)
async function testPersonalContext() {
  console.log('=== Testing Personal Context Fetch ===\n');
  
  const identityQuery = "What's my name?";
  console.log(`Fetching personal context for: "${identityQuery}"`);
  
  try {
    const context = await fetchPersonalContext(identityQuery);
    if (context) {
      console.log('✅ Found personal context:');
      console.log(context.substring(0, 200) + (context.length > 200 ? '...' : ''));
    } else {
      console.log('❌ No personal context found (this is expected if no identity is stored yet)');
    }
  } catch (error) {
    console.log('❌ Error fetching context:', error);
  }
}

testPersonalContext();

console.log('\n=== Test Complete ===');

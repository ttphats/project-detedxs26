/**
 * Test Token Generation
 * Run: npx tsx backend/test-token-generation.ts
 */

import { generateAccessToken } from './src/utils/helpers.js';
import * as qrcodeService from './src/services/qrcode.service.js';

console.log('🧪 Testing token generation...\n');

// Test 1: Generate token
const { token, hash } = generateAccessToken();
console.log('✅ Token generated:');
console.log(`   Token: ${token}`);
console.log(`   Token length: ${token.length}`);
console.log(`   Hash: ${hash}`);
console.log(`   Hash length: ${hash.length}\n`);

// Test 2: Generate ticket URL
const orderNumber = 'TKHTEST01';
const ticketUrl = qrcodeService.generateTicketUrl(orderNumber, token);
console.log('✅ Ticket URL generated:');
console.log(`   URL: ${ticketUrl}`);
console.log(`   Contains token: ${ticketUrl.includes(token) ? 'YES ✓' : 'NO ✗'}`);
console.log(`   Token param: ${new URL(ticketUrl).searchParams.get('token')}\n`);

// Test 3: Verify empty token scenario
const emptyToken = '';
const emptyUrl = qrcodeService.generateTicketUrl(orderNumber, emptyToken);
console.log('⚠️  Empty token test:');
console.log(`   URL: ${emptyUrl}`);
console.log(`   This is what happens if token is empty!\n`);

console.log('🎯 Expected behavior:');
console.log('   - Token should be 64 characters (32 bytes hex)');
console.log('   - URL should contain full token in query string');
console.log('   - If URL ends with "?token=" → token is empty/undefined');

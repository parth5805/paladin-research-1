/*
 * Run the COMPLETE real lending deployment with all functions working
 */

const { execSync } = require('child_process');

console.log('🚀 Running COMPLETE REAL lending contract deployment...');
console.log('===================================================');
console.log('🎯 This version includes the full lending lifecycle:');
console.log('   ✅ Privacy group creation');
console.log('   ✅ Contract deployment');
console.log('   ✅ Loan initialization');
console.log('   ✅ Loan funding');
console.log('   ✅ Payment processing');
console.log('');

try {
    // Run the complete version
    const result = execSync('npx ts-node src/complete-real-lending.ts', {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'inherit'
    });
    
    console.log('\n🎉 COMPLETE real lending deployment finished!');
} catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
}

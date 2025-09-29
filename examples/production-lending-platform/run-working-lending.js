/*
 * Run the WORKING real lending deployment
 */

const { execSync } = require('child_process');

console.log('🚀 Running WORKING REAL lending contract deployment...');
console.log('====================================================');
console.log('🔧 This version uses real verifier addresses to fix the funding issue!');

try {
    // Run the working version
    const result = execSync('npx ts-node src/working-real-lending.ts', {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'inherit'
    });
    
    console.log('\n🎉 WORKING real lending deployment completed successfully!');
} catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
}

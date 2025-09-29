/*
 * Direct REAL lending deployment using TypeScript
 */

const { execSync } = require('child_process');

console.log('🚀 Running REAL lending contract deployment...');
console.log('==============================================');

try {
    // Run ts-node directly on our deployment script
    const result = execSync('npx ts-node src/real-lending-deployment.ts', {
        cwd: process.cwd(),
        encoding: 'utf8',
        stdio: 'inherit'
    });
    
    console.log('\n✅ Real lending deployment completed successfully!');
} catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
}

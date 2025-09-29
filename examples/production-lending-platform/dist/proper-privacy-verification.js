"use strict";
/*
 * ✅ PROPER PRIVACY VERIFICATION TEST
 *
 * Using the ACTUAL Paladin TypeScript SDK patterns from the working examples
 * This will test that only authorized identities can access the lending contract
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealLendingContract = void 0;
exports.runProperPrivacyVerification = runProperPrivacyVerification;
const paladin_sdk_1 = __importStar(require("@lfdecentralizedtrust-labs/paladin-sdk"));
const paladin_example_common_1 = require("paladin-example-common");
const RealLendingContract_json_1 = __importDefault(require("../abis/RealLendingContract.json"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger = console;
// Real Lending Contract wrapper using proper SDK patterns
class RealLendingContract extends paladin_sdk_1.PentePrivateContract {
    constructor(evm, address) {
        super(evm, RealLendingContract_json_1.default.abi, address);
        this.evm = evm;
        this.address = address;
    }
    using(paladin) {
        return new RealLendingContract(this.evm.using(paladin), this.address);
    }
}
exports.RealLendingContract = RealLendingContract;
async function runProperPrivacyVerification() {
    logger.log('🎯 PROPER PRIVACY VERIFICATION TEST');
    logger.log('==================================');
    logger.log('Using the actual Paladin TypeScript SDK patterns\n');
    if (paladin_example_common_1.nodeConnections.length < 3) {
        logger.error("Need at least 3 nodes for privacy testing");
        return false;
    }
    try {
        // Initialize Paladin clients
        const clients = paladin_example_common_1.nodeConnections.map(node => new paladin_sdk_1.default(node.clientOptions));
        const [paladinNode1, paladinNode2, paladinNode3] = clients;
        // Load the deployed contract data
        const dataFiles = fs.readdirSync('./data')
            .filter(file => file.includes('complete-real-lending'))
            .sort()
            .reverse();
        if (dataFiles.length === 0) {
            logger.error("No deployment data found! Run the deployment first.");
            return false;
        }
        const latestDataFile = dataFiles[0];
        const deploymentData = JSON.parse(fs.readFileSync(path.join('./data', latestDataFile), 'utf8'));
        logger.log(`📄 Using deployment data: ${latestDataFile}`);
        logger.log(`📄 Contract Address: ${deploymentData.contractAddress}`);
        logger.log(`🔐 Privacy Group ID: ${deploymentData.privacyGroupId}`);
        // Get the authorized verifiers (from deployment)
        const [authorizedLender] = paladinNode1.getVerifiers(`bigbank@${paladin_example_common_1.nodeConnections[0].id}`);
        const [authorizedBorrower] = paladinNode2.getVerifiers(`techstartup@${paladin_example_common_1.nodeConnections[1].id}`);
        // Get unauthorized verifiers for testing
        const [unauthorizedNode1] = paladinNode1.getVerifiers(`fakelender@${paladin_example_common_1.nodeConnections[0].id}`);
        const [unauthorizedNode2] = paladinNode2.getVerifiers(`fakeborrower@${paladin_example_common_1.nodeConnections[1].id}`);
        const [outsiderNode3] = paladinNode3.getVerifiers(`outsider@${paladin_example_common_1.nodeConnections[2].id}`);
        logger.log(`🏦 Authorized Lender: ${authorizedLender.lookup}`);
        logger.log(`🏭 Authorized Borrower: ${authorizedBorrower.lookup}`);
        logger.log(`💸 Unauthorized Lender: ${unauthorizedNode1.lookup}`);
        logger.log(`🏢 Unauthorized Borrower: ${unauthorizedNode2.lookup}`);
        logger.log(`🧑‍💻 Outsider: ${outsiderNode3.lookup}\n`);
        // Recreate the privacy group and contract instances
        const penteFactory = new paladin_sdk_1.PenteFactory(paladinNode1, "pente");
        const privacyGroup = await penteFactory.resumePrivacyGroup({
            id: deploymentData.privacyGroupId
        });
        if (!privacyGroup) {
            logger.error("Failed to resume privacy group!");
            return false;
        }
        // Create contract instance
        const lendingContract = new RealLendingContract(privacyGroup, deploymentData.contractAddress);
        logger.log('🧪 RUNNING PRIVACY TESTS');
        logger.log('========================\n');
        const testResults = [];
        // TEST 1: Authorized lender should access loan details
        logger.log('🔍 TEST 1: Authorized Lender Access (SHOULD WORK)');
        try {
            const loanDetails = await lendingContract.call({
                from: authorizedLender.lookup,
                function: "getLoanDetails",
            });
            logger.log(`   ✅ SUCCESS: Lender can access loan details`);
            logger.log(`   📊 Loan Details: ${JSON.stringify(loanDetails).slice(0, 100)}...`);
            testResults.push({
                testName: "Authorized Lender Access",
                expected: true,
                actual: true,
                result: 'PASS',
                details: 'Lender successfully accessed loan details'
            });
        }
        catch (error) {
            logger.log(`   ❌ FAILED: ${error.message}`);
            testResults.push({
                testName: "Authorized Lender Access",
                expected: true,
                actual: false,
                result: 'FAIL',
                details: error.message
            });
        }
        // TEST 2: Authorized borrower should access loan details
        logger.log('\n🔍 TEST 2: Authorized Borrower Access (SHOULD WORK)');
        try {
            const loanDetails = await lendingContract.using(paladinNode2).call({
                from: authorizedBorrower.lookup,
                function: "getLoanDetails",
            });
            logger.log(`   ✅ SUCCESS: Borrower can access loan details`);
            logger.log(`   📊 Loan Details: ${JSON.stringify(loanDetails).slice(0, 100)}...`);
            testResults.push({
                testName: "Authorized Borrower Access",
                expected: true,
                actual: true,
                result: 'PASS',
                details: 'Borrower successfully accessed loan details'
            });
        }
        catch (error) {
            logger.log(`   ❌ FAILED: ${error.message}`);
            testResults.push({
                testName: "Authorized Borrower Access",
                expected: true,
                actual: false,
                result: 'FAIL',
                details: error.message
            });
        }
        // TEST 3: Unauthorized lender on same node should be blocked
        logger.log('\n🔍 TEST 3: Unauthorized Lender on Node1 (SHOULD FAIL)');
        try {
            const loanDetails = await lendingContract.call({
                from: unauthorizedNode1.lookup,
                function: "getLoanDetails",
            });
            logger.log(`   ❌ PRIVACY BREACH: Unauthorized lender accessed data!`);
            logger.log(`   🚨 Data: ${JSON.stringify(loanDetails)}`);
            testResults.push({
                testName: "Unauthorized Lender Blocked",
                expected: false,
                actual: true,
                result: 'FAIL',
                details: 'Unauthorized lender gained access - PRIVACY BREACH!'
            });
        }
        catch (error) {
            logger.log(`   ✅ SUCCESS: Unauthorized lender properly blocked`);
            logger.log(`   🔒 Error: ${error.message}`);
            testResults.push({
                testName: "Unauthorized Lender Blocked",
                expected: false,
                actual: false,
                result: 'PASS',
                details: 'Unauthorized lender properly blocked'
            });
        }
        // TEST 4: Unauthorized borrower on same node should be blocked
        logger.log('\n🔍 TEST 4: Unauthorized Borrower on Node2 (SHOULD FAIL)');
        try {
            const loanDetails = await lendingContract.using(paladinNode2).call({
                from: unauthorizedNode2.lookup,
                function: "getLoanDetails",
            });
            logger.log(`   ❌ PRIVACY BREACH: Unauthorized borrower accessed data!`);
            logger.log(`   🚨 Data: ${JSON.stringify(loanDetails)}`);
            testResults.push({
                testName: "Unauthorized Borrower Blocked",
                expected: false,
                actual: true,
                result: 'FAIL',
                details: 'Unauthorized borrower gained access - PRIVACY BREACH!'
            });
        }
        catch (error) {
            logger.log(`   ✅ SUCCESS: Unauthorized borrower properly blocked`);
            logger.log(`   🔒 Error: ${error.message}`);
            testResults.push({
                testName: "Unauthorized Borrower Blocked",
                expected: false,
                actual: false,
                result: 'PASS',
                details: 'Unauthorized borrower properly blocked'
            });
        }
        // TEST 5: Outsider on different node should be blocked
        logger.log('\n🔍 TEST 5: Outsider on Node3 (SHOULD FAIL)');
        try {
            const loanDetails = await lendingContract.using(paladinNode3).call({
                from: outsiderNode3.lookup,
                function: "getLoanDetails",
            });
            logger.log(`   ❌ PRIVACY BREACH: Outsider accessed private data!`);
            logger.log(`   🚨 Data: ${JSON.stringify(loanDetails)}`);
            testResults.push({
                testName: "Outsider Blocked",
                expected: false,
                actual: true,
                result: 'FAIL',
                details: 'Outsider gained access - PRIVACY BREACH!'
            });
        }
        catch (error) {
            logger.log(`   ✅ SUCCESS: Outsider properly blocked`);
            logger.log(`   🔒 Error: ${error.message}`);
            testResults.push({
                testName: "Outsider Blocked",
                expected: false,
                actual: false,
                result: 'PASS',
                details: 'Outsider properly blocked'
            });
        }
        // TEST 6: Cross-node authorized access should fail
        logger.log('\n🔍 TEST 6: Authorized Lender from Wrong Node (SHOULD FAIL)');
        try {
            const loanDetails = await lendingContract.using(paladinNode2).call({
                from: authorizedLender.lookup,
                function: "getLoanDetails",
            });
            logger.log(`   ❌ PRIVACY BREACH: Cross-node access succeeded!`);
            logger.log(`   🚨 Data: ${JSON.stringify(loanDetails)}`);
            testResults.push({
                testName: "Cross-node Lender Blocked",
                expected: false,
                actual: true,
                result: 'FAIL',
                details: 'Cross-node access succeeded - possible privacy issue'
            });
        }
        catch (error) {
            logger.log(`   ✅ SUCCESS: Cross-node access properly blocked`);
            logger.log(`   🔒 Error: ${error.message}`);
            testResults.push({
                testName: "Cross-node Lender Blocked",
                expected: false,
                actual: false,
                result: 'PASS',
                details: 'Cross-node access properly blocked'
            });
        }
        // Print comprehensive results
        logger.log('\n\n🎯 COMPREHENSIVE PRIVACY TEST RESULTS');
        logger.log('=====================================');
        let passedTests = 0;
        let totalTests = testResults.length;
        testResults.forEach((test, index) => {
            const emoji = test.result === 'PASS' ? '✅' : '❌';
            const expectation = test.expected ? '(should access)' : '(should be blocked)';
            logger.log(`${index + 1}. ${test.testName} ${expectation}: ${emoji} ${test.result}`);
            logger.log(`   Details: ${test.details}`);
            if (test.result === 'PASS')
                passedTests++;
        });
        logger.log('\n📊 FINAL PRIVACY VERIFICATION RESULT');
        logger.log('====================================');
        logger.log(`Tests Passed: ${passedTests}/${totalTests}`);
        logger.log(`Privacy Score: ${Math.round((passedTests / totalTests) * 100)}%`);
        if (passedTests === totalTests) {
            logger.log('\n🎉 ✅ PRIVACY VERIFICATION PASSED!');
            logger.log('🔒 Your lending contract has proper privacy isolation');
            logger.log('🛡️  Only authorized parties can access loan details');
            logger.log('🚫 All unauthorized access attempts properly blocked');
            logger.log('\n💡 KEY VERIFICATION POINTS:');
            logger.log('   ✅ Authorized lender can access from node1');
            logger.log('   ✅ Authorized borrower can access from node2');
            logger.log('   ✅ Unauthorized parties blocked on same nodes');
            logger.log('   ✅ Outsiders blocked from different nodes');
            logger.log('   ✅ Cross-node access properly controlled');
            return true;
        }
        else {
            logger.log('\n❌ 🚨 PRIVACY ISSUES DETECTED!');
            logger.log('⚠️  Some privacy tests failed');
            logger.log('🔧 Review the failed tests above');
            // Highlight critical failures
            const criticalFailures = testResults.filter(t => t.result === 'FAIL' && (t.testName.includes('Unauthorized') ||
                t.testName.includes('Outsider')));
            if (criticalFailures.length > 0) {
                logger.log('\n🚨 CRITICAL PRIVACY BREACHES:');
                criticalFailures.forEach(failure => {
                    logger.log(`   🔴 ${failure.testName}: ${failure.details}`);
                });
            }
            return false;
        }
    }
    catch (error) {
        logger.error('❌ Privacy verification failed with error:', error.message);
        return false;
    }
}
// Run the proper privacy verification
if (require.main === module) {
    runProperPrivacyVerification()
        .then((success) => {
        if (success) {
            logger.log('\n🎯 Privacy verification completed successfully!');
            process.exit(0);
        }
        else {
            logger.log('\n❌ Privacy verification failed!');
            process.exit(1);
        }
    })
        .catch((error) => {
        logger.error('Error in privacy verification:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=proper-privacy-verification.js.map
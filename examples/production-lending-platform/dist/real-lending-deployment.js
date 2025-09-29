"use strict";
/*
 * REAL LENDING CONTRACT DEPLOYMENT
 * Using proper Paladin SDK - this will actually work!
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
const paladin_sdk_1 = __importStar(require("@lfdecentralizedtrust-labs/paladin-sdk"));
const paladin_example_common_1 = require("paladin-example-common");
const RealLendingContract_json_1 = __importDefault(require("../abis/RealLendingContract.json"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const logger = console;
// Real Lending Contract class
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
async function deployRealLendingContract() {
    logger.log("\n🚀 DEPLOYING REAL LENDING CONTRACT");
    logger.log("==================================");
    logger.log(`⏰ Starting at: ${new Date().toISOString()}`);
    if (paladin_example_common_1.nodeConnections.length < 2) {
        logger.error("Need at least 2 nodes for lending contract");
        return false;
    }
    try {
        // Initialize Paladin clients
        logger.log("Initializing Paladin clients...");
        const clients = paladin_example_common_1.nodeConnections.map(node => new paladin_sdk_1.default(node.clientOptions));
        const [paladinNode1, paladinNode2] = clients;
        // Get verifiers (participants in the lending deal)
        const [lenderVerifier] = paladinNode1.getVerifiers(`bigbank@${paladin_example_common_1.nodeConnections[0].id}`);
        const [borrowerVerifier] = paladinNode2.getVerifiers(`techstartup@${paladin_example_common_1.nodeConnections[1].id}`);
        logger.log(`🏦 Lender: ${lenderVerifier.lookup}`);
        logger.log(`🏭 Borrower: ${borrowerVerifier.lookup}`);
        // Step 1: Create privacy group for the lending deal
        logger.log("\n📋 Creating privacy group for lending deal...");
        const penteFactory = new paladin_sdk_1.PenteFactory(paladinNode1, "pente");
        const lendingPrivacyGroup = await penteFactory.newPrivacyGroup({
            members: [lenderVerifier, borrowerVerifier],
            evmVersion: "shanghai",
            externalCallsEnabled: true,
        }).waitForDeploy();
        if (!(0, paladin_example_common_1.checkDeploy)(lendingPrivacyGroup)) {
            logger.error("Failed to create privacy group");
            return false;
        }
        logger.log(`✅ Privacy group created: ${lendingPrivacyGroup?.group.id}`);
        // Step 2: Deploy the lending contract
        logger.log("\n🏗️ Deploying lending contract...");
        const contractAddress = await lendingPrivacyGroup.deploy({
            abi: RealLendingContract_json_1.default.abi,
            bytecode: RealLendingContract_json_1.default.bytecode,
            from: lenderVerifier.lookup,
        }).waitForDeploy();
        if (!contractAddress) {
            logger.error("Failed to deploy lending contract");
            return false;
        }
        logger.log(`✅ Lending contract deployed: ${contractAddress}`);
        // Step 3: Create contract interface
        const lendingContract = new RealLendingContract(lendingPrivacyGroup, contractAddress);
        // Step 4: Initialize the loan with parameters
        logger.log("\n📋 Initializing loan with parameters...");
        const initReceipt = await lendingContract.sendTransaction({
            from: lenderVerifier.lookup,
            function: "initializeLoan",
            data: {
                _lender: "0x1234567890123456789012345678901234567890",
                _borrower: "0x0987654321098765432109876543210987654321",
                _loanAmount: "1000000", // $1M
                _interestRate: "500" // 5%
            },
        }).waitForReceipt(15000);
        if (!initReceipt?.success) {
            logger.error("Failed to initialize loan");
            return false;
        }
        logger.log(`✅ Loan initialized! TX: ${initReceipt.transactionHash}`);
        // Step 5: Fund the loan (lender action)
        logger.log("\n💰 Lender funding the loan...");
        const fundReceipt = await lendingContract.sendTransaction({
            from: lenderVerifier.lookup,
            function: "fundLoan",
            data: {}
        }).waitForReceipt(15000);
        if (!fundReceipt?.success) {
            logger.error("Failed to fund loan");
            return false;
        }
        logger.log(`✅ Loan funded! TX: ${fundReceipt.transactionHash}`);
        // Step 6: Make a payment (borrower action)
        logger.log("\n💸 Borrower making first payment...");
        const paymentReceipt = await lendingContract.sendTransaction({
            from: borrowerVerifier.lookup,
            function: "makePayment",
            data: { amount: "100000" } // $100k payment
        }).waitForReceipt(15000);
        if (!paymentReceipt?.success) {
            logger.error("Failed to make payment");
            return false;
        }
        logger.log(`✅ Payment made! TX: ${paymentReceipt.transactionHash}`);
        // Step 7: Get loan details
        logger.log("\n📊 Retrieving loan details...");
        const loanDetails = await lendingContract.call({
            from: lenderVerifier.lookup,
            function: "getLoanDetails"
        });
        logger.log(`Loan Amount: ${loanDetails[0]}`);
        logger.log(`Interest Rate: ${loanDetails[1]}`);
        logger.log(`Is Funded: ${loanDetails[2]}`);
        logger.log(`Creation Time: ${loanDetails[3]}`);
        logger.log(`Total Paid: ${loanDetails[4]}`);
        logger.log(`Initialized: ${loanDetails[5]}`);
        // Step 8: Get current blockchain timestamp
        const currentTime = await lendingContract.call({
            from: lenderVerifier.lookup,
            function: "getCurrentTimestamp"
        });
        logger.log(`Current blockchain time: ${currentTime}`);
        // Step 9: Save deployment data
        const deploymentData = {
            timestamp: new Date().toISOString(),
            privacyGroupId: lendingPrivacyGroup?.group.id,
            contractAddress: contractAddress,
            lender: lenderVerifier.lookup,
            borrower: borrowerVerifier.lookup,
            initTx: initReceipt.transactionHash,
            fundingTx: fundReceipt.transactionHash,
            paymentTx: paymentReceipt.transactionHash,
            loanDetails: {
                amount: loanDetails[0],
                interestRate: loanDetails[1],
                isFunded: loanDetails[2],
                creationTime: loanDetails[3],
                totalPaid: loanDetails[4],
                initialized: loanDetails[5]
            },
            blockchainTime: currentTime
        };
        const dataDir = path.join(__dirname, '..', 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        const filename = `real-lending-deployment-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        const filepath = path.join(dataDir, filename);
        fs.writeFileSync(filepath, JSON.stringify(deploymentData, null, 2));
        logger.log(`\n🎉 REAL LENDING CONTRACT DEPLOYED SUCCESSFULLY!`);
        logger.log("===============================================");
        logger.log(`📄 Contract Address: ${contractAddress}`);
        logger.log(`🔐 Privacy Group: ${lendingPrivacyGroup?.group.id}`);
        logger.log(`� Init TX: ${initReceipt.transactionHash}`);
        logger.log(`�💰 Funding TX: ${fundReceipt.transactionHash}`);
        logger.log(`💸 Payment TX: ${paymentReceipt.transactionHash}`);
        logger.log(`📊 Data saved to: ${filepath}`);
        logger.log(`⏰ Completed at: ${new Date().toISOString()}`);
        return true;
    }
    catch (error) {
        logger.error(`❌ Deployment failed: ${error}`);
        return false;
    }
}
// Run the deployment
async function main() {
    const success = await deployRealLendingContract();
    process.exit(success ? 0 : 1);
}
main();
//# sourceMappingURL=real-lending-deployment.js.map
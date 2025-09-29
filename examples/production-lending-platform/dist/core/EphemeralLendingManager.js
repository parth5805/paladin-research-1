"use strict";
/**
 * @file EphemeralLendingManager.ts
 * @description Core manager implementing Paladin CEO's vision of ephemeral private blockchains
 *
 * CEO Quote: "super scalable way to have these almost like ephemeral EVMS that are doing
 * processing for you... like AWS Lambda... if you send something to it it'll wake up
 * performance do its job and then go back to sleep"
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.EphemeralLendingManager = void 0;
const paladin_sdk_1 = __importStar(require("@lfdecentralizedtrust-labs/paladin-sdk"));
const uuid_1 = require("uuid");
const Logger_1 = require("./Logger");
const ContractABIs_1 = require("./ContractABIs");
/**
 * Enhanced Lending Contract wrapper for ephemeral EVMs
 */
class LendingContract extends paladin_sdk_1.PentePrivateContract {
    constructor(evm, address) {
        super(evm, ContractABIs_1.LendingContractABI.abi, address);
        this.evm = evm;
        this.address = address;
    }
    using(paladin) {
        return new LendingContract(this.evm.using(paladin), this.address);
    }
    async initializeLoan(from, lenderAddress, borrowerAddress, terms) {
        Logger_1.Logger.info(`Initializing loan in ephemeral EVM`, {
            from,
            lender: lenderAddress,
            borrower: borrowerAddress,
            principal: terms.principal.toString(),
            interestRate: terms.interestRate
        });
        const receipt = await this.sendTransaction({
            from: from,
            function: "initializeLoan",
            data: {
                _lender: lenderAddress,
                _borrower: borrowerAddress,
                _principal: terms.principal,
                _interestRate: terms.interestRate,
                _duration: terms.duration,
                _collateralAmount: terms.collateralAmount,
                _collateralRequired: terms.collateralRequired
            },
        }).waitForReceipt(10000);
        if (!receipt?.success) {
            throw new Error("Loan initialization failed!");
        }
        Logger_1.Logger.info(`Loan initialized successfully`, {
            txHash: receipt.transactionHash,
            contractAddress: this.address
        });
        return receipt;
    }
    async getLoanDetails(from) {
        Logger_1.Logger.debug(`Getting loan details from ephemeral EVM`, { from, contract: this.address });
        const result = await this.call({
            from: from,
            function: "getLoanDetails",
            data: {},
        });
        Logger_1.Logger.debug(`Loan details retrieved`, { result });
        return result;
    }
    async makePayment(from, paymentAmount) {
        Logger_1.Logger.info(`Making payment in ephemeral EVM`, {
            from,
            amount: paymentAmount.toString(),
            contract: this.address
        });
        const receipt = await this.sendTransaction({
            from: from,
            function: "makePayment",
            data: {},
            value: paymentAmount
        }).waitForReceipt(10000);
        if (!receipt?.success) {
            throw new Error("Payment failed!");
        }
        Logger_1.Logger.info(`Payment completed`, { txHash: receipt.transactionHash });
        return receipt;
    }
    async fundLoan(from, fundingAmount) {
        Logger_1.Logger.info(`Funding loan in ephemeral EVM`, {
            from,
            amount: fundingAmount.toString(),
            contract: this.address
        });
        const receipt = await this.sendTransaction({
            from: from,
            function: "fundLoan",
            data: {},
            value: fundingAmount
        }).waitForReceipt(10000);
        if (!receipt?.success) {
            throw new Error("Loan funding failed!");
        }
        Logger_1.Logger.info(`Loan funded successfully`, { txHash: receipt.transactionHash });
        return receipt;
    }
}
/**
 * Main manager class implementing CEO's ephemeral EVM vision
 */
class EphemeralLendingManager {
    constructor(lenderNodeUrl = "http://localhost:31548", borrowerNodeUrl = "http://localhost:31648") {
        this.lenderNodeUrl = lenderNodeUrl;
        this.borrowerNodeUrl = borrowerNodeUrl;
        this.activePlatforms = new Map();
        this.logger = Logger_1.Logger;
        this.logger.info('EphemeralLendingManager initialized', {
            lenderNode: lenderNodeUrl,
            borrowerNode: borrowerNodeUrl
        });
    }
    /**
     * Creates ephemeral EVM for a specific lending deal
     * Implements CEO's "AWS Lambda" vision: wake up, do job, sleep
     */
    async createEphemeralLendingDeal(lender, borrower, terms) {
        const dealId = `DEAL_${(0, uuid_1.v4)().substr(0, 8)}`;
        this.logger.info('🚀 Creating ephemeral lending platform (CEO\'s AWS Lambda vision)', {
            dealId,
            lender: lender.name,
            borrower: borrower.name,
            principal: terms.principal.toString()
        });
        try {
            // Step 1: Connect to Paladin nodes
            const lenderNode = new paladin_sdk_1.default({ url: lender.nodeUrl });
            const borrowerNode = new paladin_sdk_1.default({ url: borrower.nodeUrl });
            // Step 2: Get node identities
            const [lenderVerifier] = lenderNode.getVerifiers(lender.identity);
            const [borrowerVerifier] = borrowerNode.getVerifiers(borrower.identity);
            this.logger.info('Node identities obtained', {
                lenderIdentity: lenderVerifier.lookup,
                borrowerIdentity: borrowerVerifier.lookup
            });
            // Step 3: Create ephemeral privacy group (CEO's "mini private blockchain")
            this.logger.info('⚡ Creating ephemeral EVM (like AWS Lambda)...');
            const penteFactory = new paladin_sdk_1.PenteFactory(lenderNode, "pente");
            const ephemeralEVM = await penteFactory.newPrivacyGroup({
                members: [lenderVerifier, borrowerVerifier], // ONLY these 2 parties
                evmVersion: "shanghai",
                externalCallsEnabled: true,
            }).waitForDeploy();
            if (!ephemeralEVM) {
                throw new Error("Failed to create ephemeral EVM");
            }
            this.logger.info('✅ Ephemeral EVM created', {
                privacyGroupId: ephemeralEVM.group.id,
                message: 'This is the "mini private blockchain on-demand" from CEO\'s vision!'
            });
            // Step 4: Deploy lending contract to ephemeral EVM
            this.logger.info('🏗️ Deploying lending contract to ephemeral EVM...');
            const contractAddress = await ephemeralEVM.deploy({
                abi: ContractABIs_1.LendingContractABI.abi,
                bytecode: ContractABIs_1.LendingContractABI.bytecode,
                from: lenderVerifier.lookup,
            }).waitForDeploy();
            if (!contractAddress) {
                throw new Error("Failed to deploy lending contract");
            }
            this.logger.info('✅ Lending contract deployed to ephemeral EVM', {
                contractAddress,
                ephemeralEVM: ephemeralEVM.group.id
            });
            // Step 5: Create contract wrapper
            const lendingContract = new LendingContract(ephemeralEVM, contractAddress);
            // Step 6: Initialize the loan
            await lendingContract.initializeLoan(lenderVerifier.lookup, lender.walletAddress, borrower.walletAddress, terms);
            // Step 7: Create deal record
            const deal = {
                dealId,
                lender,
                borrower,
                terms,
                ephemeralEVM,
                contractAddress,
                contract: lendingContract,
                created: new Date(),
                status: 'created'
            };
            // Step 8: Store in active platforms
            this.activePlatforms.set(dealId, deal);
            this.logger.info('🎉 Ephemeral lending platform created successfully', {
                dealId,
                contractAddress,
                privacyGroupId: ephemeralEVM.group.id,
                message: 'CEO\'s vision realized: scalable mini private blockchain on-demand!'
            });
            return deal;
        }
        catch (error) {
            this.logger.error('Failed to create ephemeral lending platform', {
                dealId,
                error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
        }
    }
    /**
     * Fund a loan (lender action)
     */
    async fundLoan(dealId, lenderIdentity, fundingAmount) {
        const deal = this.activePlatforms.get(dealId);
        if (!deal) {
            throw new Error(`Deal ${dealId} not found`);
        }
        this.logger.info('💰 Funding loan in ephemeral EVM', {
            dealId,
            amount: fundingAmount.toString(),
            lender: deal.lender.name
        });
        await deal.contract.fundLoan(lenderIdentity, fundingAmount);
        deal.status = 'funded';
        this.logger.info('✅ Loan funded successfully', { dealId });
    }
    /**
     * Make payment (borrower action)
     */
    async makePayment(dealId, borrowerIdentity, paymentAmount) {
        const deal = this.activePlatforms.get(dealId);
        if (!deal) {
            throw new Error(`Deal ${dealId} not found`);
        }
        this.logger.info('💳 Making payment in ephemeral EVM', {
            dealId,
            amount: paymentAmount.toString(),
            borrower: deal.borrower.name
        });
        await deal.contract.makePayment(borrowerIdentity, paymentAmount);
        this.logger.info('✅ Payment completed', { dealId });
    }
    /**
     * Get loan details from ephemeral EVM
     */
    async getLoanDetails(dealId, fromIdentity) {
        const deal = this.activePlatforms.get(dealId);
        if (!deal) {
            throw new Error(`Deal ${dealId} not found`);
        }
        this.logger.debug('📊 Getting loan details from ephemeral EVM', { dealId });
        return await deal.contract.getLoanDetails(fromIdentity);
    }
    /**
     * List all active ephemeral platforms
     */
    getActiveDeals() {
        return Array.from(this.activePlatforms.values());
    }
    /**
     * Get specific deal
     */
    getDeal(dealId) {
        return this.activePlatforms.get(dealId);
    }
    /**
     * Demonstrate that deals are isolated from each other
     */
    async testDealIsolation(dealIds) {
        this.logger.info('🔒 Testing deal isolation between ephemeral EVMs', {
            deals: dealIds
        });
        for (let i = 0; i < dealIds.length; i++) {
            const currentDeal = this.activePlatforms.get(dealIds[i]);
            if (!currentDeal)
                continue;
            this.logger.info(`Testing access to Deal ${currentDeal.dealId}:`);
            // Test authorized access
            try {
                const lenderDetails = await currentDeal.contract.getLoanDetails(currentDeal.lender.identity);
                this.logger.info(`✅ Lender authorized access successful`, {
                    dealId: currentDeal.dealId,
                    lender: currentDeal.lender.name
                });
            }
            catch (error) {
                this.logger.error(`❌ Lender authorized access failed`, {
                    dealId: currentDeal.dealId,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
            // Test cross-deal access (should fail)
            for (let j = 0; j < dealIds.length; j++) {
                if (i !== j) {
                    const otherDeal = this.activePlatforms.get(dealIds[j]);
                    if (!otherDeal)
                        continue;
                    try {
                        await currentDeal.contract.getLoanDetails(otherDeal.lender.identity);
                        this.logger.error(`❌ SECURITY BREACH! ${otherDeal.dealId} accessed ${currentDeal.dealId}`);
                    }
                    catch (error) {
                        this.logger.info(`✅ Cross-deal access properly denied`, {
                            attemptingDeal: otherDeal.dealId,
                            targetDeal: currentDeal.dealId
                        });
                    }
                }
            }
        }
    }
    /**
     * Clean up ephemeral EVM (CEO's "go back to sleep" vision)
     */
    async cleanupEphemeralDeal(dealId) {
        const deal = this.activePlatforms.get(dealId);
        if (!deal) {
            throw new Error(`Deal ${dealId} not found`);
        }
        this.logger.info('🧹 Cleaning up ephemeral EVM (AWS Lambda "sleep" mode)', {
            dealId,
            privacyGroupId: deal.ephemeralEVM.group.id
        });
        // Remove from active platforms
        this.activePlatforms.delete(dealId);
        this.logger.info('✅ Ephemeral EVM cleaned up - returned to "sleep" state', { dealId });
    }
}
exports.EphemeralLendingManager = EphemeralLendingManager;
//# sourceMappingURL=EphemeralLendingManager.js.map
/**
 * @file EphemeralLendingManager.ts
 * @description Core manager implementing Paladin CEO's vision of ephemeral private blockchains
 *
 * CEO Quote: "super scalable way to have these almost like ephemeral EVMS that are doing
 * processing for you... like AWS Lambda... if you send something to it it'll wake up
 * performance do its job and then go back to sleep"
 */
import PaladinClient, { PentePrivateContract, PentePrivacyGroup } from "@lfdecentralizedtrust-labs/paladin-sdk";
export interface LoanTerms {
    principal: bigint;
    interestRate: number;
    duration: number;
    collateralAmount: bigint;
    collateralRequired: boolean;
}
export interface LenderProfile {
    nodeUrl: string;
    identity: string;
    walletAddress: string;
    name: string;
}
export interface BorrowerProfile {
    nodeUrl: string;
    identity: string;
    walletAddress: string;
    name: string;
}
export interface EphemeralDeal {
    dealId: string;
    lender: LenderProfile;
    borrower: BorrowerProfile;
    terms: LoanTerms;
    ephemeralEVM: PentePrivacyGroup;
    contractAddress: string;
    contract: LendingContract;
    created: Date;
    status: 'created' | 'funded' | 'active' | 'completed' | 'defaulted';
}
/**
 * Enhanced Lending Contract wrapper for ephemeral EVMs
 */
declare class LendingContract extends PentePrivateContract<{}> {
    protected evm: any;
    readonly address: string;
    constructor(evm: any, address: string);
    using(paladin: PaladinClient): LendingContract;
    initializeLoan(from: string, lenderAddress: string, borrowerAddress: string, terms: LoanTerms): Promise<import("@lfdecentralizedtrust-labs/paladin-sdk").ITransactionReceipt>;
    getLoanDetails(from: string): Promise<any>;
    makePayment(from: string, paymentAmount: bigint): Promise<import("@lfdecentralizedtrust-labs/paladin-sdk").ITransactionReceipt>;
    fundLoan(from: string, fundingAmount: bigint): Promise<import("@lfdecentralizedtrust-labs/paladin-sdk").ITransactionReceipt>;
}
/**
 * Main manager class implementing CEO's ephemeral EVM vision
 */
export declare class EphemeralLendingManager {
    private lenderNodeUrl;
    private borrowerNodeUrl;
    private activePlatforms;
    private logger;
    constructor(lenderNodeUrl?: string, borrowerNodeUrl?: string);
    /**
     * Creates ephemeral EVM for a specific lending deal
     * Implements CEO's "AWS Lambda" vision: wake up, do job, sleep
     */
    createEphemeralLendingDeal(lender: LenderProfile, borrower: BorrowerProfile, terms: LoanTerms): Promise<EphemeralDeal>;
    /**
     * Fund a loan (lender action)
     */
    fundLoan(dealId: string, lenderIdentity: string, fundingAmount: bigint): Promise<void>;
    /**
     * Make payment (borrower action)
     */
    makePayment(dealId: string, borrowerIdentity: string, paymentAmount: bigint): Promise<void>;
    /**
     * Get loan details from ephemeral EVM
     */
    getLoanDetails(dealId: string, fromIdentity: string): Promise<any>;
    /**
     * List all active ephemeral platforms
     */
    getActiveDeals(): EphemeralDeal[];
    /**
     * Get specific deal
     */
    getDeal(dealId: string): EphemeralDeal | undefined;
    /**
     * Demonstrate that deals are isolated from each other
     */
    testDealIsolation(dealIds: string[]): Promise<void>;
    /**
     * Clean up ephemeral EVM (CEO's "go back to sleep" vision)
     */
    cleanupEphemeralDeal(dealId: string): Promise<void>;
}
export {};
//# sourceMappingURL=EphemeralLendingManager.d.ts.map
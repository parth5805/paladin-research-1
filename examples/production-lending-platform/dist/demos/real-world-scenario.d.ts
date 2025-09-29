#!/usr/bin/env ts-node
/**
 * @file real-world-scenario.ts
 * @description REAL PRODUCTION DEMO proving CEO's vision works with your Kubernetes setup
 *
 * This demo connects to your actual running Paladin cluster:
 * - kubectl get pods -n paladin (your 3 Besu + 3 Paladin nodes)
 * - Creates multiple ephemeral lending platforms
 * - Proves complete 1:1 privacy isolation
 * - Shows "AWS Lambda" style scalability
 */
declare const CONFIG: {
    BESU_NODES: string[];
    PALADIN_NODES: string[];
};
declare const LENDERS: {
    nodeUrl: string;
    identity: string;
    walletAddress: string;
    name: string;
}[];
declare const BORROWERS: {
    nodeUrl: string;
    identity: string;
    walletAddress: string;
    name: string;
}[];
declare const LOAN_SCENARIOS: {
    lender: {
        nodeUrl: string;
        identity: string;
        walletAddress: string;
        name: string;
    };
    borrower: {
        nodeUrl: string;
        identity: string;
        walletAddress: string;
        name: string;
    };
    terms: {
        principal: bigint;
        interestRate: number;
        duration: number;
        collateralAmount: bigint;
        collateralRequired: boolean;
    };
    description: string;
}[];
declare function checkClusterConnectivity(): Promise<void>;
declare function demonstrateEphemeralLending(): Promise<string[]>;
declare function testPrivacyIsolation(activeDeals: string[]): Promise<void>;
declare function demonstrateScalability(): Promise<{
    dealId: string;
    ephemeralEVMId: string;
    lender: string;
    borrower: string;
    principal: number;
}[]>;
declare function showProductionReadiness(): Promise<void>;
declare function main(): Promise<void>;
//# sourceMappingURL=real-world-scenario.d.ts.map
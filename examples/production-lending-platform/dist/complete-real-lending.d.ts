import PaladinClient, { PentePrivacyGroup, PentePrivateContract } from "@lfdecentralizedtrust-labs/paladin-sdk";
export declare class RealLendingContract extends PentePrivateContract<{}> {
    protected evm: PentePrivacyGroup;
    readonly address: string;
    constructor(evm: PentePrivacyGroup, address: string);
    using(paladin: PaladinClient): RealLendingContract;
}
//# sourceMappingURL=complete-real-lending.d.ts.map
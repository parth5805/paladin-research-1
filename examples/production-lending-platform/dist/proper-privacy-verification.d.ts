import PaladinClient, { PentePrivacyGroup, PentePrivateContract } from "@lfdecentralizedtrust-labs/paladin-sdk";
export declare class RealLendingContract extends PentePrivateContract<{}> {
    protected evm: PentePrivacyGroup;
    readonly address: string;
    constructor(evm: PentePrivacyGroup, address: string);
    using(paladin: PaladinClient): RealLendingContract;
}
declare function runProperPrivacyVerification(): Promise<boolean>;
export { runProperPrivacyVerification };
//# sourceMappingURL=proper-privacy-verification.d.ts.map
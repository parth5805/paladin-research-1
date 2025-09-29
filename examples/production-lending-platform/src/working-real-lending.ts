/*
 * WORKING REAL LENDING CONTRACT - Fixed Identity Mapping
 */

import PaladinClient, { 
  PenteFactory, 
  PentePrivacyGroup,
  PentePrivateContract 
} from "@lfdecentralizedtrust-labs/paladin-sdk";
import { checkDeploy, nodeConnections } from "paladin-example-common";
import lendingJson from "../abis/RealLendingContract.json";
import * as fs from 'fs';
import * as path from 'path';

const logger = console;

export class RealLendingContract extends PentePrivateContract<{}> {
  constructor(
    protected evm: PentePrivacyGroup,
    public readonly address: string
  ) {
    super(evm, lendingJson.abi, address);
  }

  using(paladin: PaladinClient) {
    return new RealLendingContract(this.evm.using(paladin), this.address);
  }
}

async function deployWorkingLendingContract(): Promise<boolean> {
  logger.log("\n🚀 DEPLOYING WORKING REAL LENDING CONTRACT");
  logger.log("==========================================");
  logger.log(`⏰ Starting at: ${new Date().toISOString()}`);

  if (nodeConnections.length < 2) {
    logger.error("Need at least 2 nodes for lending contract");
    return false;
  }

  try {
    // Initialize Paladin clients
    logger.log("Initializing Paladin clients...");
    const clients = nodeConnections.map(node => new PaladinClient(node.clientOptions));
    const [paladinNode1, paladinNode2] = clients;

    // Get verifiers (participants in the lending deal)
    const [lenderVerifier] = paladinNode1.getVerifiers(`bigbank@${nodeConnections[0].id}`);
    const [borrowerVerifier] = paladinNode2.getVerifiers(`techstartup@${nodeConnections[1].id}`);

    logger.log(`🏦 Lender: ${lenderVerifier.lookup}`);
    logger.log(`🏭 Borrower: ${borrowerVerifier.lookup}`);
    
    // Get the actual addresses
    const lenderAddress = await lenderVerifier.address();
    const borrowerAddress = await borrowerVerifier.address();
    
    logger.log(`🔑 Lender Address: ${lenderAddress}`);
    logger.log(`🔑 Borrower Address: ${borrowerAddress}`);

    // Step 1: Create privacy group for the lending deal
    logger.log("\n📋 Creating privacy group for lending deal...");
    const penteFactory = new PenteFactory(paladinNode1, "pente");
    const lendingPrivacyGroup = await penteFactory.newPrivacyGroup({
      members: [lenderVerifier, borrowerVerifier],
      evmVersion: "shanghai",
      externalCallsEnabled: true,
    }).waitForDeploy();

    if (!checkDeploy(lendingPrivacyGroup)) {
      logger.error("Failed to create privacy group");
      return false;
    }

    logger.log(`✅ Privacy group created: ${lendingPrivacyGroup?.group.id}`);

    // Step 2: Deploy the lending contract
    logger.log("\n🏗️ Deploying lending contract...");
    const contractAddress = await lendingPrivacyGroup.deploy({
      abi: lendingJson.abi,
      bytecode: lendingJson.bytecode,
      from: lenderVerifier.lookup,
    }).waitForDeploy();

    if (!contractAddress) {
      logger.error("Failed to deploy lending contract");
      return false;
    }

    logger.log(`✅ Lending contract deployed: ${contractAddress}`);

    // Step 3: Create contract interface
    const lendingContract = new RealLendingContract(lendingPrivacyGroup, contractAddress);

    // Step 4: Initialize the loan with REAL verifier addresses
    logger.log("\n📋 Initializing loan with REAL verifier addresses...");
    const initReceipt = await lendingContract.sendTransaction({
      from: lenderVerifier.lookup,
      function: "initializeLoan",
      data: { 
        _lender: lenderAddress,    // REAL lender address
        _borrower: borrowerAddress, // REAL borrower address
        _loanAmount: "1000000", // $1M
        _interestRate: "500"    // 5%
      },
    }).waitForReceipt(15000);

    if (!initReceipt?.success) {
      logger.error("Failed to initialize loan");
      return false;
    }

    logger.log(`✅ Loan initialized with real addresses! TX: ${initReceipt.transactionHash}`);

    // Step 5: Fund the loan (should work now!)
    logger.log("\n💰 Lender funding the loan with correct identity...");
    const fundReceipt = await lendingContract.sendTransaction({
      from: lenderVerifier.lookup,
      function: "fundLoan",
      data: {}
    }).waitForReceipt(15000);

    if (!fundReceipt?.success) {
      logger.error("Failed to fund loan:", fundReceipt?.failureMessage);
      return false;
    }

    logger.log(`✅ Loan funded successfully! TX: ${fundReceipt.transactionHash}`);

    // Step 6: Make a payment (borrower action)
    logger.log("\n💸 Borrower making first payment...");
    const paymentReceipt = await lendingContract.sendTransaction({
      from: borrowerVerifier.lookup,
      function: "makePayment",
      data: { amount: "100000" } // $100k payment
    }).waitForReceipt(15000);

    if (!paymentReceipt?.success) {
      logger.error("Failed to make payment:", paymentReceipt?.failureMessage);
      return false;
    }

    logger.log(`✅ Payment made successfully! TX: ${paymentReceipt.transactionHash}`);

    // Step 7: Get loan details to prove it's working
    logger.log("\n📊 Retrieving loan details to prove everything works...");
    const loanDetails = await lendingContract.call({
      from: lenderVerifier.lookup,
      function: "getLoanDetails"
    });

    logger.log(`💰 Loan Amount: ${loanDetails[0]}`);
    logger.log(`📈 Interest Rate: ${loanDetails[1]}`);
    logger.log(`✅ Is Funded: ${loanDetails[2]}`);
    logger.log(`⏰ Creation Time: ${loanDetails[3]}`);
    logger.log(`💸 Total Paid: ${loanDetails[4]}`);
    logger.log(`🔒 Initialized: ${loanDetails[5]}`);

    // Step 8: Get current blockchain timestamp
    const currentTime = await lendingContract.call({
      from: lenderVerifier.lookup,
      function: "getCurrentTimestamp"
    });

    logger.log(`⌚ Current blockchain time: ${currentTime}`);

    // Step 9: Save complete deployment data
    const deploymentData = {
      timestamp: new Date().toISOString(),
      privacyGroupId: lendingPrivacyGroup?.group.id,
      contractAddress: contractAddress,
      realLender: {
        verifier: lenderVerifier.lookup,
        address: lenderAddress
      },
      realBorrower: {
        verifier: borrowerVerifier.lookup,
        address: borrowerAddress
      },
      transactions: {
        init: initReceipt.transactionHash,
        funding: fundReceipt.transactionHash,
        payment: paymentReceipt.transactionHash
      },
      loanState: {
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

    const filename = `working-real-lending-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(dataDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(deploymentData, null, 2));

    logger.log(`\n🎉🎉🎉 COMPLETE REAL LENDING CONTRACT SUCCESS! 🎉🎉🎉`);
    logger.log("=====================================================");
    logger.log(`📄 Contract Address: ${contractAddress}`);
    logger.log(`🔐 Privacy Group: ${lendingPrivacyGroup?.group.id}`);
    logger.log(`🏦 Real Lender: ${lenderAddress}`);
    logger.log(`🏭 Real Borrower: ${borrowerAddress}`);
    logger.log(`💰 Funding TX: ${fundReceipt.transactionHash}`);
    logger.log(`💸 Payment TX: ${paymentReceipt.transactionHash}`);
    logger.log(`📊 Data saved to: ${filepath}`);
    logger.log(`⏰ Completed at: ${new Date().toISOString()}`);
    logger.log(`\n🎯 THIS IS A REAL WORKING LENDING CONTRACT ON REAL BLOCKCHAIN!`);

    return true;

  } catch (error) {
    logger.error(`❌ Deployment failed: ${error}`);
    return false;
  }
}

// Run the deployment
async function main() {
  const success = await deployWorkingLendingContract();
  process.exit(success ? 0 : 1);
}

main();

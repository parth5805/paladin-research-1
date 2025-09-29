#!/usr/bin/env node

/**
 * Privacy Group Investigation Tool
 * 
 * This tool queries the actual privacy group to see who has access
 * and investigates why unauthorized identities can access private data
 */

const PaladinClient = require("@lfdecentralizedtrust-labs/paladin-sdk").default;
const { PenteFactory } = require("@lfdecentralizedtrust-labs/paladin-sdk");
const fs = require('fs');
const path = require('path');

const logger = console;

// Node configuration
const nodeConnections = [
  {
    id: "node1",
    clientOptions: {
      url: "http://localhost:31548",
      logger: logger
    }
  },
  {
    id: "node2", 
    clientOptions: {
      url: "http://localhost:31648",
      logger: logger
    }
  },
  {
    id: "node3",
    clientOptions: {
      url: "http://localhost:31748", 
      logger: logger
    }
  }
];

async function investigatePrivacyGroup() {
  logger.log('🕵️ PRIVACY GROUP INVESTIGATION');
  logger.log('===============================');
  logger.log('Investigating why unauthorized identities have access\n');

  try {
    // Initialize Paladin clients
    const clients = nodeConnections.map(node => new PaladinClient(node.clientOptions));
    const [paladinNode1, paladinNode2, paladinNode3] = clients;

    // Load deployment data to get privacy group ID
    const dataFiles = fs.readdirSync('./data')
      .filter(file => file.includes('complete-real-lending'))
      .sort()
      .reverse();
    
    if (dataFiles.length === 0) {
      logger.error("❌ No deployment data found!");
      return false;
    }

    const deploymentData = JSON.parse(
      fs.readFileSync(path.join('./data', dataFiles[0]), 'utf8')
    );

    const privacyGroupId = deploymentData.privacyGroupId;
    logger.log(`🔍 Investigating Privacy Group: ${privacyGroupId}\n`);

    // Connect to privacy group
    const penteFactory = new PenteFactory(paladinNode1, "pente");
    const privacyGroup = await penteFactory.resumePrivacyGroup({
      id: privacyGroupId
    });

    if (!privacyGroup) {
      logger.error("❌ Failed to resume privacy group!");
      return false;
    }

    logger.log("✅ Connected to privacy group successfully\n");

    // Check all identities we're testing
    const testIdentities = [
      { name: "Authorized Lender", id: "bigbank@node1", node: paladinNode1, expected: true },
      { name: "Authorized Borrower", id: "techstartup@node2", node: paladinNode2, expected: true },
      { name: "Fake Lender", id: "fakelender@node1", node: paladinNode1, expected: false },
      { name: "Fake Borrower", id: "fakeborrower@node2", node: paladinNode2, expected: false },
      { name: "Outsider", id: "outsider@node3", node: paladinNode3, expected: false }
    ];

    logger.log('🔍 CHECKING IDENTITY RESOLUTION');
    logger.log('================================\n');

    for (const testId of testIdentities) {
      try {
        const verifiers = testId.node.getVerifiers(testId.id);
        if (verifiers && verifiers.length > 0) {
          const verifier = verifiers[0];
          logger.log(`${testId.expected ? '✅' : '⚠️ '} ${testId.name} (${testId.id}):`);
          logger.log(`   Lookup: ${verifier.lookup}`);
          logger.log(`   Address: ${verifier.address}`);
          logger.log(`   Verifier Type: ${verifier.verifierType || 'unknown'}`);
          logger.log(`   Algorithm: ${verifier.algorithm || 'unknown'}`);
          
          // Check if this verifier was returned by getVerifiers vs expected
          if (!testId.expected) {
            logger.log(`   🚨 WARNING: Fake identity has valid verifier!`);
          }
        } else {
          logger.log(`❌ ${testId.name} (${testId.id}): No verifiers found`);
        }
        logger.log('');
      } catch (error) {
        logger.log(`❌ ${testId.name} (${testId.id}): Error getting verifiers - ${error.message}\n`);
      }
    }

    // Try to get privacy group information 
    logger.log('🔍 CHECKING PRIVACY GROUP DETAILS');
    logger.log('==================================\n');

    try {
      // Try to get group details directly
      const groupInfo = privacyGroup.group;
      if (groupInfo) {
        logger.log(`Privacy Group ID: ${groupInfo.id}`);
        logger.log(`Group Name: ${groupInfo.name || 'N/A'}`);
        logger.log(`Created: ${groupInfo.created || 'N/A'}`);
        
        if (groupInfo.members) {
          logger.log(`Members (${groupInfo.members.length}):`);
          groupInfo.members.forEach((member, index) => {
            logger.log(`  ${index + 1}. ${member}`);
          });
        }
        
        if (groupInfo.configuration) {
          logger.log(`Configuration:`);
          Object.entries(groupInfo.configuration).forEach(([key, value]) => {
            logger.log(`  ${key}: ${value}`);
          });
        }
      } else {
        logger.log("❌ Could not retrieve group information");
      }
      logger.log('');
    } catch (error) {
      logger.log(`❌ Error getting group details: ${error.message}\n`);
    }

    // Check if there are any configuration issues
    logger.log('🔍 ANALYZING POTENTIAL ISSUES');
    logger.log('==============================\n');

    // Check 1: Identity resolution patterns
    const authorizedLender = paladinNode1.getVerifiers("bigbank@node1")[0];
    const fakeLender = paladinNode1.getVerifiers("fakelender@node1")[0];
    
    if (authorizedLender && fakeLender) {
      logger.log("🕵️ IDENTITY COMPARISON:");
      logger.log(`Authorized Lender Address: ${authorizedLender.address}`);
      logger.log(`Fake Lender Address: ${fakeLender.address}`);
      
      if (authorizedLender.address === fakeLender.address) {
        logger.log("🚨 CRITICAL ISSUE: Same address for different identities!");
      } else {
        logger.log("✅ Different addresses for different identities");
      }
      
      logger.log(`Authorized Lender Lookup: ${authorizedLender.lookup}`);
      logger.log(`Fake Lender Lookup: ${fakeLender.lookup}`);
      
      if (authorizedLender.lookup === fakeLender.lookup) {
        logger.log("🚨 CRITICAL ISSUE: Same lookup for different identities!");
      } else {
        logger.log("✅ Different lookups for different identities");
      }
      logger.log('');
    }

    // Check 2: Privacy group membership checking
    logger.log('🔍 TESTING PRIVACY GROUP ACCESS PATTERNS');
    logger.log('==========================================\n');

    const testCases = [
      { 
        name: "Authorized lender with correct identity", 
        identity: "bigbank@node1",
        node: paladinNode1,
        expected: "SUCCESS"
      },
      { 
        name: "Fake lender with same node", 
        identity: "fakelender@node1",
        node: paladinNode1,
        expected: "BLOCKED"
      }
    ];

    for (const testCase of testCases) {
      try {
        const verifier = testCase.node.getVerifiers(testCase.identity)[0];
        logger.log(`Testing: ${testCase.name}`);
        logger.log(`Identity: ${testCase.identity}`);
        logger.log(`Verifier Lookup: ${verifier.lookup}`);
        logger.log(`Expected: ${testCase.expected}`);
        
        // Try a simple call to test access
        const result = await privacyGroup.using(testCase.node).call({
          to: deploymentData.contractAddress,
          from: verifier.lookup,
          function: "getLoanDetails"
        });
        
        logger.log(`Result: SUCCESS - Data received`);
        if (testCase.expected === "BLOCKED") {
          logger.log(`🚨 PRIVACY BREACH: Should have been blocked!`);
        } else {
          logger.log(`✅ Expected success`);
        }
        
      } catch (error) {
        logger.log(`Result: BLOCKED - ${error.message}`);
        if (testCase.expected === "SUCCESS") {
          logger.log(`❌ Unexpected block: Should have succeeded!`);
        } else {
          logger.log(`✅ Expected block`);
        }
      }
      logger.log('');
    }

    return true;

  } catch (error) {
    logger.error(`❌ Investigation failed: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    return false;
  }
}

// Run the investigation
if (require.main === module) {
  investigatePrivacyGroup()
    .then((success) => {
      if (success) {
        logger.log('🕵️ ✅ INVESTIGATION COMPLETED');
        process.exit(0);
      } else {
        logger.log('🕵️ ❌ INVESTIGATION FAILED');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error('💥 Investigation crashed:', error);
      process.exit(1);
    });
}

module.exports = { investigatePrivacyGroup };

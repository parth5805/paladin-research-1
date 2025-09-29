#!/usr/bin/env node

/**
 * Identity Resolution Test
 * 
 * This tool tests how different identity names resolve to addresses
 * to understand why fake identities can access private data
 */

const PaladinClient = require("@lfdecentralizedtrust-labs/paladin-sdk").default;

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

async function testIdentityResolution() {
  logger.log('🔍 IDENTITY RESOLUTION TEST');
  logger.log('============================');
  logger.log('Testing how different identity names resolve to addresses\n');

  try {
    // Initialize Paladin clients
    const clients = nodeConnections.map(node => new PaladinClient(node.clientOptions));
    const [paladinNode1, paladinNode2, paladinNode3] = clients;

    // Test various identity patterns
    const identityTests = [
      // Node 1 identities
      { node: paladinNode1, nodeId: "node1", identity: "bigbank@node1" },
      { node: paladinNode1, nodeId: "node1", identity: "fakelender@node1" },
      { node: paladinNode1, nodeId: "node1", identity: "anythingelse@node1" },
      { node: paladinNode1, nodeId: "node1", identity: "member@node1" },
      { node: paladinNode1, nodeId: "node1", identity: "test@node1" },
      
      // Node 2 identities
      { node: paladinNode2, nodeId: "node2", identity: "techstartup@node2" },
      { node: paladinNode2, nodeId: "node2", identity: "fakeborrower@node2" },
      { node: paladinNode2, nodeId: "node2", identity: "something@node2" },
      { node: paladinNode2, nodeId: "node2", identity: "member@node2" },
      { node: paladinNode2, nodeId: "node2", identity: "test@node2" },
      
      // Node 3 identities
      { node: paladinNode3, nodeId: "node3", identity: "outsider@node3" },
      { node: paladinNode3, nodeId: "node3", identity: "anything@node3" },
      { node: paladinNode3, nodeId: "node3", identity: "member@node3" },
      { node: paladinNode3, nodeId: "node3", identity: "test@node3" }
    ];

    logger.log('Testing identity resolution patterns:\n');

    const addressMap = new Map();
    
    for (const test of identityTests) {
      try {
        const verifiers = test.node.getVerifiers(test.identity);
        if (verifiers && verifiers.length > 0) {
          const verifier = verifiers[0];
          
          // Try to get the actual address
          let actualAddress = 'UNKNOWN';
          try {
            actualAddress = verifier.address;
            // If it's a function, try to call it
            if (typeof actualAddress === 'function') {
              actualAddress = 'FUNCTION_OBJECT';
            }
          } catch (e) {
            try {
              // Try different methods to get the actual address
              actualAddress = await verifier.resolve?.() || 'UNRESOLVABLE';
            } catch (e2) {
              actualAddress = 'ERROR_RESOLVING';
            }
          }
          
          logger.log(`${test.nodeId} | ${test.identity.padEnd(20)} | Lookup: ${verifier.lookup.padEnd(20)} | Address: ${actualAddress}`);
          
          // Track unique addresses per node
          const nodeKey = test.nodeId;
          if (!addressMap.has(nodeKey)) {
            addressMap.set(nodeKey, new Set());
          }
          addressMap.get(nodeKey).add(actualAddress);
          
        } else {
          logger.log(`${test.nodeId} | ${test.identity.padEnd(20)} | NO VERIFIERS FOUND`);
        }
      } catch (error) {
        logger.log(`${test.nodeId} | ${test.identity.padEnd(20)} | ERROR: ${error.message}`);
      }
    }

    logger.log('\n🔍 ADDRESS ANALYSIS');
    logger.log('====================');
    
    for (const [nodeId, addresses] of addressMap.entries()) {
      logger.log(`${nodeId}: ${addresses.size} unique address(es)`);
      if (addresses.size === 1) {
        logger.log(`  🚨 ALL identities on ${nodeId} resolve to the SAME address!`);
      } else {
        logger.log(`  ✅ Different identities on ${nodeId} have different addresses`);
      }
    }

    // Hypothesis test: Check if node identity pattern matters
    logger.log('\n🧪 HYPOTHESIS TESTING');
    logger.log('======================');
    
    const nodeTests = [
      { node: paladinNode1, tests: [
        { identity: "alpha@node1", desc: "alpha prefix" },
        { identity: "beta@node1", desc: "beta prefix" },
        { identity: "gamma@node1", desc: "gamma prefix" }
      ]},
      { node: paladinNode2, tests: [
        { identity: "alpha@node2", desc: "alpha prefix" },
        { identity: "beta@node2", desc: "beta prefix" },
        { identity: "gamma@node2", desc: "gamma prefix" }
      ]}
    ];

    for (const nodeTest of nodeTests) {
      logger.log(`\nTesting identity prefixes on ${nodeTest.node === paladinNode1 ? 'node1' : 'node2'}:`);
      
      const nodeAddresses = new Set();
      
      for (const test of nodeTest.tests) {
        try {
          const verifiers = nodeTest.node.getVerifiers(test.identity);
          if (verifiers && verifiers.length > 0) {
            const verifier = verifiers[0];
            let address = 'UNKNOWN';
            try {
              address = verifier.address;
              if (typeof address === 'function') {
                address = 'FUNCTION_OBJECT';
              }
            } catch (e) {
              address = 'ERROR';
            }
            
            logger.log(`  ${test.identity} (${test.desc}): ${address}`);
            nodeAddresses.add(address);
          }
        } catch (error) {
          logger.log(`  ${test.identity} (${test.desc}): ERROR - ${error.message}`);
        }
      }
      
      if (nodeAddresses.size === 1) {
        logger.log(`  🚨 CONFIRMED: All identities resolve to same address on this node!`);
      } else {
        logger.log(`  ✅ Different identities have different addresses`);
      }
    }

    return true;

  } catch (error) {
    logger.error(`❌ Identity resolution test failed: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    return false;
  }
}

// Run the test
if (require.main === module) {
  testIdentityResolution()
    .then((success) => {
      if (success) {
        logger.log('\n🔍 ✅ IDENTITY RESOLUTION TEST COMPLETED');
        process.exit(0);
      } else {
        logger.log('\n🔍 ❌ IDENTITY RESOLUTION TEST FAILED');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error('💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { testIdentityResolution };

const PaladinClient = require("@lfdecentralizedtrust-labs/paladin-sdk").default;

const client = new PaladinClient({
  url: "http://127.0.0.1:31548"
});

// Test direct receipt retrieval
async function testReceipt() {
  try {
    const receipt = await client.getTransactionReceipt("6abdc6d4-d967-4579-8cd5-68656efe04e4");
    console.log("Receipt found:", receipt);
  } catch (error) {
    console.error("Error retrieving receipt:", error.message);
  }
}

testReceipt();

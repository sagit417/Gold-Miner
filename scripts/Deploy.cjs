const hre = require("hardhat");

async function main() {
  console.log("Deploying MiningGame contract...");

  const MiningGame = await hre.ethers.getContractFactory("MiningGame");
  const miningGame = await MiningGame.deploy();

  await miningGame.waitForDeployment();

  console.log(`MiningGame deployed to: ${await miningGame.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

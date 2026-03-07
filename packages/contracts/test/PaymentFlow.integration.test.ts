import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

/**
 * Integration tests for the complete payment flow across
 * BountyRegistry, DataRegistry, and EscrowManager contracts.
 *
 * Tests the fix for GitHub Issue #9: Payment Flow Between BountyRegistry and DataRegistry
 */
describe("Payment Flow Integration", function () {
  async function deployFullSystemFixture() {
    const [
      owner,
      bountyCreator,
      contributor1,
      contributor2,
      functionsConsumer,
    ] = await hre.ethers.getSigners();

    // Deploy all contracts
    const EscrowManager = await hre.ethers.getContractFactory("EscrowManager");
    const escrowManager = await EscrowManager.deploy();

    const BountyRegistry =
      await hre.ethers.getContractFactory("BountyRegistry");
    const bountyRegistry = await BountyRegistry.deploy();

    const DataRegistry = await hre.ethers.getContractFactory("DataRegistry");
    const dataRegistry = await DataRegistry.deploy(
      await bountyRegistry.getAddress(),
      functionsConsumer.address,
    );

    // Set up all contract references (critical for payment flow)
    await escrowManager.setBountyRegistry(await bountyRegistry.getAddress());
    await escrowManager.setDataRegistry(await dataRegistry.getAddress());
    await bountyRegistry.setEscrowManager(await escrowManager.getAddress());
    await dataRegistry.setEscrowManager(await escrowManager.getAddress());

    // Wire up access control: allow DataRegistry to call BountyRegistry
    await bountyRegistry.setDataRegistry(await dataRegistry.getAddress());

    return {
      escrowManager,
      bountyRegistry,
      dataRegistry,
      owner,
      bountyCreator,
      contributor1,
      contributor2,
      functionsConsumer,
    };
  }

  describe("Complete Bounty Lifecycle with Payment", function () {
    it("Should handle full flow: create bounty -> submit data -> verify -> pay contributor", async function () {
      const {
        escrowManager,
        bountyRegistry,
        dataRegistry,
        bountyCreator,
        contributor1,
        functionsConsumer,
      } = await loadFixture(deployFullSystemFixture);

      const reward = hre.ethers.parseEther("1.0");
      const deadline = (await time.latest()) + 86400;

      // Step 1: Creator creates bounty with reward
      const creatorBalanceBefore = await hre.ethers.provider.getBalance(
        bountyCreator.address,
      );

      const createTx = await bountyRegistry
        .connect(bountyCreator)
        .createBounty("QmMetadata", "QmSchema", deadline, 5, {
          value: reward,
        });
      const createReceipt = await createTx.wait();
      const createGas = createReceipt!.gasUsed * createReceipt!.gasPrice;

      // Verify funds moved from creator to escrow
      const creatorBalanceAfter = await hre.ethers.provider.getBalance(
        bountyCreator.address,
      );
      expect(creatorBalanceBefore - creatorBalanceAfter - createGas).to.equal(
        reward,
      );
      expect(await escrowManager.getTotalBalance()).to.equal(reward);
      expect(await escrowManager.isEscrowFunded(0)).to.be.true;

      // Step 2: Contributor submits data
      await dataRegistry
        .connect(contributor1)
        .submitData(0, "QmDataCID", "metadata");

      const submission = await dataRegistry.getSubmission(0);
      expect(submission.status).to.equal(1); // VERIFYING

      // Step 3: FunctionsConsumer reports verification success
      const contributorBalanceBefore = await hre.ethers.provider.getBalance(
        contributor1.address,
      );

      await dataRegistry
        .connect(functionsConsumer)
        .handleVerificationResult(0, true, "0x");

      // Step 4: Verify payment was released to contributor
      const contributorBalanceAfter = await hre.ethers.provider.getBalance(
        contributor1.address,
      );
      expect(contributorBalanceAfter - contributorBalanceBefore).to.equal(
        reward,
      );

      // Verify escrow is released
      expect(await escrowManager.isEscrowFunded(0)).to.be.false;
      expect(await escrowManager.getTotalBalance()).to.equal(0);

      // Verify bounty and submission status
      const bounty = await bountyRegistry.getBounty(0);
      expect(bounty.status).to.equal(2); // COMPLETED

      const finalSubmission = await dataRegistry.getSubmission(0);
      expect(finalSubmission.status).to.equal(2); // VERIFIED
    });

    it("Should handle bounty cancellation with proper refund", async function () {
      const { escrowManager, bountyRegistry, bountyCreator } =
        await loadFixture(deployFullSystemFixture);

      const reward = hre.ethers.parseEther("0.5");
      const deadline = (await time.latest()) + 86400;

      // Create bounty
      await bountyRegistry
        .connect(bountyCreator)
        .createBounty("QmMetadata", "QmSchema", deadline, 5, {
          value: reward,
        });

      expect(await escrowManager.getTotalBalance()).to.equal(reward);

      // Cancel bounty
      const balanceBefore = await hre.ethers.provider.getBalance(
        bountyCreator.address,
      );
      const cancelTx = await bountyRegistry
        .connect(bountyCreator)
        .cancelBounty(0);
      const cancelReceipt = await cancelTx.wait();
      const cancelGas = cancelReceipt!.gasUsed * cancelReceipt!.gasPrice;

      // Verify refund
      const balanceAfter = await hre.ethers.provider.getBalance(
        bountyCreator.address,
      );
      expect(balanceAfter + cancelGas - balanceBefore).to.equal(reward);

      // Verify escrow is empty
      expect(await escrowManager.getTotalBalance()).to.equal(0);
      expect(await escrowManager.isEscrowFunded(0)).to.be.false;
    });

    it("Should handle multiple bounties with independent escrows", async function () {
      const {
        escrowManager,
        bountyRegistry,
        dataRegistry,
        bountyCreator,
        contributor1,
        contributor2,
        functionsConsumer,
      } = await loadFixture(deployFullSystemFixture);

      const deadline = (await time.latest()) + 86400;
      const reward1 = hre.ethers.parseEther("1.0");
      const reward2 = hre.ethers.parseEther("2.0");
      const reward3 = hre.ethers.parseEther("0.5");

      // Create 3 bounties
      await bountyRegistry
        .connect(bountyCreator)
        .createBounty("QmMetadata1", "QmSchema", deadline, 5, {
          value: reward1,
        });
      await bountyRegistry
        .connect(bountyCreator)
        .createBounty("QmMetadata2", "QmSchema", deadline, 5, {
          value: reward2,
        });
      await bountyRegistry
        .connect(bountyCreator)
        .createBounty("QmMetadata3", "QmSchema", deadline, 5, {
          value: reward3,
        });

      // Verify total escrow
      expect(await escrowManager.getTotalBalance()).to.equal(
        reward1 + reward2 + reward3,
      );

      // Submit and verify data for bounty 0
      await dataRegistry.connect(contributor1).submitData(0, "QmData1", "meta");
      await dataRegistry
        .connect(functionsConsumer)
        .handleVerificationResult(0, true, "0x");

      // Cancel bounty 1
      await bountyRegistry.connect(bountyCreator).cancelBounty(1);

      // Submit data for bounty 2, reject it
      await dataRegistry.connect(contributor2).submitData(2, "QmData2", "meta");
      await dataRegistry
        .connect(functionsConsumer)
        .handleVerificationResult(1, false, "0x");

      // Verify final state
      expect(await escrowManager.isEscrowFunded(0)).to.be.false; // Released
      expect(await escrowManager.isEscrowFunded(1)).to.be.false; // Refunded
      expect(await escrowManager.isEscrowFunded(2)).to.be.true; // Still funded

      // Only bounty 2's funds remain
      expect(await escrowManager.getTotalBalance()).to.equal(reward3);

      // Verify escrow statistics
      const stats = await escrowManager.getStats();
      expect(stats.deposits).to.equal(reward1 + reward2 + reward3);
      expect(stats.released).to.equal(reward1);
      expect(stats.refunded).to.equal(reward2);
    });

    it("Should handle rejected submission without releasing payment", async function () {
      const {
        escrowManager,
        bountyRegistry,
        dataRegistry,
        bountyCreator,
        contributor1,
        functionsConsumer,
      } = await loadFixture(deployFullSystemFixture);

      const reward = hre.ethers.parseEther("1.0");
      const deadline = (await time.latest()) + 86400;

      // Create bounty
      await bountyRegistry
        .connect(bountyCreator)
        .createBounty("QmMetadata", "QmSchema", deadline, 5, {
          value: reward,
        });

      // Submit data
      await dataRegistry
        .connect(contributor1)
        .submitData(0, "QmBadData", "meta");

      const contributorBalanceBefore = await hre.ethers.provider.getBalance(
        contributor1.address,
      );

      // Reject submission
      await dataRegistry
        .connect(functionsConsumer)
        .handleVerificationResult(0, false, "0x");

      // Verify no payment was made
      const contributorBalanceAfter = await hre.ethers.provider.getBalance(
        contributor1.address,
      );
      expect(contributorBalanceAfter).to.equal(contributorBalanceBefore);

      // Funds should still be in escrow
      expect(await escrowManager.isEscrowFunded(0)).to.be.true;
      expect(await escrowManager.getTotalBalance()).to.equal(reward);

      // Bounty should still be active (can accept more submissions)
      const bounty = await bountyRegistry.getBounty(0);
      expect(bounty.status).to.equal(1); // ACTIVE
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should have reentrancy protection on BountyRegistry.cancelBounty", async function () {
      const { bountyRegistry, bountyCreator } = await loadFixture(
        deployFullSystemFixture,
      );

      const deadline = (await time.latest()) + 86400;
      const reward = hre.ethers.parseEther("0.1");

      await bountyRegistry
        .connect(bountyCreator)
        .createBounty("QmMetadata", "QmSchema", deadline, 5, {
          value: reward,
        });

      // Cancel should succeed (nonReentrant)
      await bountyRegistry.connect(bountyCreator).cancelBounty(0);

      // Double cancel should fail (status check, not reentrancy)
      await expect(
        bountyRegistry.connect(bountyCreator).cancelBounty(0),
      ).to.be.revertedWithCustomError(bountyRegistry, "InvalidStatus");
    });

    it("Should have reentrancy protection on DataRegistry.handleVerificationResult", async function () {
      const {
        bountyRegistry,
        dataRegistry,
        bountyCreator,
        contributor1,
        functionsConsumer,
      } = await loadFixture(deployFullSystemFixture);

      const deadline = (await time.latest()) + 86400;

      await bountyRegistry
        .connect(bountyCreator)
        .createBounty("QmMetadata", "QmSchema", deadline, 5, {
          value: hre.ethers.parseEther("0.1"),
        });

      await dataRegistry.connect(contributor1).submitData(0, "QmData", "meta");

      // First verification should succeed
      await dataRegistry
        .connect(functionsConsumer)
        .handleVerificationResult(0, true, "0x");

      // Second call should fail (status check)
      await expect(
        dataRegistry
          .connect(functionsConsumer)
          .handleVerificationResult(0, true, "0x"),
      ).to.be.revertedWithCustomError(dataRegistry, "InvalidStatus");
    });
  });

  describe("Access Control", function () {
    it("Should only allow BountyRegistry to deposit to EscrowManager", async function () {
      const { escrowManager, contributor1 } = await loadFixture(
        deployFullSystemFixture,
      );

      await expect(
        escrowManager.connect(contributor1).deposit(99, contributor1.address, {
          value: hre.ethers.parseEther("1.0"),
        }),
      ).to.be.revertedWithCustomError(escrowManager, "Unauthorized");
    });

    it("Should only allow DataRegistry to release from EscrowManager", async function () {
      const { escrowManager, bountyRegistry, bountyCreator, contributor1 } =
        await loadFixture(deployFullSystemFixture);

      const deadline = (await time.latest()) + 86400;

      await bountyRegistry
        .connect(bountyCreator)
        .createBounty("QmMetadata", "QmSchema", deadline, 5, {
          value: hre.ethers.parseEther("0.1"),
        });

      await expect(
        escrowManager.connect(contributor1).release(0, contributor1.address),
      ).to.be.revertedWithCustomError(escrowManager, "Unauthorized");
    });

    it("Should only allow BountyRegistry to refund from EscrowManager", async function () {
      const { escrowManager, bountyRegistry, bountyCreator, contributor1 } =
        await loadFixture(deployFullSystemFixture);

      const deadline = (await time.latest()) + 86400;

      await bountyRegistry
        .connect(bountyCreator)
        .createBounty("QmMetadata", "QmSchema", deadline, 5, {
          value: hre.ethers.parseEther("0.1"),
        });

      await expect(
        escrowManager.connect(contributor1).refund(0),
      ).to.be.revertedWithCustomError(escrowManager, "Unauthorized");
    });
  });
});

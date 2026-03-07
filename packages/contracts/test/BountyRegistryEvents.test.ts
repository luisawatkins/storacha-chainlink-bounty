import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("BountyRegistry Events & New Features", function () {
  async function deployFixture() {
    const [owner, creator, user, dataRegistrySigner] =
      await hre.ethers.getSigners();

    // Deploy EscrowManager first
    const EscrowManager = await hre.ethers.getContractFactory("EscrowManager");
    const escrowManager = await EscrowManager.deploy();

    // Deploy BountyRegistry
    const BountyRegistry =
      await hre.ethers.getContractFactory("BountyRegistry");
    const registry = await BountyRegistry.deploy();

    // Set up bidirectional references
    await escrowManager.setBountyRegistry(await registry.getAddress());
    await registry.setEscrowManager(await escrowManager.getAddress());

    // Set up DataRegistry access control
    await registry.setDataRegistry(dataRegistrySigner.address);

    return {
      registry,
      escrowManager,
      owner,
      creator,
      user,
      dataRegistrySigner,
    };
  }

  describe("Increase Reward", function () {
    it("Should increase reward and emit event", async function () {
      const { registry, creator } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;
      const initialReward = hre.ethers.parseEther("0.1");
      const increaseAmount = hre.ethers.parseEther("0.05");

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: initialReward,
        });

      await expect(
        registry.connect(creator).increaseReward(0, { value: increaseAmount }),
      )
        .to.emit(registry, "RewardIncreased")
        .withArgs(0, increaseAmount, initialReward + increaseAmount);

      const bounty = await registry.getBounty(0);
      expect(bounty.reward).to.equal(initialReward + increaseAmount);
    });

    it("Should route increased funds through EscrowManager", async function () {
      const { registry, escrowManager, creator } =
        await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;
      const initialReward = hre.ethers.parseEther("0.1");
      const increaseAmount = hre.ethers.parseEther("0.05");

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: initialReward,
        });

      await expect(
        registry.connect(creator).increaseReward(0, { value: increaseAmount }),
      )
        .to.emit(escrowManager, "FundsDeposited")
        .withArgs(0, creator.address, increaseAmount);

      const escrow = await escrowManager.getEscrow(0);
      expect(escrow.amount).to.equal(initialReward + increaseAmount);
    });

    it("Should revert if bounty not active", async function () {
      const { registry, creator } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });
      await registry.connect(creator).cancelBounty(0);

      await expect(
        registry
          .connect(creator)
          .increaseReward(0, { value: hre.ethers.parseEther("0.1") }),
      ).to.be.revertedWithCustomError(registry, "InvalidStatus");
    });

    it("Should revert if not creator", async function () {
      const { registry, creator, user } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });

      await expect(
        registry
          .connect(user)
          .increaseReward(0, { value: hre.ethers.parseEther("0.1") }),
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });
  });

  describe("Extend Deadline", function () {
    it("Should extend deadline and emit event", async function () {
      const { registry, creator } = await loadFixture(deployFixture);
      const initialDeadline = (await time.latest()) + 86400;
      const newDeadline = initialDeadline + 3600;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", initialDeadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });

      await expect(registry.connect(creator).extendDeadline(0, newDeadline))
        .to.emit(registry, "DeadlineExtended")
        .withArgs(0, newDeadline);

      const bounty = await registry.getBounty(0);
      expect(bounty.deadline).to.equal(newDeadline);
    });

    it("Should revert if new deadline is not greater", async function () {
      const { registry, creator } = await loadFixture(deployFixture);
      const initialDeadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", initialDeadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });

      await expect(
        registry.connect(creator).extendDeadline(0, initialDeadline),
      ).to.be.revertedWithCustomError(registry, "InvalidDeadline");
    });

    it("Should revert if new deadline is in the past", async function () {
      const { registry, creator } = await loadFixture(deployFixture);
      const initialDeadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", initialDeadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });

      // Move time past the deadline
      await time.increaseTo(initialDeadline + 100);

      // Try to extend to a time greater than old deadline but still in the past
      const pastDeadline = initialDeadline + 50;
      await expect(
        registry.connect(creator).extendDeadline(0, pastDeadline),
      ).to.be.revertedWithCustomError(registry, "InvalidDeadline");
    });

    it("Should revert if not creator", async function () {
      const { registry, creator, user } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });

      await expect(
        registry.connect(user).extendDeadline(0, deadline + 100),
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });
  });

  describe("Expire Bounty", function () {
    it("Should expire bounty, refund creator via escrow, and emit event", async function () {
      const { registry, escrowManager, creator, user } =
        await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;
      const reward = hre.ethers.parseEther("0.1");

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: reward,
        });

      // Move time past deadline
      await time.increaseTo(deadline + 1);

      // Anyone can call expire
      const tx = registry.connect(user).expireBounty(0);

      await expect(tx)
        .to.emit(registry, "BountyExpired")
        .withArgs(0, creator.address, reward);

      // Verify escrow was refunded
      await expect(tx)
        .to.emit(escrowManager, "FundsRefunded")
        .withArgs(0, creator.address, reward);

      await expect(tx).to.changeEtherBalances(
        [creator, escrowManager],
        [reward, -reward],
      );

      const bounty = await registry.getBounty(0);
      expect(bounty.status).to.equal(4); // EXPIRED
    });

    it("Should revert if deadline not reached", async function () {
      const { registry, creator } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });

      await expect(
        registry.connect(creator).expireBounty(0),
      ).to.be.revertedWithCustomError(registry, "InvalidDeadline");
    });

    it("Should revert if already cancelled/expired/completed", async function () {
      const { registry, creator } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });
      await registry.connect(creator).cancelBounty(0);

      await time.increaseTo(deadline + 1);

      await expect(
        registry.connect(creator).expireBounty(0),
      ).to.be.revertedWithCustomError(registry, "InvalidStatus");
    });
  });
});

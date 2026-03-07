import {
  loadFixture,
  time,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("BountyRegistry", function () {
  async function deployFixture() {
    const [owner, creator, user, dataRegistrySigner] =
      await hre.ethers.getSigners();

    // Deploy EscrowManager first
    const EscrowManager = await hre.ethers.getContractFactory("EscrowManager");
    const escrowManager = await EscrowManager.deploy();

    // Deploy BountyRegistry
    const BountyRegistry = await hre.ethers.getContractFactory(
      "BountyRegistry"
    );
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

  async function deployFixtureWithoutEscrowManager() {
    const [owner, creator, user, dataRegistrySigner] =
      await hre.ethers.getSigners();
    const BountyRegistry = await hre.ethers.getContractFactory(
      "BountyRegistry"
    );
    const registry = await BountyRegistry.deploy();

    await registry.setDataRegistry(dataRegistrySigner.address);

    return { registry, owner, creator, user, dataRegistrySigner };
  }

  describe("Deployment", function () {
    it("Should set owner and initialize counters", async function () {
      const { registry, owner } = await loadFixture(deployFixture);
      expect(await registry.owner()).to.equal(owner.address);
      expect(await registry.getTotalBounties()).to.equal(0);
    });
  });

  describe("EscrowManager Integration", function () {
    it("Should revert createBounty if EscrowManager not set", async function () {
      const { registry, creator } = await loadFixture(
        deployFixtureWithoutEscrowManager
      );
      const deadline = (await time.latest()) + 86400;
      const reward = hre.ethers.parseEther("0.1");

      await expect(
        registry
          .connect(creator)
          .createBounty("QmMetadata", "QmSchema", deadline, 10, {
            value: reward,
          })
      ).to.be.revertedWithCustomError(registry, "EscrowManagerNotSet");
    });

    it("Should allow owner to set EscrowManager", async function () {
      const { registry, escrowManager } = await loadFixture(deployFixture);
      expect(await registry.escrowManager()).to.equal(
        await escrowManager.getAddress()
      );
    });

    it("Should emit event when EscrowManager is updated", async function () {
      const { registry } = await loadFixture(deployFixtureWithoutEscrowManager);
      const EscrowManager = await hre.ethers.getContractFactory(
        "EscrowManager"
      );
      const newEscrowManager = await EscrowManager.deploy();

      await expect(
        registry.setEscrowManager(await newEscrowManager.getAddress())
      )
        .to.emit(registry, "EscrowManagerUpdated")
        .withArgs(hre.ethers.ZeroAddress, await newEscrowManager.getAddress());
    });
  });

  describe("setDataRegistry", function () {
    it("Should emit DataRegistryUpdated event", async function () {
      const { dataRegistrySigner } = await loadFixture(deployFixture);
      const BountyRegistry = await hre.ethers.getContractFactory(
        "BountyRegistry"
      );
      const newRegistry = await BountyRegistry.deploy();

      await expect(newRegistry.setDataRegistry(dataRegistrySigner.address))
        .to.emit(newRegistry, "DataRegistryUpdated")
        .withArgs(
          "0x0000000000000000000000000000000000000000",
          dataRegistrySigner.address
        );
    });

    it("Should revert when setting zero address", async function () {
      const { registry } = await loadFixture(deployFixture);
      await expect(
        registry.setDataRegistry("0x0000000000000000000000000000000000000000")
      ).to.be.revertedWithCustomError(registry, "InvalidAddress");
    });

    it("Should revert when called by non-owner", async function () {
      const { registry, user, dataRegistrySigner } = await loadFixture(
        deployFixture
      );
      await expect(
        registry.connect(user).setDataRegistry(dataRegistrySigner.address)
      ).to.be.revertedWithCustomError(registry, "OwnableUnauthorizedAccount");
    });
  });

  describe("Create Bounty", function () {
    it("Should create bounty and deposit to EscrowManager", async function () {
      const { registry, escrowManager, creator } = await loadFixture(
        deployFixture
      );
      const deadline = (await time.latest()) + 86400;
      const reward = hre.ethers.parseEther("0.1");

      await expect(
        registry
          .connect(creator)
          .createBounty("QmMetadata", "QmSchema", deadline, 10, {
            value: reward,
          })
      )
        .to.emit(registry, "BountyCreated")
        .withArgs(
          0,
          creator.address,
          reward,
          "QmMetadata",
          "QmSchema",
          deadline,
        )
        .and.to.emit(escrowManager, "FundsDeposited")
        .withArgs(0, creator.address, reward);

      const bounty = await registry.getBounty(0);
      expect(bounty.creator).to.equal(creator.address);
      expect(bounty.status).to.equal(1); // ACTIVE

      // Verify funds are in escrow
      expect(await escrowManager.isEscrowFunded(0)).to.be.true;
      expect(await escrowManager.getEscrowAmount(0)).to.equal(reward);
    });

    it("Should revert with insufficient reward", async function () {
      const { registry, creator } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;

      await expect(
        registry
          .connect(creator)
          .createBounty("QmMetadata", "QmSchema", deadline, 10, {
            value: hre.ethers.parseEther("0.005"),
          })
      ).to.be.revertedWithCustomError(registry, "InsufficientReward");
    });

    it("Should revert with past deadline", async function () {
      const { registry, creator } = await loadFixture(deployFixture);
      const pastDeadline = (await time.latest()) - 1;

      await expect(
        registry
          .connect(creator)
          .createBounty("QmMetadata", "QmSchema", pastDeadline, 10, {
            value: hre.ethers.parseEther("0.1"),
          })
      ).to.be.revertedWithCustomError(registry, "InvalidDeadline");
    });

    it("Should revert with zero max submissions", async function () {
      const { registry, creator } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;

      await expect(
        registry
          .connect(creator)
          .createBounty("QmMetadata", "QmSchema", deadline, 0, {
            value: hre.ethers.parseEther("0.1"),
          })
      ).to.be.revertedWithCustomError(registry, "InvalidStatus");
    });
  });

  describe("Cancel Bounty", function () {
    it("Should cancel and refund creator via EscrowManager", async function () {
      const { registry, escrowManager, creator } = await loadFixture(
        deployFixture
      );
      const deadline = (await time.latest()) + 86400;
      const reward = hre.ethers.parseEther("0.1");

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: reward,
        });

      const creatorBalanceBefore = await hre.ethers.provider.getBalance(
        creator.address
      );

      const tx = await registry.connect(creator).cancelBounty(0);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;

      await expect(tx)
        .to.emit(registry, "BountyCancelled")
        .withArgs(0, creator.address)
        .and.to.emit(escrowManager, "FundsRefunded")
        .withArgs(0, creator.address, reward);

      const creatorBalanceAfter = await hre.ethers.provider.getBalance(
        creator.address
      );
      expect(creatorBalanceAfter + gasUsed - creatorBalanceBefore).to.equal(
        reward
      );

      const bounty = await registry.getBounty(0);
      expect(bounty.status).to.equal(3); // CANCELLED

      // Verify escrow is refunded
      expect(await escrowManager.isEscrowFunded(0)).to.be.false;
    });

    it("Should revert double cancel", async function () {
      const { registry, creator } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;
      const reward = hre.ethers.parseEther("0.1");

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: reward,
        });
      await registry.connect(creator).cancelBounty(0);

      await expect(
        registry.connect(creator).cancelBounty(0)
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
        registry.connect(user).cancelBounty(0)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });
  });

  describe("Complete Bounty", function () {
    it("Should complete bounty", async function () {
      const { registry, creator, user, dataRegistrySigner } = await loadFixture(
        deployFixture
      );
      const deadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });

      await expect(
        registry
          .connect(dataRegistrySigner)
          .completeBounty(0, user.address, "QmData")
      )
        .to.emit(registry, "BountyCompleted")
        .withArgs(0, user.address, "QmData");

      const bounty = await registry.getBounty(0);
      expect(bounty.status).to.equal(2); // COMPLETED
    });

    it("Should revert if not DataRegistry", async function () {
      const { registry, creator, user } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });

      await expect(
        registry.connect(user).completeBounty(0, user.address, "QmData")
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("Should revert if DataRegistry not set", async function () {
      const [_owner, creator, user] = await hre.ethers.getSigners();
      const EscrowManager = await hre.ethers.getContractFactory(
        "EscrowManager"
      );
      const escrowManager = await EscrowManager.deploy();
      const BountyRegistry = await hre.ethers.getContractFactory(
        "BountyRegistry"
      );
      const newRegistry = await BountyRegistry.deploy();

      // Set up EscrowManager but NOT DataRegistry
      await escrowManager.setBountyRegistry(await newRegistry.getAddress());
      await newRegistry.setEscrowManager(await escrowManager.getAddress());

      const deadline = (await time.latest()) + 86400;

      await newRegistry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });

      await expect(
        newRegistry.connect(user).completeBounty(0, user.address, "QmData")
      ).to.be.revertedWithCustomError(newRegistry, "DataRegistryNotSet");
    });
  });

  describe("Increment Submissions", function () {
    it("Should increment submission count", async function () {
      const { registry, creator, dataRegistrySigner } = await loadFixture(
        deployFixture
      );
      const deadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 3, {
          value: hre.ethers.parseEther("0.1"),
        });

      await expect(registry.connect(dataRegistrySigner).incrementSubmissions(0))
        .to.emit(registry, "SubmissionIncremented")
        .withArgs(0, 1);

      const bounty = await registry.getBounty(0);
      expect(bounty.submissionCount).to.equal(1);
    });

    it("Should revert if not DataRegistry", async function () {
      const { registry, creator, user } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 3, {
          value: hre.ethers.parseEther("0.1"),
        });

      await expect(
        registry.connect(user).incrementSubmissions(0)
      ).to.be.revertedWithCustomError(registry, "Unauthorized");
    });

    it("Should revert when max reached", async function () {
      const { registry, creator, dataRegistrySigner } = await loadFixture(
        deployFixture
      );
      const deadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 2, {
          value: hre.ethers.parseEther("0.1"),
        });

      await registry.connect(dataRegistrySigner).incrementSubmissions(0);
      await registry.connect(dataRegistrySigner).incrementSubmissions(0);

      await expect(
        registry.connect(dataRegistrySigner).incrementSubmissions(0)
      ).to.be.revertedWithCustomError(registry, "MaxSubmissionsReached");
    });
  });

  describe("View Functions", function () {
    it("Should check if bounty is active", async function () {
      const { registry, creator } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata", "QmSchema", deadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });

      expect(await registry.isBountyActive(0)).to.be.true;

      await registry.connect(creator).cancelBounty(0);
      expect(await registry.isBountyActive(0)).to.be.false;
    });

    it("Should get bounties by creator", async function () {
      const { registry, creator } = await loadFixture(deployFixture);
      const deadline = (await time.latest()) + 86400;

      await registry
        .connect(creator)
        .createBounty("QmMetadata1", "QmSchema", deadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });
      await registry
        .connect(creator)
        .createBounty("QmMetadata2", "QmSchema", deadline, 10, {
          value: hre.ethers.parseEther("0.1"),
        });

      const bounties = await registry.getBountiesByCreator(creator.address);
      expect(bounties.length).to.equal(2);
      expect(bounties[0]).to.equal(0);
      expect(bounties[1]).to.equal(1);
    });
  });
});

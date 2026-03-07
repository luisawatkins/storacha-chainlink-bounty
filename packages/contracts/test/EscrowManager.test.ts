import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import hre from "hardhat";

describe("EscrowManager", function () {
  async function deployFixture() {
    const [owner, bountyRegistry, dataRegistry, depositor, recipient, user] =
      await hre.ethers.getSigners();

    const EscrowManager = await hre.ethers.getContractFactory("EscrowManager");
    const escrowManager = await EscrowManager.deploy();

    // Set authorized contracts
    await escrowManager.setBountyRegistry(bountyRegistry.address);
    await escrowManager.setDataRegistry(dataRegistry.address);

    return {
      escrowManager,
      owner,
      bountyRegistry,
      dataRegistry,
      depositor,
      recipient,
      user,
    };
  }

  describe("Deployment", function () {
    it("Should set owner correctly", async function () {
      const { escrowManager, owner } = await loadFixture(deployFixture);
      expect(await escrowManager.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero balances", async function () {
      const { escrowManager } = await loadFixture(deployFixture);
      const stats = await escrowManager.getStats();
      expect(stats.deposits).to.equal(0);
      expect(stats.released).to.equal(0);
      expect(stats.refunded).to.equal(0);
      expect(stats.currentBalance).to.equal(0);
    });
  });

  describe("Admin Functions", function () {
    it("Should set BountyRegistry address", async function () {
      const { escrowManager, bountyRegistry } = await loadFixture(
        deployFixture
      );
      expect(await escrowManager.bountyRegistry()).to.equal(
        bountyRegistry.address
      );
    });

    it("Should set DataRegistry address", async function () {
      const { escrowManager, dataRegistry } = await loadFixture(deployFixture);
      expect(await escrowManager.dataRegistry()).to.equal(dataRegistry.address);
    });

    it("Should emit events when updating registry addresses", async function () {
      const {
        escrowManager: _escrowManager,
        owner: _owner,
        user,
      } = await loadFixture(deployFixture);

      // Deploy fresh contract without set addresses
      const EscrowManager = await hre.ethers.getContractFactory(
        "EscrowManager"
      );
      const freshEscrow = await EscrowManager.deploy();

      await expect(freshEscrow.setBountyRegistry(user.address))
        .to.emit(freshEscrow, "BountyRegistryUpdated")
        .withArgs(hre.ethers.ZeroAddress, user.address);

      await expect(freshEscrow.setDataRegistry(user.address))
        .to.emit(freshEscrow, "DataRegistryUpdated")
        .withArgs(hre.ethers.ZeroAddress, user.address);
    });

    it("Should revert if non-owner tries to set addresses", async function () {
      const { escrowManager, user } = await loadFixture(deployFixture);

      await expect(
        escrowManager.connect(user).setBountyRegistry(user.address)
      ).to.be.revertedWithCustomError(
        escrowManager,
        "OwnableUnauthorizedAccount"
      );

      await expect(
        escrowManager.connect(user).setDataRegistry(user.address)
      ).to.be.revertedWithCustomError(
        escrowManager,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should revert when setting zero address", async function () {
      const { escrowManager } = await loadFixture(deployFixture);

      await expect(
        escrowManager.setBountyRegistry(hre.ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(escrowManager, "InvalidAddress");

      await expect(
        escrowManager.setDataRegistry(hre.ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(escrowManager, "InvalidAddress");
    });
  });

  describe("Deposit", function () {
    it("Should accept deposit from BountyRegistry", async function () {
      const { escrowManager, bountyRegistry, depositor } = await loadFixture(
        deployFixture
      );
      const bountyId = 1;
      const amount = hre.ethers.parseEther("1.0");

      await expect(
        escrowManager
          .connect(bountyRegistry)
          .deposit(bountyId, depositor.address, { value: amount })
      )
        .to.emit(escrowManager, "FundsDeposited")
        .withArgs(bountyId, depositor.address, amount);

      const escrow = await escrowManager.getEscrow(bountyId);
      expect(escrow.bountyId).to.equal(bountyId);
      expect(escrow.depositor).to.equal(depositor.address);
      expect(escrow.amount).to.equal(amount);
      expect(escrow.status).to.equal(1); // FUNDED
    });

    it("Should update statistics after deposit", async function () {
      const { escrowManager, bountyRegistry, depositor } = await loadFixture(
        deployFixture
      );
      const amount = hre.ethers.parseEther("1.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount });

      const stats = await escrowManager.getStats();
      expect(stats.deposits).to.equal(amount);
      expect(stats.currentBalance).to.equal(amount);
    });

    it("Should revert deposit from unauthorized caller", async function () {
      const { escrowManager, user, depositor } = await loadFixture(
        deployFixture
      );
      const amount = hre.ethers.parseEther("1.0");

      await expect(
        escrowManager
          .connect(user)
          .deposit(1, depositor.address, { value: amount })
      ).to.be.revertedWithCustomError(escrowManager, "Unauthorized");
    });

    it("Should revert deposit with zero amount", async function () {
      const { escrowManager, bountyRegistry, depositor } = await loadFixture(
        deployFixture
      );

      await expect(
        escrowManager
          .connect(bountyRegistry)
          .deposit(1, depositor.address, { value: 0 })
      ).to.be.revertedWithCustomError(escrowManager, "InvalidAmount");
    });

    it("Should revert deposit with zero depositor address", async function () {
      const { escrowManager, bountyRegistry } = await loadFixture(
        deployFixture
      );
      const amount = hre.ethers.parseEther("1.0");

      await expect(
        escrowManager
          .connect(bountyRegistry)
          .deposit(1, hre.ethers.ZeroAddress, { value: amount })
      ).to.be.revertedWithCustomError(escrowManager, "InvalidAddress");
    });

    it("Should revert if escrow already exists for bounty", async function () {
      const { escrowManager, bountyRegistry, depositor } = await loadFixture(
        deployFixture
      );
      const amount = hre.ethers.parseEther("1.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount });

      await expect(
        escrowManager
          .connect(bountyRegistry)
          .deposit(1, depositor.address, { value: amount })
      ).to.be.revertedWithCustomError(escrowManager, "EscrowAlreadyExists");
    });
  });

  describe("Release", function () {
    it("Should release funds to recipient", async function () {
      const {
        escrowManager,
        bountyRegistry,
        dataRegistry,
        depositor,
        recipient,
      } = await loadFixture(deployFixture);
      const bountyId = 1;
      const amount = hre.ethers.parseEther("1.0");

      // Deposit first
      await escrowManager
        .connect(bountyRegistry)
        .deposit(bountyId, depositor.address, { value: amount });

      const recipientBalanceBefore = await hre.ethers.provider.getBalance(
        recipient.address
      );

      // Release funds
      await expect(
        escrowManager.connect(dataRegistry).release(bountyId, recipient.address)
      )
        .to.emit(escrowManager, "FundsReleased")
        .withArgs(bountyId, recipient.address, amount);

      const recipientBalanceAfter = await hre.ethers.provider.getBalance(
        recipient.address
      );
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(amount);

      const escrow = await escrowManager.getEscrow(bountyId);
      expect(escrow.status).to.equal(2); // RELEASED
    });

    it("Should update statistics after release", async function () {
      const {
        escrowManager,
        bountyRegistry,
        dataRegistry,
        depositor,
        recipient,
      } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount });
      await escrowManager.connect(dataRegistry).release(1, recipient.address);

      const stats = await escrowManager.getStats();
      expect(stats.released).to.equal(amount);
      expect(stats.currentBalance).to.equal(0);
    });

    it("Should revert release from unauthorized caller", async function () {
      const { escrowManager, bountyRegistry, depositor, user, recipient } =
        await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount });

      await expect(
        escrowManager.connect(user).release(1, recipient.address)
      ).to.be.revertedWithCustomError(escrowManager, "Unauthorized");
    });

    it("Should revert release with zero recipient address", async function () {
      const { escrowManager, bountyRegistry, dataRegistry, depositor } =
        await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount });

      await expect(
        escrowManager.connect(dataRegistry).release(1, hre.ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(escrowManager, "InvalidAddress");
    });

    it("Should revert release if escrow not funded", async function () {
      const { escrowManager, dataRegistry, recipient } = await loadFixture(
        deployFixture
      );

      await expect(
        escrowManager.connect(dataRegistry).release(1, recipient.address)
      ).to.be.revertedWithCustomError(escrowManager, "InvalidEscrowStatus");
    });

    it("Should revert double release", async function () {
      const {
        escrowManager,
        bountyRegistry,
        dataRegistry,
        depositor,
        recipient,
      } = await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount });
      await escrowManager.connect(dataRegistry).release(1, recipient.address);

      await expect(
        escrowManager.connect(dataRegistry).release(1, recipient.address)
      ).to.be.revertedWithCustomError(escrowManager, "InvalidEscrowStatus");
    });
  });

  describe("Refund", function () {
    it("Should refund funds to depositor", async function () {
      const { escrowManager, bountyRegistry, depositor } = await loadFixture(
        deployFixture
      );
      const bountyId = 1;
      const amount = hre.ethers.parseEther("1.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(bountyId, depositor.address, { value: amount });

      const depositorBalanceBefore = await hre.ethers.provider.getBalance(
        depositor.address
      );

      await expect(escrowManager.connect(bountyRegistry).refund(bountyId))
        .to.emit(escrowManager, "FundsRefunded")
        .withArgs(bountyId, depositor.address, amount);

      const depositorBalanceAfter = await hre.ethers.provider.getBalance(
        depositor.address
      );
      expect(depositorBalanceAfter - depositorBalanceBefore).to.equal(amount);

      const escrow = await escrowManager.getEscrow(bountyId);
      expect(escrow.status).to.equal(3); // REFUNDED
    });

    it("Should update statistics after refund", async function () {
      const { escrowManager, bountyRegistry, depositor } = await loadFixture(
        deployFixture
      );
      const amount = hre.ethers.parseEther("1.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount });
      await escrowManager.connect(bountyRegistry).refund(1);

      const stats = await escrowManager.getStats();
      expect(stats.refunded).to.equal(amount);
      expect(stats.currentBalance).to.equal(0);
    });

    it("Should revert refund from unauthorized caller", async function () {
      const { escrowManager, bountyRegistry, depositor, user } =
        await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount });

      await expect(
        escrowManager.connect(user).refund(1)
      ).to.be.revertedWithCustomError(escrowManager, "Unauthorized");
    });

    it("Should revert refund if escrow not funded", async function () {
      const { escrowManager, bountyRegistry } = await loadFixture(
        deployFixture
      );

      await expect(
        escrowManager.connect(bountyRegistry).refund(1)
      ).to.be.revertedWithCustomError(escrowManager, "InvalidEscrowStatus");
    });

    it("Should revert double refund", async function () {
      const { escrowManager, bountyRegistry, depositor } = await loadFixture(
        deployFixture
      );
      const amount = hre.ethers.parseEther("1.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount });
      await escrowManager.connect(bountyRegistry).refund(1);

      await expect(
        escrowManager.connect(bountyRegistry).refund(1)
      ).to.be.revertedWithCustomError(escrowManager, "InvalidEscrowStatus");
    });
  });

  describe("Emergency Withdraw", function () {
    it("Should allow owner to emergency withdraw", async function () {
      const { escrowManager, bountyRegistry, depositor, recipient } =
        await loadFixture(deployFixture);
      const bountyId = 1;
      const amount = hre.ethers.parseEther("1.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(bountyId, depositor.address, { value: amount });

      const recipientBalanceBefore = await hre.ethers.provider.getBalance(
        recipient.address
      );

      await expect(escrowManager.emergencyWithdraw(bountyId, recipient.address))
        .to.emit(escrowManager, "FundsRefunded")
        .withArgs(bountyId, recipient.address, amount);

      const recipientBalanceAfter = await hre.ethers.provider.getBalance(
        recipient.address
      );
      expect(recipientBalanceAfter - recipientBalanceBefore).to.equal(amount);
    });

    it("Should revert emergency withdraw from non-owner", async function () {
      const { escrowManager, bountyRegistry, depositor, user, recipient } =
        await loadFixture(deployFixture);
      const amount = hre.ethers.parseEther("1.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount });

      await expect(
        escrowManager.connect(user).emergencyWithdraw(1, recipient.address)
      ).to.be.revertedWithCustomError(
        escrowManager,
        "OwnableUnauthorizedAccount"
      );
    });

    it("Should revert emergency withdraw with zero recipient", async function () {
      const { escrowManager, bountyRegistry, depositor } = await loadFixture(
        deployFixture
      );
      const amount = hre.ethers.parseEther("1.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount });

      await expect(
        escrowManager.emergencyWithdraw(1, hre.ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(escrowManager, "InvalidAddress");
    });
  });

  describe("View Functions", function () {
    it("Should return correct escrow status", async function () {
      const { escrowManager, bountyRegistry, depositor } = await loadFixture(
        deployFixture
      );
      const amount = hre.ethers.parseEther("1.0");

      expect(await escrowManager.isEscrowFunded(1)).to.be.false;

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount });

      expect(await escrowManager.isEscrowFunded(1)).to.be.true;
    });

    it("Should return correct escrow amount", async function () {
      const { escrowManager, bountyRegistry, depositor } = await loadFixture(
        deployFixture
      );
      const amount = hre.ethers.parseEther("1.0");

      expect(await escrowManager.getEscrowAmount(1)).to.equal(0);

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount });

      expect(await escrowManager.getEscrowAmount(1)).to.equal(amount);
    });

    it("Should return correct total balance", async function () {
      const { escrowManager, bountyRegistry, depositor } = await loadFixture(
        deployFixture
      );
      const amount1 = hre.ethers.parseEther("1.0");
      const amount2 = hre.ethers.parseEther("2.0");

      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount1 });
      await escrowManager
        .connect(bountyRegistry)
        .deposit(2, depositor.address, { value: amount2 });

      expect(await escrowManager.getTotalBalance()).to.equal(amount1 + amount2);
    });
  });

  describe("Receive Function", function () {
    it("Should reject direct ETH transfers", async function () {
      const { escrowManager, user } = await loadFixture(deployFixture);

      await expect(
        user.sendTransaction({
          to: await escrowManager.getAddress(),
          value: hre.ethers.parseEther("1.0"),
        })
      ).to.be.revertedWith("Use deposit() function");
    });
  });

  describe("Multiple Bounties", function () {
    it("Should handle multiple bounties independently", async function () {
      const {
        escrowManager,
        bountyRegistry,
        dataRegistry,
        depositor,
        recipient,
      } = await loadFixture(deployFixture);
      const amount1 = hre.ethers.parseEther("1.0");
      const amount2 = hre.ethers.parseEther("2.0");
      const amount3 = hre.ethers.parseEther("0.5");

      // Create 3 escrows
      await escrowManager
        .connect(bountyRegistry)
        .deposit(1, depositor.address, { value: amount1 });
      await escrowManager
        .connect(bountyRegistry)
        .deposit(2, depositor.address, { value: amount2 });
      await escrowManager
        .connect(bountyRegistry)
        .deposit(3, depositor.address, { value: amount3 });

      // Release bounty 1
      await escrowManager.connect(dataRegistry).release(1, recipient.address);

      // Refund bounty 2
      await escrowManager.connect(bountyRegistry).refund(2);

      // Check states
      expect((await escrowManager.getEscrow(1)).status).to.equal(2); // RELEASED
      expect((await escrowManager.getEscrow(2)).status).to.equal(3); // REFUNDED
      expect((await escrowManager.getEscrow(3)).status).to.equal(1); // FUNDED

      // Check remaining balance
      expect(await escrowManager.getTotalBalance()).to.equal(amount3);

      // Check stats
      const stats = await escrowManager.getStats();
      expect(stats.deposits).to.equal(amount1 + amount2 + amount3);
      expect(stats.released).to.equal(amount1);
      expect(stats.refunded).to.equal(amount2);
    });
  });
});

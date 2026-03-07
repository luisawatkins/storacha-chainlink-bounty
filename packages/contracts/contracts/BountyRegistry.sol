// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./EscrowManager.sol";

/**
 * @title BountyRegistry
 * @notice Manages creation and lifecycle of data bounties
 * @dev Handles bounty creation, cancellation, and completion
 */
contract BountyRegistry is Ownable, ReentrancyGuard {
    struct Bounty {
        uint256 id;
        address creator;
        string metadataUri; // IPFS CID of off-chain metadata (title, description, etc.)
        string schemaUri; // IPFS CID of JSON Schema
        uint256 reward;
        uint256 deadline;
        BountyStatus status;
        uint256 maxSubmissions;
        uint256 submissionCount;
        uint256 createdAt;
    }

    enum BountyStatus {
        DRAFT,
        ACTIVE,
        COMPLETED,
        CANCELLED,
        EXPIRED
    }

    // State variables
    uint256 private _bountyIdCounter;
    mapping(uint256 => Bounty) public bounties;
    address public dataRegistry;

    // Minimum reward to prevent spam (0.01 ETH)
    uint256 public constant MIN_REWARD = 0.01 ether;

    // EscrowManager for secure fund management
    EscrowManager public escrowManager;

    // Events
    event BountyCreated(
        uint256 indexed id,
        address indexed creator,
        uint256 reward,
        string metadataUri,
        string schemaUri,
        uint256 indexed deadline
    );

    event BountyCompleted(
        uint256 indexed id,
        address indexed winner,
        string cid
    );

    event BountyCancelled(uint256 indexed id, address indexed creator);

    event BountyExpired(uint256 indexed id, address indexed creator, uint256 reward);

    event RewardIncreased(
        uint256 indexed id,
        uint256 amountAdded,
        uint256 newReward
    );

    event DeadlineExtended(uint256 indexed id, uint256 newDeadline);

    event SubmissionIncremented(uint256 indexed bountyId, uint256 newCount);

    event EscrowManagerUpdated(address indexed oldAddress, address indexed newAddress);

    event DataRegistryUpdated(address indexed previousRegistry, address indexed newRegistry);

    // Custom errors
    error InsufficientReward();
    error InvalidDeadline();
    error BountyNotFound();
    error Unauthorized();
    error InvalidStatus();
    error MaxSubmissionsReached();
    error EscrowManagerNotSet();
    error EscrowDepositFailed();
    error DataRegistryNotSet();
    error InvalidAddress();

    modifier onlyDataRegistry() {
        if (dataRegistry == address(0)) revert DataRegistryNotSet();
        if (msg.sender != dataRegistry) revert Unauthorized();
        _;
    }

    constructor() Ownable(msg.sender) {}

    /**
     * @notice Set the DataRegistry address
     * @param _dataRegistry Address of the DataRegistry contract
     */
    function setDataRegistry(address _dataRegistry) external onlyOwner {
        if (_dataRegistry == address(0)) revert InvalidAddress();
        address previousRegistry = dataRegistry;
        dataRegistry = _dataRegistry;
        emit DataRegistryUpdated(previousRegistry, _dataRegistry);
    }

    /**
     * @notice Create a new bounty
     * @param metadataUri IPFS CID of off-chain metadata
     * @param schemaUri IPFS CID of the JSON Schema for data validation
     * @param deadline Unix timestamp of bounty deadline
     * @param maxSubmissions Maximum number of submissions allowed
     * @return bountyId The ID of the created bounty
     */
    function createBounty(
        string calldata metadataUri,
        string calldata schemaUri,
        uint256 deadline,
        uint256 maxSubmissions
    ) external payable returns (uint256) {
        if (msg.value < MIN_REWARD) revert InsufficientReward();
        if (deadline <= block.timestamp) revert InvalidDeadline();
        if (maxSubmissions == 0) revert InvalidStatus();
        if (address(escrowManager) == address(0)) revert EscrowManagerNotSet();

        uint256 bountyId = _bountyIdCounter++;

        bounties[bountyId] = Bounty({
            id: bountyId,
            creator: msg.sender,
            metadataUri: metadataUri,
            schemaUri: schemaUri,
            reward: msg.value,
            deadline: deadline,
            status: BountyStatus.ACTIVE,
            maxSubmissions: maxSubmissions,
            submissionCount: 0,
            createdAt: block.timestamp
        });

        // Deposit funds into EscrowManager
        escrowManager.deposit{value: msg.value}(bountyId, msg.sender);

        emit BountyCreated(bountyId, msg.sender, msg.value, metadataUri, schemaUri, deadline);

        return bountyId;
    }

    /**
     * @notice Cancel bounty and refund creator via EscrowManager
     * @param bountyId The ID of the bounty to cancel
     */
    function cancelBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.creator == address(0)) revert BountyNotFound();
        if (msg.sender != bounty.creator) revert Unauthorized();
        if (bounty.status != BountyStatus.ACTIVE) revert InvalidStatus();

        bounty.status = BountyStatus.CANCELLED;

        // Refund creator via EscrowManager
        escrowManager.refund(bountyId);

        emit BountyCancelled(bountyId, bounty.creator);
    }

    /**
     * @notice Set the EscrowManager contract address
     * @param _escrowManager Address of the EscrowManager contract
     */
    function setEscrowManager(address _escrowManager) external onlyOwner {
        if (_escrowManager == address(0)) revert BountyNotFound();

        address oldAddress = address(escrowManager);
        escrowManager = EscrowManager(payable(_escrowManager));

        emit EscrowManagerUpdated(oldAddress, _escrowManager);
    }

    /**
     * @notice Mark bounty as completed (called by DataRegistry)
     * @param bountyId The ID of the bounty to complete
     * @param winner Address of the winning contributor
     * @param cid IPFS CID of the winning submission
     */
    function completeBounty(
        uint256 bountyId,
        address winner,
        string calldata cid
    ) external onlyDataRegistry {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.creator == address(0)) revert BountyNotFound();
        if (bounty.status != BountyStatus.ACTIVE) revert InvalidStatus();

        bounty.status = BountyStatus.COMPLETED;

        emit BountyCompleted(bountyId, winner, cid);
    }

    /**
     * @notice Increase bounty reward
     * @param bountyId The ID of the bounty
     */
    function increaseReward(uint256 bountyId) external payable nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.creator == address(0)) revert BountyNotFound();
        if (msg.sender != bounty.creator) revert Unauthorized();
        if (bounty.status != BountyStatus.ACTIVE) revert InvalidStatus();
        if (msg.value == 0) revert InsufficientReward();

        bounty.reward += msg.value;

        // Route funds through EscrowManager
        escrowManager.increaseDeposit{value: msg.value}(bountyId, msg.sender);

        emit RewardIncreased(bountyId, msg.value, bounty.reward);
    }

    /**
     * @notice Extend bounty deadline
     * @param bountyId The ID of the bounty
     * @param newDeadline New deadline timestamp
     */
    function extendDeadline(uint256 bountyId, uint256 newDeadline) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.creator == address(0)) revert BountyNotFound();
        if (msg.sender != bounty.creator) revert Unauthorized();
        if (bounty.status != BountyStatus.ACTIVE) revert InvalidStatus();
        if (newDeadline <= bounty.deadline) revert InvalidDeadline();
        if (newDeadline <= block.timestamp) revert InvalidDeadline();

        bounty.deadline = newDeadline;

        emit DeadlineExtended(bountyId, newDeadline);
    }

    /**
     * @notice Expire bounty and refund creator
     * @param bountyId The ID of the bounty
     */
    function expireBounty(uint256 bountyId) external nonReentrant {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.creator == address(0)) revert BountyNotFound();
        if (bounty.status != BountyStatus.ACTIVE) revert InvalidStatus();
        if (block.timestamp <= bounty.deadline) revert InvalidDeadline();

        bounty.status = BountyStatus.EXPIRED;

        // Refund creator via EscrowManager
        escrowManager.refund(bountyId);

        emit BountyExpired(bountyId, bounty.creator, bounty.reward);
    }

    /**
     * @notice Increment submission count
     * @param bountyId The ID of the bounty
     */
    function incrementSubmissions(uint256 bountyId) external onlyDataRegistry {
        Bounty storage bounty = bounties[bountyId];

        if (bounty.creator == address(0)) revert BountyNotFound();
        if (bounty.submissionCount >= bounty.maxSubmissions) {
            revert MaxSubmissionsReached();
        }

        bounty.submissionCount++;

        emit SubmissionIncremented(bountyId, bounty.submissionCount);
    }

    /**
     * @notice Get bounty details
     * @param bountyId The ID of the bounty
     * @return Bounty struct containing all bounty information
     */
    function getBounty(uint256 bountyId) external view returns (Bounty memory) {
        return bounties[bountyId];
    }

    /**
     * @notice Check if bounty is active
     * @param bountyId The ID of the bounty
     * @return bool True if bounty is active and not expired
     */
    function isBountyActive(uint256 bountyId) external view returns (bool) {
        Bounty storage bounty = bounties[bountyId];
        return
            bounty.status == BountyStatus.ACTIVE &&
            block.timestamp <= bounty.deadline &&
            bounty.submissionCount < bounty.maxSubmissions;
    }

    /**
     * @notice Get total number of bounties created
     * @return uint256 Total bounty count
     */
    function getTotalBounties() external view returns (uint256) {
        return _bountyIdCounter;
    }

    /**
     * @notice Get bounties created by an address
     * @param creator Address of the creator
     * @return uint256[] Array of bounty IDs
     */
    function getBountiesByCreator(address creator) external view returns (uint256[] memory) {
        uint256 count = 0;

        // First pass: count bounties
        for (uint256 i = 0; i < _bountyIdCounter; i++) {
            if (bounties[i].creator == creator) {
                count++;
            }
        }

        // Second pass: populate array
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;

        for (uint256 i = 0; i < _bountyIdCounter; i++) {
            if (bounties[i].creator == creator) {
                result[index] = i;
                index++;
            }
        }

        return result;
    }
}

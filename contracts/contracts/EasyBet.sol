// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

// Uncomment the line to use openzeppelin/ERC721,ERC20
// You can use this dependency directly because it has been installed by TA already
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// Uncomment this line to use console.log
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
contract EasyBet is ERC721Enumerable, Ownable {
    // use a event if you want
    // to represent time you can choose block.timestamp
    // event BetPlaced(uint256 tokenId, uint256 price, address owner);
    event BetPlaced(
        uint256 tokenId,
        uint256 price,
        address owner,
        uint256 activityId,
        uint256 choiceIndex
    );
    event ActivityCreated(
        uint256 activityId,
        address creator,
        string description,
        string[] choices
    );
    event ActivityResolved(uint256 activityId, uint8 winningChoiceIndex);
    event PrizeClaimed(uint256 activityId, address winner, uint256 amount);

    // Marketplace related events
    event TicketListed(uint256 indexed tokenId, uint256 price);
    event TicketSold(
        uint256 indexed tokenId,
        address seller,
        address buyer,
        uint256 price
    );
    event ListingCancelled(uint256 indexed tokenId);
    // maybe you need a struct to store some activity information
    struct Activity {
        address owner;
        uint256 listedTimestamp;
        string description;
        string[] choices;
        uint256[] choiceAmounts; // total amount bet on each choice
        uint256 prizePool;
        uint256 endTime;
        bool isResolved;
        uint8 winningChoiceIndex; // index of the winning choice, whether to be array
        bool isActive;
    }
    struct Listing {
        address seller;
        uint256 price; // in wei
        bool active;
    }

    mapping(uint256 => Activity) public activities; // A map from activity-index to its information
    uint256 public activityCount; // total number of activities created
    mapping(uint256 => uint256) public tokenBetAmount; // tokenId => amount
    mapping(uint256 => uint256) public totalWinningAmount; // activityId => total ETH in winning choice
    // 彩票信息映射：通过彩票ID可以查询到所属活动ID
    mapping(uint256 => uint256) public tokenToActivityId;
    // 彩票信息映射：通过彩票ID可以查询到所选的选项索引
    mapping(uint256 => uint256) public tokenToChoiceIndex;

    // 每个活动的彩票计数器，用于生成唯一的彩票ID
    mapping(uint256 => uint256) public activityTicketCount;

    // 记录每个活动中获胜选项的所有彩票持有者
    mapping(uint256 => mapping(uint256 => address[]))
        public winningTicketHolders;
    // 嵌套映射：活动ID -> 选项索引 -> 持有者地址数组

    // 标记彩票是否已经领取过奖金，防止重复领取
    mapping(uint256 => bool) public ticketClaimed;

    mapping(uint256 => Listing) public listings; // tokenId -> Listing

    // 合约部署时执行，初始化NFT合约和权限控制
    constructor() ERC721("EasyBetTicket", "EBT") Ownable(msg.sender) {
        // ERC721 构造：设置NFT名称为"EasyBetTicket"，符号为"EBT"
        // Ownable 构造：设置合约所有者为部署者地址
    }

    function helloworld() external pure returns (string memory) {
        return "hello world";
    }

    function createActivity(
        string memory description,
        string[] memory choices,
        uint256 durationHours
    ) external onlyOwner returns (uint256) {
        // onlyOwner 表示只有合约所有者能调用
        require(choices.length >= 2, "At least two choices required");

        uint256 activityId = activityCount;
        activityCount++;
        activities[activityId] = Activity({
            owner: msg.sender, // 当前调用者作为创建者
            listedTimestamp: block.timestamp, // 当前时间戳
            description: description, // 活动描述
            choices: choices, // 选项列表
            choiceAmounts: new uint256[](choices.length), // 初始化每个选项的投注金额数组
            prizePool: 0, // 初始奖池为0
            endTime: block.timestamp + durationHours * 1 hours, // 结束时间
            isResolved: false, // 初始未结算
            winningChoiceIndex: 0, // 初始获胜选项为0
            isActive: true // 初始活跃状态
        });

        emit ActivityCreated(activityId, msg.sender, description, choices);
        return activityId;
    }

    function buyTicket(
        uint256 activityId,
        uint256 choiceIndex
    ) external payable {
        require(activityId < activityCount, "Activity does not exist");
        require(
            choiceIndex < activities[activityId].choices.length,
            "Invalid choice index"
        );
        require(
            block.timestamp < activities[activityId].endTime,
            "Activity has ended"
        );
        require(activities[activityId].isActive, "Activity is not active");
        require(msg.value > 0, "Bet amount must be greater than zero");

        // 获取活动的存储引用（storage），可以直接修改原数据
        Activity storage activity = activities[activityId];
        activity.choiceAmounts[choiceIndex] += msg.value; // 更新选项的投注金额
        activity.prizePool += msg.value; // 更新奖池金额

        uint256 localId = activityTicketCount[activityId]++;
        uint256 tokenId = (activityId << 64) | localId; // 生成唯一的NFT彩票ID
        _mint(msg.sender, tokenId); // 铸造NFT彩票给购买者
        tokenToActivityId[tokenId] = activityId; // 记录彩票对应的活动
        tokenToChoiceIndex[tokenId] = choiceIndex; // 记录彩票对应的选
        tokenBetAmount[tokenId] = msg.value;
        emit BetPlaced(tokenId, msg.value, msg.sender, activityId, choiceIndex);
    }

    function resolveActivity(
        uint256 activityId,
        uint8 winningChoiceIndex
    ) external onlyOwner {
        require(activityId < activityCount, "Activity does not exist");
        Activity storage activity = activities[activityId];
        require(!activity.isResolved, "Activity already resolved");
        require(
            winningChoiceIndex < activity.choices.length,
            "Invalid winning choice index"
        );
        // require(block.timestamp >= activity.endTime, "Activity not ended yet");

        // 只设置状态，不遍历任何 NFT
        activity.isResolved = true;
        activity.winningChoiceIndex = winningChoiceIndex;

        emit ActivityResolved(activityId, winningChoiceIndex);
    }

    function claimPrize(uint256 activityId) external {
        require(activityId < activityCount, "Activity does not exist");
        Activity storage activity = activities[activityId];
        require(activity.isResolved, "Activity not resolved");

        uint8 winningChoiceIndex = activity.winningChoiceIndex;

        // 计算用户在获胜选项上的总投注金额
        uint256 userTotalBet = 0;
        uint256 balance = balanceOf(msg.sender);
        for (uint256 i = 0; i < balance; i++) {
            uint256 tokenId = tokenOfOwnerByIndex(msg.sender, i);
            if (
                tokenToActivityId[tokenId] == activityId &&
                tokenToChoiceIndex[tokenId] == winningChoiceIndex &&
                !ticketClaimed[tokenId]
            ) {
                userTotalBet += tokenBetAmount[tokenId];
                ticketClaimed[tokenId] = true; // 标记为已领取
            }
        }

        require(userTotalBet > 0, "No winning tickets or already claimed");

        // 使用 activity.choiceAmounts[winningChoiceIndex] 作为总投注金额
        uint256 totalWinningBet = activity.choiceAmounts[winningChoiceIndex];
        require(totalWinningBet > 0, "No bets on winning choice"); // 安全检查

        // 按金额比例分配奖金
        uint256 prizeAmount = (activity.prizePool * userTotalBet) /
            totalWinningBet;

        (bool success, ) = payable(msg.sender).call{value: prizeAmount}("");
        require(success, "Failed to send prize");

        emit PrizeClaimed(activityId, msg.sender, prizeAmount);
    }

    // 挂单：仅限彩票持有者，且活动未开奖
    function listTicket(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        require(price > 0, "Price must be > 0");

        uint256 activityId = tokenToActivityId[tokenId];
        Activity storage activity = activities[activityId];
        require(!activity.isResolved, "Activity already resolved");
        require(!ticketClaimed[tokenId], "Ticket already claimed");

        listings[tokenId] = Listing(msg.sender, price, true);
        emit TicketListed(tokenId, price);
    }

    // 取消挂单
    function cancelListing(uint256 tokenId) external {
        require(listings[tokenId].seller == msg.sender, "Not seller");
        require(listings[tokenId].active, "Not listed");

        listings[tokenId].active = false;
        emit ListingCancelled(tokenId);
    }

    // 购买挂单彩票：必须支付 exact price
    function buyListedTicket(uint256 tokenId) external payable {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not listed or inactive");
        require(msg.value == listing.price, "Incorrect price");

        address seller = listing.seller;
        listing.active = false;

        // 安全转移 NFT
        _transfer(seller, msg.sender, tokenId);

        // 支付 ETH 给卖家
        (bool sent, ) = payable(seller).call{value: msg.value}("");
        require(sent, "Failed to send ETH to seller");

        emit TicketSold(tokenId, seller, msg.sender, msg.value);
    }
    // ============ 公共函数：获取彩票信息 ============
    function getTokenInfo(
        uint256 tokenId
    )
        external
        view
        returns (
            uint256 activityId, // 活动ID
            uint256 choiceIndex, // 选项索引
            string memory activityDescription, // 活动描述
            string memory choiceName // 选项名称
        )
    {
        // 从映射中获取活动ID和选项索引
        activityId = tokenToActivityId[tokenId];
        choiceIndex = tokenToChoiceIndex[tokenId];
        // 获取活动的存储引用
        Activity storage activity = activities[activityId];

        // 返回彩票的完整信息
        return (
            activityId, // 活动ID
            choiceIndex, // 选项索引
            activity.description, // 活动描述
            activity.choices[choiceIndex] // 选项名称
        );
    }

    function getActivityInfo(
        uint256 activityId
    )
        external
        view
        returns (
            address owner,
            uint256 listedTimestamp,
            string memory description,
            string[] memory choices,
            uint256[] memory choiceAmounts,
            uint256 prizePool,
            uint256 endTime,
            bool isResolved,
            uint256 winningChoiceIndex,
            bool isActive
        )
    {
        Activity storage activity = activities[activityId];
        return (
            activity.owner,
            activity.listedTimestamp,
            activity.description,
            activity.choices,
            activity.choiceAmounts,
            activity.prizePool,
            activity.endTime,
            activity.isResolved,
            activity.winningChoiceIndex,
            activity.isActive
        );
    }

    function decodeTokenId(
        uint256 tokenId
    ) public pure returns (uint256 activityId, uint256 localId) {
        activityId = tokenId >> 64;
        localId = tokenId & ((1 << 64) - 1); // 取低64位
    }

    //
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract RE4MerchantShop {
    address public owner;
    bool private locked;

    enum ItemType {
        Weapon,
        Consumable
    }

    struct Player {
        string name;
        bool registered;
    }

    struct Item {
        uint256 id;
        string name;
        uint256 price;
        ItemType itemType;
        bool exists;
    }

    struct WeaponStats {
        uint256 power;
        uint256 fireRate;
        uint256 reloadSpeed;
        uint256 capacity;
        bool exclusive;
    }

    mapping(address => Player) private players;
    mapping(uint256 => Item) private items;
    mapping(address => mapping(uint256 => uint256)) private itemQuantities;
    mapping(address => mapping(uint256 => WeaponStats)) private playerWeaponStats;

    uint256[] private allItemIds;

    event PlayerRegistered(address indexed player, string name);
    event ItemPurchased(address indexed player, uint256 indexed itemId, string itemName, uint256 price);
    event ItemSold(address indexed player, uint256 indexed itemId, string itemName, uint256 refund);
    event WeaponUpgraded(address indexed player, uint256 indexed weaponId, string upgradeName, uint256 newValue);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can use this function");
        _;
    }

    modifier onlyRegistered() {
        require(players[msg.sender].registered, "Register first");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }

    constructor() {
        owner = msg.sender;

        _addItem(1, "Rusty Revolver", 0.001 ether, ItemType.Weapon);
        _addItem(2, "Iron Shotgun", 0.002 ether, ItemType.Weapon);
        _addItem(3, "Hunter Rifle", 0.003 ether, ItemType.Weapon);
        _addItem(101, "First Aid Bottle", 0.0003 ether, ItemType.Consumable);
        _addItem(102, "Heavy Ammo Pack", 0.0002 ether, ItemType.Consumable);
        _addItem(103, "Merchant Charm", 0.0005 ether, ItemType.Consumable);
    }

    function registerPlayer(string memory name) external {
        require(!players[msg.sender].registered, "Already registered");
        require(bytes(name).length > 0, "Name is required");

        players[msg.sender] = Player({
            name: name,
            registered: true
        });

        emit PlayerRegistered(msg.sender, name);
    }

    function buyItem(uint256 itemId) external payable onlyRegistered {
        Item memory item = items[itemId];
        require(item.exists, "Item does not exist");
        require(msg.value >= item.price, "Not enough ETH");

        if (item.itemType == ItemType.Weapon) {
            require(itemQuantities[msg.sender][itemId] == 0, "Weapon already owned");
            itemQuantities[msg.sender][itemId] = 1;
            playerWeaponStats[msg.sender][itemId] = _baseStats(itemId);
        } else {
            itemQuantities[msg.sender][itemId] += 1;
        }

        emit ItemPurchased(msg.sender, itemId, item.name, item.price);
    }

    function sellItem(uint256 itemId) external onlyRegistered nonReentrant {
        Item memory item = items[itemId];
        require(item.exists, "Item does not exist");
        require(itemQuantities[msg.sender][itemId] > 0, "Item not owned");

        uint256 refund = item.price / 2;
        require(address(this).balance >= refund, "Shop has insufficient balance");

        itemQuantities[msg.sender][itemId] -= 1;

        if (item.itemType == ItemType.Weapon && itemQuantities[msg.sender][itemId] == 0) {
            delete playerWeaponStats[msg.sender][itemId];
        }

        (bool success, ) = payable(msg.sender).call{value: refund}("");
        require(success, "Refund failed");

        emit ItemSold(msg.sender, itemId, item.name, refund);
    }

    function upgradeWeapon(uint256 weaponId, uint8 upgradeType) external payable onlyRegistered {
        Item memory item = items[weaponId];
        require(item.exists, "Item does not exist");
        require(item.itemType == ItemType.Weapon, "Item is not a weapon");
        require(itemQuantities[msg.sender][weaponId] > 0, "Weapon not owned");
        require(upgradeType <= 4, "Invalid upgrade type");

        uint256 cost = getUpgradeCost(upgradeType);
        require(msg.value >= cost, "Not enough ETH");

        WeaponStats storage stats = playerWeaponStats[msg.sender][weaponId];
        string memory upgradeName;
        uint256 newValue;

        if (upgradeType == 0) {
            stats.power += 10;
            upgradeName = "Power";
            newValue = stats.power;
        } else if (upgradeType == 1) {
            stats.fireRate += 1;
            upgradeName = "Fire Rate";
            newValue = stats.fireRate;
        } else if (upgradeType == 2) {
            stats.reloadSpeed += 1;
            upgradeName = "Reload Speed";
            newValue = stats.reloadSpeed;
        } else if (upgradeType == 3) {
            stats.capacity += 5;
            upgradeName = "Capacity";
            newValue = stats.capacity;
        } else {
            require(!stats.exclusive, "Exclusive upgrade already applied");
            stats.exclusive = true;
            stats.power += 25;
            stats.capacity += 10;
            upgradeName = "Exclusive";
            newValue = 1;
        }

        emit WeaponUpgraded(msg.sender, weaponId, upgradeName, newValue);
    }

    function getPlayer(address user) external view returns (string memory name, bool registered) {
        Player memory player = players[user];
        return (player.name, player.registered);
    }

    function getItemQuantity(address user, uint256 itemId) external view returns (uint256) {
        return itemQuantities[user][itemId];
    }

    function getWeaponStats(address user, uint256 weaponId) external view returns (
        uint256 power,
        uint256 fireRate,
        uint256 reloadSpeed,
        uint256 capacity,
        bool exclusive
    ) {
        require(items[weaponId].exists, "Item does not exist");
        require(items[weaponId].itemType == ItemType.Weapon, "Item is not a weapon");

        WeaponStats memory stats = playerWeaponStats[user][weaponId];
        return (stats.power, stats.fireRate, stats.reloadSpeed, stats.capacity, stats.exclusive);
    }

    function getItemInfo(uint256 itemId) external view returns (
        uint256 id,
        string memory name,
        uint256 price,
        ItemType itemType,
        bool exists
    ) {
        Item memory item = items[itemId];
        return (item.id, item.name, item.price, item.itemType, item.exists);
    }

    function getAllItemIds() external view returns (uint256[] memory) {
        return allItemIds;
    }

    function getContractBalance() external view onlyOwner returns (uint256) {
        return address(this).balance;
    }

    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "No ETH to withdraw");

        (bool success, ) = payable(owner).call{value: balance}("");
        require(success, "Withdraw failed");
    }

    receive() external payable {}

    function getUpgradeCost(uint8 upgradeType) public pure returns (uint256) {
        require(upgradeType <= 4, "Invalid upgrade type");

        if (upgradeType == 0) {
            return 0.0004 ether;
        }
        if (upgradeType == 1) {
            return 0.0003 ether;
        }
        if (upgradeType == 2) {
            return 0.0003 ether;
        }
        if (upgradeType == 3) {
            return 0.0005 ether;
        }

        return 0.0015 ether;
    }

    function _addItem(uint256 id, string memory name, uint256 price, ItemType itemType) private {
        require(!items[id].exists, "Item already exists");

        items[id] = Item({
            id: id,
            name: name,
            price: price,
            itemType: itemType,
            exists: true
        });

        allItemIds.push(id);
    }

    function _baseStats(uint256 weaponId) private pure returns (WeaponStats memory) {
        if (weaponId == 1) {
            return WeaponStats(30, 1, 1, 6, false);
        }
        if (weaponId == 2) {
            return WeaponStats(55, 1, 1, 8, false);
        }
        if (weaponId == 3) {
            return WeaponStats(80, 1, 1, 5, false);
        }

        return WeaponStats(1, 1, 1, 1, false);
    }
}

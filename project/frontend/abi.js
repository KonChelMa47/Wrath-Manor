const RE4_MERCHANT_SHOP_ABI = [
  "function registerPlayer(string name) external",
  "function buyItem(uint256 itemId) external payable",
  "function sellItem(uint256 itemId) external",
  "function upgradeWeapon(uint256 weaponId, uint8 upgradeType) external payable",
  "function getPlayer(address user) external view returns (string name, bool registered)",
  "function getItemQuantity(address user, uint256 itemId) external view returns (uint256)",
  "function getWeaponStats(address user, uint256 weaponId) external view returns (uint256 power, uint256 fireRate, uint256 reloadSpeed, uint256 capacity, bool exclusive)",
  "function getItemInfo(uint256 itemId) external view returns (uint256 id, string name, uint256 price, uint8 itemType, bool exists)",
  "function getAllItemIds() external view returns (uint256[])",
  "function getUpgradeCost(uint8 upgradeType) external pure returns (uint256)",
  "function getContractBalance() external view returns (uint256)",
  "function withdraw() external",
  "event PlayerRegistered(address indexed player, string name)",
  "event ItemPurchased(address indexed player, uint256 indexed itemId, string itemName, uint256 price)",
  "event ItemSold(address indexed player, uint256 indexed itemId, string itemName, uint256 refund)",
  "event WeaponUpgraded(address indexed player, uint256 indexed weaponId, string upgradeName, uint256 newValue)"
];

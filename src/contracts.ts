import { parseAbi } from 'viem';

export const MINING_GAME_ABI = parseAbi([
  "function submitScore(uint256 score, uint8 level) external",
  "function dailyCheckIn() external",
  "function getPlayer(address playerAddr) external view returns (uint256 personalBest, uint256 totalScore, uint256 lastCheckIn, uint16 currentStreak, uint16 bonusBombs, uint16 bonusStars)",
  "function getLeaderboard() external view returns (tuple(address playerAddr, uint256 totalScore)[10])",
  "function canCheckIn(address playerAddr) public view returns (bool)",
  "function secondsUntilNextCheckIn(address playerAddr) public view returns (uint256)"
]);

// Placeholder for deployed address - this will need to be updated after deployment
export const MINING_GAME_ADDRESS = "0x0000000000000000000000000000000000000000";


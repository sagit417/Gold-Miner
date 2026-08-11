// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MiningGame {
    struct Player {
        uint256 personalBest;
        uint256 totalScore;
        uint256 lastCheckIn;
        uint16 currentStreak;
        uint16 bonusBombs;
        uint16 bonusStars;
    }

    mapping(address => Player) public players;
    
    struct LeaderboardEntry {
        address playerAddr;
        uint256 totalScore;
    }

    LeaderboardEntry[10] public leaderboard;

    event ScoreSubmitted(address indexed player, uint256 score, uint8 level, uint256 totalScore);
    event CheckedIn(address indexed player, uint16 streak, uint16 bombsAwarded, uint16 starsAwarded, uint256 coinsAwarded);

    function submitScore(uint256 score, uint8 level) external {
        require(score > 0, "Score must be greater than 0");
        
        Player storage p = players[msg.sender];
        
        if (score > p.personalBest) {
            p.personalBest = score;
        }
        
        p.totalScore += score;

        _updateLeaderboard(msg.sender, p.totalScore);

        emit ScoreSubmitted(msg.sender, score, level, p.totalScore);
    }

    function dailyCheckIn() external {
        require(canCheckIn(msg.sender), "Check-in not available yet");
        
        Player storage p = players[msg.sender];
        
        // Calculate streak
        if (p.lastCheckIn == 0 || block.timestamp > p.lastCheckIn + 48 hours) {
            // Missed a day or first time, reset streak
            p.currentStreak = 1;
        } else {
            // Within 24-48 hours, increment streak
            p.currentStreak += 1;
        }
        
        p.lastCheckIn = block.timestamp;
        
        // Awards: +1 bomb, +1 star life, and +50 bonus coins
        uint16 bombsAwarded = 1;
        uint16 starsAwarded = 1;
        uint256 coinsAwarded = 50;

        // Streak bonus: every 7-day streak gives +1 extra star life
        if (p.currentStreak % 7 == 0) {
            starsAwarded += 1;
        }

        p.bonusBombs += bombsAwarded;
        p.bonusStars += starsAwarded;
        p.totalScore += coinsAwarded; // Bonus coins add to total score?
        // Or should coins just be added to their next game? The prompt says "adds to cumulative all-time score"
        // Let's add it to totalScore directly so it reflects on the leaderboard
        
        _updateLeaderboard(msg.sender, p.totalScore);

        emit CheckedIn(msg.sender, p.currentStreak, bombsAwarded, starsAwarded, coinsAwarded);
    }

    function _updateLeaderboard(address player, uint256 newTotalScore) internal {
        // Find if player is already on leaderboard
        int256 playerIndex = -1;
        for (uint256 i = 0; i < 10; i++) {
            if (leaderboard[i].playerAddr == player) {
                playerIndex = int256(i);
                break;
            }
        }

        if (playerIndex != -1) {
            // Update existing entry
            leaderboard[uint256(playerIndex)].totalScore = newTotalScore;
            // Shift up if necessary
            for (uint256 i = uint256(playerIndex); i > 0; i--) {
                if (leaderboard[i].totalScore > leaderboard[i - 1].totalScore) {
                    LeaderboardEntry memory temp = leaderboard[i - 1];
                    leaderboard[i - 1] = leaderboard[i];
                    leaderboard[i] = temp;
                } else {
                    break;
                }
            }
        } else {
            // Check if better than last place
            if (newTotalScore > leaderboard[9].totalScore) {
                leaderboard[9] = LeaderboardEntry(player, newTotalScore);
                // Shift up
                for (uint256 i = 9; i > 0; i--) {
                    if (leaderboard[i].totalScore > leaderboard[i - 1].totalScore) {
                        LeaderboardEntry memory temp = leaderboard[i - 1];
                        leaderboard[i - 1] = leaderboard[i];
                        leaderboard[i] = temp;
                    } else {
                        break;
                    }
                }
            }
        }
    }

    function getPlayer(address playerAddr) external view returns (
        uint256 personalBest,
        uint256 totalScore,
        uint256 lastCheckIn,
        uint16 currentStreak,
        uint16 bonusBombs,
        uint16 bonusStars
    ) {
        Player storage p = players[playerAddr];
        return (
            p.personalBest,
            p.totalScore,
            p.lastCheckIn,
            p.currentStreak,
            p.bonusBombs,
            p.bonusStars
        );
    }

    function getLeaderboard() external view returns (LeaderboardEntry[10] memory) {
        return leaderboard;
    }

    function canCheckIn(address playerAddr) public view returns (bool) {
        Player storage p = players[playerAddr];
        if (p.lastCheckIn == 0) return true;
        return block.timestamp >= p.lastCheckIn + 24 hours;
    }
    
    function secondsUntilNextCheckIn(address playerAddr) public view returns (uint256) {
        Player storage p = players[playerAddr];
        if (p.lastCheckIn == 0) return 0;
        uint256 nextTime = p.lastCheckIn + 24 hours;
        if (block.timestamp >= nextTime) return 0;
        return nextTime - block.timestamp;
    }
}

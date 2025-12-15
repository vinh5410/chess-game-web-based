// Elo Rating Calculator
// This module provides functions to calculate Elo ratings for players.

/**
 * Calculate the new Elo ratings for two players after a game.
 * @param {number} playerRating - Current rating of the player.
 * @param {number} opponentRating - Current rating of the opponent.
 * @param {number} score - The score of the player (1 for win, 0.5 for draw, 0 for loss).
 * @param {number} kFactor - The K-factor used to adjust rating changes.
 * @returns {number} - The new rating of the player.
 */
function calculateElo(playerRating, opponentRating, score, kFactor = 32) {
    const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));
    return Math.round(playerRating + kFactor * (score - expectedScore));
}

module.exports = {
    calculateElo
};
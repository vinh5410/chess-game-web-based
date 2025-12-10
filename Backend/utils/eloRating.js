const getExpectedScore = (ratingA, ratingB) => {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
};

const calculateNewRating = (currentRating, actualScore, expectedScore, kFactor = 32) => {
    return Math.round(currentRating + kFactor * (actualScore - expectedScore));
};

module.exports = { getExpectedScore, calculateNewRating };
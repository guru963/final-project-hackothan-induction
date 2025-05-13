// utils/colorService.js
const getCurrentColor = (colors = ["red", "green", "blue"]) => {
    try {
        const index = Math.floor(Date.now() / 30000) % colors.length;
        if (!colors[index]) {
            throw new Error('Color index out of bounds');
        }
        return colors[index];
    } catch (error) {
        console.error('Color calculation error:', error);
        throw error;
    }
};

module.exports = { getCurrentColor };
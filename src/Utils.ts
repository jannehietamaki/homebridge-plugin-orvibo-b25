module.exports.generateRandomTextValue = function(length) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  for (let i = length; i > 0; --i) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

module.exports.generateRandomHexValue = function(length) {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = length; i > 0; --i) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

module.exports.generateRandomNumber = function(length) {
  const numbers = '0123456789';
  let result = '';
  for (let i = length; i > 0; --i) {
    result += numbers[Math.floor(Math.random() * numbers.length)];
  }
  return parseInt(result);
};


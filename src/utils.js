function times(count, fn) {
  return Array(count)
    .fill()
    .forEach((_, index) => fn(index));
}

module.exports = {
  times
};

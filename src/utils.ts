function times(count, fn) {
  return Array(count)
    .fill()
    .forEach((_, index) => fn(index));
}

function jsonParse(str) {
  let obj;
  try {
    obj = JSON.parse(str);
  } catch (err) {}
  return obj;
}

module.exports = {
  times,
  jsonParse
};

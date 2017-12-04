const { SqsParallel } = require("../src");

const queue = new SqsParallel({
  concurrency: 4
});
queue.on("message", () => {
  console.log("SHLAM");
});

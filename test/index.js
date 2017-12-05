const { SqsParallel } = require("../src");

const queue = new SqsParallel({
  region: "eu-west-1",
  name: "sallar",
  concurrency: 4,
  debug: true
});
queue.on("message", () => {
  console.log("GOT MESSAGE");
});

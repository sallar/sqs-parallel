const { SQS } = require("aws-sdk");
const { EventEmitter } = require("events");
const { times } = require("./utils");

class SqsParallel extends EventEmitter {
  constructor(config = {}) {
    super();
    this.client = null;
    this.url = null;
    this.config = Object.assign(
      {
        region: process.env.AWS_REGION,
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_KEY,
        visibilityTimeout: null,
        waitTimeSeconds: 20,
        maxNumberOfMessages: 1,
        name: "",
        concurrency: 1,
        debug: false
      },
      config
    );

    this.on("newListener", name => {
      if (name !== "message") {
        return;
      }
      if (this.client === null || this.listeners("message").length === 1) {
        return this.connect().then(() => {
          times(this.config.concurrency || 1, index => this.readQueue(index));
        });
      }
    });
  }

  connect() {
    return new Promise((resolve, reject) => {
      resolve();
    });
  }

  readQueue(index) {
    console.log("spinning up " + index);
  }
}

module.exports = {
  SqsParallel
};

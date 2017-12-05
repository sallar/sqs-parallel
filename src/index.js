const { SQS } = require("aws-sdk");
const { EventEmitter } = require("events");
const { times } = require("./utils");
const debug = require("debug");

const log = debug("sqs-parallel:log");
const error = debug("sqs-parallel:error");

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
        return this.connect()
          .then(() => {
            times(this.config.concurrency || 1, index => this.readQueue(index));
          })
          .catch(err => {
            this.emit("error", err);
          });
      }
    });

    if (this.config.debug) {
      this.on("error", err => error(err));
      this.on("connection", queues => log("Connecting...", queues));
      this.on("connect", queue => log("Connected", queue));
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.url) {
        this.once("connect", () => resolve());
        if (this.client && !this.url) {
          return;
        }
      }
      this.client = new SQS({
        region: this.config.region,
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      });
      this.client.listQueues(
        { QueueNamePrefix: this.config.name },
        (err, data) => {
          if (err) {
            return reject(err);
          }
          if (!data.QueueUrls) {
            return reject("No queues have been found.");
          }
          this.emit("connection", data.QueueUrls);
          const re = new RegExp(`/[\\d]+/${this.config.name}$`);
          const url = data.QueueUrls.find(item => re.test(item));
          if (url) {
            this.emit("connect", url);
            this.url = url;
            resolve();
          } else {
            reject(new Error("Queue not found."));
          }
        }
      );
    });
  }

  readQueue(index) {
    console.log("spinning up " + index);
  }
}

module.exports = {
  SqsParallel
};

const { SQS } = require('aws-sdk');
const { EventEmitter } = require('events');
const { times, jsonParse } = require('./utils');
const debug = require('debug');

const log = debug('sqs-parallel:log');
const error = debug('sqs-parallel:error');

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
        name: '',
        concurrency: 1,
        debug: false
      },
      config
    );

    this.on('newListener', name => {
      if (name !== 'message') {
        return;
      }
      if (this.client === null || this.listeners('message').length === 1) {
        return this.connect()
          .then(() => {
            times(this.config.concurrency || 1, index => this.readQueue(index));
          })
          .catch(err => {
            this.emit('error', err);
          });
      }
    });

    if (this.config.debug) {
      this.on('error', err => error(err));
      this.on('connection', queues => log('Connecting...', queues));
      this.on('connect', queue => log('Connected', queue));
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.url) {
        this.once('connect', () => resolve());
        if (this.client && !this.url) {
          return;
        }
      }
      if (this.client) {
        return resolve();
      }
      this.client = new SQS({
        region: this.config.region,
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey
      });
      this.client
        .getQueueUrl({
          QueueName: this.config.name
        })
        .promise()
        .then(data => {
          this.emit('connect', data.QueueUrl);
          this.url = data.QueueUrl;
        })
        .catch(err => reject(err));
    });
  }

  readQueue(index) {
    // Call myself on next tick helper
    const next = () => {
      process.nextTick(() => this.readQueue(index));
    };
    // No listeners or hasn't been connected yet.
    if (this.listeners('message').length === 0 || !this.url) {
      return;
    }
    this.client
      .receiveMessage({
        QueueUrl: this.url,
        AttributeNames: ['All'],
        MaxNumberOfMessages: this.config.maxNumberOfMessages,
        WaitTimeSeconds: this.config.waitTimeSeconds,
        VisibilityTimeout:
          this.config.visibilityTimeout !== null
            ? this.config.visibilityTimeout
            : undefined
      })
      .promise()
      .then(data => {
        if (this.config.debug) {
          log('Received message from remote queue', data);
        }
        if (!Array.isArray(data.Messages) || data.Messages.length === 0) {
          return next();
        }
        // Emit each message
        data.Messages.forEach(message => {
          this.emit('message', {
            type: 'Message',
            data: jsonParse(message.Body) || message.Body,
            message,
            metadata: data.ResponseMetadata,
            url: this.url,
            name: this.config.name,
            workerIndex: index,
            next,
            deleteMessage: () => this.deleteMessage(message.ReceiptHandle),
            delay: timeout =>
              this.changeMessageVisibility(message.ReceiptHandle, timeout),
            changeMessageVisibility: timeout =>
              this.changeMessageVisibility(message.ReceiptHandle, timeout)
          });
        });
      })
      .catch(err => {
        this.emit('error', err);
      });
  }

  sendMessage(message = {}) {
    if (message === null) {
      message = {};
    }
    return this.connect().then(() => {
      return this.client
        .sendMessage({
          MessageBody: JSON.stringify(message.body || {}),
          QueueUrl: this.url,
          DelaySeconds: typeof message.delay === 'number' ? message.delay : 0
        })
        .promise();
    });
  }

  deleteMessage(receiptHandle) {
    return this.connect().then(() => {
      return this.client
        .deleteMessage({
          QueueUrl: this.url,
          ReceiptHandle: receiptHandle
        })
        .promise();
    });
  }

  changeMessageVisibility(receiptHandle, timeout = 30) {
    return this.connect().then(() => {
      return this.client
        .changeMessageVisibility({
          QueueUrl: this.url,
          ReceiptHandle: receiptHandle,
          VisibilityTimeout: timeout
        })
        .promise();
    });
  }
}

module.exports = {
  SqsParallel
};

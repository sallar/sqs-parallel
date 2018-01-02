import { SQS, AWSError, Response } from 'aws-sdk';
import { EventEmitter } from 'events';
import { times, jsonParse } from './utils';
import * as debug from 'debug';

const log = debug('sqs-parallel:log');
const error = debug('sqs-parallel:error');

export type OutgoingMessage = {
  delay: number;
  body: any;
}

export class SqsParallel extends EventEmitter {
  private client: SQS | null;
  private url: string | null;
  private config: any;

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

    this.on('newListener', (name: string) => {
      if (name !== 'message') {
        return;
      }
      if (this.client === null || this.listeners('message').length === 1) {
        return this.connect()
          .then(() => {
            times(this.config.concurrency || 1, (index: number) => this.readQueue(index));
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

  connect(): Promise<SQS> {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.url) {
        this.once('connect', () => resolve(this.client!));
        if (this.client && !this.url) {
          return;
        }
      }
      if (this.client) {
        return resolve(this.client);
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
          this.emit('connect', data.QueueUrl!);
          this.url = data.QueueUrl!;
        })
        .catch(err => reject(err));
    });
  }

  readQueue(index: number) {
    // Call myself on next tick helper
    const next = () => {
      process.nextTick(() => this.readQueue(index));
    };

    // No listeners or hasn't been connected yet.
    if (this.listeners('message').length === 0 || !this.url) {
      return;
    }

    if (this.client === null) {
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
            data: jsonParse(message.Body!) || message.Body,
            message,
            url: this.url,
            name: this.config.name,
            workerIndex: index,
            next,
            deleteMessage: () => this.deleteMessage(message.ReceiptHandle!),
            delay: (timeout: number) =>
              this.changeMessageVisibility(message.ReceiptHandle!, timeout),
            changeMessageVisibility: (timeout: number) =>
              this.changeMessageVisibility(message.ReceiptHandle!, timeout)
          });
        });
      })
      .catch(err => {
        this.emit('error', err);
      });
  }

  sendMessage(message: OutgoingMessage) {
    if (!message) {
      message = {
        body: {},
        delay: 0
      };
    }
    return this.connect().then(client => {
      return client
        .sendMessage({
          MessageBody: JSON.stringify(message.body),
          QueueUrl: this.url!,
          DelaySeconds: typeof message.delay === 'number' ? message.delay : 0
        })
        .promise();
    });
  }

  deleteMessage(receiptHandle: string) {
    return this.connect().then(client => {
      return client
        .deleteMessage({
          QueueUrl: this.url!,
          ReceiptHandle: receiptHandle
        })
        .promise();
    });
  }

  changeMessageVisibility(receiptHandle: string, timeout = 30) {
    return this.connect().then(client => {
      return client
        .changeMessageVisibility({
          QueueUrl: this.url!,
          ReceiptHandle: receiptHandle,
          VisibilityTimeout: timeout
        })
        .promise();
    });
  }
}

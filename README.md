# sqs-parallel

[![Build Status](https://travis-ci.org/sallar/sqs-parallel.svg?branch=master)](https://travis-ci.org/sallar/sqs-parallel)

🔥 Since
[bigluck/sqs-queue-parallel](https://github.com/bigluck/sqs-queue-parallel) is
dead and no one is checking the issues and PRs, I decided to:

* Rewrite the library in plain JS (look ma! no coffeescript!)
* Fix bugs and issues reported by users of that repo
* Consider including the proposed PRs
* Change callback style methods to return `Promise`s.

---

sqs-parallel is a **node.js** library build on top of **Amazon AWS SQS** with
**concurrency** and **parallel** message poll support.

You can create a poll of SQS queue watchers, each one can receive 1 or more
messages from Amazon SQS.

With sqs-parallel you need just to configure your AWS private keys, setup one or
more `message` event listeners and wait for new messages to arrive.

## Install

```bash
npm install sqs-parallel --save
```

## Example

```js
const { SqsParallel } = require('sqs-parallel');

// Simple configuration:
//  - 2 concurrency listeners
//  - each listener can receive up to 4 messages
// With this configuration you could receive and parse 8 `message` events in parallel
const queue = new SqsParallel({
  name: 'sqs-test',
  maxNumberOfMessages: 4,
  concurrency: 2
});

queue.on('message', e => {
  console.log('New message: ', e.metadata, e.data.MessageId);
  e.deleteMessage().then(() => {
    e.next();
  });
});

queue.on('error', err => {
  console.log('There was an error: ', err);
});
```

## License

This software is released under the [MIT License](LICENSE).

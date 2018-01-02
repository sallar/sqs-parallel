const { SqsParallel } = require('../dist');
const assert = require('assert');

const RAND = new Date().getSeconds();

const queue = new SqsParallel({
  region: 'eu-west-1',
  name: 'test-queue',
  concurrency: 1,
  debug: true
});
queue.on('error', err => {
  console.error(err);
  process.exit(1);
});
queue.on('message', message => {
  assert.equal(typeof message.data, 'object', 'An object should be received');
  assert.equal(message.data.time, RAND, 'Received data must be same as sent');
  message.deleteMessage().then(msg => {
    assert.ok(msg, 'Message should be deleted');
  });
});
queue
  .sendMessage({
    body: {
      time: RAND
    }
  })
  .then(res => {
    assert.ok(res, 'Message should be sent');
  });

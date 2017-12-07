const { SqsParallel } = require('../src');

const queue = new SqsParallel({
  region: 'eu-west-1',
  name: 'sallar',
  concurrency: 4,
  debug: true
});
queue.on('message', message => {
  message.deleteMessage().then(() => {
    console.log('deleted');
    message.next();
  });
});

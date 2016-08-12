module.exports.setup = (program) => {
  return program
    .command('cancel-task-group <taskGroupId>')
    .description('Cancel all pending or running tasks in a task group');
};

module.exports.run = async (taskGroupId) => {
  var taskcluster = require('taskcluster-client');
  var queue = new taskcluster.Queue();
  var chalk = require('chalk');
  var continuationToken;

  var cancellations = [];
  do {
    let result = await queue.listTaskGroup(taskGroupId, continuationToken? {continuationToken} : {});
    continuationToken = result.continuationToken;
    for (let task of result.tasks) {
      if (["pending", "running"].indexOf(task.status.state) !== -1) {
        console.log(`cancelling ${task.status.taskId}`);
        cancellations.push(queue.cancelTask(task.status.taskId));
      }
    }
  } while(continuationToken)

  console.log(`waiting for ${cancellations.length} to finish`);
  await Promise.all(cancellations);
};



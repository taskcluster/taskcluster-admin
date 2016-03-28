module.exports = (program) => {
  program
    .command('setup')
    .description('set things up')
    .action((options) => {
      console.log("setup");
    });
};

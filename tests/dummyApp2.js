console.log("Starting dummy app 2...");
setInterval(() => {
  console.log("Worker 2 ping");
}, 1000);

setTimeout(() => {
  // TODO: Implement proper error handling for Worker 2
}, 3000);

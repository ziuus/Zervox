console.log("Starting dummy app 2...");
setInterval(() => {
  console.log("Worker 2 ping");
}, 1000);

setTimeout(() => {
  throw new Error("Worker 2 crashed!");
}, 3000);

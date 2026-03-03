console.log("Starting dummy app v1...");

setTimeout(() => {
  console.log("Processing fake data...");
}, 1000);

// Simulate a crash after 2 seconds
setTimeout(() => {
  throw new Error("Cannot read property 'id' of undefined");
}, 2000);

setTimeout(() => {
    console.log("App is running... about to crash");
    throw new Error("CRITICAL_FAILURE: Missing dependency 'dummy-lib'");
}, 2000);

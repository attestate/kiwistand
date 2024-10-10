window.eventQueue = window.eventQueue || [];

function addToQueue(evt) {
  if (window.reactHasLoaded) {
    window.dispatchEvent(evt);
  } else {
    window.eventQueue.push(evt);
  }
}
window.addToQueue = addToQueue;

function processEventQueue() {
  if (window.reactHasLoaded) {
    window.eventQueue.forEach((evt) => {
      console.log(evt);
      window.dispatchEvent(evt);
    });
    window.eventQueue = [];
  } else {
    setTimeout(processEventQueue, 50);
  }
}
processEventQueue();

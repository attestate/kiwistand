// This script runs synchronously in <head> (no defer/async) so that
// window.addToQueue is available as soon as the DOM starts rendering.
// This allows upvote buttons and other interactive elements to queue
// events before main.jsx (React) has loaded and taken over.
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


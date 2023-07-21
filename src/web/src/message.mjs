export function showMessage(message, duration = 3000, isHTML = false) {
  const messageElement = document.createElement("div");
  
  if (isHTML) {
    messageElement.innerHTML = message;
  } else {
    messageElement.innerText = message;
  }

  messageElement.style.position = "fixed";
  messageElement.style.top = "50%";
  messageElement.style.left = "50%";
  messageElement.style.transform = "translate(-50%, -50%)";
  messageElement.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
  messageElement.style.color = "white";
  messageElement.style.padding = "8px 16px";
  messageElement.style.borderRadius = "3px";
  messageElement.style.textAlign = "center";
  messageElement.style.maxWidth = "80%";
  messageElement.style.zIndex = "9999";

  document.body.appendChild(messageElement);

  setTimeout(() => {
    document.body.removeChild(messageElement);
  }, duration);
}

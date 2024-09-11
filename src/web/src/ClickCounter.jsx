import React, { useEffect, useState } from "react";

const ClickCounter = ({ href, initialClicks }) => {
  const [clicks, setClicks] = useState(parseInt(initialClicks, 10));

  useEffect(() => {
    const increment = () => {
      setClicks(clicks + 1);
    };
    const listenerName = `click-increment-${href}`;
    window.addEventListener(listenerName, increment);
    return () => window.removeEventListener(listenerName, increment);
  });

  return (
    <span>
      {clicks} {clicks === 1 ? "click" : "clicks"}
    </span>
  );
};

export default ClickCounter;

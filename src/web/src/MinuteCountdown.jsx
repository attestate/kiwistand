import React, { useState, useEffect } from "react";

function Countdown() {
  const [time, setTime] = useState(59);

  useEffect(() => {
    if (time > 0) {
      const timer = setTimeout(() => setTime(time - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [time]);

  if (time === 0) {
    return (
      <div style={{ marginTop: "10px" }}>
        Taking longer than usual... <br />
        please bear with us!
      </div>
    );
  }
  return (
    <div style={{ marginTop: "10px" }}>
      Should take a minute... <br />
      {`0:${time.toString().padStart(2, "0")}`}
    </div>
  );
}

export default Countdown;

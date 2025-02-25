import React, { useState, useEffect } from "react";
import { fetchKarma } from "./API.mjs";

const Karma = ({ address, className, style, initial, children }) => {
  const [karma, setKarma] = useState(initial || null);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(false);

  useEffect(() => {
    const getKarma = async () => {
      if (!address) return;
      
      try {
        const data = await fetchKarma(address);
        if (data && data.karma !== undefined) {
          setKarma(data.karma);
          setUpdated(true);
        }
      } catch (err) {
        console.error("Error fetching karma:", err);
      } finally {
        setLoading(false);
      }
    };

    getKarma();
  }, [address]);

  // Use the children (which contains the initial value) until we've fetched the updated value
  if (!updated && children) {
    return <span className={className} style={style}>{children}</span>;
  }

  return (
    <span className={className} style={style}>
      {karma !== null ? karma : (initial || "?")}
    </span>
  );
};

export default Karma;

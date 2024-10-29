import { connect } from "@parcnet-js/app-connector";
import { ticketProofRequest } from "@parcnet-js/ticket-spec";
import { useEffect, useState } from "react";

import theme from "./theme.jsx";

let z = null;

export async function initZupass() {
  if (z) return z;

  const element = document.getElementById("zupass-connector");
  if (!element) throw new Error("Missing zupass-connector element");

  const zapp = {
    name: "Kiwi News",
    permissions: {
      REQUEST_PROOF: { collections: ["Tickets"] },
    },
  };

  z = await connect(zapp, element, "https://zupass.org");
  return z;
}

export async function verifyDevconTicket() {
  const z = await initZupass();

  const request = ticketProofRequest({
    classificationTuples: [
      {
        signerPublicKey: "YwahfUdUYehkGMaWh0+q3F8itx2h8mybjPmt8CmTJSs",
        eventId: "5074edf5-f079-4099-b036-22223c0c6995",
      },
    ],
    externalNullifier: {
      type: "string",
      value: crypto.randomUUID(),
    },
  });

  const proof = await z.gpc.prove({ request: request.schema });
  return !!proof.proof; // Returns true if proof exists
}

export function ZupassButton(props) {
  const { setHasTicket } = props;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validDiscount, setValidDiscount] = useState(false);

  useEffect(() => {
    const discountQuery = new URLSearchParams(window.location.search).get(
      "discount",
    );
    setValidDiscount(discountQuery === theme.discount.code);
  }, [window.location.search]);

  async function handleVerifyClick() {
    try {
      setLoading(true);
      setError("");
      const verified = await verifyDevconTicket();
      setHasTicket(verified);
      if (verified) {
        window.history.pushState({}, "", "?discount=devcon");
      }
    } catch (err) {
      console.log(err.stack);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      style={{
        backgroundColor: "#fcd270",
        color: "#19473f",
        border: "none",
        borderRadius: "8px",
        padding: "8px 16px",
        fontSize: "16px",
        fontWeight: "bold",
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        opacity: validDiscount ? "0.7" : "1",
      }}
      onClick={handleVerifyClick}
      disabled={loading}
    >
      {validDiscount
        ? "Verified!"
        : loading
        ? "Opening Zupass..."
        : "Verify Devcon Ticket"}
    </button>
  );
}

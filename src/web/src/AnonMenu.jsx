// The "Upvote anonymously" menu that a long press (or right click) on the
// heart opens, and the sheet it leads to. Loaded lazily from Vote.jsx so the
// heart, which is on every feed row, stays small.
import React, { useState } from "react";

const menuItemStyle = {
  position: "absolute",
  bottom: "calc(100% + 4px)",
  left: 0,
  zIndex: 21,
  whiteSpace: "nowrap",
  padding: "8px 12px",
  fontSize: "14px",
  color: "var(--text-primary)",
  background: "var(--bg-white)",
  border: "var(--border-thin)",
  borderRadius: "8px",
  boxShadow: "var(--shadow-default)",
  cursor: "pointer",
};

export default function AnonMenu(props) {
  const { onClose, toast } = props;
  const [Sheet, setSheet] = useState(null);

  if (Sheet) return <Sheet {...props} />;

  const openSheet = async () => {
    try {
      const { default: AnonUpvote } = await import("./AnonUpvote.jsx");
      setSheet(() => AnonUpvote);
    } catch (err) {
      toast?.error("Couldn't load anonymous upvotes");
      onClose();
    }
  };

  return (
    <>
      {/* NOTE: Closes on pointerdown, not click: after a long press the
          browser may send a click that would close it at once. */}
      <span
        onPointerDown={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 20 }}
      />
      <button
        className="anon-upvote-menu-item"
        onClick={openSheet}
        style={menuItemStyle}
      >
        Upvote anonymously
      </button>
    </>
  );
}

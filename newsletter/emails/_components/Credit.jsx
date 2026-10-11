import React from "react";
import { Text, Link } from "@react-email/components";

import { hasName } from "../../../src/credit.mjs";

// A quiet line under a story's byline when it's the submitter's first story
// ever, or their first after a long break (src/credit.mjs, computed in
// src/digest.mjs). Never rendered without a real name: no 0x addresses.
// NOTE: In _components so react-email doesn't export it as a template.
export default function Credit({ story = {} }) {
  const { credit } = story;
  if (!credit || !hasName(credit.name)) return null;
  if (credit.kind !== "new" && credit.kind !== "returning") return null;
  if (credit.kind === "returning" && !credit.away) return null;

  const href =
    story.submitterLink ||
    `https://news.kiwistand.com/upvotes?address=${story.identity}`;
  const name = (
    <Link href={href} className="k-link" style={nameStyle}><span><span className="k-link" style={{ color: '#000000' }}>{credit.name}</span></span></Link>
  );

  return (
    <Text className="k-muted k-credit" style={creditStyle}>
      {credit.kind === "new" ? (
        <>First story from {name} — welcome!</>
      ) : (
        <>{name} is back after {credit.away}</>
      )}
    </Text>
  );
}

const creditStyle = {
  fontSize: '9pt',
  lineHeight: '1.4',
  color: '#555555',
  margin: '8px 0 0 0',
  padding: '0 0 0 8px',
  borderLeft: '3px solid #AFC046',
};

const nameStyle = {
  fontWeight: 600,
  color: '#000000',
  textDecoration: 'none',
};

import { env } from "process";

import { eligible } from "@attestate/delegator2";

import { EIP712_MESSAGE } from "./constants.mjs";
import * as id from "./id.mjs";
import * as registry from "./chainstate/registry.mjs";
import log from "./logger.mjs";

async function getInvite() {
  const response = await fetch(
    `https://api.telegram.org/bot${env.TG_CHANNEL_TOKEN}/createChatInviteLink?chat_id=${env.TG_CHANNEL_ID}&creates_join_request=true`,
  );
  const data = await response.json();
  return data.result.invite_link;
}
export async function generateLink(message) {
  const signer = id.ecrecover(message, EIP712_MESSAGE);
  const allowlist = await registry.allowlist();
  const delegations = await registry.delegations();
  const identity = eligible(allowlist, delegations, signer);
  if (!identity) {
    throw new Error(
      "Body must include a validly signed message from an eligible signer.",
    );
  }

  let link;
  try {
    link = await getInvite();
  } catch (err) {
    log(`Failed on getInvite: ${err.toString()}`);
    throw new Error("Couldn't get invite link");
  }
  return link;
}

// @format
import { writeFile, readFile } from "fs/promises";
import { env } from "process";

import {
  createSecp256k1PeerId,
  exportToProtobuf,
  createFromProtobuf,
} from "@libp2p/peer-id-factory";
import { keccak256 } from "ethereum-cryptography/keccak.js";
import { toHex } from "ethereum-cryptography/utils.js";
import { encode } from "cbor-x";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { utils } from "ethers";
import canonicalize from "canonicalize";

import {
  SCHEMATA,
  EIP712_DOMAIN,
  EIP712_MESSAGE,
  EIP712_DELEGATION,
} from "./constants.mjs";

import log from "./logger.mjs";

const ajv = new Ajv();
addFormats(ajv);

export async function bootstrap(path) {
  let peerId;
  if (!path) {
    return await createSecp256k1PeerId();
  }

  try {
    peerId = await load(path);
  } catch (err) {
    if ((err.code = "ENOENT")) {
      peerId = await createSecp256k1PeerId();
      await store(path, peerId);
    } else {
      throw err;
    }
  }
  log(`Loaded id: ${peerId.toCID()}`);
  return peerId;
}

export async function store(path, id) {
  await writeFile(path, exportToProtobuf(id));
}

export async function load(path) {
  const content = await readFile(path);
  return createFromProtobuf(content);
}

export function toDigest(value) {
  const copy = canonicalize({ ...value });
  const canonical = encode(copy);
  const digest = toHex(keccak256(canonical));
  const index = `${value.timestamp.toString(16)}${digest}`;
  return {
    digest,
    canonical,
    index,
  };
}

export function create(title, href, type, timestamp) {
  const message = {
    title,
    href,
    type,
    timestamp,
  };
  return message;
}

export async function sign(signer, message, type) {
  const signature = await signer._signTypedData(EIP712_DOMAIN, type, message);
  return {
    ...message,
    signature,
  };
}

export function timelimit(timestamp) {
  const nowSecs = Date.now() / 1000;
  const toleranceSecs = parseInt(env.MAX_TIMESTAMP_DELTA_SECS, 10);
  const maxTimestampSecs = nowSecs + toleranceSecs;
  if (timestamp >= maxTimestampSecs) {
    const message = `timelimit: Message timestamp is more than "${toleranceSecs}" seconds in the future and so message is dropped: "${timestamp}"`;
    log(message);
    throw new Error(message);
  }
  return;
}

export function ecrecover(message, type) {
  const copy = { ...message };
  delete copy["signature"];
  const address = utils.verifyTypedData(
    EIP712_DOMAIN,
    type,
    copy,
    message.signature
  );
  return address;
}

const messageValidator = ajv.compile(SCHEMATA.message);
const delegationValidator = ajv.compile(SCHEMATA.delegation);
export function verify(message) {
  let result, type;
  if (message && message.type === "amplify") {
    result = messageValidator(message);
    type = EIP712_MESSAGE;
  } else if (
    message &&
    (message.type === "appoint" || message.type === "revoke")
  ) {
    result = delegationValidator(message);
    type = EIP712_DELEGATION;
  } else {
    const errMessage = `Couldn't match message type of message "${JSON.stringify(
      message
    )}"`;
    log(errMessage);
    throw new Error(errMessage);
  }

  if (!result) {
    const errMessage = `Wrongly formatted message: ${JSON.stringify(
      messageValidator.errors
    )}`;
    log(errMessage);
    throw new Error(errMessage);
  }

  return ecrecover(message, type);
}

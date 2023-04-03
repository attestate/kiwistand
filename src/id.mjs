// @format
import { writeFile, readFile } from "fs/promises";

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

import { SCHEMATA, EIP712_DOMAIN, EIP712_TYPES } from "./constants.mjs";

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
  const copy = { ...value };
  const canonical = encode(copy);
  const digest = toHex(keccak256(canonical));
  return {
    digest,
    canonical,
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

export async function sign(signer, message) {
  const signature = await signer._signTypedData(
    EIP712_DOMAIN,
    EIP712_TYPES,
    message
  );
  return {
    ...message,
    signature,
  };
}

const messageValidator = ajv.compile(SCHEMATA.message);
export function verify(message) {
  const result = messageValidator(message);
  if (!result) {
    const errMessage = `Wrongly formatted message: ${JSON.stringify(
      messageValidator.errors
    )}`;
    log(errMessage);
    throw new Error(errMessage);
  }
  const copy = { ...message };
  delete copy["signature"];
  const address = utils.verifyTypedData(
    EIP712_DOMAIN,
    EIP712_TYPES,
    copy,
    message.signature
  );
  return address;
}

// Builds gossip fixtures from real OP mainnet blocks with the OP Stack's own
// encoder and signer: SSZ envelope (op-service/eth), V1 block signature
// (op-service/signer) and snappy, as op-node publishes them. The signature
// comes from a throwaway key; its address is in the fixture.
package main

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strconv"

	"github.com/ethereum-optimism/optimism/op-service/eth"
	"github.com/ethereum-optimism/optimism/op-service/signer"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/golang/snappy"
	"github.com/holiman/uint256"
)

const rpcURL = "https://mainnet.optimism.io"

func call(method string, params []any, out any) {
	body, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
	res, err := http.Post(rpcURL, "application/json", bytes.NewReader(body))
	if err != nil {
		panic(err)
	}
	defer res.Body.Close()
	var env struct {
		Result json.RawMessage
		Error  any
	}
	if err := json.NewDecoder(res.Body).Decode(&env); err != nil {
		panic(err)
	}
	if env.Error != nil {
		panic(fmt.Sprint(env.Error))
	}
	if err := json.Unmarshal(env.Result, out); err != nil {
		panic(err)
	}
}

type header struct {
	ParentHash            common.Hash      `json:"parentHash"`
	Miner                 common.Address   `json:"miner"`
	StateRoot             common.Hash      `json:"stateRoot"`
	ReceiptsRoot          common.Hash      `json:"receiptsRoot"`
	LogsBloom             eth.Bytes256     `json:"logsBloom"`
	MixHash               common.Hash      `json:"mixHash"`
	Number                hexutil.Uint64   `json:"number"`
	GasLimit              hexutil.Uint64   `json:"gasLimit"`
	GasUsed               hexutil.Uint64   `json:"gasUsed"`
	Timestamp             hexutil.Uint64   `json:"timestamp"`
	ExtraData             hexutil.Bytes    `json:"extraData"`
	BaseFeePerGas         hexutil.Big      `json:"baseFeePerGas"`
	Hash                  common.Hash      `json:"hash"`
	BlobGasUsed           *hexutil.Uint64  `json:"blobGasUsed"`
	ExcessBlobGas         *hexutil.Uint64  `json:"excessBlobGas"`
	WithdrawalsRoot       *common.Hash     `json:"withdrawalsRoot"`
	ParentBeaconBlockRoot *common.Hash     `json:"parentBeaconBlockRoot"`
	Transactions          []*types.Transaction `json:"transactions"`
	Withdrawals           types.Withdrawals `json:"withdrawals"`
}

func main() {
	key, _ := crypto.GenerateKey()
	signerAddr := crypto.PubkeyToAddress(key.PublicKey)
	var fixtures []map[string]any
	for _, arg := range os.Args[1:] {
		n, _ := strconv.ParseUint(arg, 10, 64)
		var h header
		call("eth_getBlockByNumber", []any{hexutil.Uint64(n), true}, &h)
		txs := make([]eth.Data, len(h.Transactions))
		for i, tx := range h.Transactions {
			raw, err := tx.MarshalBinary()
			if err != nil {
				panic(err)
			}
			txs[i] = eth.Data(raw)
		}
		baseFee := (*big.Int)(&h.BaseFeePerGas)
		var fee eth.Uint256Quantity
		(*uint256.Int)(&fee).SetFromBig(baseFee)
		withdrawals := h.Withdrawals
		payload := &eth.ExecutionPayload{
			ParentHash:      h.ParentHash,
			FeeRecipient:    h.Miner,
			StateRoot:       eth.Bytes32(h.StateRoot),
			ReceiptsRoot:    eth.Bytes32(h.ReceiptsRoot),
			LogsBloom:       h.LogsBloom,
			PrevRandao:      eth.Bytes32(h.MixHash),
			BlockNumber:     eth.Uint64Quantity(h.Number),
			GasLimit:        eth.Uint64Quantity(h.GasLimit),
			GasUsed:         eth.Uint64Quantity(h.GasUsed),
			Timestamp:       eth.Uint64Quantity(h.Timestamp),
			ExtraData:       eth.BytesMax32(h.ExtraData),
			BaseFeePerGas:   fee,
			BlockHash:       h.Hash,
			Transactions:    txs,
			Withdrawals:     &withdrawals,
			BlobGasUsed:     (*eth.Uint64Quantity)(h.BlobGasUsed),
			ExcessBlobGas:   (*eth.Uint64Quantity)(h.ExcessBlobGas),
			WithdrawalsRoot: h.WithdrawalsRoot,
		}
		envelope := &eth.ExecutionPayloadEnvelope{ParentBeaconBlockRoot: h.ParentBeaconBlockRoot, ExecutionPayload: payload}
		var buf bytes.Buffer
		if _, err := envelope.MarshalSSZ(&buf); err != nil {
			panic(err)
		}
		raw := buf.Bytes()
		msg := signer.BlockSigningMessage{
			Domain:      signer.SigningDomainBlocksV1,
			ChainID:     eth.ChainIDFromUInt64(10),
			PayloadHash: signer.PayloadHash(raw),
		}
		hash := msg.ToSigningHash()
		sig, err := crypto.Sign(hash[:], key)
		if err != nil {
			panic(err)
		}
		// The verifier op-node runs on every gossiped block.
		block := signer.SignedP2PBlock{Raw: raw, Signature: eth.Bytes65(sig)}
		auth := &signer.OPStackP2PBlockAuthV1{Allowed: signerAddr, Chain: eth.ChainIDFromUInt64(10)}
		if err := block.VerifySignature(auth); err != nil {
			panic(err)
		}
		// OP mainnet has been on Isthmus (withdrawals root, topic /3/) since 2025.
		version := eth.BlockV4
		var decoded eth.ExecutionPayloadEnvelope
		if err := decoded.UnmarshalSSZ(version, uint32(len(raw)), bytes.NewReader(raw)); err != nil {
			panic(err)
		}
		data := append(append([]byte{}, sig...), raw...)
		fixtures = append(fixtures, map[string]any{
			"number":    uint64(h.Number),
			"hash":      h.Hash.Hex(),
			"txs":       len(txs),
			"version":   int(version) + 1,
			"signer":    signerAddr.Hex(),
			"signingHash": hash.Hex(),
			"gossip":    hex.EncodeToString(snappy.Encode(nil, data)),
		})
	}
	out, _ := json.MarshalIndent(fixtures, "", " ")
	fmt.Println(string(out))
}

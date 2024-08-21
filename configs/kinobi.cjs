const path = require("path");
const k = require("@metaplex-foundation/kinobi");

// Paths.
const clientDir = path.join(__dirname, "..", "clients");
const idlDir = path.join(__dirname, "..", "idls");

// Instanciate Kinobi.
const kinobi = k.createFromIdls([
  path.join(idlDir, "parity_issuance.json"),
  path.join(idlDir, "parity_staking.json"),
  path.join(idlDir, "pt_staking.json"),
]);

kinobi.update(
  new k.updateProgramsVisitor({
    parityIssuance: { name: "parityIssuance", prefix: "si" },
    parityStaking: { name: "parityStaking", prefix: "ss" },
    ptStaking: {name: "ptStaking", prefix: "ps"},
  })
);

// Update accounts.
kinobi.update(
  new k.updateAccountsVisitor({
    tokenManager: {
      seeds: [
        k.constantPdaSeedNodeFromString("token-manager")
      ],
    },
    poolManager: {
      seeds: [
        k.constantPdaSeedNodeFromString("pool-manager")
      ],
    },
    gatekeeper: {
      seeds: [
        k.constantPdaSeedNodeFromString("gatekeeper"),
        k.variablePdaSeedNode(
          "wallet",
          k.publicKeyTypeNode(),
          "The address of the gate_keeper wallet"
        ),
      ],
    },
    globalConfig: {
      seeds: [
        k.constantPdaSeedNodeFromString("global-config")
      ]
    },
    userStake: {
      seeds: [
        k.constantPdaSeedNodeFromString("user-stake"),
        k.variablePdaSeedNode(
          "user",
          k.publicKeyTypeNode(),
          "The address of the user wallet"
        ),
      ]
    }
  })
);

// Render JavaScript.
const jsDir = path.join(clientDir, "js", "src", "generated");
const prettier = require(path.join(clientDir, "js", ".prettierrc.json"));
kinobi.accept(new k.renderJavaScriptVisitor(jsDir, {
  prettier
}));

// Render Rust.
const crateDir = path.join(clientDir, "rust");
const rustDir = path.join(clientDir, "rust", "src", "generated");
kinobi.accept(
  new k.renderRustVisitor(rustDir, {
    formatCode: true,
    crateFolder: crateDir,
  })
);

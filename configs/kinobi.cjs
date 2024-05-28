const path = require("path");
const k = require("@metaplex-foundation/kinobi");

// Paths.
const clientDir = path.join(__dirname, "..", "clients");
const idlDir = path.join(__dirname, "..", "idls");

// Instanciate Kinobi.
const kinobi = k.createFromIdls([
  path.join(idlDir, "sold_issuance.json"),
  path.join(idlDir, "sold_staking.json"),
]);

kinobi.update(
  new k.updateProgramsVisitor({
    soldIssuance: { name: "soldIssuance", prefix: "si" },
    soldStaking: { name: "soldStaking", prefix: "ss" },
  })
);

// // Update accounts.
kinobi.update(
  new k.updateAccountsVisitor({
    tokenManager: {
      seeds: [
        k.constantPdaSeedNodeFromString("token-manager")
      ],
    },
  })
);

// Render JavaScript.
const jsDir = path.join(clientDir, "js", "src", "generated");
const prettier = require(path.join(clientDir, "js", ".prettierrc.json"));
kinobi.accept(new k.renderJavaScriptVisitor(jsDir, {
  prettier
}));

// Render Rust.
// const crateDir = path.join(clientDir, "rust");
// const rustDir = path.join(clientDir, "rust", "src", "generated");
// kinobi.accept(
//   new k.RenderRustVisitor(rustDir, {
//     formatCode: true,
//     crateFolder: crateDir,
//   })
// );
